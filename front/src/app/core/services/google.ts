import { Service } from '@angular/core';

// Lo poquito que usamos de la librería de Google (Google Identity Services).
// La librería no trae tipos para TypeScript, así que los escribimos nosotros.
export interface GoogleId {
  initialize(opciones: {
    client_id: string;
    ux_mode?: 'popup' | 'redirect';
    login_uri?: string;
    callback?: (respuesta: { credential: string }) => void;
    auto_select?: boolean;
    // Un texto al azar que Google mete ADENTRO de la credencial (para vincular la cuenta).
    nonce?: string;
  }): void;
  renderButton(elemento: HTMLElement, opciones: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const URL_SCRIPT = 'https://accounts.google.com/gsi/client';

// Carga el script de Google UNA sola vez, recién cuando hace falta (al abrir
// el login o el registro), y no en index.html: así el resto de la app no lo descarga.
// Devuelve una Promise: varias pantallas pueden esperarla y comparten la misma carga.
@Service()
export class Google {
  private carga: Promise<GoogleId> | null = null;

  cargar(): Promise<GoogleId> {
    this.carga ??= new Promise<GoogleId>((resolve, reject) => {
      const yaEsta = window.google?.accounts?.id;
      if (yaEsta) return resolve(yaEsta);

      const script = document.createElement('script');
      script.src = URL_SCRIPT;
      script.async = true;
      script.onload = () => {
        const id = window.google?.accounts?.id;
        if (id) resolve(id);
        else reject(new Error('El script de Google cargó raro'));
      };
      // Sin internet o bloqueado (por ejemplo, por un bloqueador de anuncios):
      // olvidamos la carga fallida para poder reintentar la próxima vez.
      script.onerror = () => {
        script.remove();
        this.carga = null;
        reject(new Error('No cargó el script de Google'));
      };
      document.head.append(script);
    });
    return this.carga;
  }
}
