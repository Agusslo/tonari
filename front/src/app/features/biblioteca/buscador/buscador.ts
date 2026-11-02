import { Component, computed, ElementRef, inject, input, output, signal, viewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, debounceTime, distinctUntilChanged, filter, of, Subject, switchMap, tap } from 'rxjs';
import { Anilist } from '../../../core/services/anilist';
import { IObra, TipoObra } from '../../../core/interfaces/biblioteca';
import { ImagenRespaldoDirective } from '../../../shared/directives/imagen-respaldo.directive';

// Buscador de anime o manga (con la API de AniList) para agregar a la biblioteca.
// No guarda nada: avisa al padre qué obra elegiste (output "agregar").
@Component({
  selector: 'app-buscador',
  imports: [ImagenRespaldoDirective],
  templateUrl: './buscador.html',
  styleUrl: './buscador.css',
})
export class Buscador implements AfterViewInit {
  private readonly anilist = inject(Anilist);

  readonly tipo = input.required<TipoObra>();
  // Los idAnilist que ya están en tu biblioteca: esos muestran "En tu biblioteca".
  readonly yaAgregadas = input<Set<number>>(new Set());
  // El idAnilist de la obra que se está agregando ahora (muestra el spinner).
  readonly agregando = input<number | null>(null);

  readonly agregar = output<IObra>();
  readonly cerrar = output<void>();

  protected readonly resultados = signal<IObra[]>([]);
  protected readonly buscando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly texto = signal('');
  protected readonly sinResultados = computed(
    () => !this.buscando() && !this.error() && this.texto().trim().length >= 3 && !this.resultados().length,
  );

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  // Cada tecla manda el texto a este "canal". Con RxJS se arma la búsqueda:
  //  - debounceTime(400): espera a que dejes de escribir 400 ms (no busca por cada letra;
  //    AniList permite unos 90 pedidos por minuto).
  //  - distinctUntilChanged: si el texto no cambió, no vuelve a buscar.
  //  - switchMap: si llega una búsqueda nueva, cancela la anterior que seguía en camino
  //    (así nunca se pisan resultados viejos sobre nuevos).
  private readonly busquedas = new Subject<string>();

  constructor() {
    this.busquedas
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        tap(() => this.error.set(null)),
        filter((texto) => {
          const largo = texto.trim().length >= 3; // con menos de 3 letras no busca
          if (!largo) this.resultados.set([]);
          return largo;
        }),
        tap(() => this.buscando.set(true)),
        switchMap((texto) =>
          this.anilist.buscar(this.tipo(), texto.trim()).pipe(
            catchError((error: HttpErrorResponse) => {
              this.error.set(
                error.status === 429
                  ? 'Muchas búsquedas seguidas. Esperá unos segundos y probá de nuevo.'
                  : 'El catálogo de anime no responde en este momento. Probá de nuevo en un rato.',
              );
              return of([] as IObra[]);
            }),
          ),
        ),
        takeUntilDestroyed(), // al cerrar el buscador, se deja de escuchar
      )
      .subscribe((obras) => {
        this.resultados.set(obras);
        this.buscando.set(false);
      });
  }

  ngAfterViewInit() {
    this.campo().nativeElement.focus(); // se abre listo para escribir
  }

  protected escribir(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.texto.set(valor);
    this.busquedas.next(valor);
  }
}
