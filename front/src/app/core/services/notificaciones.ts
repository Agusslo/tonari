import { HttpClient } from '@angular/common/http';
import { effect, inject, Service, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IListaNotificaciones } from '../interfaces/notificacion';
import { Auth } from './auth';

// Cada cuánto se pregunta "¿hay notificaciones nuevas?".
// No es tiempo real (para eso harían falta WebSockets, y Vercel no los mantiene abiertos):
// es "casi" tiempo real, y solo pide un número chiquito.
const CADA_MS = 30_000;

// Notificaciones (extra): el numerito de la campanita y la lista.
@Service()
export class Notificaciones {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly url = `${environment.apiUrl}/notificaciones`;

  // El numerito rojo. Lo lee la campanita.
  readonly noLeidas = signal(0);

  constructor() {
    // Se vuelve a ejecutar cada vez que cambia el token: al entrar arranca a
    // preguntar, al salir (token null) se corta y el número vuelve a 0.
    effect((onCleanup) => {
      if (!this.auth.token()) {
        this.noLeidas.set(0);
        return;
      }

      // Solo pregunta si la pestaña está a la vista: si está minimizada, no gasta.
      const preguntar = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) this.contar();
      };
      preguntar();
      const reloj = setInterval(preguntar, CADA_MS);
      // Al volver a la pestaña, pregunta enseguida (sin esperar los 30 segundos).
      document.addEventListener('visibilitychange', preguntar);

      onCleanup(() => {
        clearInterval(reloj);
        document.removeEventListener('visibilitychange', preguntar);
      });
    });

    // Si la app está instalada (PWA), el número también aparece en el ícono,
    // como en WhatsApp. No todos los navegadores lo tienen: por eso el "if".
    effect(() => {
      const cantidad = this.noLeidas();
      if ('setAppBadge' in navigator) {
        const accion = cantidad > 0 ? navigator.setAppBadge(cantidad) : navigator.clearAppBadge();
        accion.catch(() => {}); // si el navegador no lo permite, no pasa nada
      }
    });
  }

  // GET /notificaciones/no-leidas -> { noLeidas }
  private contar() {
    this.http.get<{ noLeidas: number }>(`${this.url}/no-leidas`).subscribe({
      next: ({ noLeidas }) => this.noLeidas.set(noLeidas),
      error: () => {}, // si falla, se reintenta en la próxima vuelta
    });
  }

  // GET /notificaciones?offset=0&limit=20 (de paso, actualiza el numerito)
  listar(offset = 0, limit = 20) {
    return this.http
      .get<IListaNotificaciones>(this.url, { params: { offset, limit } })
      .pipe(tap((respuesta) => this.noLeidas.set(respuesta.noLeidas)));
  }

  // PATCH /notificaciones/leidas: el número pasa a 0 apenas se abre la campanita.
  marcarLeidas() {
    this.noLeidas.set(0);
    return this.http.patch<{ noLeidas: number }>(`${this.url}/leidas`, {});
  }
}
