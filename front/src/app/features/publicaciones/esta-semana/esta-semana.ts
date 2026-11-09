import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, concatMap, from, of } from 'rxjs';
import { BibliotecaApi } from '../../../core/services/biblioteca-api';
import { Anilist, Secuela } from '../../../core/services/anilist';
import { CatalogoApi } from '../../../core/services/catalogo-api';
import IEntrada from '../../../core/interfaces/biblioteca';
import { rutaFicha } from '../../../shared/utils/rutas';
import { cuandoSale } from '../../../shared/utils/fechas';
import { ImagenRespaldoDirective } from '../../../shared/directives/imagen-respaldo.directive';

const SEMANA = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos
const MAX_TEMPORADAS = 4; // para que el panel no se haga eterno
const MAX_MANGAS = 8; // a cuántos mangas les preguntamos (de a uno: MangaDex limita los pedidos)
const CLAVE_OCULTAS = 'tonari-secuelas-ocultas'; // las que tocaste "No me interesa"

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Un anime que estás viendo y saca episodio en los próximos 7 días.
interface Estreno {
  entrada: IEntrada;
  episodio: number;
  fecha: Date;
  sinVer: number; // episodios que YA salieron y todavía no viste
}

// Un manga que estás leyendo y tiene capítulos que no leíste.
interface MangaNuevo {
  entrada: IEntrada;
  ultimo: number; // el último capítulo que hay en MangaDex
  nuevos: number; // cuántos te faltan
}

type Estado = 'cargando' | 'listo' | 'error';

// Novedades (extra), en la columna del muro (o arriba del muro en el celular). Tres bloques:
//  1. Esta semana sale: los animes que estás viendo y sacan episodio en 7 días (AniList).
//  2. Temporadas nuevas: secuelas de tus animes que no tenés en la biblioteca (AniList),
//     para enterarte de la temporada 3 sin buscarla. Botón para agregarla.
//  3. Manga: capítulos nuevos de lo que estás leyendo (MangaDex, a través de nuestro back).
//  4. Completá tu biblioteca: si estás viendo la temporada 3 y no tenés la 2, te pregunta
//     si ya la viste ("Sí, la vi" la agrega como Completado). No la marca sola: podés
//     haberla salteado, y tu biblioteca la llenás vos.
// Todo arranca de tu biblioteca: un solo pedido a nuestro back, y de ahí cada bloque
// hace lo suyo por separado (si uno tarda o falla, los otros se ven igual).
@Component({
  selector: 'app-esta-semana',
  imports: [RouterLink, ImagenRespaldoDirective],
  templateUrl: './esta-semana.html',
  styleUrl: './esta-semana.css',
})
export class EstaSemana {
  private readonly bibliotecaApi = inject(BibliotecaApi);
  private readonly anilist = inject(Anilist);
  private readonly catalogoApi = inject(CatalogoApi);
  // takeUntilDestroyed(this.destruir): si te vas de la pantalla, se cortan los pedidos.
  private readonly destruir = inject(DestroyRef);

  // sin-obras = no tenés nada para seguir (mostramos cómo empezar).
  protected readonly general = signal<'cargando' | 'listo' | 'sin-obras' | 'error'>('cargando');

  protected readonly estrenos = signal<Estreno[]>([]);
  protected readonly estadoEstrenos = signal<Estado>('cargando');

  private readonly secuelas = signal<Secuela[]>([]);
  protected readonly estadoTemporadas = signal<Estado>('cargando');
  private readonly ocultas = signal<Set<number>>(leerOcultas());
  protected readonly agregando = signal<number | null>(null); // id de la que se está agregando
  protected readonly errorAgregar = signal<string | null>(null);

  // Precuelas que te faltan registrar (series ya terminadas de lo que estás viendo o completaste).
  private readonly precuelas = signal<Secuela[]>([]);
  protected readonly marcandoTodas = signal(false);

  protected readonly mangas = signal<MangaNuevo[]>([]);
  protected readonly estadoMangas = signal<Estado>('cargando');

  // Título y estado de cada anime tuyo ("Sigue a Kusuriya", "Estás viendo Kusuriya 3rd Season").
  private readonly titulos = new Map<number, string>();
  private readonly estados = new Map<number, IEntrada['estado']>();

  // "Completá tu biblioteca": las que no ocultaste, hasta 4.
  protected readonly faltantes = computed(() =>
    this.precuelas()
      .filter((s) => !this.ocultas().has(s.obra.idAnilist))
      .slice(0, MAX_TEMPORADAS),
  );

  // Las secuelas para mostrar: sin las que ocultaste, primero las que están saliendo,
  // después las anunciadas y al final las que ya terminaron y te faltan.
  protected readonly temporadas = computed(() => {
    const orden = { RELEASING: 0, NOT_YET_RELEASED: 1, FINISHED: 2 };
    return this.secuelas()
      .filter((s) => !this.ocultas().has(s.obra.idAnilist))
      .sort((a, b) => orden[a.estado] - orden[b.estado])
      .slice(0, MAX_TEMPORADAS);
  });

  // ¿Ya terminó de cargar todo y no hay nada que contar?
  protected readonly nadaNuevo = computed(
    () =>
      this.estadoEstrenos() !== 'cargando' &&
      this.estadoTemporadas() !== 'cargando' &&
      this.estadoMangas() !== 'cargando' &&
      !this.estrenos().length &&
      !this.temporadas().length &&
      !this.faltantes().length &&
      !this.mangas().length,
  );

  protected readonly rutaFicha = rutaFicha;
  protected readonly cuando = cuandoSale;

  constructor() {
    this.bibliotecaApi
      .listar()
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (lista) => {
          // La biblioteca viene ordenada por lo último que tocaste: eso va primero en todo.
          const animes = lista.filter((e) => e.tipo === 'anime');
          const viendo = animes.filter((e) => e.estado === 'en-curso');
          const completados = animes.filter((e) => e.estado === 'completado');
          const leyendo = lista.filter((e) => e.tipo === 'manga' && e.estado === 'en-curso');
          for (const e of animes) {
            this.titulos.set(e.idAnilist, e.titulo);
            this.estados.set(e.idAnilist, e.estado);
          }

          if (!viendo.length && !completados.length && !leyendo.length) {
            this.general.set('sin-obras');
            return;
          }
          this.general.set('listo');
          this.cargarEstrenos(viendo);
          this.cargarTemporadas(viendo, completados, new Set(animes.map((e) => e.idAnilist)));
          this.cargarMangas(leyendo.slice(0, MAX_MANGAS));
        },
        error: () => this.general.set('error'),
      });
  }

  // ---------- 1. Esta semana sale ----------
  private cargarEstrenos(viendo: IEntrada[]) {
    if (!viendo.length) {
      this.estadoEstrenos.set('listo');
      return;
    }
    this.anilist
      .proximosEpisodios(viendo.map((e) => e.idAnilist))
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (proximos) => {
          const ahora = Date.now();
          const estrenos: Estreno[] = [];
          for (const entrada of viendo) {
            const proximo = proximos.get(entrada.idAnilist);
            if (!proximo || proximo.fecha.getTime() - ahora > SEMANA) continue;
            // Si el próximo es el 12, ya salieron 11: si vas por el 9, te faltan 2.
            const sinVer = Math.max(0, proximo.episodio - 1 - entrada.progreso);
            estrenos.push({ entrada, ...proximo, sinVer });
          }
          estrenos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
          this.estrenos.set(estrenos);
          this.estadoEstrenos.set('listo');
        },
        error: () => this.estadoEstrenos.set('error'),
      });
  }

  // ---------- 2. Temporadas nuevas ----------
  // De lo que estás viendo: secuelas que salen o están anunciadas (todavía no te faltan).
  // De lo que completaste: además, las que ya terminaron ("te falta la temporada 2").
  private cargarTemporadas(viendo: IEntrada[], completados: IEntrada[], tengo: Set<number>) {
    const origenes = [...completados, ...viendo].slice(0, 50); // AniList: hasta 50 por pedido
    if (!origenes.length) {
      this.estadoTemporadas.set('listo');
      return;
    }
    const completadas = new Set(completados.map((e) => e.idAnilist));
    this.anilist
      .secuelas(origenes.map((e) => e.idAnilist))
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: ({ secuelas, idsPrecuelas, precuelas }) => {
          // Las precuelas que no tenés: "¿ya viste esta?"
          this.precuelas.set(precuelas.filter((p) => !tengo.has(p.obra.idAnilist)));
          this.secuelas.set(
            secuelas.filter(
              (s) =>
                !tengo.has(s.obra.idAnilist) && // si ya la tenés (en cualquier estado), no hace falta avisar
                // Si algo tuyo viene DESPUÉS de esta (es su precuela), ya la viste:
                // estás en la temporada 3, no te recomendamos la 2.
                !idsPrecuelas.has(s.obra.idAnilist) &&
                (s.estado !== 'FINISHED' || completadas.has(s.origen)),
            ),
          );
          this.estadoTemporadas.set('listo');
        },
        error: () => this.estadoTemporadas.set('error'),
      });
  }

  // "Agregar": la suma a tu biblioteca con el POST /biblioteca de siempre.
  // Si está saliendo va a "Viendo" (y si sale esta semana, aparece arriba); si no, a "Pendiente".
  agregar(secuela: Secuela) {
    if (this.agregando() !== null) return;
    this.agregando.set(secuela.obra.idAnilist);
    this.errorAgregar.set(null);
    const estado = secuela.estado === 'RELEASING' ? 'en-curso' : 'pendiente';
    this.bibliotecaApi.agregar(secuela.obra, estado).subscribe({
      next: (entrada) => {
        this.agregando.set(null);
        this.quitarSecuela(secuela.obra.idAnilist);
        const p = secuela.proximo;
        if (estado === 'en-curso' && p && p.fecha.getTime() - Date.now() <= SEMANA) {
          this.estrenos.update((lista) =>
            [...lista, { entrada, ...p, sinVer: Math.max(0, p.episodio - 1) }].sort(
              (a, b) => a.fecha.getTime() - b.fecha.getTime(),
            ),
          );
        }
      },
      error: (error: HttpErrorResponse) => {
        this.agregando.set(null);
        // 409 = ya estaba en tu biblioteca (por ejemplo, la agregaste en otra pestaña).
        if (error.status === 409) this.quitarSecuela(secuela.obra.idAnilist);
        else this.errorAgregar.set('No pudimos agregarla. Probá de nuevo.');
      },
    });
  }

  // "No me interesa": no la vuelve a mostrar. Se guarda en ESTE navegador (localStorage):
  // es una preferencia chiquita de quien mira, no hace falta guardarla en la base.
  ocultar(secuela: Secuela) {
    this.ocultas.update((ocultas) => new Set(ocultas).add(secuela.obra.idAnilist));
    try {
      localStorage.setItem(CLAVE_OCULTAS, JSON.stringify([...this.ocultas()]));
    } catch {
      // modo incógnito o almacenamiento bloqueado: se oculta solo por ahora
    }
  }

  private quitarSecuela(id: number) {
    this.secuelas.update((lista) => lista.filter((s) => s.obra.idAnilist !== id));
  }

  // ---------- 4. Completá tu biblioteca ----------
  // "Sí, la vi": la agrega como Completado. El back pone el progreso en el total
  // (regla de siempre: Completado = viste todos los episodios).
  marcarVista(precuela: Secuela) {
    if (this.agregando() !== null || this.marcandoTodas()) return;
    this.agregando.set(precuela.obra.idAnilist);
    this.errorAgregar.set(null);
    this.bibliotecaApi.agregar(precuela.obra, 'completado').subscribe({
      next: () => {
        this.agregando.set(null);
        this.quitarPrecuela(precuela.obra.idAnilist);
      },
      error: (error: HttpErrorResponse) => {
        this.agregando.set(null);
        if (error.status === 409) this.quitarPrecuela(precuela.obra.idAnilist);
        else this.errorAgregar.set('No pudimos marcarla. Probá de nuevo.');
      },
    });
  }

  // "Marcar todas como vistas": de a una (concatMap), así si una falla las demás siguen.
  marcarTodas() {
    if (this.agregando() !== null || this.marcandoTodas()) return;
    this.marcandoTodas.set(true);
    this.errorAgregar.set(null);
    let fallaron = 0;
    from(this.faltantes())
      .pipe(
        concatMap((precuela) =>
          this.bibliotecaApi.agregar(precuela.obra, 'completado').pipe(
            concatMap(() => of(precuela.obra.idAnilist)),
            catchError((error: HttpErrorResponse) => {
              if (error.status === 409) return of(precuela.obra.idAnilist); // ya estaba: igual se saca
              fallaron++;
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe({
        next: (id) => {
          if (id !== null) this.quitarPrecuela(id);
        },
        complete: () => {
          this.marcandoTodas.set(false);
          if (fallaron) this.errorAgregar.set(`No pudimos marcar ${fallaron}. Probá de nuevo.`);
        },
      });
  }

  private quitarPrecuela(id: number) {
    this.precuelas.update((lista) => lista.filter((p) => p.obra.idAnilist !== id));
  }

  // "Estás viendo Kusuriya 3rd Season" / "Completaste Kusuriya 3rd Season"
  textoFaltante(p: Secuela) {
    const titulo = this.titulos.get(p.origen) ?? 'la que sigue';
    return this.estados.get(p.origen) === 'completado' ? `Completaste ${titulo}` : `Estás viendo ${titulo}`;
  }

  // ---------- 3. Manga: capítulos nuevos ----------
  // Usa la misma ruta que la ficha (GET /catalogo/manga/:id/capitulos): nuestro back le
  // pregunta a MangaDex y lo guarda 6 horas. De a UNO por vez (concatMap): si fueran todos
  // juntos, MangaDex nos frenaría por hacer muchos pedidos a la vez.
  // Se van mostrando a medida que llegan.
  private cargarMangas(leyendo: IEntrada[]) {
    if (!leyendo.length) {
      this.estadoMangas.set('listo');
      return;
    }
    from(leyendo)
      .pipe(
        concatMap((entrada) =>
          this.catalogoApi.capitulosManga(entrada.idAnilist, entrada.titulo).pipe(
            // Si un manga falla (MangaDex caído, no está), se saltea y siguen los demás.
            catchError(() => of(null)),
            concatMap((capitulos) => of({ entrada, capitulos })),
          ),
        ),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe({
        next: ({ entrada, capitulos }) => {
          const ultimo = capitulos?.ultimo;
          if (!ultimo || ultimo <= entrada.progreso) return;
          this.mangas.update((lista) =>
            [...lista, { entrada, ultimo, nuevos: ultimo - entrada.progreso }].sort(
              (a, b) => b.nuevos - a.nuevos,
            ),
          );
        },
        complete: () => this.estadoMangas.set('listo'),
      });
  }

  // ---------- Textos ----------
  textoSecuela(s: Secuela) {
    if (s.estado === 'RELEASING') {
      return s.proximo ? `Ep. ${s.proximo.episodio} · ${cuandoSale(s.proximo.fecha)}` : 'Ya está saliendo';
    }
    if (s.estado === 'FINISHED') {
      return s.obra.total ? `Ya salió completa · ${s.obra.total} ep.` : 'Ya salió completa';
    }
    const e = s.estreno;
    if (e?.year && e.month && e.day) return `Se estrena el ${dosCifras(e.day)}/${dosCifras(e.month)}/${e.year}`;
    if (e?.year && e.month) return `Se estrena en ${MESES[e.month - 1]} ${e.year}`;
    if (e?.year) return `Se estrena en ${e.year}`;
    return 'Anunciada, sin fecha';
  }

  etiquetaSecuela(s: Secuela) {
    return { RELEASING: 'Saliendo', NOT_YET_RELEASED: 'Anunciada', FINISHED: 'Te falta' }[s.estado];
  }

  tituloOrigen(s: Secuela) {
    return this.titulos.get(s.origen) ?? '';
  }

}

function dosCifras(n: number) {
  return String(n).padStart(2, '0');
}

// Las ocultas guardadas en este navegador. Si no se puede leer (incógnito), ninguna.
function leerOcultas(): Set<number> {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_OCULTAS) ?? '[]');
    return new Set(Array.isArray(guardadas) ? guardadas.filter((n) => typeof n === 'number') : []);
  } catch {
    return new Set();
  }
}
