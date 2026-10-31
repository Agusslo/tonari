    // Forma de una publicación tal como la devuelve el back.

    // El autor viene "populado": con sus datos públicos, nunca correo ni contraseña.
    export interface IAutor {
    _id: string;
    nombre: string;
    apellido: string;
    nombreUsuario: string;
    imagenPerfil: string;
    }

    export default interface IPublicacion {
    _id: string;
    titulo: string;
    descripcion: string;
    imagen?: string; // opcional: no todas tienen imagen
    usuario: IAutor;
    meGusta: string[]; // _id de los usuarios que dieron "Me gusta"
    cantidadMeGusta: number;
    cantidadComentarios: number; // la suma el back cada vez que alguien comenta
    activa: boolean;
    createdAt: string;
    updatedAt: string;
    }

    // Lo que devuelve GET /publicaciones: una página y el total.
    export interface IPaginaPublicaciones {
    publicaciones: IPublicacion[];
    total: number;
    offset: number;
    limit: number;
    }

    // Los parámetros que acepta GET /publicaciones (todos opcionales).
    export interface IParametrosListado {
    orden?: 'fecha' | 'meGusta';
    usuario?: string;
    offset?: number;
    limit?: number;
    siguiendo?: boolean; // solo las de la gente que sigo
    }