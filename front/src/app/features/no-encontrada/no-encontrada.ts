import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';

// Página 404: se muestra para cualquier dirección que no existe (la ruta "**").
// Antes esas direcciones mandaban al muro sin avisar; ahora se explica qué pasó
// y se ofrece cómo seguir (consigna: información clara al realizar acciones).
@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink],
  templateUrl: './no-encontrada.html',
  styleUrl: './no-encontrada.css',
})
export class NoEncontrada {
  private readonly location = inject(Location);

  // La dirección que se intentó abrir, para mostrarla.
  protected readonly direccion = this.location.path();

  private readonly auth = inject(Auth);

  // Con token (aunque todavía no esté validado) se ofrece volver al muro;
  // sin token, ingresar. El guard de cada pantalla decide igual si podés entrar.
  protected readonly conSesion = this.auth.token() !== null;

  constructor() {
    // Si recargaste estando en una dirección que no existe, esta pantalla no pasa por
    // Cargando: hay token pero no usuario, y el menú mostraría "Ingresar".
    // Le pedimos al back quién sos (como hace Cargando) para que el menú quede bien.
    // Si el token ya no sirve, el interceptor cierra la sesión y te lleva al login.
    if (this.conSesion && !this.auth.usuarioActual()) {
      this.auth.autorizar().subscribe({ error: () => {} });
    }
  }

  // "Volver atrás": la página anterior del historial del navegador.
  protected volver() {
    this.location.back();
  }
}
