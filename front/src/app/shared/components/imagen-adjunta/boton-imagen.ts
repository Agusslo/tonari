import { Component, input } from '@angular/core';
import { ImagenAdjunta } from '../../utils/imagen-adjunta';

// El botoncito de "adjuntar imagen" de los comentarios y respuestas (extra).
// El <input type="file"> va ADENTRO del <label>: tocar el ícono abre el selector.
@Component({
  selector: 'app-boton-imagen',
  template: `
    <label class="boton-imagen" [class.activo]="adjunta().archivo()" title="Agregar imagen (o pegala con Ctrl+V)">
      <input
        type="file"
        class="solo-lector"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Agregar imagen (también podés pegarla con Ctrl+V)"
        (change)="adjunta().desdeInput($event)"
      />
      @if (adjunta().procesando()) {
        <span class="spinner" aria-hidden="true"></span>
      } @else {
        <svg class="icono" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="M21 16l-5-5-8 8" />
        </svg>
      }
    </label>
  `,
  styleUrl: './imagen-adjunta.css',
})
export class BotonImagen {
  readonly adjunta = input.required<ImagenAdjunta>();
}
