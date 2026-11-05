import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { Auth } from '../../../core/services/auth';
import { CuentasApi } from '../../../core/services/cuentas-api';
import { CLAVE_VINCULAR_GOOGLE } from '../../../shared/components/boton-google/boton-google';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// /ingreso-google (extra): a esta pantalla te devuelve el back después de elegir
// tu cuenta en Google, con la credencial en el fragmento: /ingreso-google#credential=...
// Le mandamos la credencial al back (POST /auth/google), igual que antes hacía el botón,
// y según la respuesta vas al muro (ya tenías cuenta) o a "Completá tu perfil".
// Si venías de "Cuentas vinculadas" (hay un nonce guardado y sesión iniciada), en vez
// de ingresar VINCULA esa cuenta de Google a la tuya y te devuelve a Mi perfil.
@Component({
  selector: 'app-ingreso-google',
  imports: [RouterLink],
  templateUrl: './ingreso-google.html',
  styleUrl: './ingreso-google.css',
})
export class IngresoGoogle {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly cuentasApi = inject(CuentasApi);

  protected readonly error = signal<string | null>(null);
  protected readonly vinculando = signal(false);

  constructor() {
    // El fragmento es lo que va después del "#". Lo leemos y enseguida lo borramos
    // de la barra de direcciones (replaceState): la credencial no tiene que quedar a la vista.
    const fragmento = new URLSearchParams(inject(ActivatedRoute).snapshot.fragment ?? '');
    inject(Location).replaceState('/ingreso-google');

    const credencial = fragmento.get('credential');
    if (!credencial) {
      this.error.set('No nos llegó la respuesta de Google. Probá de nuevo.');
      return;
    }

    const nonce = tomarNonceVincular();
    if (nonce && this.auth.token()) {
      this.vincular(credencial, nonce);
      return;
    }

    this.auth.loginGoogle(credencial).subscribe({
      // replaceUrl: si después tocás "atrás", no volvés a esta pantalla de paso.
      next: (usuario) =>
        this.router.navigate([usuario ? '/publicaciones' : '/registro/google'], {
          replaceUrl: true,
        }),
      error: (error: HttpErrorResponse) => this.error.set(mensajeDeError(error)),
    });
  }

  // Vincular: POST /auth/cuentas/google y después autorizar (al volver de Google la app
  // arrancó de cero y todavía no sabe quién sos). Volvés a Mi perfil con un aviso.
  private vincular(credencial: string, nonce: string) {
    this.vinculando.set(true);
    this.cuentasApi
      .vincularGoogle(credencial, nonce)
      .pipe(switchMap(() => this.auth.autorizar()))
      .subscribe({
        next: () =>
          this.router.navigate(['/mi-perfil'], {
            replaceUrl: true,
            state: { aviso: 'Listo: vinculaste tu cuenta de Google.' },
          }),
        error: (error: HttpErrorResponse) => this.error.set(mensajeDeError(error)),
      });
  }
}

// El nonce que guardó el botón de Google en modo "vincular". Se borra al leerlo.
function tomarNonceVincular() {
  try {
    const nonce = sessionStorage.getItem(CLAVE_VINCULAR_GOOGLE);
    sessionStorage.removeItem(CLAVE_VINCULAR_GOOGLE);
    return nonce;
  } catch {
    return null;
  }
}
