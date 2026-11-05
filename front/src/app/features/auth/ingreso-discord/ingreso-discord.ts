import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { Auth } from '../../../core/services/auth';
import { CuentasApi } from '../../../core/services/cuentas-api';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// Si Discord o el back avisan un problema, viene #error=... en vez del ticket.
const ERRORES: Record<string, string> = {
  cancelado: 'Cancelaste en Discord, así que no hicimos nada.',
  invalido: 'El ingreso con Discord venció o no es válido. Probá de nuevo.',
  discord: 'No pudimos comunicarnos con Discord. Probá de nuevo en un rato.',
  configuracion: 'El ingreso con Discord todavía no está configurado. Probá más tarde o entrá con tu correo.',
};

// /ingreso-discord (extra): acá te devuelve el back después de Discord, con el ticket
// en el fragmento: /ingreso-discord#ticket=...&modo=ingreso (o modo=vincular).
//   ingreso  -> POST /auth/discord: al muro, o a "Completá tu perfil" si es la primera vez.
//   vincular -> POST /auth/cuentas/discord: lo suma a tu cuenta y volvés a Mi perfil.
// En los dos casos va el nonce que guardamos ANTES de ir a Discord (ver Auth.urlDiscord).
@Component({
  selector: 'app-ingreso-discord',
  imports: [RouterLink],
  templateUrl: './ingreso-discord.html',
  // Mismo diseño que la pantalla de vuelta de Google.
  styleUrl: '../ingreso-google/ingreso-google.css',
})
export class IngresoDiscord {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly cuentasApi = inject(CuentasApi);

  protected readonly error = signal<string | null>(null);
  protected readonly vinculando = signal(false);

  constructor() {
    // Igual que con Google: leemos el fragmento y lo borramos de la barra de direcciones.
    const fragmento = new URLSearchParams(inject(ActivatedRoute).snapshot.fragment ?? '');
    inject(Location).replaceState('/ingreso-discord');

    this.vinculando.set(fragmento.get('modo') === 'vincular');
    const ticket = fragmento.get('ticket');
    const nonce = this.auth.tomarNonceDiscord();

    const codigoError = fragmento.get('error');
    if (codigoError || !ticket) {
      this.error.set(ERRORES[codigoError ?? ''] ?? 'No nos llegó la respuesta de Discord. Probá de nuevo.');
      return;
    }
    // Sin nonce: la vuelta no empezó en esta pestaña (o es un link que te mandó otro).
    if (!nonce) {
      this.error.set('Este ingreso no empezó en esta pestaña. Tocá el botón de Discord de nuevo.');
      return;
    }

    if (this.vinculando()) this.vincular(ticket, nonce);
    else this.ingresar(ticket, nonce);
  }

  private ingresar(ticket: string, nonce: string) {
    this.auth.loginDiscord(ticket, nonce).subscribe({
      next: (usuario) =>
        this.router.navigate([usuario ? '/publicaciones' : '/registro/discord'], {
          replaceUrl: true,
        }),
      error: (error: HttpErrorResponse) => this.error.set(mensajeDeError(error)),
    });
  }

  private vincular(ticket: string, nonce: string) {
    if (!this.auth.token()) {
      this.error.set('Tu sesión se cerró. Ingresá de nuevo y volvé a vincular Discord desde Mi perfil.');
      return;
    }
    this.cuentasApi
      .vincularDiscord(ticket, nonce)
      .pipe(switchMap(() => this.auth.autorizar()))
      .subscribe({
        next: () =>
          this.router.navigate(['/mi-perfil'], {
            replaceUrl: true,
            state: { aviso: 'Listo: vinculaste tu cuenta de Discord.' },
          }),
        error: (error: HttpErrorResponse) => this.error.set(mensajeDeError(error)),
      });
  }
}
