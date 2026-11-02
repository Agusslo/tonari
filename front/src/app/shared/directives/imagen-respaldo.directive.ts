import { Directive, ElementRef, inject, input } from '@angular/core';

// Directiva propia 2: <img appImagenRespaldo> si la imagen no carga (link roto, AniList
// caído, sin internet), no deja el ícono feo de "imagen rota" del navegador.
//   <img appImagenRespaldo [src]="..." />                 -> la esconde y queda el fondo del contenedor
//   <img appImagenRespaldo="logo.svg" [src]="..." />      -> pone esa otra imagen en su lugar
// Se usa en todas las tapas de anime y manga, que vienen de otro sitio (AniList).
@Directive({
  selector: 'img[appImagenRespaldo]',
  host: { '(error)': 'alFallar()' },
})
export class ImagenRespaldoDirective {
  private readonly imagen = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;

  // El valor del atributo: la imagen de respaldo ('' = ninguna, solo esconder).
  readonly appImagenRespaldo = input('');

  protected alFallar() {
    const respaldo = this.appImagenRespaldo();
    // Si el respaldo también falla, "error" vuelve a dispararse: la segunda vez escondemos,
    // así no queda en un bucle intentando cargar la misma imagen para siempre.
    if (respaldo && !this.imagen.src.endsWith(respaldo)) {
      this.imagen.src = respaldo;
      return;
    }
    // visibility (y no display): sigue ocupando su lugar, así no se desarma la grilla.
    this.imagen.classList.add('imagen-rota');
  }
}
