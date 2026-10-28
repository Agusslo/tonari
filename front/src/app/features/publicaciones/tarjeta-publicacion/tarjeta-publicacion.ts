import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import IPublicacion from '../../../core/interfaces/publicacion';
import IUsuario from '../../../core/interfaces/usuario';
import { Avatar } from '../../../shared/components/avatar/avatar';

// Una publicación del muro. La pantalla Publicaciones repite este componente
// una vez por cada publicación (consigna: "cada publicación es un componente").
@Component({
  selector: 'app-tarjeta-publicacion',
  imports: [DatePipe, Avatar],
  templateUrl: './tarjeta-publicacion.html',
  styleUrl: './tarjeta-publicacion.css',
})
export class TarjetaPublicacion {
  // input.required: el padre TIENE que pasarle una publicación.
  readonly publicacion = input.required<IPublicacion>();
  // Quién está mirando (null = nadie logueado) y si hay una acción en curso.
  readonly usuario = input<IUsuario | null>(null);
  readonly ocupada = input(false);

  // output: la tarjeta AVISA al padre qué quiere hacer el usuario;
  // el padre es el que habla con el back.
  readonly alternarMeGusta = output<IPublicacion>();
  readonly eliminar = output<IPublicacion>();

  // ¿El usuario que mira ya le dio "Me gusta"?
  protected readonly leGusta = computed(() => {
    const usuario = this.usuario();
    return usuario !== null && this.publicacion().meGusta.includes(usuario._id);
  });

  // Puede eliminar el autor o un administrador (igual que valida el back).
  protected readonly puedeEliminar = computed(() => {
    const usuario = this.usuario();
    if (!usuario) return false;
    return usuario._id === this.publicacion().usuario._id || usuario.perfil === 'administrador';
  });

  // Si la imagen de la publicación falla (por ejemplo, el archivo ya no existe),
  // se oculta en vez de mostrar el ícono de imagen rota. La foto del autor
  // la resuelve <app-avatar> (blobatar o iniciales).
  protected readonly imagenRota = signal(false);
}