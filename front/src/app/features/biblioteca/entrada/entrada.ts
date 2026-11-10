import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { rutaFicha } from '../../../shared/utils/rutas';
import IEntrada, { ESTADOS, EstadoEntrada } from '../../../core/interfaces/biblioteca';
import { BibliotecaApi, CambiosEntrada } from '../../../core/services/biblioteca-api';
import { ProximoEpisodio } from '../../../core/services/anilist';
import { cuandoSale } from '../../../shared/utils/fechas';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { EstadoObraPipe } from '../../../shared/pipes/estado-obra.pipe';
import { ImagenRespaldoDirective } from '../../../shared/directives/imagen-respaldo.directive';

// Una obra de la biblioteca: portada, estado, progreso y puntuación.
// Cada cambio se guarda enseguida en el back; el back aplica las reglas
// (por ejemplo, si llegás al último episodio queda "Completado") y devuelve
// la obra actualizada, que avisamos al padre con "actualizada".
@Component({
  selector: 'app-entrada',
  imports: [RouterLink, EstadoObraPipe, ImagenRespaldoDirective],
  templateUrl: './entrada.html',
  styleUrl: './entrada.css',
  host: {
    '(document:click)': 'cerrarNotaSiAfuera($event)',
    '(document:keydown.escape)': 'notaAbierta.set(false)',
  },
})
export class Entrada {
  private readonly api = inject(BibliotecaApi);
  private readonly elemento = inject(ElementRef<HTMLElement>);

  readonly entrada = input.required<IEntrada>();
  // false cuando mirás la biblioteca de otro: solo lectura.
  readonly editable = input(true);
  // Anime en emisión: cuál es el próximo episodio y cuándo sale (null = no se está emitiendo).
  readonly proximo = input<ProximoEpisodio | null>(null);

  readonly actualizada = output<IEntrada>();
  readonly quitar = output<IEntrada>();

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notaAbierta = signal(false);

  protected readonly estados = ESTADOS;
  protected readonly rutaFicha = rutaFicha;
  protected readonly puntuaciones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // "ep." para anime, "cap." para manga.
  protected readonly unidad = computed(() => (this.entrada().tipo === 'anime' ? 'ep.' : 'cap.'));

  // Porcentaje para la barrita de progreso (solo si se sabe el total).
  protected readonly porcentaje = computed(() => {
    const { progreso, total } = this.entrada();
    return total ? Math.min(100, Math.round((progreso / total) * 100)) : null;
  });

  // Hasta qué episodio salió: si el próximo es el 7, salieron 6 (null = no se sabe / todos).
  protected readonly salidos = computed(() => {
    const proximo = this.proximo();
    return proximo ? proximo.episodio - 1 : null;
  });

  // El "+" se apaga al llegar al total... o al último episodio que salió.
  protected readonly puedeSumar = computed(() => {
    const { progreso, total } = this.entrada();
    const salidos = this.salidos();
    if (salidos !== null && progreso >= salidos) return false;
    return total === null || progreso < total;
  });

  // "Ep. 7 sale vie 11:00" debajo del contador.
  protected readonly textoProximo = computed(() => {
    const proximo = this.proximo();
    return proximo ? `Ep. ${proximo.episodio} sale ${cuandoSale(proximo.fecha)}` : null;
  });

  protected cambiarEstado(evento: Event) {
    this.guardar({ estado: (evento.target as HTMLSelectElement).value as EstadoEntrada });
  }

  protected elegirPuntuacion(puntuacion: number | null) {
    this.notaAbierta.set(false);
    if (puntuacion !== this.entrada().puntuacion) this.guardar({ puntuacion });
  }

  // El panel de nota se cierra al hacer clic afuera o con Escape.
  protected cerrarNotaSiAfuera(evento: MouseEvent) {
    if (this.notaAbierta() && !this.elemento.nativeElement.contains(evento.target as Node)) {
      this.notaAbierta.set(false);
    }
  }

  // +1 / -1 episodio o capítulo.
  protected mover(paso: 1 | -1) {
    const nuevo = this.entrada().progreso + paso;
    if (nuevo < 0 || this.guardando()) return;
    if (paso === 1 && !this.puedeSumar()) return;
    this.guardar({ progreso: nuevo });
  }

  private guardar(cambios: CambiosEntrada) {
    this.guardando.set(true);
    this.error.set(null);
    this.api.actualizar(this.entrada()._id, cambios).subscribe({
      next: (actualizada) => {
        this.guardando.set(false);
        this.actualizada.emit(actualizada);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }
}
