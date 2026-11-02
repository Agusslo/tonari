import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// /ingreso-google (extra): a esta pantalla te devuelve el back después de elegir
// tu cuenta en Google, con la credencial en el fragmento: /ingreso-google#credential=...
// Le mandamos la credencial al back (POST /auth/google), igual que antes hacía el botón,
// y según la respuesta vas al muro (ya tenías cuenta) o a "Completá tu perfil".
@Component({
  selector: 'app-ingreso-google',
  imports: [RouterLink],
  templateUrl: './ingreso-google.html',
  styleUrl: './ingreso-google.css',
})
export class IngresoGoogle {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);

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

    this.auth.loginGoogle(credencial).subscribe({
      // replaceUrl: si después tocás "atrás", no volvés a esta pantalla de paso.
      next: (usuario) =>
        this.router.navigate([usuario ? '/publicaciones' : '/registro/google'], {
          replaceUrl: true,
        }),
      error: (error: HttpErrorResponse) => this.error.set(mensajeDeError(error)),
    });
  }
}
