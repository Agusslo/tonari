import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

let contador = 0; // para que cada modal tenga un id único

// Modal reutilizable (la consigna prohíbe alert()).
// Usa el <dialog> nativo del navegador, que ya trae lo difícil resuelto:
// atrapa el foco adentro, se cierra con Escape y devuelve el foco al cerrar.
@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly abierto = input(false);
  readonly titulo = input.required<string>();
  readonly tipo = input<'exito' | 'error'>('exito');

  // Avisa al componente padre que el modal se cerró (botón, Escape, etc.)
  readonly cerrar = output<void>();

  protected readonly idTitulo = `modal-titulo-${++contador}`;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    // Cada vez que cambia "abierto", abrimos o cerramos el <dialog>.
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      if (this.abierto() && !dialogo.open) dialogo.showModal();
      if (!this.abierto() && dialogo.open) dialogo.close();
    });
  }
}