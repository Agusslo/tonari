import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

// Guard del dashboard (Sprint 4): solo entran los administradores.
// Va después de sesionGuard: para cuando llega acá, ya hay usuario en memoria.
// Es solo para la pantalla: la seguridad de verdad está en el back (AdminGuard -> 403).
export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  const usuario = auth.usuarioActual();
  if (!usuario) return true; // de esto se encarga sesionGuard (va primero)
  if (usuario.perfil === 'administrador') return true;

  // Un usuario común que escribió /dashboard a mano: a Publicaciones.
  return router.createUrlTree(['/publicaciones']);
};
