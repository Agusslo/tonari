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
      nextAiringEpisode { episode }
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
  nextAiringEpisode: { episode: number } | null; // solo si se está emitiendo
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

  private aFicha(m: FichaAnilist, tipo: TipoObra): IFicha {
    const estado = m.status ? ESTADOS_PUBLICACION[m.status] : undefined;
    return {
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
