import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, retry, shareReplay, throwError, timeout, timer } from 'rxjs';
import { IFicha, IObra, TipoObra } from '../interfaces/biblioteca';

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

// La consulta de la ficha: UNA obra por su id, con más datos que la búsqueda.
const CONSULTA_FICHA = `
  query ($id: Int) {
    Media(id: $id) {
      id
      idMal
      title { romaji english native }
      description(asHtml: false)
      format
      status
      episodes
      chapters
      startDate { year }
      genres
      averageScore
      bannerImage
      coverImage { extraLarge }
      siteUrl
      nextAiringEpisode { episode airingAt }
    }
  }
`;

interface FichaAnilist {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
  startDate: { year: number | null } | null;
  genres: string[] | null;
  averageScore: number | null; // de 0 a 100
  bannerImage: string | null;
  coverImage: { extraLarge: string | null } | null;
  siteUrl: string;
  nextAiringEpisode: { episode: number; airingAt: number } | null; // solo si se está emitiendo
}

// "Esta semana sale" (extra): de VARIOS animes a la vez (id_in = "el id es alguno de
// esta lista"), cuándo sale el próximo episodio. Un solo pedido para todos.
// airingAt viene en SEGUNDOS desde 1970 (Unix); JavaScript usa milisegundos.
const CONSULTA_PROXIMOS = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`;

// El próximo episodio de un anime que se está emitiendo.
export interface ProximoEpisodio {
  episodio: number;
  fecha: Date;
}

// "Temporadas nuevas" (extra): en AniList cada temporada es una obra distinta,
// conectada con la anterior por una relación SEQUEL ("secuela").
// De tus animes, pedimos sus relaciones y nos quedamos con las secuelas. Un solo pedido.
const CONSULTA_SECUELAS = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        relations {
          edges {
            relationType
            node {
              id
              type
              format
              status
              title { romaji english }
              coverImage { large }
              episodes
              startDate { year month day }
              nextAiringEpisode { episode airingAt }
            }
          }
        }
      }
    }
  }
`;

// RELEASING = está saliendo · NOT_YET_RELEASED = anunciada · FINISHED = ya terminó
export type EstadoSecuela = 'RELEASING' | 'NOT_YET_RELEASED' | 'FINISHED';

// Una secuela de un anime que tenés (la temporada que sigue, una película que continúa...).
export interface Secuela {
  origen: number; // id de AniList de TU anime (del que es secuela)
  obra: IObra; // lo necesario para agregarla a la biblioteca
  estado: EstadoSecuela;
  estreno: { year: number | null; month: number | null; day: number | null } | null;
  proximo: ProximoEpisodio | null; // si está saliendo
}

interface NodoSecuela {
  id: number;
  type: string;
  format: string | null;
  status: string | null;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null } | null;
  episodes: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

// El estado de publicación, según sea anime (se emite) o manga (se publica).
const ESTADOS_PUBLICACION: Record<string, [string, string]> = {
  RELEASING: ['En emisión', 'En publicación'],
  FINISHED: ['Finalizado', 'Finalizado'],
  NOT_YET_RELEASED: ['Próximamente', 'Próximamente'],
  CANCELLED: ['Cancelado', 'Cancelado'],
  HIATUS: ['En pausa', 'En pausa'],
};

// Las tapas de los animes en tendencia ahora mismo (para la portada del login y el registro).
const CONSULTA_TENDENCIAS = `
  query {
    Page(perPage: 3) {
      media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
        coverImage { large }
      }
    }
  }
`;

@Service()
export class Anilist {
  private readonly http = inject(HttpClient);

  // shareReplay: se piden una sola vez aunque pases del login al registro y vuelvas.
  // (Si falla, shareReplay se "resetea" y la próxima vez lo vuelve a intentar.)
  private readonly tendencias = this.http
    .post<{ data: { Page: { media: { coverImage: { large: string | null } | null }[] } } }>(
      URL_ANILIST,
      { query: CONSULTA_TENDENCIAS },
    )
    .pipe(
      timeout(8000),
      map((respuesta) =>
        respuesta.data.Page.media.map((m) => m.coverImage?.large).filter((url): url is string => !!url),
      ),
      shareReplay(1),
    );

  tapasEnTendencia() {
    return this.tendencias;
  }

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

  // La ficha de una obra (sinopsis, géneros, banner...).
  detalle(idAnilist: number, tipo: TipoObra) {
    return this.http
      .post<{ data: { Media: FichaAnilist } }>(URL_ANILIST, {
        query: CONSULTA_FICHA,
        variables: { id: idAnilist },
      })
      .pipe(
        timeout(8000),
        retry({
          count: 1,
          delay: (error) => (error?.status === 429 ? throwError(() => error) : timer(1000)),
        }),
        map(({ data }) => this.aFicha(data.Media, tipo)),
      );
  }

  // Devuelve un Map: id de AniList -> su próximo episodio. Los que no se están
  // emitiendo (terminados, en pausa) no aparecen en el Map. Máximo 50 ids por pedido.
  proximosEpisodios(ids: number[]) {
    return this.http
      .post<{
        data: { Page: { media: { id: number; nextAiringEpisode: { episode: number; airingAt: number } | null }[] } };
      }>(URL_ANILIST, { query: CONSULTA_PROXIMOS, variables: { ids: ids.slice(0, 50) } })
      .pipe(
        timeout(8000),
        retry({
          count: 1,
          delay: (error) => (error?.status === 429 ? throwError(() => error) : timer(1000)),
        }),
        map(({ data }) => {
          const proximos = new Map<number, ProximoEpisodio>();
          for (const m of data.Page.media) {
            if (m.nextAiringEpisode) {
              proximos.set(m.id, {
                episodio: m.nextAiringEpisode.episode,
                fecha: new Date(m.nextAiringEpisode.airingAt * 1000),
              });
            }
          }
          return proximos;
        }),
      );
  }

  // Las secuelas (anime) de esos animes. Solo las que están saliendo, anunciadas o
  // terminadas (no las canceladas). Si dos de tus animes apuntan a la misma secuela,
  // va una sola vez.
  // También devuelve sus PRECUELAS (lo que viene antes): si tenés la temporada 3,
  // su precuela es la 2 -> ya la viste, aunque no esté en tu biblioteca.
  //   idsPrecuelas: todas (para no recomendarte como "nueva" algo que ya pasaste).
  //   precuelas: solo las que son SERIES ya terminadas (TV, TV corto, ONA), con sus datos,
  //   para "Completá tu biblioteca". Películas y especiales no: esos no se dan por vistos.
  secuelas(ids: number[]) {
    return this.http
      .post<{
        data: {
          Page: {
            media: { id: number; relations: { edges: { relationType: string; node: NodoSecuela }[] } | null }[];
          };
        };
      }>(URL_ANILIST, { query: CONSULTA_SECUELAS, variables: { ids: ids.slice(0, 50) } })
      .pipe(
        timeout(8000),
        retry({
          count: 1,
          delay: (error) => (error?.status === 429 ? throwError(() => error) : timer(1000)),
        }),
        map(({ data }) => {
          const porId = new Map<number, Secuela>();
          const idsPrecuelas = new Set<number>();
          const precuelas = new Map<number, Secuela>();
          for (const m of data.Page.media) {
            for (const { relationType, node } of m.relations?.edges ?? []) {
              if (relationType === 'PREQUEL' && node.type === 'ANIME') {
                idsPrecuelas.add(node.id);
                const esSerie = ['TV', 'TV_SHORT', 'ONA'].includes(node.format ?? '');
                if (esSerie && node.status === 'FINISHED' && !precuelas.has(node.id)) {
                  precuelas.set(node.id, aSecuela(m.id, node));
                }
                continue;
              }
              const estado = node.status as EstadoSecuela;
              if (relationType !== 'SEQUEL' || node.type !== 'ANIME') continue;
              if (!['RELEASING', 'NOT_YET_RELEASED', 'FINISHED'].includes(estado)) continue;
              if (porId.has(node.id)) continue;
              porId.set(node.id, aSecuela(m.id, node));
            }
          }
          return { secuelas: [...porId.values()], idsPrecuelas, precuelas: [...precuelas.values()] };
        }),
      );
  }

  private aFicha(m: FichaAnilist, tipo: TipoObra): IFicha {
    const estado = m.status ? ESTADOS_PUBLICACION[m.status] : undefined;
    return {
      titulo: m.title.romaji ?? m.title.english ?? 'Sin título',
      tituloIngles: m.title.english,
      tituloNativo: m.title.native,
      sinopsis: m.description ? textoPlano(m.description) : null,
      generos: m.genres ?? [],
      formato: m.format ? (FORMATOS[m.format] ?? m.format) : null,
      estadoPublicacion: estado ? estado[tipo === 'anime' ? 0 : 1] : null,
      anio: m.startDate?.year ?? null,
      total: (tipo === 'anime' ? m.episodes : m.chapters) ?? null,
      // Si el próximo episodio que sale es el 1150, ya salieron 1149.
      emitidos: m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null,
      // airingAt viene en segundos (Unix); Date usa milisegundos.
      proximoEpisodio: m.nextAiringEpisode
        ? { episodio: m.nextAiringEpisode.episode, fecha: new Date(m.nextAiringEpisode.airingAt * 1000) }
        : null,
      puntajeAnilist: m.averageScore !== null ? m.averageScore / 10 : null,
      banner: m.bannerImage,
      tapa: m.coverImage?.extraLarge ?? null,
      urlAnilist: m.siteUrl,
      idMal: m.idMal,
    };
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

// La sinopsis de AniList trae algo de HTML (<br>, <i>) y entidades (&quot;).
// Los <br> pasan a saltos de línea y el resto lo "limpia" el propio navegador:
// DOMParser arma el HTML sin mostrarlo ni ejecutar nada, y textContent devuelve solo el texto.
// Así no usamos [innerHTML] con contenido que viene de afuera.
function textoPlano(html: string): string {
  const conSaltos = html.replace(/<br\s*\/?>/gi, '\n');
  const texto = new DOMParser().parseFromString(conSaltos, 'text/html').body.textContent ?? '';
  return texto.replace(/\n{3,}/g, '\n\n').trim();
}

// Una obra relacionada de AniList (secuela o precuela) en el formato que usa TONARI.
// origen: el anime TUYO del que es secuela/precuela.
function aSecuela(origen: number, node: NodoSecuela): Secuela {
  return {
    origen,
    estado: node.status as EstadoSecuela,
    estreno: node.startDate,
    proximo: node.nextAiringEpisode
      ? { episodio: node.nextAiringEpisode.episode, fecha: new Date(node.nextAiringEpisode.airingAt * 1000) }
      : null,
    obra: {
      idAnilist: node.id,
      tipo: 'anime',
      titulo: node.title.romaji ?? node.title.english ?? 'Sin título',
      imagen: node.coverImage?.large ?? undefined,
      total: node.episodes,
      anio: node.startDate?.year ?? null,
      formato: node.format ? (FORMATOS[node.format] ?? node.format) : null,
    },
  };
}
