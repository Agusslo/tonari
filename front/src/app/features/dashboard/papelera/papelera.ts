import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { PublicacionesApi } from '../../../core/services/publicaciones-api';
import { IPublicacionEliminada } from '../../../core/interfaces/publicacion';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { Modal } from '../../../shared/components/modal/modal';
import { TiempoRelativoPipe } from '../../../shared/pipes/tiempo-relativo.pipe';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { urlCuadrada } from '../../../shared/utils/cloudinary';
import { MenuDashboard } from '../menu/menu';

// De a cuántas se piden (con "Cargar más" se traen las siguientes).
const POR_PAGINA = 10;

// Dashboard / Papelera (extra): las publicaciones dadas de baja (baja lógica)
// y el botón para reactivarlas. Solo administradores: adminGuard en la ruta
// y AdminGuard en el back.
@Component({
  selector: 'app-dashboard-papelera',
  imports: [DatePipe, RouterLink, Avatar, Modal, TiempoRelativoPipe, MenuDashboard],
  templateUrl: './papelera.html',
  styleUrl: './papelera.css',
})
export class DashboardPapelera {
  private readonly api = inject(PublicacionesApi);

  protected readonly publicaciones = signal<IPublicacionEliminada[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly errorCarga = signal<string | null>(null);

  // ¿Quedan más en el back? (las que tengo < el total)
  protected readonly hayMas = computed(() => this.publicaciones().length < this.total());

  // Reactivar: primero se confirma en un modal (nada de confirm()).
  protected readonly confirmando = signal<IPublicacionEliminada | null>(null);
  protected readonly procesando = signal(false);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly miniatura = (url: string) => urlCuadrada(url, 120);

  constructor() {
    this.cargar();
  }

  // Primera página (o "Reintentar").
  protected cargar() {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.api.papelera(0, POR_PAGINA).subscribe({
      next: ({ publicaciones, total }) => {
        this.publicaciones.set(publicaciones);
        this.total.set(total);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(mensajeDeError(error));
      },
    });
  }

  // Las siguientes, debajo de las que ya están.
  protected cargarMas() {
    if (this.cargandoMas() || !this.hayMas()) return;
    this.cargandoMas.set(true);
    this.api.papelera(this.publicaciones().length, POR_PAGINA).subscribe({
      next: ({ publicaciones, total }) => {
        this.publicaciones.update((lista) => [...lista, ...publicaciones]);
        this.total.set(total);
        this.cargandoMas.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoMas.set(false);
        this.aviso.set(mensajeDeError(error));
      },
    });
  }

  protected pedirConfirmacion(publicacion: IPublicacionEliminada) {
    this.errorAccion.set(null);
    this.confirmando.set(publicacion);
  }

  protected cerrarConfirmacion() {
    if (this.procesando()) return;
    this.confirmando.set(null);
  }

  // POST /publicaciones/:id/reactivar. Sale de la papelera y vuelve al muro.
  protected reactivar() {
    const publicacion = this.confirmando();
    if (!publicacion || this.procesando()) return;

    this.procesando.set(true);
    this.errorAccion.set(null);
    this.api.reactivar(publicacion._id).subscribe({
      next: () => {
        this.procesando.set(false);
        this.confirmando.set(null);
        this.publicaciones.update((lista) => lista.filter((p) => p._id !== publicacion._id));
        this.total.update((total) => total - 1);
        this.aviso.set(`"${publicacion.titulo}" volvió a Publicaciones.`);
      },
      error: (error: HttpErrorResponse) => {
        this.procesando.set(false);
        this.errorAccion.set(mensajeDeError(error)); // ej.: 409 "ya está activa"
      },
    });
  }
}
