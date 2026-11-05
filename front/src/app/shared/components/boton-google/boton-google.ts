import { afterNextRender, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Google } from '../../../core/services/google';
import { BotonDiscord } from '../boton-discord/boton-discord';

// Vincular Google desde "Cuentas vinculadas": el nonce que le pedimos a Google que meta
// en la credencial. Lo lee /ingreso-google al volver para saber que era para VINCULAR
// (y no para ingresar) y el back revisa que coincida con el de adentro de la credencial.
export const CLAVE_VINCULAR_GOOGLE = 'tonari-vincular-google';

// El botón "Continuar con Google" (extra), el mismo en el login y en el registro.
// Cómo funciona (modo "redirección"):
//   1. Cargamos el script de Google y le pedimos que dibuje SU botón en el div.
//      (Google no deja usar un botón propio: tiene que ser el suyo.)
//   2. Tocás el botón -> la pestaña entera va a Google (sin ventanita emergente:
//      Brave, Safari y los navegadores de Instagram/WhatsApp las bloquean).
//   3. Elegís tu cuenta -> Google le manda la credencial a nuestro back
//      (login_uri), que te devuelve a /ingreso-google, y esa pantalla termina el ingreso.
// modo "ingreso" (login y registro): además muestra "Continuar con Discord" y el separador.
// modo "vincular" (Mi perfil > Cuentas vinculadas): solo el botón de Google, con nonce.
@Component({
  selector: 'app-boton-google',
  imports: [RouterLink, BotonDiscord],
  templateUrl: './boton-google.html',
  styleUrl: './boton-google.css',
})
export class BotonGoogle {
  private readonly google = inject(Google);

  readonly modo = input<'ingreso' | 'vincular'>('ingreso');

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
          const nonce = this.prepararNonce();
          googleId.initialize({
            nonce,
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
            text: this.modo() === 'vincular' ? 'signin_with' : 'continue_with',
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

  // En "vincular" guardamos un nonce en esta pestaña y se lo damos a Google.
  // En "ingreso" borramos uno viejo, por si quedó de una vinculación que no terminaste.
  private prepararNonce() {
    try {
      if (this.modo() === 'vincular') {
        const nonce = crypto.randomUUID();
        sessionStorage.setItem(CLAVE_VINCULAR_GOOGLE, nonce);
        return nonce;
      }
      sessionStorage.removeItem(CLAVE_VINCULAR_GOOGLE);
    } catch {
      // sin sessionStorage: vincular no va a andar, pero el ingreso sí
    }
    return undefined;
  }
}
