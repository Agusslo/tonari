import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import IPublicacion from '../../../core/interfaces/publicacion';
import IUsuario from '../../../core/interfaces/usuario';

// Una publicación del muro. La pantalla Publicaciones repite este componente
// una vez por cada publicación (consigna: "cada publicación es un componente").
@Component({
  selector: 'app-tarjeta-publicacion',
  imports: [DatePipe],
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

  // Iniciales del autor: se muestran si su foto no carga.
  protected readonly iniciales = computed(() => {
    const { nombre, apellido } = this.publicacion().usuario;
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  });

  // Si una imagen falla (por ejemplo, el archivo ya no existe), se oculta
  // en vez de mostrar el ícono de imagen rota.
  protected readonly fotoRota = signal(false);
  protected readonly imagenRota = signal(false);
}