import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { BuscarApi, IResultadosBusqueda } from '../../../core/services/buscar-api';
import { Avatar } from '../avatar/avatar';
import { ClickAfueraDirective } from '../../directives/click-afuera.directive';
import { TiempoRelativoPipe } from '../../pipes/tiempo-relativo.pipe';
import { mensajeDeError } from '../../utils/errores-http';
import { urlCuadrada } from '../../utils/cloudinary';

// El estado de la búsqueda: escribiendo, esperando al back, con resultados o con error.
type Estado =
  | { tipo: 'inactivo' }
  | { tipo: 'cargando' }
  | { tipo: 'listo'; resultados: IResultadosBusqueda }
  | { tipo: 'error'; mensaje: string };

// Una opción del desplegable (para moverse con las flechas).
interface Opcion {
  id: string;
  ruta: string[];
}

// Mínimo de letras para buscar (el back pide lo mismo: 400 si son menos).
const MINIMO = 2;

// Buscador global (extra): en la barra de arriba, busca usuarios (por usuario,
// nombre o apellido) y publicaciones (por título) mientras escribís.
@Component({
  selector: 'app-buscador-global',
  imports: [Avatar, ClickAfueraDirective, TiempoRelativoPipe],
  templateUrl: './buscador-global.html',
  styleUrl: './buscador-global.css',
  host: { '(document:keydown)': 'atajo($event)' },
})
export class BuscadorGlobal {
  private readonly api = inject(BuscarApi);
  private readonly router = inject(Router);

  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  // La opción marcada con las flechas (-1 = ninguna).
  protected readonly marcada = signal(-1);

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  // Espera 300 ms sin teclear antes de ir al back (debounceTime) y, si escribís
  // otra cosa mientras tanto, se olvida de la búsqueda anterior (switchMap).
  protected readonly estado = toSignal(
    toObservable(this.texto).pipe(
      map((texto) => texto.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((texto) =>
        texto.length < MINIMO
          ? of<Estado>({ tipo: 'inactivo' })
          : this.api.buscar(texto).pipe(
              map((resultados): Estado => ({ tipo: 'listo', resultados })),
              catchError((error: HttpErrorResponse) =>
                of<Estado>({ tipo: 'error', mensaje: mensajeDeError(error) }),
              ),
              startWith<Estado>({ tipo: 'cargando' }),
            ),
      ),
    ),
    { initialValue: { tipo: 'inactivo' } as Estado },
  );

  protected readonly resultados = computed(() => {
    const estado = this.estado();
    return estado.tipo === 'listo' ? estado.resultados : null;
  });

  // Todas las opciones en orden (primero usuarios, después publicaciones).
  protected readonly opciones = computed<Opcion[]>(() => {
    const resultados = this.resultados();
    if (!resultados) return [];
    return [
      ...resultados.usuarios.map((u) => ({
        id: `u-${u._id}`,
        ruta: ['/usuarios', u.nombreUsuario],
      })),
      ...resultados.publicaciones.map((p) => ({
        id: `p-${p._id}`,
        ruta: ['/publicaciones', p._id],
      })),
    ];
  });

  protected readonly cortoParaBuscar = computed(() => {
    const largo = this.texto().trim().length;
    return largo > 0 && largo < MINIMO;
  });

  // Se muestra el panel si está abierto y hay algo escrito.
  protected readonly mostrarPanel = computed(
    () => this.abierto() && this.texto().trim().length > 0,
  );

  protected readonly idMarcada = computed(() => this.opciones()[this.marcada()]?.id ?? null);

  protected readonly miniatura = (url: string) => urlCuadrada(url, 80);

  protected escribir(evento: Event) {
    this.texto.set((evento.target as HTMLInputElement).value);
    this.marcada.set(-1);
    this.abierto.set(true);
  }

  // Flechas para moverse, Enter para abrir, Escape para cerrar.
  protected teclas(evento: KeyboardEvent) {
    const total = this.opciones().length;
    if (evento.key === 'ArrowDown' && total) {
      evento.preventDefault();
      this.abierto.set(true);
      this.marcada.update((i) => (i + 1) % total);
    } else if (evento.key === 'ArrowUp' && total) {
      evento.preventDefault();
      this.marcada.update((i) => (i <= 0 ? total - 1 : i - 1));
    } else if (evento.key === 'Enter') {
      const opcion = this.opciones()[this.marcada() === -1 ? 0 : this.marcada()];
      if (opcion) {
        evento.preventDefault();
        this.ir(opcion.ruta);
      }
    } else if (evento.key === 'Escape') {
      if (this.abierto() && this.texto()) {
        this.abierto.set(false);
      } else {
        this.limpiar();
        this.campo()?.nativeElement.blur();
      }
    }
  }

  // Atajo: "/" en cualquier lado (menos mientras escribís en otro campo) enfoca el buscador.
  protected atajo(evento: KeyboardEvent) {
    if (evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const destino = evento.target as HTMLElement | null;
    if (destino?.closest('input, textarea, select, [contenteditable="true"]')) return;
    evento.preventDefault();
    this.campo()?.nativeElement.focus();
  }

  protected ir(ruta: string[]) {
    this.router.navigate(ruta);
    this.limpiar();
    this.campo()?.nativeElement.blur();
  }

  protected limpiar() {
    this.texto.set('');
    this.marcada.set(-1);
    this.abierto.set(false);
  }

  protected indiceDe(id: string) {
    return this.opciones().findIndex((o) => o.id === id);
  }
}
