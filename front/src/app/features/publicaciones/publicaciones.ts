import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { PublicacionesApi } from '../../core/services/publicaciones-api';
import IPublicacion from '../../core/interfaces/publicacion';
import { TarjetaPublicacion } from './tarjeta-publicacion/tarjeta-publicacion';
import { mensajeDeError } from '../../shared/utils/errores-http';

@Component({
  selector: 'app-publicaciones',
  imports: [RouterLink, TarjetaPublicacion],
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

  // ngOnInit: Angular lo llama una vez, cuando el componente ya está listo.
  // Es el lugar para pedir los datos iniciales.
  ngOnInit() {
    this.cargar();
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
}