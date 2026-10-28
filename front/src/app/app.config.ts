import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withViewTransitions: al cambiar de pantalla, la vieja se funde con la nueva
    // (View Transitions API del navegador; el estilo está en styles.css).
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(),
  ],
};
