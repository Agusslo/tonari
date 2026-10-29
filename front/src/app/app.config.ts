import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { tokenInterceptor } from './core/interceptors/token-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withViewTransitions: al cambiar de pantalla, la vieja se funde con la nueva
    // (View Transitions API del navegador; el estilo está en styles.css).
    // withInMemoryScrolling 'top': cada pantalla nueva arranca desde arriba,
    // en vez de quedar en la posición de scroll de la pantalla anterior.
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    // withInterceptors: todos los pedidos de HttpClient pasan por el interceptor,
    // que les agrega el token y redirige al login si el back responde 401.
    provideHttpClient(withInterceptors([tokenInterceptor])),
  ],
};