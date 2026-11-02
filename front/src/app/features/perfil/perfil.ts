import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { PublicacionesApi } from '../../core/services/publicaciones-api';
import IPublicacion from '../../core/interfaces/publicacion';
import { IPaginaComentarios } from '../../core/interfaces/comentario';
import { ComentariosApi } from '../../core/services/comentarios-api';
import { BibliotecaApi } from '../../core/services/biblioteca-api';
import IEntrada from '../../core/interfaces/biblioteca';
import { mensajeDeError } from '../../shared/utils/errores-http';
import { rutaFicha } from '../../shared/utils/rutas';
import { urlBanner } from '../../shared/utils/cloudinary';
import { Avatar } from '../../shared/components/avatar/avatar';
import { ModalPersonas } from '../../shared/components/modal-personas/modal-personas';
import { UsuariosApi } from '../../core/services/usuarios-api';
import { IResumenSeguir } from '../../core/interfaces/usuario';
import { EditarPerfil } from './editar-perfil/editar-perfil';
import { EstadoObraPipe } from '../../shared/pipes/estado-obra.pipe';
import { NumeroCortoPipe } from '../../shared/pipes/numero-corto.pipe';
import { ImagenRespaldoDirective } from '../../shared/directives/imagen-respaldo.directive';

@Component({
  selector: 'app-perfil',
  imports: [DatePipe, RouterLink, Avatar, EditarPerfil, ModalPersonas, EstadoObraPipe, NumeroCortoPipe, ImagenRespaldoDirective],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  private readonly api = inject(PublicacionesApi);
  private readonly comentariosApi = inject(ComentariosApi);
  private readonly bibliotecaApi = inject(BibliotecaApi);
  private readonly usuariosApi = inject(UsuariosApi);

  // El usuario que ingresó (o null), el mismo que usa Publicaciones.
  protected readonly usuario = inject(Auth).usuarioActual;

  // Mis últimas 3 publicaciones (consigna, Sprint 2).
  protected readonly misPublicaciones = signal<IPublicacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los últimos comentarios de cada una de esas publicaciones (consigna, Sprint 2:
  // "mis últimas 3 publicaciones y sus comentarios"). Se guardan por _id de publicación.
  protected readonly comentariosDe = signal<Record<string, IPaginaComentarios>>({});

  // "Seguir" (extra): mis seguidores / a cuántos sigo, y qué lista está abierta.
  protected readonly numerosSeguir = signal<IResumenSeguir | null>(null);
  protected readonly lista = signal<'seguidores' | 'siguiendo' | null>(null);

  // Mi Biblioteca (extra): un resumen en el perfil. null = todavía cargando.
  protected readonly biblioteca = signal<IEntrada[] | null>(null);
  protected readonly rutaFicha = rutaFicha;
  protected readonly urlBanner = urlBanner;
  // Cuántas hay en cada estado (anime y manga juntos).
  protected readonly resumenBiblioteca = computed(() => {
    const lista = this.biblioteca() ?? [];
    const contar = (estado: string) => lista.filter((e) => e.estado === estado).length;
    return {
      total: lista.length,
      enCurso: contar('en-curso'),
      completados: contar('completado'),
      pendientes: contar('pendiente'),
    };
  });
  // Las tapas que se muestran: primero lo que estás viendo o leyendo (hasta 6).
  protected readonly tapas = computed(() => {
    const lista = this.biblioteca() ?? [];
    const enCurso = lista.filter((e) => e.estado === 'en-curso');
    return (enCurso.length ? enCurso : lista).slice(0, 6);
  });

    // ¿Está abierto el formulario de "Editar perfil"? Y el aviso de "guardado".
  protected readonly editando = signal(false);
  protected readonly guardadoOk = signal(false);

  ngOnInit() {
    const usuario = this.usuario();
    if (!usuario) return; // sin sesión no hay nada que pedir

    // Mis números de "seguir": salen de mi propio perfil público. Si falla, no se muestran.
    this.usuariosApi.perfil(usuario.nombreUsuario).subscribe({
      next: ({ seguidores, siguiendo, loSigo, meSigue }) =>
        this.numerosSeguir.set({ seguidores, siguiendo, loSigo, meSigue }),
      error: () => this.numerosSeguir.set(null),
    });

    // Mi Biblioteca: si falla, el resumen simplemente no se muestra.
    this.bibliotecaApi.listar().subscribe({
      next: (entradas) => this.biblioteca.set(entradas),
      error: () => this.biblioteca.set([]),
    });

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
