// Mi Biblioteca (extra): la lista de anime y manga de cada usuario.

export type TipoObra = 'anime' | 'manga';
export type EstadoEntrada = 'pendiente' | 'en-curso' | 'completado' | 'abandonado';

// Una obra en la biblioteca, tal como la devuelve el back.
export default interface IEntrada {
  _id: string;
  usuario: string;
  tipo: TipoObra;
  idAnilist: number; // id de la obra en AniList
  titulo: string;
  imagen?: string;
  total: number | null; // episodios o capítulos (null = no se sabe)
  estado: EstadoEntrada;
  progreso: number;
  puntuacion: number | null; // 1 a 10, o null si no la puntuaste
  createdAt: string;
  updatedAt: string;
}

// Un resultado de búsqueda de AniList, ya "traducido" a lo que usa TONARI.
export interface IObra {
  idAnilist: number;
  tipo: TipoObra;
  titulo: string;
  imagen?: string;
  total: number | null;
  anio: number | null;
  formato: string | null; // "TV", "Película", "Manga", "Novela ligera"...
}

// Lo que muestra la ficha de una obra (sale de AniList, no se guarda en nuestra base).
export interface IFicha {
  tituloIngles: string | null;
  tituloNativo: string | null; // en japonés
  sinopsis: string | null; // en inglés (AniList no la tiene en español)
  generos: string[];
  formato: string | null;
  estadoPublicacion: string | null; // "En emisión", "Finalizado"...
  anio: number | null;
  total: number | null;
  emitidos: number | null; // anime en emisión: episodios que ya salieron
  puntajeAnilist: number | null; // promedio de AniList, de 0 a 10
  banner: string | null; // imagen ancha para el fondo de la cabecera
  tapa: string | null; // tapa en alta calidad
  urlAnilist: string;
  idMal: number | null; // id en MyAnimeList, para el link
}

// Los textos de cada estado. "En curso" cambia según el tipo: viendo / leyendo.
export function nombreEstado(estado: EstadoEntrada, tipo: TipoObra): string {
  if (estado === 'en-curso') return tipo === 'anime' ? 'Viendo' : 'Leyendo';
  return { pendiente: 'Pendiente', completado: 'Completado', abandonado: 'Abandonado' }[estado];
}

export const ESTADOS: EstadoEntrada[] = ['en-curso', 'completado', 'pendiente', 'abandonado'];
