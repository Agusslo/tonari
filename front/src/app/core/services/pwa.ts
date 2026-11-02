import { inject, Service, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

// El evento que manda el navegador cuando la app se puede instalar (Chrome, Edge, Android).
// No viene en los tipos de TypeScript, así que lo describimos nosotros.
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Todo lo de la PWA que se ve en pantalla:
//   - "Hay una versión nueva": el service worker bajó un deploy nuevo en segundo plano.
//   - "Sin conexión": el navegador avisa cuando se corta internet (eventos online/offline).
//   - "Instalar app": el botón propio para instalar TONARI como aplicación.
@Service()
export class Pwa {
  private readonly swUpdate = inject(SwUpdate);

  readonly hayVersionNueva = signal(false);
  readonly enLinea = signal(navigator.onLine);
  readonly sePuedeInstalar = signal(false);
  private eventoInstalar: EventoInstalar | null = null;

  constructor() {
    // isEnabled es false con ng serve (el service worker está apagado en desarrollo).
    if (this.swUpdate.isEnabled) {
      // VERSION_READY: ya bajó la versión nueva completa; se usa al recargar.
      this.swUpdate.versionUpdates
        .pipe(filter((evento) => evento.type === 'VERSION_READY'))
        .subscribe(() => this.hayVersionNueva.set(true));
      // Caso raro: la versión guardada se rompió (por ejemplo, el navegador borró
      // parte del caché). Lo más sano es recargar y bajar todo de nuevo.
      this.swUpdate.unrecoverable.subscribe(() => document.location.reload());
    }

    window.addEventListener('online', () => this.enLinea.set(true));
    window.addEventListener('offline', () => this.enLinea.set(false));

    // preventDefault: que el navegador no muestre su cartel solo; lo guardamos
    // para mostrarlo cuando la persona toque "Instalar app".
    window.addEventListener('beforeinstallprompt', (evento) => {
      evento.preventDefault();
      this.eventoInstalar = evento as EventoInstalar;
      this.sePuedeInstalar.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.eventoInstalar = null;
      this.sePuedeInstalar.set(false);
    });
  }

  // "Actualizar": activa la versión nueva y recarga para usarla.
  async actualizar() {
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }

  // "Instalar app": muestra el cartel de instalación del navegador.
  // Solo se puede usar una vez por evento: después hay que esperar otro.
  async instalar() {
    const evento = this.eventoInstalar;
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    this.eventoInstalar = null;
    this.sePuedeInstalar.set(false);
  }
}
