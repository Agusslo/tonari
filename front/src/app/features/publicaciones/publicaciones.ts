import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
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
import { entrarEnCascada } from '../../shared/utils/animaciones';
import { mensajeDeError } from '../../shared/utils/errores-http';

@Component({
  selector: 'app-publicaciones',
  imports: [TarjetaPublicacion, Modal, CrearPublicacion, TarjetaPerfil],
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
  // Scroll infinito (como Twitter): se piden de a 10 y, al llegar al final de la lista,
  // se piden las 10 siguientes y se AGREGAN abajo. Cada pedido sigue trayendo una
  // cantidad limitada (offset + limit), así que la paginación la sigue haciendo el back.
  protected readonly orden = signal<'fecha' | 'meGusta'>('fecha');
  private readonly porPagina = 10;
  protected readonly cargandoMas = signal(false);
  protected readonly errorMas = signal<string | null>(null);

  // computed: ¿quedan publicaciones por traer? (las que tengo < las que hay en total)
  protected readonly hayMas = computed(() => this.publicaciones().length < this.total());

  // El elemento invisible del final de la lista y si está en pantalla ahora.
  private readonly finDeLista = viewChild<ElementRef<HTMLElement>>('finDeLista');
  private readonly finVisible = signal(false);

  // Acciones sobre una publicación
  protected readonly ocupada = signal<string | null>(null); // _id de la que se está procesando
  protected readonly aEliminar = signal<IPublicacion | null>(null); // abre el modal de confirmación
  protected readonly errorAccion = signal<string | null>(null); // abre el modal de error

  // Cuántas publicaciones tiene el usuario logueado (para su tarjeta lateral).
  protected readonly misPublicaciones = signal<number | null>(null);

  // "Tu resumen": los "Me gusta" que recibió en total y su publicación más querida
  // (null = todavía no llegó o falló el pedido).
  protected readonly meGustaRecibidos = signal<number | null>(null);
  protected readonly miMasQuerida = signal<IPublicacion | null>(null);

  // Promedio de "Me gusta" por publicación, con un decimal (2,5, no 2,4999…).
  // toLocaleString('es-AR') formatea el número como se usa acá: con coma decimal.
  protected readonly promedioMeGusta = computed(() => {
    const recibidos = this.meGustaRecibidos();
    const publicaciones = this.misPublicaciones();
    if (recibidos === null || !publicaciones) return null;
    return (Math.round((recibidos / publicaciones) * 10) / 10).toLocaleString('es-AR');
  });

  // Las tarjetas que hay en pantalla (como elementos del DOM, para animarlas).
  private readonly tarjetas = viewChildren(TarjetaPublicacion, { read: ElementRef });

  constructor() {
    // Después de dibujar la lista, las tarjetas nuevas entran en cascada (GSAP).
    // Las que ya estaban no se vuelven a animar: al cargar más, solo entran las nuevas.
    afterRenderEffect(() => {
      entrarEnCascada(this.tarjetas().map((tarjeta) => tarjeta.nativeElement));
    });

    // IntersectionObserver: el navegador avisa cuando un elemento entra o sale de la
    // pantalla (sin estar escuchando el scroll todo el tiempo). Observamos el elemento
    // del final de la lista: cuando aparece, pedimos más.
    // rootMargin 400px: avisa un poco ANTES de llegar, así casi no se ve la espera.
    // El effect se vuelve a ejecutar si el elemento aparece o desaparece (está dentro
    // de un @if) y onCleanup desconecta el observador viejo.
    effect((onCleanup) => {
      const elemento = this.finDeLista()?.nativeElement;
      if (!elemento) return;
      const observador = new IntersectionObserver(
        ([entrada]) => {
          this.finVisible.set(entrada.isIntersecting);
          if (entrada.isIntersecting) this.cargarMas();
        },
        { rootMargin: '400px' },
      );
      observador.observe(elemento);
      onCleanup(() => {
        observador.disconnect();
        this.finVisible.set(false);
      });
    });
  }

  // ngOnInit: Angular lo llama una vez, cuando el componente ya está listo.
  // Es el lugar para pedir los datos iniciales.
  ngOnInit() {
    this.cargar();
    this.cargarMiResumen();
  }

  // Un solo pedido para las dos tarjetas laterales: las publicaciones del usuario
  // ordenadas por "Me gusta". De ahí sale el total (tarjeta de perfil), la suma de
  // corazones y la más querida (la primera). 50 es el máximo que acepta el back:
  // con más publicaciones, la suma cuenta solo las 50 más queridas.
  cargarMiResumen() {
    const usuario = this.usuario();
    if (!usuario) return;
    this.api.listar({ usuario: usuario._id, orden: 'meGusta', limit: 50 }).subscribe({
      next: (pagina) => {
        const lista = pagina.publicaciones;
        this.misPublicaciones.set(pagina.total);
        this.meGustaRecibidos.set(lista.reduce((suma, p) => suma + p.cantidadMeGusta, 0));
        // Una "más querida" con 0 corazones no tiene sentido mostrarla
        this.miMasQuerida.set(lista[0]?.cantidadMeGusta ? lista[0] : null);
      },
      error: () => {
        // No es grave: las tarjetas muestran "–"
        this.misPublicaciones.set(null);
        this.meGustaRecibidos.set(null);
        this.miMasQuerida.set(null);
      },
    });
  }

  // "Publicar algo" de la tarjeta lateral: lleva al formulario de arriba
  // y deja el cursor en el título, listo para escribir.
  irACrear() {
    const titulo = document.getElementById('titulo');
    titulo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    titulo?.focus({ preventScroll: true });
  }

  // La primera tanda (al entrar, al cambiar el orden o al publicar): reemplaza la lista.
  cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.errorMas.set(null);

    this.api.listar({ orden: this.orden(), offset: 0, limit: this.porPagina }).subscribe({
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

  // Las siguientes: offset = las que ya tengo (si tengo 10, salteá 10 y traé 10 más).
  // Se AGREGAN al final de la lista. El "if" evita pedir dos veces lo mismo
  // si el observador avisa mientras todavía está cargando.
  cargarMas() {
    if (this.cargando() || this.cargandoMas() || !this.hayMas() || this.errorMas()) return;
    this.cargandoMas.set(true);

    this.api
      .listar({ orden: this.orden(), offset: this.publicaciones().length, limit: this.porPagina })
      .subscribe({
        next: (pagina) => {
          // Por si alguien publicó mientras tanto, no repetimos ninguna que ya esté.
          const yaEstan = new Set(this.publicaciones().map((p) => p._id));
          const nuevas = pagina.publicaciones.filter((p) => !yaEstan.has(p._id));
          this.publicaciones.update((lista) => [...lista, ...nuevas]);
          this.total.set(pagina.total);
          this.cargandoMas.set(false);
          // Si la pantalla es alta y el final sigue a la vista, el observador no vuelve
          // a avisar (no "entró" de nuevo): pedimos la siguiente tanda nosotros.
          if (this.finVisible() && nuevas.length) queueMicrotask(() => this.cargarMas());
        },
        error: (error: HttpErrorResponse) => {
          // Se muestra abajo de la lista con un botón para reintentar.
          this.errorMas.set(mensajeDeError(error));
          this.cargandoMas.set(false);
        },
      });
  }

  reintentarMas() {
    this.errorMas.set(null);
    this.cargarMas();
  }

  // Recién publicada: volvemos a "Más recientes" desde el principio, para que se vea arriba.
  alCrear() {
    this.orden.set('fecha');
    this.cargar();
    this.cargarMiResumen();
  }

  // Al cambiar el orden se arranca la lista de nuevo.
  cambiarOrden(orden: 'fecha' | 'meGusta') {
    this.orden.set(orden);
    this.cargar();
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
        this.cargarMiResumen(); // si era tuya, cambian tus corazones
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
        // La sacamos de la lista sin recargar (así no perdés por dónde ibas scrolleando).
        this.publicaciones.update((lista) => lista.filter((p) => p._id !== publicacion._id));
        this.total.update((total) => total - 1);
        this.cargarMiResumen();
      },
      error: (error: HttpErrorResponse) => {
        this.errorAccion.set(mensajeDeError(error));
        this.ocupada.set(null);
      },
    });
  }
}