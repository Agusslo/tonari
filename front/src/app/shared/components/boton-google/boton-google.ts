import { afterNextRender, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Google } from '../../../core/services/google';

// El botón "Continuar con Google" (extra), el mismo en el login y en el registro.
// Cómo funciona (modo "redirección"):
//   1. Cargamos el script de Google y le pedimos que dibuje SU botón en el div.
//      (Google no deja usar un botón propio: tiene que ser el suyo.)
//   2. Tocás el botón -> la pestaña entera va a Google (sin ventanita emergente:
//      Brave, Safari y los navegadores de Instagram/WhatsApp las bloquean).
//   3. Elegís tu cuenta -> Google le manda la credencial a nuestro back
//      (login_uri), que te devuelve a /ingreso-google, y esa pantalla termina el ingreso.
@Component({
  selector: 'app-boton-google',
  imports: [RouterLink],
  templateUrl: './boton-google.html',
  styleUrl: './boton-google.css',
})
export class BotonGoogle {
  private readonly google = inject(Google);

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  protected readonly estado = signal<'cargando' | 'listo' | 'fallo'>('cargando');

  constructor() {
    let destruido = false;
    inject(DestroyRef).onDestroy(() => (destruido = true));

    // afterNextRender: el div ya está en la pantalla (y sabemos cuánto mide).
    afterNextRender(() => {
      this.google
        .cargar()
        .then((googleId) => {
          if (destruido) return; // te fuiste de la pantalla antes de que cargue
          googleId.initialize({
            client_id: environment.googleClientId,
            ux_mode: 'redirect',
            // A dónde manda Google la credencial (tiene que estar en
            // "URIs de redireccionamiento autorizados" del cliente en Google Cloud).
            login_uri: `${environment.apiUrl}/auth/google/redirect`,
            auto_select: false,
          });
          const elemento = this.contenedor().nativeElement;
          googleId.renderButton(elemento, {
            type: 'standard',
            theme: 'filled_black', // oscuro, como TONARI
            size: 'large',
            text: 'continue_with', // "Continuar con Google"
            shape: 'pill',
            logo_alignment: 'center',
            locale: 'es',
            // Google pide el ancho en píxeles (entre 200 y 400)
            width: Math.max(200, Math.min(400, Math.round(elemento.offsetWidth))),
          });
          this.estado.set('listo');
        })
        .catch(() => {
          if (!destruido) this.estado.set('fallo');
        });
    });
  }
}
