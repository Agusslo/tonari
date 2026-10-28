import { Component, computed, input, linkedSignal } from '@angular/core';
import IUsuario from '../../../core/interfaces/usuario';

// Foto de perfil redonda, con dos respaldos si la foto no está o no carga:
//   1. la foto que subió el usuario
//   2. un blobatar (https://blobatar.dev): un avatar generado a partir del
//      nombre de usuario, siempre el mismo para la misma persona
//   3. las iniciales sobre el degradé de la marca (si tampoco hay internet)
// El tamaño lo decide el padre con la variable CSS --tam.
@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.css',
})
export class Avatar {
  readonly usuario =
    input.required<Pick<IUsuario, 'nombre' | 'apellido' | 'nombreUsuario' | 'imagenPerfil'>>();

  // linkedSignal: vuelve a empezar cada vez que cambia el usuario.
  protected readonly fuente = linkedSignal<'foto' | 'blobatar' | 'iniciales'>(() =>
    this.usuario().imagenPerfil ? 'foto' : 'blobatar',
  );

  protected readonly url = computed(() =>
    this.fuente() === 'foto'
      ? this.usuario().imagenPerfil
      : `https://blobatar.dev/avatar/${encodeURIComponent(this.usuario().nombreUsuario)}`,
  );

  protected readonly iniciales = computed(() => {
    const { nombre, apellido } = this.usuario();
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  });

  // Si una imagen falla, se pasa al siguiente respaldo.
  protected siguienteRespaldo() {
    this.fuente.update((fuente) => (fuente === 'foto' ? 'blobatar' : 'iniciales'));
  }
}
