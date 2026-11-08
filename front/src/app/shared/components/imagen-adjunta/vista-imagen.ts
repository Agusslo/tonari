import { Component, input } from '@angular/core';
import { ImagenAdjunta } from '../../utils/imagen-adjunta';

// La vista previa de la imagen adjunta (con la X para sacarla) y su error, si hay.
@Component({
  selector: 'app-vista-imagen',
  template: `
    @if (adjunta().vistaPrevia(); as url) {
      <div class="vista-imagen">
        <img [src]="url" alt="Vista previa de la imagen" />
        <button type="button" class="quitar-imagen" aria-label="Quitar imagen" (click)="adjunta().quitar()">
          <svg class="icono" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    }
    @if (adjunta().error(); as mensaje) {
      <p class="mensaje-error" role="alert">{{ mensaje }}</p>
    }
  `,
  styleUrl: './imagen-adjunta.css',
})
export class VistaImagen {
  readonly adjunta = input.required<ImagenAdjunta>();
}
