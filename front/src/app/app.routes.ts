import { Routes } from '@angular/router';
import { sesionGuard } from './core/guards/sesion-guard';

// Cada pantalla se carga recién cuando se visita (lazy loading con loadComponent).
// "title" cambia el título de la pestaña del navegador.
// canActivate: [sesionGuard] -> solo se entra con sesión (si no, a Cargando o al Login).
export const routes: Routes = [
  // Al abrir la app: pantalla Cargando, que valida el token guardado.
  {
    path: '',
    pathMatch: 'full',
    title: 'TONARI',
    loadComponent: () => import('./features/cargando/cargando').then((m) => m.Cargando),
  },
  {
    path: 'login',
    title: 'Ingresar · TONARI',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: 'Crear cuenta · TONARI',
    loadComponent: () => import('./features/auth/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'publicaciones',
    title: 'Publicaciones · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./features/publicaciones/publicaciones').then((m) => m.Publicaciones),
  },
  {
    path: 'mi-perfil',
    title: 'Mi perfil · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil),
  },
  // Cualquier ruta que no exista va a Publicaciones (y el guard decide si podés entrar).
  { path: '**', redirectTo: 'publicaciones' },
];