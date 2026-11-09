    import { HttpClient } from '@angular/common/http';
    import { computed, inject, Service, signal } from '@angular/core';
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

    // Ingreso con Google (extra): lo que Google nos dio de vos la primera vez.
    export interface DatosGoogle {
    nombre: string;
    apellido: string;
    correo: string;
    imagenPerfil: string; // la foto de tu cuenta de Google
    }

    // Ingreso con Discord (extra): lo mismo, más un nombre de usuario sugerido.
    // Discord no tiene apellido: llega vacío y lo completás vos.
    export interface DatosDiscord extends DatosGoogle {
    nombreUsuario: string;
    }

    // Registro con Google o Discord a medio hacer (hasta que completes el perfil).
    // credencial: la credencial de Google o el ticket de Discord. nonce: solo Discord.
    export type RegistroPendiente =
    | { proveedor: 'google'; credencial: string; datos: DatosGoogle }
    | { proveedor: 'discord'; credencial: string; nonce: string; datos: DatosDiscord };

    // Lo que completás en "Completá tu perfil" (correo y foto los pone Google o Discord).
    export interface DatosRegistroGoogle {
    nombre: string;
    apellido: string;
    nombreUsuario: string;
    fechaNacimiento: string; // 'YYYY-MM-DD'
    descripcion: string;
    }

    // POST /auth/google responde una de dos cosas (el campo "nuevo" dice cuál):
    type RespuestaGoogle =
    | ({ nuevo: false } & RespuestaAuth) // ya tenías cuenta: entrás
    | { nuevo: true; datos: DatosGoogle }; // primera vez: falta completar el perfil

    // POST /auth/discord: igual que Google.
    type RespuestaDiscord =
    | ({ nuevo: false } & RespuestaAuth)
    | { nuevo: true; datos: DatosDiscord };

    // Discord (extra): el "nonce" es un texto al azar que guardamos en ESTE navegador antes
    // de ir a Discord, y vuelve adentro del ticket. El back revisa que coincidan: así nadie
    // te puede mandar un link con SU ticket (por ejemplo, para vincular su Discord a tu cuenta).
    // sessionStorage: dura lo que la pestaña abierta (no queda guardado para siempre).
    const CLAVE_NONCE_DISCORD = 'tonari-nonce-discord';

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

    // Cuándo vence el token, en milisegundos (null = no hay token).
    // Se lee del "exp" que viene adentro del token. computed: se recalcula solo
    // cada vez que cambia el token (login, refrescar, salir).
    readonly vencimiento = computed(() => leerVencimiento(this.tokenGuardado()));

    // Registro con Google o Discord a medio hacer: la credencial (o el ticket) y lo que
    // nos dieron, hasta que completes el perfil. Solo en memoria (no en localStorage): la
    // credencial sirve para entrar como vos, así que no la dejamos guardada.
    // Si recargás "Completá tu perfil", se pierde y volvés a tocar el botón.
    private readonly pendiente = signal<RegistroPendiente | null>(null);
    readonly registroPendiente = this.pendiente.asReadonly();

    // POST /auth/registro. Va como FormData (multipart/form-data) porque puede
    // llevar un archivo: con JSON no se puede mandar una imagen.
    // La foto es obligatoria (sin ella, el back responde 400).
    // El back devuelve { usuario, token }: guardamos la sesión y le pasamos
    // al componente solo el usuario (map).
    registro(datos: DatosRegistro, imagenPerfil: File) {
        const formData = new FormData();
        for (const [campo, valor] of Object.entries(datos)) {
        formData.append(campo, valor);
        }
        formData.append('imagenPerfil', imagenPerfil);

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

    // ---------- Olvidé mi contraseña (extra) ----------

    // POST /auth/recuperar: el back manda un mail con el link (si hay una cuenta con
    // ese correo). Responde lo mismo exista o no, así que no hay nada que guardar.
    recuperar(correo: string) {
        return this.http.post<{ mensaje: string }>(`${this.url}/recuperar`, { correo });
    }

    // POST /auth/restablecer/verificar: ¿el link del mail todavía sirve? (400 si no)
    verificarRecuperacion(token: string) {
        return this.http.post<{ valido: true }>(`${this.url}/restablecer/verificar`, { token });
    }

    // POST /auth/restablecer: guarda la contraseña nueva. No inicia sesión:
    // después de esto vas al login y entrás con ella.
    restablecer(token: string, contraseña: string) {
        return this.http.post<{ mensaje: string }>(`${this.url}/restablecer`, {
        token,
        contraseña,
        });
    }

    // POST /auth/google: tocaste "Continuar con Google" y Google nos dio la credencial.
    // Devuelve el usuario si ya tenías cuenta (y queda la sesión iniciada),
    // o null si es la primera vez (guardamos lo de Google para completar el perfil).
    loginGoogle(credencial: string) {
        return this.http
        .post<RespuestaGoogle>(`${this.url}/google`, { credential: credencial })
        .pipe(
            tap((respuesta) => {
            if (respuesta.nuevo) {
                this.pendiente.set({ proveedor: 'google', credencial, datos: respuesta.datos });
            }
            else this.iniciarSesion(respuesta);
            }),
            map((respuesta) => (respuesta.nuevo ? null : respuesta.usuario)),
        );
    }

    // POST /auth/google/registro: completaste el perfil. Va como JSON (no hay archivo:
    // la foto es la de Google). El back responde { usuario, token }, igual que el registro.
    registroGoogle(credencial: string, datos: DatosRegistroGoogle) {
        return this.http
        .post<RespuestaAuth>(`${this.url}/google/registro`, { credential: credencial, ...datos })
        .pipe(
            tap((respuesta) => {
            this.pendiente.set(null);
            this.iniciarSesion(respuesta);
            }),
            map((respuesta) => respuesta.usuario),
        );
    }

    // ---------- Discord (extra) ----------

    // La dirección a la que va el botón "Continuar con Discord" (o "Vincular").
    // Es un link común (no un pedido con HttpClient): el navegador va al back, el back
    // lo manda a Discord y Discord lo devuelve a /ingreso-discord con el ticket.
    urlDiscord(modo: 'ingreso' | 'vincular') {
        const nonce = crypto.randomUUID();
        try {
        sessionStorage.setItem(CLAVE_NONCE_DISCORD, nonce);
        } catch {
        // sin sessionStorage (modo privado raro): el back lo va a rechazar y se avisa
        }
        const parametros = new URLSearchParams({ modo, nonce });
        return `${this.url}/discord?${parametros}`;
    }

    // El nonce que guardamos antes de ir a Discord. Se borra al usarlo (sirve una vez).
    tomarNonceDiscord() {
        try {
        const nonce = sessionStorage.getItem(CLAVE_NONCE_DISCORD);
        sessionStorage.removeItem(CLAVE_NONCE_DISCORD);
        return nonce;
        } catch {
        return null;
        }
    }

    // POST /auth/discord: igual que loginGoogle. Devuelve el usuario si ya tenías cuenta,
    // o null si es la primera vez (guardamos lo de Discord para "Completá tu perfil").
    loginDiscord(ticket: string, nonce: string) {
        return this.http.post<RespuestaDiscord>(`${this.url}/discord`, { ticket, nonce }).pipe(
        tap((respuesta) => {
            if (respuesta.nuevo) {
            this.pendiente.set({ proveedor: 'discord', credencial: ticket, nonce, datos: respuesta.datos });
            } else {
            this.iniciarSesion(respuesta);
            }
        }),
        map((respuesta) => (respuesta.nuevo ? null : respuesta.usuario)),
        );
    }

    // POST /auth/discord/registro: completaste el perfil.
    registroDiscord(ticket: string, nonce: string, datos: DatosRegistroGoogle) {
        return this.http
        .post<RespuestaAuth>(`${this.url}/discord/registro`, { ticket, nonce, ...datos })
        .pipe(
            tap((respuesta) => {
            this.pendiente.set(null);
            this.iniciarSesion(respuesta);
            }),
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
        this.pendiente.set(null);
        this.guardarToken(null);
    }

    // PATCH /usuarios/:id: editar mi perfil (multipart por si trae foto nueva).
    // Con la respuesta actualizamos el usuario guardado: así el menú, Mi Perfil
    // y las publicaciones muestran los datos nuevos al instante.
    // banner (extra): una imagen nueva para el banner, o quitarBanner=true para borrarlo.
    actualizarPerfil(
        id: string,
        datos: DatosPerfil,
        imagenPerfil: File | null,
        banner: File | null = null,
        quitarBanner = false,
    ) {
        const formData = new FormData();
        for (const [campo, valor] of Object.entries(datos)) {
        formData.append(campo, valor);
        }
        if (imagenPerfil) formData.append('imagenPerfil', imagenPerfil);
        if (banner) formData.append('banner', banner);
        else if (quitarBanner) formData.append('quitarBanner', 'true');

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

    // El payload es la parte del medio del token (encabezado.PAYLOAD.firma), en base64url.
    // No está encriptado: cualquiera lo puede leer (lo que no se puede es cambiarlo).
    // atob decodifica base64; antes cambiamos - y _ por + y /, que es la diferencia con base64.
    // exp viene en SEGUNDOS (estándar JWT) y Date.now() usa milisegundos: por eso * 1000.
    function leerVencimiento(token: string | null): number | null {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
        return null; // token con formato raro: lo tratamos como si no hubiera
    }
    }