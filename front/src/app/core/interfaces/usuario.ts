    // Forma del usuario que devuelve el back (registro y login).
    // Nunca trae la contraseña: el back la saca antes de responder.
    export default interface IUsuario {
    _id: string;
    nombre: string;
    apellido: string;
    correo: string;
    nombreUsuario: string;
    fechaNacimiento: string; // fecha en formato ISO, ej. '2004-12-04T00:00:00.000Z'
    descripcion: string;
    imagenPerfil: string; // URL de la imagen
    banner?: string; // imagen ancha de arriba del perfil (extra, opcional)
    perfil: 'usuario' | 'administrador';
    habilitado: boolean;
    createdAt: string;
    updatedAt: string;
    // Cuentas vinculadas (extra): solo están si las vinculó.
    googleId?: string;
    discordId?: string;
    discordUsuario?: string;
    mostrarDiscord?: boolean;
    }

    // Discord (extra) en un perfil público: solo si lo vinculó y eligió mostrarlo.
    export interface IDiscordPublico {
    id: string; // para el link "Ver en Discord" (discord.com/users/<id>)
    usuario: string; // el nombre que se busca en "Agregar amigo"
    }
    // Lo que se ve del perfil de OTRO usuario (GET /usuarios/:nombreUsuario):
    // solo los datos públicos, sin correo ni fecha de nacimiento.
    export interface IPerfilPublico {
    _id: string;
    nombre: string;
    apellido: string;
    nombreUsuario: string;
    imagenPerfil: string;
    banner?: string;
    descripcion: string;
    perfil: 'usuario' | 'administrador';
    createdAt: string;
    discord: IDiscordPublico | null; // Discord (extra)
    // "Seguir" (extra)
    seguidores: number; // cuántos lo siguen
    siguiendo: number; // a cuántos sigue
    loSigo: boolean; // si YO (el que mira) lo sigo
    meSigue: boolean; // si ÉL me sigue a mí ("Te sigue")
    }

    // Lo que devuelven seguir / dejar de seguir: los números actualizados.
    export type IResumenSeguir = Pick<IPerfilPublico, 'seguidores' | 'siguiendo' | 'loSigo' | 'meSigue'>;

    // Un usuario en el listado del dashboard (GET /usuarios, solo administradores).
    // Trae el correo y si está habilitado, pero no la fecha de nacimiento ni la descripción.
    export type IUsuarioAdmin = Pick<
    IUsuario,
    | '_id'
    | 'nombre'
    | 'apellido'
    | 'correo'
    | 'nombreUsuario'
    | 'imagenPerfil'
    | 'perfil'
    | 'habilitado'
    | 'googleId'
    | 'discordId'
    | 'createdAt'
    >;
