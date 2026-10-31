import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '../../core/services/auth';
import { UsuariosApi } from '../../core/services/usuarios-api';
import { PublicacionesApi } from '../../core/services/publicaciones-api';
import { BibliotecaApi } from '../../core/services/biblioteca-api';
import { IPerfilPublico } from '../../core/interfaces/usuario';
import IPublicacion from '../../core/interfaces/publicacion';
import IEntrada, { nombreEstado } from '../../core/interfaces/biblioteca';
import { Avatar } from '../../shared/components/avatar/avatar';
import { ModalPersonas } from '../../shared/components/modal-personas/modal-personas';
import { Modal } from '../../shared/components/modal/modal';
import { mensajeDeError } from '../../shared/utils/errores-http';

// Perfil de OTRO usuario: /usuarios/beto (consigna, Sprint 5: "clic en el nombre o la
// foto de otro usuario para ver su perfil: datos y últimas 3 publicaciones").
// Extra: también se ve su biblioteca (solo para mirar, no se puede cambiar).
// Usa los mismos estilos que Mi Perfil (perfil.css) para que se vean iguales.
@Component({
  selector: 'app-perfil-usuario',
  imports: [DatePipe, RouterLink, Avatar, ModalPersonas, Modal],
  templateUrl: './perfil-usuario.html',
  styleUrls: ['../perfil/perfil.css', './perfil-usuario.css'],
})
export class PerfilUsuario {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly publicacionesApi = inject(PublicacionesApi);
  private readonly bibliotecaApi = inject(BibliotecaApi);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly titulo = inject(Title);

  protected readonly perfil = signal<IPerfilPublico | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  // Sus últimas 3 publicaciones y cuántas tiene en total.
  protected readonly publicaciones = signal<IPublicacion[]>([]);
  protected readonly totalPublicaciones = signal<number | null>(null);
  protected readonly cargandoPublicaciones = signal(true);

  // "Seguir" (extra): esperando al back, el error si falla y qué lista está abierta.
  protected readonly ocupadoSeguir = signal(false);
  protected readonly errorSeguir = signal<string | null>(null);
  protected readonly lista = signal<'seguidores' | 'siguiendo' | null>(null);

  // Su biblioteca (null = todavía no llegó; si falla, queda vacía).
  protected readonly biblioteca = signal<IEntrada[] | null>(null);
  protected readonly nombreEstado = nombreEstado;

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

  // Hasta 6 tapas: primero lo que está viendo o leyendo.
  protected readonly tapas = computed(() => {
    const lista = this.biblioteca() ?? [];
    const enCurso = lista.filter((e) => e.estado === 'en-curso');
    return [...enCurso, ...lista.filter((e) => e.estado !== 'en-curso')].slice(0, 6);
  });

  constructor() {
    // paramMap (y no snapshot): si estando en un perfil se entra a otro,
    // Angular reusa esta misma pantalla y solo cambia el parámetro.
    // takeUntilDestroyed: al salir de la pantalla se deja de escuchar.
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((parametros) => this.cargar(parametros.get('nombreUsuario') ?? ''));
  }

  private cargar(nombreUsuario: string) {
    // ¿Es mi propio perfil? Entonces a Mi Perfil (que tiene todos mis datos y "Editar").
    // replaceUrl: así el botón "Atrás" no vuelve a esta dirección.
    if (nombreUsuario === this.auth.usuarioActual()?.nombreUsuario) {
      this.router.navigate(['/mi-perfil'], { replaceUrl: true });
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.perfil.set(null);
    this.lista.set(null);
    this.biblioteca.set(null);

    this.usuariosApi.perfil(nombreUsuario).subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.cargando.set(false);
        this.titulo.setTitle(`${perfil.nombre} ${perfil.apellido} (@${perfil.nombreUsuario}) · TONARI`);
        // Con su _id pedimos lo demás, las dos cosas a la vez.
        this.cargarPublicaciones(perfil._id);
        this.cargarBiblioteca(perfil._id);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(
          error.status === 404 ? `No encontramos a @${nombreUsuario}.` : mensajeDeError(error),
        );
        this.cargando.set(false);
      },
    });
  }

  // Seguir / dejar de seguir. El back devuelve los números nuevos (seguidores, etc.)
  // y los mezclamos con el perfil: así el botón y el contador cambian sin recargar.
  protected alternarSeguir() {
    const perfil = this.perfil();
    if (!perfil || this.ocupadoSeguir()) return;
    this.ocupadoSeguir.set(true);
    const pedido = perfil.loSigo
      ? this.usuariosApi.dejarDeSeguir(perfil._id)
      : this.usuariosApi.seguir(perfil._id);
    pedido.subscribe({
      next: (numeros) => {
        this.perfil.update((actual) => (actual ? { ...actual, ...numeros } : actual));
        this.ocupadoSeguir.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorSeguir.set(mensajeDeError(error));
        this.ocupadoSeguir.set(false);
      },
    });
  }

  // El mismo GET del muro, filtrado por esa persona y con límite 3 (más recientes primero).
  private cargarPublicaciones(usuarioId: string) {
    this.cargandoPublicaciones.set(true);
    this.publicacionesApi.listar({ usuario: usuarioId, limit: 3 }).subscribe({
      next: (pagina) => {
        this.publicaciones.set(pagina.publicaciones);
        this.totalPublicaciones.set(pagina.total);
        this.cargandoPublicaciones.set(false);
      },
      error: () => {
        this.publicaciones.set([]);
        this.cargandoPublicaciones.set(false);
      },
    });
  }

  // GET /biblioteca?usuario=<id>: la biblioteca de otro (el back ya lo permitía).
  private cargarBiblioteca(usuarioId: string) {
    this.bibliotecaApi.listar(usuarioId).subscribe({
      next: (entradas) => this.biblioteca.set(entradas),
      error: () => this.biblioteca.set([]),
    });
  }
}
