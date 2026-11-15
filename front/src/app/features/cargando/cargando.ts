import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, timer } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { Tema } from '../../core/services/tema';

// Pantalla Cargando: es lo primero que se ve al abrir la app (o al recargar).
// Le pregunta al back si el token guardado sigue sirviendo (POST /auth/autorizar):
// si sirve -> a Publicaciones (o a la pantalla donde estabas), con tu usuario recuperado.
// si no -> al Login.
@Component({
  selector: 'app-cargando',
  templateUrl: './cargando.html',
  styleUrl: './cargando.css',
})
export class Cargando implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly tema = inject(Tema);

  // true = no se pudo hablar con el back (apagado o sin internet).
  protected readonly sinConexion = signal(false);

  ngOnInit() {
    this.validarSesion();
  }

  protected validarSesion() {
    this.sinConexion.set(false);

    // Sin token guardado no hay nada que validar: directo al login.
    if (!this.auth.token()) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    // forkJoin espera a que terminen LOS DOS: la respuesta del back y un timer
    // de 600 ms. Así, si el back contesta muy rápido, la pantalla no "parpadea".
    forkJoin([this.auth.autorizar(), timer(600)]).subscribe({
      next: () => this.router.navigateByUrl(this.destino(), { replaceUrl: true }),
      error: (error: HttpErrorResponse) => {
        // status 0: el pedido ni llegó. El token puede estar bien: no lo borramos
        // y ofrecemos reintentar.
        if (error.status === 0) {
          this.sinConexion.set(true);
          return;
        }
        // Cualquier otro error (401: vencido o inválido): sesión terminada.
        this.auth.cerrarSesion();
        this.router.navigate(['/login'], { replaceUrl: true });
      },
    });
  }

  // Si llegaste acá porque recargaste otra pantalla (por ejemplo /mi-perfil),
  // el guard la anotó en ?volver=/mi-perfil y te devolvemos ahí.
  // Solo rutas internas (que empiecen con "/"), y nunca "/" (sería esta misma pantalla).
  private destino(): string {
    const volver = this.ruta.snapshot.queryParamMap.get('volver');
    return volver?.startsWith('/') && volver !== '/' ? volver : '/publicaciones';
  }
}