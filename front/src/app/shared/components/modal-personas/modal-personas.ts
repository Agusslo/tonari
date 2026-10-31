import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UsuariosApi } from '../../../core/services/usuarios-api';
import { IAutor } from '../../../core/interfaces/publicacion';
import { Avatar } from '../avatar/avatar';

// Ventana con la lista de seguidores o de "siguiendo" de un usuario.
// Usa el <dialog> nativo, igual que app-modal (Escape para cerrar, foco atrapado),
// pero sin el ícono de éxito/error: acá se muestra una lista de personas.
@Component({
  selector: 'app-modal-personas',
  imports: [RouterLink, Avatar],
  templateUrl: './modal-personas.html',
  styleUrl: './modal-personas.css',
})
export class ModalPersonas {
  private readonly usuariosApi = inject(UsuariosApi);

  readonly nombreUsuario = input.required<string>();
  // Qué lista mostrar (null = la ventana está cerrada).
  readonly cual = input<'seguidores' | 'siguiendo' | null>(null);
  // true en Mi Perfil: los textos te hablan a vos ("Todavía no seguís a nadie").
  readonly propio = input(false);
  readonly cerrar = output<void>();

  protected readonly personas = signal<IAutor[] | null>(null);
  protected readonly error = signal(false);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    // Cada vez que se abre (o cambia la lista), se abre el <dialog> y se pide la lista.
    effect(() => {
      const cual = this.cual();
      const dialogo = this.dialogo().nativeElement;
      if (!cual) {
        if (dialogo.open) dialogo.close();
        return;
      }
      if (!dialogo.open) dialogo.showModal();
      this.personas.set(null);
      this.error.set(false);
      this.usuariosApi.personas(this.nombreUsuario(), cual).subscribe({
        next: (personas) => this.personas.set(personas),
        error: () => this.error.set(true),
      });
    });
  }
}
