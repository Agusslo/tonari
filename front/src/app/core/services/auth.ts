    import { HttpClient } from '@angular/common/http';
    import { inject, Service, signal } from '@angular/core';
    import { map, tap } from 'rxjs';
    import { environment } from '../../../environments/environment';
    import IUsuario from '../interfaces/usuario';

    // Los datos de texto del registro (la imagen va aparte, como archivo).
    export interface DatosRegistro {
    nombre: string;
    apellido: string;
    correo: string;
    nombreUsuario: string;
    contraseña: string;
    fechaNacimiento: string; // 'YYYY-MM-DD'
    descripcion: string;
    }

    // Lo que se puede cambiar al editar el perfil (la foto va aparte).
    export interface DatosPerfil {
    nombre: string;
    apellido: string;
    fechaNacimiento: string; // 'YYYY-MM-DD'
    descripcion: string;
    }

    // Lo que responden el login y el registro del back.
    interface RespuestaAuth {
    usuario: IUsuario;
    token: string;
    }

    // Nombre con el que se guarda el token en el localStorage del navegador.
    const CLAVE_TOKEN = 'tonari-token';

    // Todo lo que habla con /auth del back pasa por acá:
    // los componentes nunca llaman al back directo.
    @Service()
    export class Auth {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/auth`;

    // El usuario que ingresó (null = nadie). Lo leen las pantallas, por ejemplo
    // Mi Perfil. Vive en memoria: al recargar se pierde, y lo recupera la
    // pantalla Cargando pidiéndoselo al back con el token (autorizar).
    private readonly usuario = signal<IUsuario | null>(null);
    readonly usuarioActual = this.usuario.asReadonly();

    // El token JWT. Se guarda en localStorage para que sobreviva al recargar
    // la página. Arranca con el que haya quedado guardado (o null).
    // Lo lee el interceptor para mandarlo en cada pedido al back.
    private readonly tokenGuardado = signal<string | null>(leerToken());
    readonly token = this.tokenGuardado.asReadonly();

    // POST /auth/registro. Va como FormData (multipart/form-data) porque puede
    // llevar un archivo: con JSON no se puede mandar una imagen.
    // La foto es opcional: sin foto, el back le asigna un blobatar.
    // El back devuelve { usuario, token }: guardamos la sesión y le pasamos
    // al componente solo el usuario (map).
    registro(datos: DatosRegistro, imagenPerfil: File | null) {
        const formData = new FormData();
        for (const [campo, valor] of Object.entries(datos)) {
        formData.append(campo, valor);
        }
        if (imagenPerfil) formData.append('imagenPerfil', imagenPerfil);

        return this.http.post<RespuestaAuth>(`${this.url}/registro`, formData).pipe(
        tap((respuesta) => this.iniciarSesion(respuesta)),
        map((respuesta) => respuesta.usuario),
        );
    }

    // POST /auth/login. "usuario" puede ser el correo o el nombre de usuario.
    login(usuario: string, contraseña: string) {
        return this.http
        .post<RespuestaAuth>(`${this.url}/login`, { usuario, contraseña })
        .pipe(
            tap((respuesta) => this.iniciarSesion(respuesta)),
            map((respuesta) => respuesta.usuario),
        );
    }

    // POST /auth/autorizar (el interceptor le pone el token).
    // Si el token sirve, el back devuelve los datos del usuario y los guardamos.
    // Lo va a usar la pantalla Cargando al abrir la app.
    autorizar() {
        return this.http
        .post<IUsuario>(`${this.url}/autorizar`, {})
        .pipe(tap((usuario) => this.usuario.set(usuario)));
    }

    // POST /auth/refrescar: el back devuelve un token nuevo (15 minutos más).
    // Lo va a usar el modal de "¿extender la sesión?".
    refrescar() {
        return this.http
        .post<{ token: string }>(`${this.url}/refrescar`, {})
        .pipe(tap(({ token }) => this.guardarToken(token)));
    }

    // Cerrar sesión: se olvida quién estaba logueado y se borra el token.
    cerrarSesion() {
        this.usuario.set(null);
        this.guardarToken(null);
    }

    // PATCH /usuarios/:id: editar mi perfil (multipart por si trae foto nueva).
    // Con la respuesta actualizamos el usuario guardado: así el menú, Mi Perfil
    // y las publicaciones muestran los datos nuevos al instante.
    actualizarPerfil(id: string, datos: DatosPerfil, imagenPerfil: File | null) {
        const formData = new FormData();
        for (const [campo, valor] of Object.entries(datos)) {
        formData.append(campo, valor);
        }
        if (imagenPerfil) formData.append('imagenPerfil', imagenPerfil);

        return this.http
        .patch<IUsuario>(`${environment.apiUrl}/usuarios/${id}`, formData)
        .pipe(tap((usuarioActualizado) => this.usuario.set(usuarioActualizado)));
    }

    // Login y registro terminan igual: guardamos el usuario y su token.
    private iniciarSesion({ usuario, token }: RespuestaAuth) {
        this.usuario.set(usuario);
        this.guardarToken(token);
    }

    // Actualiza el signal y el localStorage juntos (null = borrarlo).
    // try/catch: en modo incógnito estricto o con el almacenamiento bloqueado,
    // localStorage tira error; así la app sigue andando igual (sin recordar la sesión).
    private guardarToken(token: string | null) {
        this.tokenGuardado.set(token);
        try {
        if (token) localStorage.setItem(CLAVE_TOKEN, token);
        else localStorage.removeItem(CLAVE_TOKEN);
        } catch {
        // Sin localStorage: el token queda solo en memoria.
        }
    }
    }

    // Lee el token guardado al abrir la app (fuera de la clase: es una
    // función suelta que se usa una sola vez para el valor inicial del signal).
    function leerToken(): string | null {
    try {
        return localStorage.getItem(CLAVE_TOKEN);
    } catch {
        return null;
    }
    }