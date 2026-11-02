import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { PublicacionesApi } from '../../core/services/publicaciones-api';
import { ComentariosApi } from '../../core/services/comentarios-api';
import IPublicacion from '../../core/interfaces/publicacion';
import IComentario from '../../core/interfaces/comentario';
import { TarjetaPublicacion } from '../publicaciones/tarjeta-publicacion/tarjeta-publicacion';
import { Comentario } from './comentario/comentario';
import { Modal } from '../../shared/components/modal/modal';
import { mensajeDeError } from '../../shared/utils/errores-http';
import { AutoAlturaDirective } from '../../shared/directives/auto-altura.directive';

// Cuántos comentarios se traen por vez (la primera carga y cada "cargar más").
const POR_TANDA = 5;

// Página Publicación (/publicaciones/:id): la publicación en grande y sus comentarios.
@Component({
  selector: 'app-publicacion',
  imports: [ReactiveFormsModule, RouterLink, TarjetaPublicacion, Comentario, Modal, AutoAlturaDirective],
  templateUrl: './publicacion.html',
  styleUrl: './publicacion.css',
})
export class Publicacion implements OnInit {
  private readonly publicacionesApi = inject(PublicacionesApi);
  private readonly comentariosApi = inject(ComentariosApi);
  private readonly router = inject(Router);
  // El :id de la URL (/publicaciones/6adc...) sale de la ruta activa.
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly usuario = inject(Auth).usuarioActual;

  // ---- La publicación ----
  protected readonly publicacion = signal<IPublicacion | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupada = signal(false); // "Me gusta" o eliminar en curso
  protected readonly aEliminar = signal(false); // abre el modal de confirmación
  protected readonly errorAccion = signal<string | null>(null); // modal de error

  // ---- Los comentarios ----
  protected readonly comentarios = signal<IComentario[]>([]);
  protected readonly totalComentarios = signal(0);
  protected readonly cargandoComentarios = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly errorComentarios = signal<string | null>(null);

  // ¿Quedan comentarios por traer? (los que tengo < el total que informa el back)
  protected readonly hayMas = computed(() => this.comentarios().length < this.totalComentarios());

  // ---- Escribir un comentario ----
  // FormGroup (aunque tenga un solo campo): es lo que conecta el <form> con
  // (ngSubmit). Sin [formGroup], el form se enviaría "a la antigua" y recargaría la página.
  protected readonly formulario = new FormGroup({
    mensaje: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
  });
  protected readonly nuevo = this.formulario.controls.mensaje;
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);

  ngOnInit() {
    this.cargarPublicacion();
    this.cargarComentarios();
  }

  cargarPublicacion() {
    this.cargando.set(true);
    this.error.set(null);
    this.publicacionesApi.obtener(this.id).subscribe({
      next: (publicacion) => {
        this.publicacion.set(publicacion);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(
          error.status === 404 || error.status === 400
            ? 'Esta publicación no existe o fue eliminada.'
            : mensajeDeError(error),
        );
        this.cargando.set(false);
      },
    });
  }

  // Primera carga: los 5 más nuevos.
  cargarComentarios() {
    this.cargandoComentarios.set(true);
    this.errorComentarios.set(null);
    this.comentariosApi.listar(this.id, 0, POR_TANDA).subscribe({
      next: (pagina) => {
        this.comentarios.set(pagina.comentarios);
        this.totalComentarios.set(pagina.total);
        this.cargandoComentarios.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorComentarios.set(mensajeDeError(error));
        this.cargandoComentarios.set(false);
      },
    });
  }

  // "Cargar más": pide los siguientes y los SUMA al final, sin perder los anteriores.
  // offset = cuántos ya tengo (si tengo 5, que saltee 5 y traiga del 6 en adelante).
  cargarMas() {
    if (this.cargandoMas()) return;
    this.cargandoMas.set(true);
    this.comentariosApi.listar(this.id, this.comentarios().length, POR_TANDA).subscribe({
      next: (pagina) => {
        this.comentarios.update((actuales) => {
          // Si mientras tanto alguien comentó, la lista del back "se corrió" y
          // podría volver uno repetido: filtramos los que ya tenemos.
          const ids = new Set(actuales.map((c) => c._id));
          return [...actuales, ...pagina.comentarios.filter((c) => !ids.has(c._id))];
        });
        this.totalComentarios.set(pagina.total);
        this.cargandoMas.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorAccion.set(mensajeDeError(error));
        this.cargandoMas.set(false);
      },
    });
  }

  comentar() {
    const mensaje = this.nuevo.value.trim();
    if (!mensaje || this.nuevo.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.comentariosApi.crear(this.id, mensaje).subscribe({
      next: (comentario) => {
        // El nuevo va arriba de todo (la lista va del más nuevo al más viejo).
        this.comentarios.update((actuales) => [comentario, ...actuales]);
        this.totalComentarios.update((total) => total + 1);
        // También sube el contador de la publicación ("3 comentarios").
        this.publicacion.update((p) =>
          p ? { ...p, cantidadComentarios: (p.cantidadComentarios ?? 0) + 1 } : p,
        );
        this.formulario.reset();
        this.enviando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorEnvio.set(mensajeDeError(error));
        this.enviando.set(false);
      },
    });
  }

  // El componente <app-comentario> avisa que se editó: lo reemplazamos en la lista.
  alEditar(editado: IComentario) {
    this.comentarios.update((lista) => lista.map((c) => (c._id === editado._id ? editado : c)));
  }

  // Alguien respondió un comentario: las respuestas también cuentan en "3 comentarios".
  alResponder() {
    this.publicacion.update((p) =>
      p ? { ...p, cantidadComentarios: (p.cantidadComentarios ?? 0) + 1 } : p,
    );
  }

  // ---- "Me gusta" y eliminar (lo mismo que en el muro) ----
  alternarMeGusta(publicacion: IPublicacion) {
    const usuario = this.usuario();
    if (!usuario || this.ocupada()) return;

    const pedido = publicacion.meGusta.includes(usuario._id)
      ? this.publicacionesApi.quitarMeGusta(publicacion._id, usuario._id)
      : this.publicacionesApi.darMeGusta(publicacion._id, usuario._id);

    this.ocupada.set(true);
    pedido.subscribe({
      next: (actualizada) => {
        this.publicacion.set(actualizada); // el back devuelve la publicación ya actualizada
        this.ocupada.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorAccion.set(mensajeDeError(error));
        this.ocupada.set(false);
      },
    });
  }

  confirmarEliminar() {
    const publicacion = this.publicacion();
    const usuario = this.usuario();
    if (!publicacion || !usuario) return;

    this.aEliminar.set(false);
    this.ocupada.set(true);
    this.publicacionesApi.eliminar(publicacion._id, usuario._id).subscribe({
      // Ya no existe: volvemos al muro.
      next: () => this.router.navigate(['/publicaciones']),
      error: (error: HttpErrorResponse) => {
        this.errorAccion.set(mensajeDeError(error));
        this.ocupada.set(false);
      },
    });
  }
}
