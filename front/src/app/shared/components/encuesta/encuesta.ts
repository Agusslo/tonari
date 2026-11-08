import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicacionesApi } from '../../../core/services/publicaciones-api';
import IPublicacion, { IEncuesta } from '../../../core/interfaces/publicacion';
import { mensajeDeError } from '../../utils/errores-http';

// La encuesta de una publicación (extra).
//   - Antes de votar: las opciones como botones, SIN resultados (así no votás "al ganador").
//   - Después de votar o cuando cierra: barras con el porcentaje (el autor también vota).
// Qué se puede ver lo decide el back (encuesta.verResultados): si no votaste,
// los votos ni siquiera viajan, así que no se pueden espiar en la pestaña Red.
@Component({
  selector: 'app-encuesta',
  templateUrl: './encuesta.html',
  styleUrl: './encuesta.css',
})
export class Encuesta {
  private readonly api = inject(PublicacionesApi);

  readonly publicacionId = input.required<string>();
  readonly encuesta = input.required<IEncuesta>();
  readonly puedeVotar = input(true); // false sin sesión
  // Avisa al padre con la publicación actualizada (por si quiere guardarla en su lista).
  readonly votada = output<IPublicacion>();

  // Copia local: al votar se reemplaza con lo que devuelve el back. linkedSignal:
  // si el padre manda una encuesta nueva (por ejemplo, al dar Me gusta), se toma esa.
  protected readonly estado = linkedSignal(() => this.encuesta());
  protected readonly votando = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  // Cerrada: la(s) opción(es) con más votos quedan resaltadas (puede haber empate).
  protected readonly ganadoras = computed(() => {
    const { opciones, cerrada, totalVotos } = this.estado();
    if (!cerrada || totalVotos === 0) return new Set<number>();
    const maximo = Math.max(...opciones.map((opcion) => opcion.votos ?? 0));
    return new Set(opciones.flatMap((opcion, i) => (opcion.votos === maximo ? [i] : [])));
  });

  // "Quedan 5 h", "Quedan 2 días", "Cerró".
  protected readonly tiempo = computed(() => {
    const { cierra, cerrada } = this.estado();
    if (cerrada) return 'Encuesta cerrada';
    const minutos = Math.max(1, Math.round((new Date(cierra).getTime() - Date.now()) / 60_000));
    if (minutos < 60) return `Quedan ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `Quedan ${horas} h`;
    const dias = Math.round(horas / 24);
    return `Quedan ${dias} ${dias === 1 ? 'día' : 'días'}`;
  });

  porcentaje(votos: number | null) {
    const total = this.estado().totalVotos;
    return total && votos ? Math.round((votos * 100) / total) : 0;
  }

  votar(opcion: number) {
    if (this.votando() !== null || !this.puedeVotar()) return;
    this.votando.set(opcion);
    this.error.set(null);
    this.api.votar(this.publicacionId(), opcion).subscribe({
      next: (publicacion) => {
        this.votando.set(null);
        if (publicacion.encuesta) this.estado.set(publicacion.encuesta);
        this.votada.emit(publicacion);
      },
      error: (error: HttpErrorResponse) => {
        this.votando.set(null);
        this.error.set(mensajeDeError(error));
      },
    });
  }
}
