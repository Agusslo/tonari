import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { CapitulosMangaDto } from './dto/capitulos-manga.dto.js';

// MangaDex (https://mangadex.org) tiene una API pública y gratis (sin clave para leer).
// La usamos SOLO para saber qué capítulos tiene un manga y en qué tomo está cada uno:
// no mostramos ni guardamos el contenido de los capítulos.
//
// ¿Por qué la llama el back y no el navegador?
//  - MangaDex no deja que otras páginas la usen directo desde el navegador.
//  - Pide identificarse con un User-Agent propio (el navegador no deja cambiarlo).
//  - Así guardamos la respuesta un rato (caché) y no le pedimos lo mismo cada vez.
const URL_MANGADEX = 'https://api.mangadex.org';
const AGENTE = 'TONARI/1.0 (proyecto de la UTN Avellaneda)';
const DURACION_CACHE_MS = 6 * 60 * 60 * 1000; // 6 horas

export interface TomoCapitulos {
  tomo: string | null; // null = capítulos que todavía no salieron en un tomo
  capitulos: number[];
}

export interface CapitulosManga {
  encontrado: boolean; // false = ese manga no está en MangaDex
  ultimo: number | null; // el último capítulo que hay
  tomos: TomoCapitulos[];
  urlMangadex: string | null;
}

// Solo los campos de MangaDex que usamos.
interface MangaMangadex {
  id: string;
  attributes: { links: Record<string, string> | null };
}

interface AgregadoMangadex {
  volumes: Record<string, { volume: string; chapters: Record<string, { chapter: string }> }>;
}

@Injectable()
export class MangadexService {
  private readonly logger = new Logger(MangadexService.name);

  // Caché en memoria: idAnilist -> respuesta y cuándo se guardó.
  // Vive mientras el servidor esté prendido (en Vercel, mientras la función siga "caliente").
  private readonly cache = new Map<number, { guardado: number; datos: CapitulosManga }>();

  async capitulos(idAnilist: number, { titulo, alternativo, idMal }: CapitulosMangaDto) {
    const enCache = this.cache.get(idAnilist);
    if (enCache && Date.now() - enCache.guardado < DURACION_CACHE_MS) return enCache.datos;

    try {
      // 1) Encontrar el manga en MangaDex: se busca por título y se confirma con
      //    el id de AniList (o de MyAnimeList) que MangaDex guarda en "links".
      let manga: MangaMangadex | undefined;
      for (const texto of [titulo, alternativo]) {
        if (!texto || manga) continue;
        manga = await this.buscar(texto, idAnilist, idMal);
      }

      let datos: CapitulosManga = { encontrado: false, ultimo: null, tomos: [], urlMangadex: null };
      if (manga) {
        // 2) "aggregate": todos los capítulos agrupados por tomo, en una sola respuesta.
        const agregado = await this.pedir<AgregadoMangadex>(`/manga/${manga.id}/aggregate`);
        const tomos = ordenarTomos(agregado.volumes);
        const todos = tomos.flatMap((t) => t.capitulos);
        datos = {
          encontrado: true,
          ultimo: todos.length ? Math.max(...todos) : null,
          tomos,
          urlMangadex: `https://mangadex.org/title/${manga.id}`,
        };
      }

      this.cache.set(idAnilist, { guardado: Date.now(), datos });
      return datos;
    } catch (error) {
      this.logger.warn(`MangaDex no respondió: ${(error as Error).message}`);
      throw new BadGatewayException('MangaDex no responde en este momento'); // 502
    }
  }

  private async buscar(titulo: string, idAnilist: number, idMal?: number) {
    const params = new URLSearchParams({ title: titulo, limit: '10' });
    const { data } = await this.pedir<{ data: MangaMangadex[] }>(`/manga?${params}`);
    return data.find((m) => {
      const links = m.attributes.links ?? {};
      return links.al === String(idAnilist) || (idMal !== undefined && links.mal === String(idMal));
    });
  }

  // fetch viene con Node (no hace falta instalar nada). Si en 8 segundos
  // no contestó, se corta (AbortSignal.timeout).
  private async pedir<T>(ruta: string): Promise<T> {
    const respuesta = await fetch(URL_MANGADEX + ruta, {
      headers: { 'User-Agent': AGENTE },
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return (await respuesta.json()) as T;
  }
}

// MangaDex devuelve un objeto { "1": {...}, "2": {...}, "none": {...} }.
// Lo pasamos a una lista ordenada: tomo 1, 2, 3... y al final los capítulos sin tomo
// (los más nuevos, que todavía no salieron en un tomo).
// Los capítulos "extra" (10.5) se saltean: el progreso se cuenta en capítulos enteros.
function ordenarTomos(volumes: AgregadoMangadex['volumes']): TomoCapitulos[] {
  const vistos = new Set<number>(); // un capítulo puede figurar en dos tomos: va en el primero
  return Object.values(volumes)
    .map((v) => ({
      tomo: v.volume === 'none' ? null : v.volume,
      capitulos: Object.values(v.chapters)
        .map((c) => Number(c.chapter))
        .filter((n) => Number.isInteger(n) && n > 0),
    }))
    .sort((a, b) => numeroTomo(a.tomo) - numeroTomo(b.tomo))
    .map((t) => ({
      tomo: t.tomo,
      capitulos: t.capitulos
        .sort((a, b) => a - b)
        .filter((n) => {
          if (vistos.has(n)) return false;
          vistos.add(n);
          return true;
        }),
    }))
    .filter((t) => t.capitulos.length > 0);
}

function numeroTomo(tomo: string | null) {
  const n = Number(tomo);
  return tomo === null || Number.isNaN(n) ? Infinity : n;
}
