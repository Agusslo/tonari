import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { PublicacionesApi } from '../../core/services/publicaciones-api';
import IPublicacion from '../../core/interfaces/publicacion';
import { IPaginaComentarios } from '../../core/interfaces/comentario';
import { ComentariosApi } from '../../core/services/comentarios-api';
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
  private readonly comentariosApi = inject(ComentariosApi);

  // El usuario que ingresó (o null), el mismo que usa Publicaciones.
  protected readonly usuario = inject(Auth).usuarioActual;

  // Mis últimas 3 publicaciones (consigna, Sprint 2).
  protected readonly misPublicaciones = signal<IPublicacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los últimos comentarios de cada una de esas publicaciones (consigna, Sprint 2:
  // "mis últimas 3 publicaciones y sus comentarios"). Se guardan por _id de publicación.
  protected readonly comentariosDe = signal<Record<string, IPaginaComentarios>>({});

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
        this.cargarComentarios(pagina.publicaciones);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }

  // Pide los 3 comentarios más nuevos de cada publicación, todos a la vez.
  // forkJoin espera a que terminen todos los pedidos y devuelve un arreglo con las respuestas.
  // catchError: si falla el de una publicación, esa queda sin comentarios (null)
  // en vez de romper las demás.
  private cargarComentarios(publicaciones: IPublicacion[]) {
    if (!publicaciones.length) return;
    const pedidos = publicaciones.map((p) =>
      this.comentariosApi.listar(p._id, 0, 3).pipe(catchError(() => of(null))),
    );
    forkJoin(pedidos).subscribe((paginas) => {
      const porPublicacion: Record<string, IPaginaComentarios> = {};
      paginas.forEach((pagina, i) => {
        if (pagina) porPublicacion[publicaciones[i]._id] = pagina;
      });
      this.comentariosDe.set(porPublicacion);
    });
  }

  alGuardar() {
    this.editando.set(false);
    this.guardadoOk.set(true);
    setTimeout(() => this.guardadoOk.set(false), 4000); // el aviso se va solo
  }
}
