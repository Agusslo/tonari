import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { BibliotecaApi } from '../../../core/services/biblioteca-api';
import { Anilist } from '../../../core/services/anilist';
import IEntrada from '../../../core/interfaces/biblioteca';
import { rutaFicha } from '../../../shared/utils/rutas';
import { cuandoSale } from '../../../shared/utils/fechas';

const SEMANA = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

// Un anime que estás viendo y saca episodio en los próximos 7 días.
interface Estreno {
  entrada: IEntrada;
  episodio: number;
  fecha: Date;
  sinVer: number; // episodios que YA salieron y todavía no viste
}

// "Esta semana sale" (extra), en la columna del muro.
//  1. Trae tu biblioteca (nuestro back) y se queda con los animes en "Viendo".
//  2. Le pregunta a AniList, en UN pedido, cuándo sale el próximo episodio de cada uno.
//  3. Muestra los que salen en los próximos 7 días, el más cercano primero.
@Component({
  selector: 'app-esta-semana',
  imports: [RouterLink],
  templateUrl: './esta-semana.html',
  styleUrl: './esta-semana.css',
})
export class EstaSemana {
  private readonly bibliotecaApi = inject(BibliotecaApi);
  private readonly anilist = inject(Anilist);

  // sin-obras = no tenés ningún anime en "Viendo" (mostramos cómo empezar).
  protected readonly estado = signal<'cargando' | 'listo' | 'sin-obras' | 'error'>('cargando');
  protected readonly estrenos = signal<Estreno[]>([]);
  protected readonly rutaFicha = rutaFicha;

  constructor() {
    this.bibliotecaApi
      .listar()
      .pipe(
        map((lista) => lista.filter((e) => e.tipo === 'anime' && e.estado === 'en-curso')),
        // switchMap: con la biblioteca ya en la mano, hace el pedido a AniList.
        // Si no estás viendo nada, ni le pregunta (of(null) = "terminé, sin datos").
        switchMap((viendo) =>
          viendo.length
            ? this.anilist
                .proximosEpisodios(viendo.map((e) => e.idAnilist))
                .pipe(map((proximos) => ({ viendo, proximos })))
            : of(null),
        ),
        takeUntilDestroyed(), // si te vas de la pantalla, se corta
      )
      .subscribe({
        next: (resultado) => {
          if (!resultado) {
            this.estado.set('sin-obras');
            return;
          }
          const ahora = Date.now();
          const estrenos: Estreno[] = [];
          for (const entrada of resultado.viendo) {
            const proximo = resultado.proximos.get(entrada.idAnilist);
            if (!proximo || proximo.fecha.getTime() - ahora > SEMANA) continue;
            // Si el próximo es el 12, ya salieron 11: si vas por el 9, te faltan 2.
            const sinVer = Math.max(0, proximo.episodio - 1 - entrada.progreso);
            estrenos.push({ entrada, ...proximo, sinVer });
          }
          estrenos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
          this.estrenos.set(estrenos);
          this.estado.set('listo');
        },
        error: () => this.estado.set('error'),
      });
  }

  // "hoy 13:30", "mañana 22:00", "sáb 10:00" (en tu hora local).
  protected readonly cuando = cuandoSale;

}
