import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

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
    // PWA: registra el service worker de Angular (ngsw-worker.js), que guarda la app
    // en el navegador para que abra rápido, se pueda instalar y cargue sin internet.
    // Solo en producción (ng build): con ng serve molestaría, porque guardaría versiones viejas.
    // registerWhenStable:30000: se registra cuando la app terminó de cargar (o a los 30 s),
    // así no le compite a la primera pantalla por la conexión.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};