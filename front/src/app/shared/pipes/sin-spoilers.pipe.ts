import { Pipe, PipeTransform } from '@angular/core';
import { ocultarSpoilers } from '../utils/spoilers';

// Pipe propia: {{ comentario.mensaje | sinSpoilers }}
// "El final es ||que gana||" -> "El final es [spoiler]".
// Para los extractos cortos (la campanita, Mi perfil), donde no hay lugar para tocar y ver:
// ahí directamente no se muestra el spoiler.
@Pipe({ name: 'sinSpoilers' })
export class SinSpoilersPipe implements PipeTransform {
  transform(texto: string | null | undefined): string {
    return texto ? ocultarSpoilers(texto) : '';
  }
}
