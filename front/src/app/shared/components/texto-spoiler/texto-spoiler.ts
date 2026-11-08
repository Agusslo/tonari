import { Component, computed, input, linkedSignal } from '@angular/core';
import { partirSpoilers } from '../../utils/spoilers';

// Muestra un texto con los ||spoilers|| tapados (extra). Tocás uno y se destapa
// SOLO ese, como en Discord. Lo usan la descripción de la publicación y los comentarios.
@Component({
  selector: 'app-texto-spoiler',
  templateUrl: './texto-spoiler.html',
  styleUrl: './texto-spoiler.css',
})
export class TextoSpoiler {
  readonly texto = input.required<string>();

  protected readonly partes = computed(() => partirSpoilers(this.texto()));

  // Cuáles ya destapaste (por posición). linkedSignal: si cambia el texto
  // (editaste el comentario), vuelve a empezar todo tapado.
  protected readonly destapados = linkedSignal<string, ReadonlySet<number>>({
    source: this.texto,
    computation: () => new Set(),
  });

  destapar(indice: number) {
    this.destapados.update((anteriores) => new Set(anteriores).add(indice));
  }
}
