import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';

// Política de privacidad (pública, con o sin sesión). La pide Google para
// poder publicar el ingreso con Google: tiene que explicar qué datos guardamos
// y para qué. Es texto fijo: no le pide nada al back.
@Component({
  selector: 'app-privacidad',
  imports: [RouterLink],
  templateUrl: './privacidad.html',
  styleUrl: './privacidad.css',
})
export class Privacidad {
  private readonly auth = inject(Auth);

  protected readonly correoContacto = 'agusnlopez04@gmail.com';

  constructor() {
    // Igual que en la 404: si recargaste acá con sesión, esta pantalla no pasa por
    // Cargando, así que pedimos quién sos para que el menú quede bien.
    if (this.auth.token() !== null && !this.auth.usuarioActual()) {
      this.auth.autorizar().subscribe({ error: () => {} });
    }
  }
}
