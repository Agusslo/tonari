import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { PublicacionesApi } from '../../core/services/publicaciones-api';
import IPublicacion from '../../core/interfaces/publicacion';
import { mensajeDeError } from '../../shared/utils/errores-http';
import { Avatar } from '../../shared/components/avatar/avatar';
import { EditarPerfil } from './editar-perfil/editar-perfil';

@Component({
  selector: 'app-perfil',
  imports: [DatePipe, RouterLink, Avatar, EditarPerfil],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  private readonly api = inject(PublicacionesApi);

  // El usuario que ingresó (o null), el mismo que usa Publicaciones.
  protected readonly usuario = inject(Auth).usuarioActual;

  // Mis últimas 3 publicaciones (consigna, Sprint 2).
  protected readonly misPublicaciones = signal<IPublicacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  // ¿Está abierto el formulario de "Editar perfil"? Y el aviso de "guardado".
  protected readonly editando = signal(false);
  protected readonly guardadoOk = signal(false);

  ngOnInit() {
    const usuario = this.usuario();
    if (!usuario) return; // sin sesión no hay nada que pedir

    // El mismo GET del muro, pero filtrado por mí y con límite 3.
    this.api.listar({ usuario: usuario._id, limit: 3 }).subscribe({
      next: (pagina) => {
        this.misPublicaciones.set(pagina.publicaciones);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }

  alGuardar() {
    this.editando.set(false);
    this.guardadoOk.set(true);
    setTimeout(() => this.guardadoOk.set(false), 4000); // el aviso se va solo
  }
}
