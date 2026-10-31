import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, retry, throwError, timeout, timer } from 'rxjs';
import { IObra, TipoObra } from '../interfaces/biblioteca';

// AniList (https://anilist.co) es una API pública y gratuita de anime y manga.
// No pide clave. Límite: unos 90 pedidos por minuto.
// Usa GraphQL en vez de REST: siempre es UN pedido POST a la misma dirección,
// y en el cuerpo va una "consulta" que dice exactamente qué datos queremos.
const URL_ANILIST = 'https://graphql.anilist.co';

// La consulta: buscá en las obras (media) las que coincidan con el texto,
// de un tipo (ANIME o MANGA), sin contenido para adultos, las 12 más parecidas.
// Adentro de "media { ... }" se listan los campos que queremos: no viene nada más.
const CONSULTA = `
  query ($busqueda: String, $tipo: MediaType) {
    Page(perPage: 12) {
      media(search: $busqueda, type: $tipo, isAdult: false, sort: SEARCH_MATCH) {
        id
        title { romaji english }
        format
        episodes
        chapters
        startDate { year }
        coverImage { large }
      }
    }
  }
`;

// Solo los campos que pedimos en la consulta.
interface ResultadoAnilist {
  id: number;
  title: { romaji: string | null; english: string | null };
  format: string | null;
  episodes: number | null; // anime
  chapters: number | null; // manga
  startDate: { year: number | null } | null;
  coverImage: { large: string | null } | null;
}

interface RespuestaAnilist {
  data: { Page: { media: ResultadoAnilist[] } };
}

// AniList manda el formato en inglés y en mayúsculas: lo pasamos a algo lindo.
const FORMATOS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV corto',
  MOVIE: 'Película',
  SPECIAL: 'Especial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Música',
  MANGA: 'Manga',
  NOVEL: 'Novela ligera',
  ONE_SHOT: 'One shot',
};

@Service()
export class Anilist {
  private readonly http = inject(HttpClient);

  buscar(tipo: TipoObra, texto: string) {
    // Las "variables" completan los $busqueda y $tipo de la consulta.
    const cuerpo = {
      query: CONSULTA,
      variables: { busqueda: texto, tipo: tipo === 'anime' ? 'ANIME' : 'MANGA' },
    };

    return this.http.post<RespuestaAnilist>(URL_ANILIST, cuerpo).pipe(
      // timeout: si en 8 segundos no contestó, cortamos (así no queda cargando para siempre).
      timeout(8000),
      // retry: si falló, lo intenta UNA vez más después de 1 segundo
      // (salvo 429 = "muchos pedidos": reintentar enseguida empeora las cosas).
      retry({
        count: 1,
        delay: (error) => (error?.status === 429 ? throwError(() => error) : timer(1000)),
      }),
      // map "traduce" cada resultado de AniList a nuestra interfaz IObra.
      map((respuesta) => respuesta.data.Page.media.map((r) => this.aObra(r, tipo))),
    );
  }

  private aObra(r: ResultadoAnilist, tipo: TipoObra): IObra {
    return {
      idAnilist: r.id,
      tipo,
      // romaji = el título original escrito en letras latinas ("Shingeki no Kyojin").
      titulo: r.title.romaji ?? r.title.english ?? 'Sin título',
      imagen: r.coverImage?.large ?? undefined,
      total: (tipo === 'anime' ? r.episodes : r.chapters) ?? null,
      anio: r.startDate?.year ?? null,
      formato: r.format ? (FORMATOS[r.format] ?? r.format) : null,
    };
  }
}
