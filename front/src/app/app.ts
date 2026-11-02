import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from './core/services/auth';
import { Pwa } from './core/services/pwa';
import { Avatar } from './shared/components/avatar/avatar';
import { Modal } from './shared/components/modal/modal';
import { mensajeDeError } from './shared/utils/errores-http';

// Consigna: a los 10 minutos de iniciar sesión, avisar que quedan 5.
// El token dura 15: el aviso sale 5 minutos ANTES de que venza.
const AVISO_ANTES_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, Modal],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('front');

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // La cabecera cambia según haya alguien logueado o no.
  protected readonly usuario = this.auth.usuarioActual;

  // PWA: versión nueva, sin conexión e instalar la app.
  protected readonly pwa = inject(Pwa);

  // ---- Control de la sesión ----
  protected readonly avisoSesion = signal(false); // modal "¿extender la sesión?"
  protected readonly sesionTerminada = signal(false); // modal "tu sesión terminó"
  protected readonly extendiendo = signal(false); // esperando al back (spinner)
  protected readonly errorExtender = signal<string | null>(null);

  // "Ahora", actualizado cada segundo solo mientras el aviso está abierto,
  // para mostrar la cuenta regresiva (4:59, 4:58...).
  private readonly ahora = signal(Date.now());
  protected readonly tiempoRestante = computed(() => {
    const vence = this.auth.vencimiento();
    if (vence === null) return '0:00';
    const segundos = Math.max(0, Math.round((vence - this.ahora()) / 1000));
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  });

  constructor() {
    // Se ejecuta de nuevo cada vez que cambia el vencimiento del token:
    // al loguearse, al refrescar (token nuevo = 15 minutos nuevos) y al salir (null).
    // onCleanup cancela los timers viejos antes de programar los nuevos.
    effect((onCleanup) => {
      const vence = this.auth.vencimiento();
      this.avisoSesion.set(false);
      if (vence === null) return; // sin sesión, no hay nada que contar

      const falta = vence - Date.now();
      // Math.max(0, ...): si ya pasó el momento (por ejemplo, recargaste
      // en el minuto 12), se ejecuta enseguida.
      const aviso = setTimeout(() => {
        this.ahora.set(Date.now());
        this.errorExtender.set(null);
        this.avisoSesion.set(true);
      }, Math.max(0, falta - AVISO_ANTES_MS));
      const fin = setTimeout(() => this.terminarSesion(), Math.max(0, falta));

      onCleanup(() => {
        clearTimeout(aviso);
        clearTimeout(fin);
      });
    });

    // El reloj de la cuenta regresiva: corre solo con el aviso abierto.
    effect((onCleanup) => {
      if (!this.avisoSesion()) return;
      const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
      onCleanup(() => clearInterval(reloj));
    });
  }

  // "Extender sesión": POST /auth/refrescar. Al llegar el token nuevo cambia
  // el vencimiento, y el effect de arriba cierra el aviso y reprograma los timers.
  protected extenderSesion() {
    this.extendiendo.set(true);
    this.errorExtender.set(null);
    this.auth.refrescar().subscribe({
      next: () => this.extendiendo.set(false),
      error: (error: HttpErrorResponse) => {
        this.extendiendo.set(false);
        // Si es 401, el interceptor ya cerró la sesión y te mandó al login.
        if (error.status !== 401) this.errorExtender.set(mensajeDeError(error));
      },
    });
  }

  // Pasaron los 15 minutos sin extender: se cierra la sesión y se avisa.
  private terminarSesion() {
    this.avisoSesion.set(false);
    this.auth.cerrarSesion();
    this.sesionTerminada.set(true);
    this.router.navigate(['/login']);
  }

  // Cerrar sesión y volver al login.
  salir() {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }
}