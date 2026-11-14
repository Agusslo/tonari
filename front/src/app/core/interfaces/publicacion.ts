    // Forma de una publicación tal como la devuelve el back.
    import { TipoObra } from './biblioteca';

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
    encuesta?: IEncuesta; // extra: solo si tiene encuesta
    spoiler?: ISpoiler; // extra: solo si el autor avisó spoilers
    activa: boolean;
    createdAt: string;
    updatedAt: string;
    }

    // ---------- Encuesta (extra) ----------
    // El back la arma para QUIEN MIRA: votos es null si todavía no podés ver resultados
    // (no votaste, no cerró y no es tuya).
    export interface IOpcionEncuesta {
    texto: string;
    votos: number | null;
    }

    export interface IEncuesta {
    opciones: IOpcionEncuesta[];
    cierra: string; // fecha en que cierra
    cerrada: boolean;
    totalVotos: number;
    miVoto: number | null; // la posición que votaste, o null
    verResultados: boolean;
    }

    // Lo que se manda al crear: la pregunta es el título.
    export interface INuevaEncuesta {
    opciones: string[];
    duracionHoras: number; // 24, 72 o 168
    }

    // ---------- Spoiler (extra) ----------
    // liberado: por qué NO se tapa (sos el autor, la completaste o ya vas por ese
    // episodio/capítulo). null = se tapa. Lo decide el back mirando tu biblioteca.
    export interface ISpoiler {
    tipo: TipoObra;
    idAnilist: number;
    titulo: string;
    hasta: number | null; // null = de toda la obra
    liberado: 'autor' | 'completado' | 'progreso' | null;
    miProgreso: number | null; // por dónde vas vos (null = no la tenés)
    }

    export interface INuevoSpoiler {
    tipo: TipoObra;
    idAnilist: number;
    titulo: string;
    hasta: number | null;
    }

    // Lo que devuelve GET /publicaciones: una página y el total.
    // Papelera del admin (extra): una publicación dada de baja.
    // eliminadaPor / eliminadaEn quedan en null en las bajas viejas (antes de la papelera).
    export interface IPublicacionEliminada
    extends Pick<
        IPublicacion,
        '_id' | 'titulo' | 'descripcion' | 'imagen' | 'usuario' | 'cantidadMeGusta' | 'cantidadComentarios' | 'createdAt'
    > {
    eliminadaPor: { _id: string; nombreUsuario: string; perfil: 'usuario' | 'administrador' } | null;
    eliminadaEn: string | null;
    }

    export interface IPaginaPapelera {
    publicaciones: IPublicacionEliminada[];
    total: number;
    offset: number;
    limit: number;
    }

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