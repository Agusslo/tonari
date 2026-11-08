import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Notificaciones } from '../../../core/services/notificaciones';
import { INotificacion } from '../../../core/interfaces/notificacion';
import { Avatar } from '../avatar/avatar';
import { TiempoRelativoPipe } from '../../pipes/tiempo-relativo.pipe';
import { SinSpoilersPipe } from '../../pipes/sin-spoilers.pipe';
import { ClickAfueraDirective } from '../../directives/click-afuera.directive';
import { mensajeDeError } from '../../utils/errores-http';

const POR_PAGINA = 20;

// La campanita de la cabecera (extra): el numerito de no leídas y, al tocarla,
// el panel con la lista. Al abrirla, todas pasan a leídas.
@Component({
  selector: 'app-campanita',
  imports: [RouterLink, Avatar, TiempoRelativoPipe, ClickAfueraDirective, SinSpoilersPipe],
  templateUrl: './campanita.html',
  styleUrl: './campanita.css',
  // Escape cierra el panel (como cualquier menú desplegable).
  host: { '(document:keydown.escape)': 'cerrar()' },
})
export class Campanita {
  private readonly notificaciones = inject(Notificaciones);

  protected readonly noLeidas = this.notificaciones.noLeidas;
  protected readonly abierta = signal(false);
  protected readonly estado = signal<'cargando' | 'lista' | 'error'>('cargando');
  protected readonly lista = signal<INotificacion[]>([]);
  protected readonly hayMas = signal(false);
  protected readonly cargandoMas = signal(false);
  protected readonly error = signal('');

  // "Sonar": la campanita se mueve un poquito cuando llega una nueva.
  protected readonly sonando = signal(false);

  constructor() {
    // Compara con el número anterior: solo suena si SUBIÓ (no al bajar a 0).
    let anterior = this.noLeidas();
    effect((onCleanup) => {
      const actual = this.noLeidas();
      if (actual > anterior && !untracked(this.abierta)) {
        this.sonando.set(true);
        const fin = setTimeout(() => this.sonando.set(false), 900);
        onCleanup(() => clearTimeout(fin));
      }
      anterior = actual;
    });
  }

  protected alternar() {
    if (this.abierta()) {
      this.cerrar();
    } else {
      this.abierta.set(true);
      this.cargar();
    }
  }

  cerrar() {
    this.abierta.set(false);
  }

  protected cargar() {
    this.estado.set('cargando');
    this.notificaciones.listar(0, POR_PAGINA).subscribe({
      next: (respuesta) => {
        this.lista.set(respuesta.notificaciones);
        this.hayMas.set(respuesta.offset + respuesta.limit < respuesta.total);
        this.estado.set('lista');
        // Las que llegaron sin leer se siguen viendo resaltadas mientras el panel está
        // abierto (vienen con leida: false), pero en el back ya quedan leídas.
        if (respuesta.noLeidas > 0) this.notificaciones.marcarLeidas().subscribe();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(mensajeDeError(error));
        this.estado.set('error');
      },
    });
  }

  protected cargarMas() {
    this.cargandoMas.set(true);
    const desde = this.lista().length;
    this.notificaciones.listar(desde, POR_PAGINA).subscribe({
      next: (respuesta) => {
        this.lista.update((lista) => [...lista, ...respuesta.notificaciones]);
        this.hayMas.set(respuesta.offset + respuesta.limit < respuesta.total);
        this.cargandoMas.set(false);
      },
      error: () => this.cargandoMas.set(false),
    });
  }

  // A dónde lleva cada aviso: "te siguió" al perfil de esa persona; el resto, a la publicación.
  protected enlace(notificacion: INotificacion) {
    return notificacion.tipo === 'seguir' || !notificacion.publicacion
      ? ['/usuarios', notificacion.autor.nombreUsuario]
      : ['/publicaciones', notificacion.publicacion._id];
  }

  // El texto que va después del nombre: "le gustó tu publicación", etc.
  protected accion(notificacion: INotificacion) {
    switch (notificacion.tipo) {
      case 'meGusta':
        return 'le gustó tu publicación';
      case 'seguir':
        return 'te empezó a seguir';
      case 'comentario':
        return 'comentó tu publicación';
      case 'respuesta':
        return 'respondió tu comentario';
    }
  }
}
