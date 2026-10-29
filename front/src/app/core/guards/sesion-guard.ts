import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

// Guard de rutas: decide si se puede entrar a una pantalla.
// Consigna: "Solo se accede a la aplicación estando registrado o logueado".
export const sesionGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Ya hay usuario en memoria (se logueó o ya pasó por Cargando): adelante.
  if (auth.usuarioActual()) return true;

  // Hay token pero no usuario: recargaste la página. Vamos a Cargando para que
  // lo valide, anotando adónde querías ir (?volver=/mi-perfil) para volver después.
  if (auth.token()) {
    return router.createUrlTree(['/'], { queryParams: { volver: estado.url } });
  }

  // Ni usuario ni token: al login.
  return router.createUrlTree(['/login']);
};