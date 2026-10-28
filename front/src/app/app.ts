import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/services/auth';
import { Avatar } from './shared/components/avatar/avatar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('front');

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // La cabecera cambia según haya alguien logueado o no.
  protected readonly usuario = this.auth.usuarioActual;

  // Cerrar sesión y volver al login.
  salir() {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
