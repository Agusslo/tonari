import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Auth } from '../../../core/services/auth';
import { Google } from '../../../core/services/google';
import { mensajeDeError } from '../../utils/errores-http';

// El botón "Continuar con Google" (extra), el mismo en el login y en el registro.
// Cómo funciona:
//   1. Cargamos el script de Google y le pedimos que dibuje SU botón en el div.
//      (Google no deja usar un botón propio: tiene que ser el suyo.)
//   2. Tocás el botón -> Google abre su ventanita, elegís tu cuenta y Google
//      nos devuelve una "credential" (un token firmado por Google con tu nombre, correo y foto).
//   3. Se la mandamos al back, que la verifica con Google. Si ya tenés cuenta, entrás;
//      si es la primera vez, te llevamos a "Completá tu perfil".
@Component({
  selector: 'app-boton-google',
  imports: [RouterLink],
  templateUrl: './boton-google.html',
  styleUrl: './boton-google.css',
})
export class BotonGoogle {
  private readonly google = inject(Google);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // Si algo sale mal, el padre lo muestra en su modal de error.
  readonly error = output<string>();

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  protected readonly estado = signal<'cargando' | 'listo' | 'fallo'>('cargando');
  protected readonly ingresando = signal(false);

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
            callback: ({ credential }) => this.ingresar(credential),
            auto_select: false,
            cancel_on_tap_outside: true,
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

  private ingresar(credencial: string) {
    if (this.ingresando()) return;
    this.ingresando.set(true);
    this.auth.loginGoogle(credencial).subscribe({
      next: (usuario) => {
        this.ingresando.set(false);
        // usuario = ya tenía cuenta. null = primera vez: falta completar el perfil.
        this.router.navigate([usuario ? '/publicaciones' : '/registro/google']);
      },
      error: (error: HttpErrorResponse) => {
        this.ingresando.set(false);
        this.error.emit(mensajeDeError(error));
      },
    });
  }
}
