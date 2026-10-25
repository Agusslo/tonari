import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import IPublicacion from '../../../core/interfaces/publicacion';

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
}