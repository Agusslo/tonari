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
    // Primera vez con Google: completar usuario, fecha y descripción (extra).
    // Sin guard: todavía no tenés sesión. Si no venís del botón de Google, te manda al registro.
    path: 'registro/google',
    title: 'Completá tu perfil · TONARI',
    loadComponent: () =>
      import('./features/auth/registro-google/registro-google').then((m) => m.RegistroGoogle),
  },
  {
    // Política de privacidad: pública (la pide Google para el ingreso con Google).
    path: 'privacidad',
    title: 'Privacidad · TONARI',
    loadComponent: () => import('./features/privacidad/privacidad').then((m) => m.Privacidad),
  },
  {
    path: 'publicaciones',
    title: 'Publicaciones · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./features/publicaciones/publicaciones').then((m) => m.Publicaciones),
  },
  {
    // :id es un parámetro: /publicaciones/6adc... -> la página de esa publicación.
    path: 'publicaciones/:id',
    title: 'Publicación · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () => import('./features/publicacion/publicacion').then((m) => m.Publicacion),
  },
  {
    // Mi Biblioteca (extra): mi lista de anime y manga.
    path: 'biblioteca',
    title: 'Mi Biblioteca · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () => import('./features/biblioteca/biblioteca').then((m) => m.Biblioteca),
  },
  {
    // Ficha de una obra de la biblioteca (estilo MangaDex):
    // /biblioteca/anime/154587-sousou-no-frieren (tipo + id de AniList + título "slug").
    path: 'biblioteca/:tipo/:obra',
    title: 'Obra · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () => import('./features/biblioteca/ficha/ficha').then((m) => m.Ficha),
  },
  {
    // Perfil de otro usuario (/usuarios/beto): se llega tocando su nombre o su foto.
    path: 'usuarios/:nombreUsuario',
    title: 'Perfil · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./features/usuario/perfil-usuario').then((m) => m.PerfilUsuario),
  },
  {
    path: 'mi-perfil',
    title: 'Mi perfil · TONARI',
    canActivate: [sesionGuard],
    loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil),
  },
  // Cualquier ruta que no exista: página 404 (sin guard: se ve con o sin sesión).
  {
    path: '**',
    title: 'Página no encontrada · TONARI',
    loadComponent: () =>
      import('./features/no-encontrada/no-encontrada').then((m) => m.NoEncontrada),
  },
];
