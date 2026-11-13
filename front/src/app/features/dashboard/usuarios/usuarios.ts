import { Component, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { RouterLink } from "@angular/router";
import { UsuariosApi } from "../../../core/services/usuarios-api";
import { Auth } from "../../../core/services/auth";
import { IUsuarioAdmin } from "../../../core/interfaces/usuario";
import { Avatar } from "../../../shared/components/avatar/avatar";
import { Modal } from "../../../shared/components/modal/modal";
import { mensajeDeError } from "../../../shared/utils/errores-http";
import { MenuDashboard } from "../menu/menu";
import { CrearUsuario } from "./crear-usuario/crear-usuario";

type Filtro = "todos" | "habilitados" | "deshabilitados";

// Dashboard / Usuarios (Sprint 4): listado, crear, deshabilitar y habilitar.
// Usa las rutas de /usuarios del back que tienen AdminGuard.
@Component({
  selector: "app-dashboard-usuarios",
  imports: [DatePipe, RouterLink, Avatar, Modal, MenuDashboard, CrearUsuario],
  templateUrl: "./usuarios.html",
  styleUrl: "./usuarios.css",
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
  protected readonly busqueda = signal("");
  protected readonly filtro = signal<Filtro>("todos");

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.usuarios().filter((u) => {
      if (this.filtro() === "habilitados" && !u.habilitado) return false;
      if (this.filtro() === "deshabilitados" && u.habilitado) return false;
      if (!texto) return true;
      return [u.nombre, u.apellido, u.nombreUsuario, u.correo].some((dato) =>
        dato.toLowerCase().includes(texto),
      );
    });
  });

  // Los números de arriba.
  protected readonly resumen = computed(() => {
    const lista = this.usuarios();
    return {
      total: lista.length,
      habilitados: lista.filter((u) => u.habilitado).length,
      administradores: lista.filter((u) => u.perfil === "administrador").length,
    };
  });

  protected readonly formularioAbierto = signal(false);

  // Confirmación antes de deshabilitar o habilitar (la consigna prohíbe alert/confirm).
  protected readonly confirmando = signal<IUsuarioAdmin | null>(null);
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
    this.aviso.set(
      `Se creó la cuenta de @${usuario.nombreUsuario} como ${usuario.perfil}.`,
    );
  }

  protected pedirConfirmacion(usuario: IUsuarioAdmin) {
    this.errorAccion.set(null);
    this.confirmando.set(usuario);
  }

  protected cerrarConfirmacion() {
    if (this.procesando()) return;
    this.confirmando.set(null);
  }

  // Deshabilitar (DELETE /usuarios/:id) o habilitar (POST /usuarios/:id/habilitar),
  // según cómo esté ahora. El back devuelve el usuario actualizado y lo reemplazamos.
  protected confirmar() {
    const usuario = this.confirmando();
    if (!usuario || this.procesando()) return;

    const pedido = usuario.habilitado
      ? this.usuariosApi.deshabilitar(usuario._id)
      : this.usuariosApi.habilitar(usuario._id);

    this.procesando.set(true);
    this.errorAccion.set(null);
    pedido.subscribe({
      next: (actualizado) => {
        this.procesando.set(false);
        this.usuarios.update((lista) =>
          lista.map((u) => (u._id === actualizado._id ? actualizado : u)),
        );
        this.confirmando.set(null);
        this.aviso.set(
          actualizado.habilitado
            ? `@${actualizado.nombreUsuario} ya puede volver a entrar.`
            : `@${actualizado.nombreUsuario} ya no puede entrar y sus publicaciones no se muestran.`,
        );
      },
      error: (error: HttpErrorResponse) => {
        this.procesando.set(false);
        this.errorAccion.set(mensajeDeError(error)); // ej.: 409 "ya está deshabilitado"
      },
    });
  }
}
