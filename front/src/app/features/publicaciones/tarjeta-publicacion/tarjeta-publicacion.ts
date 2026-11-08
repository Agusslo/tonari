import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import IPublicacion from '../../../core/interfaces/publicacion';
import IUsuario from '../../../core/interfaces/usuario';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { TiempoRelativoPipe } from '../../../shared/pipes/tiempo-relativo.pipe';
import { NumeroCortoPipe } from '../../../shared/pipes/numero-corto.pipe';
import { Encuesta } from '../../../shared/components/encuesta/encuesta';
import { TextoSpoiler } from '../../../shared/components/texto-spoiler/texto-spoiler';

// Una publicación del muro. La pantalla Publicaciones repite este componente
// una vez por cada publicación (consigna: "cada publicación es un componente").
@Component({
  selector: 'app-tarjeta-publicacion',
  imports: [DatePipe, RouterLink, Avatar, TiempoRelativoPipe, NumeroCortoPipe, Encuesta, TextoSpoiler],
  templateUrl: './tarjeta-publicacion.html',
  styleUrl: './tarjeta-publicacion.css',
})
export class TarjetaPublicacion {
  // input.required: el padre TIENE que pasarle una publicación.
  readonly publicacion = input.required<IPublicacion>();
  // Quién está mirando (null = nadie logueado) y si hay una acción en curso.
  readonly usuario = input<IUsuario | null>(null);
  readonly ocupada = input(false);
  // true en la página Publicación: la muestra "en grande" (imagen entera)
  // y sin el link a sí misma. En el muro queda en false.
  readonly detalle = input(false);

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

  // ---------- Spoilers (extra) ----------
  // ¿Tocaste "Mostrar igual"? Vuelve a false si la tarjeta pasa a mostrar otra publicación.
  protected readonly mostrarIgual = linkedSignal({
    source: () => this.publicacion()._id,
    computation: () => false,
  });

  // Se tapa si tiene spoiler, el back dijo que a vos no te lo libera
  // (no la terminaste ni vas por ese episodio) y no tocaste "Mostrar igual".
  protected readonly tapada = computed(() => {
    const spoiler = this.publicacion().spoiler;
    return !!spoiler && spoiler.liberado === null && !this.mostrarIgual();
  });

  // "ep." para anime, "cap." para manga.
  protected readonly unidad = computed(() =>
    this.publicacion().spoiler?.tipo === 'manga' ? 'cap.' : 'ep.',
  );
}