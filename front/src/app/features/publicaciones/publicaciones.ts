import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChildren,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../core/services/auth';
import { PublicacionesApi } from '../../core/services/publicaciones-api';
import IPublicacion from '../../core/interfaces/publicacion';
import { TarjetaPublicacion } from './tarjeta-publicacion/tarjeta-publicacion';
import { Modal } from '../../shared/components/modal/modal';
import { CrearPublicacion } from './crear-publicacion/crear-publicacion';
import { TarjetaPerfil } from './tarjeta-perfil/tarjeta-perfil';
import { Avatar } from '../../shared/components/avatar/avatar';
import { entrarEnCascada } from '../../shared/utils/animaciones';
import { mensajeDeError } from '../../shared/utils/errores-http';

@Component({
  selector: 'app-publicaciones',
  imports: [TarjetaPublicacion, Modal, CrearPublicacion, TarjetaPerfil, Avatar],
  templateUrl: './publicaciones.html',
  styleUrl: './publicaciones.css',
})
export class Publicaciones implements OnInit {
  private readonly api = inject(PublicacionesApi);

  // El usuario que ingresó (o null). Es la misma signal del service:
  // si cambia, la pantalla se actualiza sola.
  protected readonly usuario = inject(Auth).usuarioActual;

  // Los 4 estados posibles de la pantalla: cargando, error, vacía o con publicaciones.
  protected readonly publicaciones = signal<IPublicacion[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  // Orden y paginación (consigna: por fecha por defecto, o por "Me gusta";
  // cantidad limitada por página).
  protected readonly orden = signal<'fecha' | 'meGusta'>('fecha');
  protected readonly pagina = signal(1);
  private readonly porPagina = 5;

  // computed: se recalcula solo cuando cambian total o pagina.
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.porPagina)),
  );

  // Acciones sobre una publicación
  protected readonly ocupada = signal<string | null>(null); // _id de la que se está procesando
  protected readonly aEliminar = signal<IPublicacion | null>(null); // abre el modal de confirmación
  protected readonly errorAccion = signal<string | null>(null); // abre el modal de error

  // Cuántas publicaciones tiene el usuario logueado (para su tarjeta lateral).
  protected readonly misPublicaciones = signal<number | null>(null);

  // Ranking lateral: las 3 con más "Me gusta" (null = todavía cargando).
  protected readonly destacadas = signal<IPublicacion[] | null>(null);

  // Las tarjetas que hay en pantalla (como elementos del DOM, para animarlas).
  private readonly tarjetas = viewChildren(TarjetaPublicacion, { read: ElementRef });

  constructor() {
    // Después de dibujar la lista, las tarjetas nuevas entran en cascada (GSAP).
    afterRenderEffect(() => {
      entrarEnCascada(this.tarjetas().map((tarjeta) => tarjeta.nativeElement));
    });
  }

  // ngOnInit: Angular lo llama una vez, cuando el componente ya está listo.
  // Es el lugar para pedir los datos iniciales.
  ngOnInit() {
    this.cargar();
    this.contarMisPublicaciones();
    this.cargarDestacadas();
  }

  // Las que tienen 0 "Me gusta" no entran: un ranking de ceros no dice nada.
  cargarDestacadas() {
    this.api.listar({ orden: 'meGusta', limit: 3 }).subscribe({
      next: (pagina) =>
        this.destacadas.set(pagina.publicaciones.filter((p) => p.cantidadMeGusta > 0)),
      error: () => this.destacadas.set([]), // no es grave: se muestra el mensaje de vacío
    });
  }

  // Pide solo 1 publicación del usuario: lo que importa es el "total" que viene en la respuesta.
  contarMisPublicaciones() {
    const usuario = this.usuario();
    if (!usuario) return;
    this.api.listar({ usuario: usuario._id, limit: 1 }).subscribe({
      next: (pagina) => this.misPublicaciones.set(pagina.total),
      error: () => this.misPublicaciones.set(null), // no es grave: la tarjeta muestra "–"
    });
  }

  cargar() {
    this.cargando.set(true);
    this.error.set(null);

    this.api
      .listar({
        orden: this.orden(),
        offset: (this.pagina() - 1) * this.porPagina, // página 1 -> 0, página 2 -> 5...
        limit: this.porPagina,
      })
      .subscribe({
        next: (pagina) => {
          this.publicaciones.set(pagina.publicaciones);
          this.total.set(pagina.total);
          this.cargando.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(mensajeDeError(error));
          this.cargando.set(false);
        },
      });
  }

  // Recién publicada: volvemos a "Más recientes", página 1, para que se vea arriba.
  alCrear() {
    this.orden.set('fecha');
    this.pagina.set(1);
    this.cargar();
    this.contarMisPublicaciones();
  }

  // Al cambiar el orden se vuelve a la primera página.
  cambiarOrden(orden: 'fecha' | 'meGusta') {
    this.orden.set(orden);
    this.pagina.set(1);
    this.cargar();
  }

  irAPagina(pagina: number) {
    this.pagina.set(pagina);
    this.cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Dar o quitar "Me gusta", según si ya lo había dado.
  alternarMeGusta(publicacion: IPublicacion) {
    const usuario = this.usuario();
    if (!usuario || this.ocupada()) return;

    const yaLeGusta = publicacion.meGusta.includes(usuario._id);
    const pedido = yaLeGusta
      ? this.api.quitarMeGusta(publicacion._id, usuario._id)
      : this.api.darMeGusta(publicacion._id, usuario._id);

    this.ocupada.set(publicacion._id);
    pedido.subscribe({
      next: (actualizada) => {
        // Reemplazamos solo esa publicación en la lista (sin recargar todo).
        this.publicaciones.update((lista) =>
          lista.map((p) => (p._id === actualizada._id ? actualizada : p)),
        );
        this.ocupada.set(null);
        this.cargarDestacadas(); // un "Me gusta" puede cambiar el ranking
      },
      error: (error: HttpErrorResponse) => {
        this.errorAccion.set(mensajeDeError(error));
        this.ocupada.set(null);
      },
    });
  }

  // Se confirma en el modal (nada de confirm() del navegador).
  confirmarEliminar() {
    const publicacion = this.aEliminar();
    const usuario = this.usuario();
    if (!publicacion || !usuario) return;

    this.aEliminar.set(null);
    this.ocupada.set(publicacion._id);
    this.api.eliminar(publicacion._id, usuario._id).subscribe({
      next: () => {
        this.ocupada.set(null);
        // Si era la única de la última página, volvemos una página atrás.
        if (this.publicaciones().length === 1 && this.pagina() > 1) {
          this.pagina.update((pagina) => pagina - 1);
        }
        this.cargar(); // recargamos para que la paginación quede bien
        this.contarMisPublicaciones();
        this.cargarDestacadas(); // si estaba en el ranking, tiene que salir
      },
      error: (error: HttpErrorResponse) => {
        this.errorAccion.set(mensajeDeError(error));
        this.ocupada.set(null);
      },
    });
  }
}