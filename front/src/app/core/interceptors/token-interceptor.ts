import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../services/auth';

// Un interceptor se mete en el medio de TODOS los pedidos que hace HttpClient:
// puede cambiar el pedido antes de que salga y mirar la respuesta cuando vuelve.
// Así ningún servicio tiene que acordarse de poner el token a mano.
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const token = auth.token();
  // Solo a NUESTRO back: el token no se le manda a otras páginas (por ejemplo, blobatar).
  const esNuestroBack = req.url.startsWith(environment.apiUrl);

  // Los pedidos son inmutables: para agregar el header se hace una copia (clone).
  const pedido =
    token && esNuestroBack
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(pedido).pipe(
    catchError((error: HttpErrorResponse) => {
      // Consigna: si una petición devuelve 401, redirigir al login.
      // El login es la excepción: ahí un 401 es "contraseña incorrecta"
      // y lo muestra el propio formulario en su modal.
      // Lo mismo con Google y Discord (/auth/google..., /auth/discord...): un 401 es
      // "credencial vencida", no "se te venció la sesión", y lo muestra su pantalla.
      const esLogin =
        req.url.endsWith('/auth/login') ||
        req.url.includes('/auth/google') ||
        req.url.includes('/auth/discord');
      if (error.status === 401 && esNuestroBack && !esLogin) {
        auth.cerrarSesion(); // el token ya no sirve: lo borramos
        router.navigate(['/login']);
      }
      // Igual devolvemos el error, por si la pantalla quiere mostrar algo.
      return throwError(() => error);
    }),
  );
};