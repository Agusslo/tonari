import { Component, input, signal } from '@angular/core';
import { IDiscordPublico } from '../../../core/interfaces/usuario';
import { ImagenRespaldoDirective } from '../../directives/imagen-respaldo.directive';

// El Discord de alguien en su perfil (extra): logo, su usuario, "Ver en Discord" y "Copiar".
// Discord no deja que una app mande solicitudes de amistad, así que lo más directo es
// abrir su perfil en Discord (discord.com/users/<id>) y agregarlo desde ahí.
// "Copiar" es por si el link no abre la app: lo pegás en Discord > Agregar amigo.
@Component({
  selector: 'app-insignia-discord',
  imports: [ImagenRespaldoDirective],
  templateUrl: './insignia-discord.html',
  styleUrl: './insignia-discord.css',
})
export class InsigniaDiscord {
  readonly discord = input.required<IDiscordPublico>();

  protected readonly copiado = signal(false);

  protected copiar() {
    navigator.clipboard
      ?.writeText(this.discord().usuario)
      .then(() => {
        this.copiado.set(true);
        setTimeout(() => this.copiado.set(false), 1600);
      })
      .catch(() => {}); // sin permiso para el portapapeles: el usuario igual se ve en pantalla
  }
}
