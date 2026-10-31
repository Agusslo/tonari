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
    perfil: 'usuario' | 'administrador';
    habilitado: boolean;
    createdAt: string;
    updatedAt: string;
    }
    // Lo que se ve del perfil de OTRO usuario (GET /usuarios/:nombreUsuario):
    // solo los datos públicos, sin correo ni fecha de nacimiento.
    export interface IPerfilPublico {
    _id: string;
    nombre: string;
    apellido: string;
    nombreUsuario: string;
    imagenPerfil: string;
    descripcion: string;
    perfil: 'usuario' | 'administrador';
    createdAt: string;
    }
