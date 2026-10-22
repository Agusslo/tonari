    import { Routes } from '@angular/router';

    // Cada pantalla se carga recién cuando se visita (lazy loading con loadComponent).
    // "title" cambia el título de la pestaña del navegador.
    export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
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
        loadComponent: () =>
        import('./features/publicaciones/publicaciones').then((m) => m.Publicaciones),
    },
    {
        path: 'mi-perfil',
        title: 'Mi perfil · TONARI',
        loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil),
    },
    // Cualquier ruta que no exista vuelve al login.
    { path: '**', redirectTo: 'login' },
    ];