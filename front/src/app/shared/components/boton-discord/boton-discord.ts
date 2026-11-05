import { Component, inject, input, signal } from '@angular/core';
import { Auth } from '../../../core/services/auth';

// "Continuar con Discord" (extra). A diferencia de Google, Discord no dibuja su botón:
// es un botón nuestro que lleva la pestaña al back (/auth/discord), y el back a Discord.
// modo "ingreso": login/registro. modo "vincular": desde "Cuentas vinculadas" en Mi perfil.
@Component({
  selector: 'app-boton-discord',
  imports: [],
  templateUrl: './boton-discord.html',
  styleUrl: './boton-discord.css',
})
export class BotonDiscord {
  private readonly auth = inject(Auth);

  readonly modo = input<'ingreso' | 'vincular'>('ingreso');
  readonly texto = input('Continuar con Discord');

  protected readonly yendo = signal(false);

  protected ir() {
    this.yendo.set(true);
    // urlDiscord guarda el nonce en este navegador y arma la dirección del back.
    window.location.href = this.auth.urlDiscord(this.modo());
  }
}
