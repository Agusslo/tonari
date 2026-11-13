import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { UsuariosApi } from '../../../core/services/usuarios-api';
import { Auth } from '../../../core/services/auth';
import { IUsuarioAdmin } from '../../../core/interfaces/usuario';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { Modal } from '../../../shared/components/modal/modal';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { MenuDashboard } from '../menu/menu';
import { CrearUsuario } from './crear-usuario/crear-usuario';

type Filtro = 'todos' | 'habilitados' | 'deshabilitados';

const DIA_MS = 24 * 60 * 60 * 1000;

// Lo que se puede hacer con un usuario (cada una pide confirmación).
type Accion = 'deshabilitar' | 'habilitar' | 'hacer-admin' | 'quitar-admin';

// Textos del modal de confirmación y del aviso de "listo", según la acción.
const TEXTOS: Record<Accion, { titulo: string; boton: string; listo: string }> = {
  deshabilitar: {
    titulo: '¿Deshabilitar este usuario?',
    boton: 'Deshabilitar',
    listo: 'ya no puede entrar y sus publicaciones no se muestran.',
  },
  habilitar: {
    titulo: '¿Habilitar este usuario?',
    boton: 'Habilitar',
    listo: 'ya puede volver a entrar.',
  },
  'hacer-admin': {
    titulo: '¿Hacerlo administrador?',
    boton: 'Hacer administrador',
    listo: 'ahora es administrador.',
  },
  'quitar-admin': {
    titulo: '¿Quitarle el rol de administrador?',
    boton: 'Quitar administrador',
    listo: 'ya no es administrador.',
  },
};

// Dashboard / Usuarios (Sprint 4): listado, crear, deshabilitar y habilitar.
// Usa las rutas de /usuarios del back que tienen AdminGuard.
@Component({
  selector: 'app-dashboard-usuarios',
  imports: [DatePipe, RouterLink, Avatar, Modal, MenuDashboard, CrearUsuario],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class DashboardUsuarios {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly auth = inject(Auth);

  protected readonly usuarios = signal<IUsuarioAdmin[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);

  // Mi id: a mí mismo no me puedo deshabilitar (el back también lo frena con 400).
  protected readonly miId = computed(() => this.auth.usuarioActual()?._id);

  // Buscador y filtro de estado (todo en el front: la lista ya está entera).
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('todos');

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.usuarios().filter((u) => {
      if (this.filtro() === 'habilitados' && !u.habilitado) return false;
      if (this.filtro() === 'deshabilitados' && u.habilitado) return false;
      if (!texto) return true;
      return [u.nombre, u.apellido, u.nombreUsuario, u.correo].some((dato) =>
        dato.toLowerCase().includes(texto),
      );
    });
  });

  // Los números de las tarjetas de arriba (y de los filtros).
  protected readonly resumen = computed(() => {
    const lista = this.usuarios();
    const hace30Dias = Date.now() - 30 * DIA_MS;
    const total = lista.length;
    const habilitados = lista.filter((u) => u.habilitado).length;
    const administradores = lista.filter((u) => u.perfil === 'administrador').length;
    return {
      total,
      habilitados,
      deshabilitados: total - habilitados,
      administradores,
      nuevos: lista.filter((u) => Date.parse(u.createdAt) >= hace30Dias).length,
      // Porcentajes enteros para las barritas (0 si todavía no hay cuentas).
      pctHabilitados: total ? Math.round((habilitados / total) * 100) : 0,
      pctAdministradores: total ? Math.round((administradores / total) * 100) : 0,
    };
  });

  // Cuántos hay en cada filtro (el numerito al lado de cada botón).
  protected cantidadFiltro(opcion: Filtro) {
    const r = this.resumen();
    return opcion === 'todos'
      ? r.total
      : opcion === 'habilitados'
        ? r.habilitados
        : r.deshabilitados;
  }

  protected readonly filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'habilitados', texto: 'Habilitados' },
    { valor: 'deshabilitados', texto: 'Deshabilitados' },
  ];

  // Cómo entró la cuenta: con Google, con Discord o con correo y contraseña.
  protected metodo(usuario: IUsuarioAdmin) {
    if (usuario.googleId && usuario.discordId) return 'Google y Discord';
    if (usuario.googleId) return 'Google';
    if (usuario.discordId) return 'Discord';
    return 'Correo';
  }

  protected readonly formularioAbierto = signal(false);

  // Confirmación antes de cada acción (la consigna prohíbe alert/confirm).
  protected readonly confirmando = signal<{ usuario: IUsuarioAdmin; accion: Accion } | null>(null);
  protected readonly textos = TEXTOS;
  protected readonly procesando = signal(false);
  protected readonly errorAccion = signal<string | null>(null);
  // Modal de "listo" (usuario creado, deshabilitado o habilitado).
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  protected cargar() {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.usuariosApi.listar().subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(mensajeDeError(error));
      },
    });
  }

  // El formulario avisa que creó uno: lo ponemos primero (es el más nuevo).
  protected usuarioCreado(usuario: IUsuarioAdmin) {
    this.formularioAbierto.set(false);
    this.usuarios.update((lista) => [usuario, ...lista]);
    this.aviso.set(`Se creó la cuenta de @${usuario.nombreUsuario} como ${usuario.perfil}.`);
  }

  protected pedirConfirmacion(usuario: IUsuarioAdmin, accion: Accion) {
    this.errorAccion.set(null);
    this.confirmando.set({ usuario, accion });
  }

  protected cerrarConfirmacion() {
    if (this.procesando()) return;
    this.confirmando.set(null);
  }

  // Cada acción va a su ruta del back, que devuelve el usuario actualizado:
  //   deshabilitar -> DELETE /usuarios/:id         habilitar -> POST /usuarios/:id/habilitar
  //   hacer-admin / quitar-admin -> PATCH /usuarios/:id/perfil
  protected confirmar() {
    const pendiente = this.confirmando();
    if (!pendiente || this.procesando()) return;
    const { usuario, accion } = pendiente;

    const pedido =
      accion === 'deshabilitar'
        ? this.usuariosApi.deshabilitar(usuario._id)
        : accion === 'habilitar'
          ? this.usuariosApi.habilitar(usuario._id)
          : this.usuariosApi.cambiarPerfil(
              usuario._id,
              accion === 'hacer-admin' ? 'administrador' : 'usuario',
            );

    this.procesando.set(true);
    this.errorAccion.set(null);
    pedido.subscribe({
      next: (actualizado) => {
        this.procesando.set(false);
        this.usuarios.update((lista) =>
          lista.map((u) => (u._id === actualizado._id ? actualizado : u)),
        );
        this.confirmando.set(null);
        this.aviso.set(`@${actualizado.nombreUsuario} ${TEXTOS[accion].listo}`);
      },
      error: (error: HttpErrorResponse) => {
        this.procesando.set(false);
        this.errorAccion.set(mensajeDeError(error)); // ej.: 409 "ya está deshabilitado"
      },
    });
  }
}
