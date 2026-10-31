import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';

// Los capítulos de un manga agrupados por tomo (los consigue NUESTRO back desde MangaDex).
export interface TomoCapitulos {
  tomo: string | null; // null = capítulos que todavía no salieron en un tomo
  capitulos: number[];
}

export interface CapitulosManga {
  encontrado: boolean; // false = ese manga no está en MangaDex
  ultimo: number | null;
  tomos: TomoCapitulos[];
  urlMangadex: string | null;
}

export interface SinopsisTraducida {
  original: string; // en inglés, como viene de AniList
  traducida: string; // en español (traducción automática)
}

// Habla con /catalogo de nuestro back (el token lo pone el interceptor).
@Service()
export class CatalogoApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/catalogo`;

  // GET /catalogo/manga/:idAnilist/capitulos?titulo=...&alternativo=...&idMal=...
  capitulosManga(idAnilist: number, titulo: string, alternativo?: string | null, idMal?: number | null) {
    const params: Record<string, string> = { titulo };
    if (alternativo) params['alternativo'] = alternativo;
    if (idMal) params['idMal'] = String(idMal);
    return this.http.get<CapitulosManga>(`${this.url}/manga/${idAnilist}/capitulos`, { params });
  }

  // GET /catalogo/sinopsis/:idAnilist -> la sinopsis traducida al español
  // (el back la traduce la primera vez y después la guarda).
  sinopsis(idAnilist: number) {
    return this.http.get<SinopsisTraducida>(`${this.url}/sinopsis/${idAnilist}`);
  }
}
