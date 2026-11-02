import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BibliotecaApi } from '../../core/services/biblioteca-api';
import IEntrada, { ESTADOS, EstadoEntrada, IObra, TipoObra } from '../../core/interfaces/biblioteca';
import { Entrada } from './entrada/entrada';
import { Buscador } from './buscador/buscador';
import { Modal } from '../../shared/components/modal/modal';
import { mensajeDeError } from '../../shared/utils/errores-http';
import { EstadoObraPipe } from '../../shared/pipes/estado-obra.pipe';
import { ImagenRespaldoDirective } from '../../shared/directives/imagen-respaldo.directive';
import { ClickAfueraDirective } from '../../shared/directives/click-afuera.directive';

// Mi Biblioteca (extra, no lo pide la consigna): tu lista de anime y manga
// con estado, progreso y puntuación. Las obras se buscan en AniList.
@Component({
  selector: 'app-biblioteca',
  imports: [Entrada, Buscador, Modal, EstadoObraPipe, ImagenRespaldoDirective, ClickAfueraDirective],
  templateUrl: './biblioteca.html',
  styleUrl: './biblioteca.css',
})
export class Biblioteca implements OnInit {
  private readonly api = inject(BibliotecaApi);

  // Todas mis obras (anime y manga). Lo demás se calcula a partir de esta lista.
  protected readonly entradas = signal<IEntrada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  // Lo que se está mirando: anime o manga, y un estado (null = todos).
  protected readonly tipo = signal<TipoObra>('anime');
  protected readonly filtro = signal<EstadoEntrada | null>(null);

  protected readonly buscadorAbierto = signal(false);
  protected readonly agregando = signal<number | null>(null); // idAnilist de la obra que se está agregando
  protected readonly aQuitar = signal<IEntrada | null>(null); // abre el modal de confirmación
  protected readonly errorAccion = signal<string | null>(null);

  protected readonly estados = ESTADOS;

  // computed: se recalculan solos cuando cambian entradas, tipo o filtro.
  protected readonly delTipo = computed(() => this.entradas().filter((e) => e.tipo === this.tipo()));
  protected readonly visibles = computed(() => {
    const filtro = this.filtro();
    return filtro ? this.delTipo().filter((e) => e.estado === filtro) : this.delTipo();
  });
  protected readonly cuantos = computed(() => {
    const cuenta: Record<string, number> = {};
    for (const e of this.delTipo()) cuenta[e.estado] = (cuenta[e.estado] ?? 0) + 1;
    return cuenta;
  });
  protected readonly totalPorTipo = computed(() => ({
    anime: this.entradas().filter((e) => e.tipo === 'anime').length,
    manga: this.entradas().filter((e) => e.tipo === 'manga').length,
  }));
  // Los números del encabezado, del tipo que se está mirando.
  protected readonly resumen = computed(() => {
    const lista = this.delTipo();
    const notas = lista.map((e) => e.puntuacion).filter((n): n is number => n !== null);
    const promedio = notas.length ? notas.reduce((suma, n) => suma + n, 0) / notas.length : null;
    return {
      vistos: lista.reduce((suma, e) => suma + e.progreso, 0).toLocaleString('es-AR'),
      completados: this.cuantos()['completado'] ?? 0,
      promedio: promedio === null ? null : promedio.toFixed(1).replace('.', ','),
    };
  });
  // Hasta 3 tapas para el abanico del encabezado: primero lo que estás viendo o leyendo.
  protected readonly tapasDestacadas = computed(() => {
    const conTapa = this.delTipo().filter((e) => e.imagen);
    const enCurso = conTapa.filter((e) => e.estado === 'en-curso');
    const resto = conTapa.filter((e) => e.estado !== 'en-curso');
    return [...enCurso, ...resto].slice(0, 3).map((e) => e.imagen!);
  });
  // Los idAnilist que ya tengo de este tipo, para que el buscador marque "En tu biblioteca".
  protected readonly yaAgregadas = computed(() => new Set(this.delTipo().map((e) => e.idAnilist)));

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.api.listar().subscribe({
      next: (entradas) => {
        this.entradas.set(entradas);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }

  cambiarTipo(tipo: TipoObra) {
    this.tipo.set(tipo);
    this.filtro.set(null);
  }

  // Elegiste una obra en el buscador: se guarda como "Pendiente" y aparece primera.
  // El buscador se cierra solo para que la veas en la lista.
  agregar(obra: IObra) {
    this.agregando.set(obra.idAnilist);
    this.api.agregar(obra).subscribe({
      next: (entrada) => {
        this.entradas.update((lista) => [entrada, ...lista]);
        this.agregando.set(null);
        this.buscadorAbierto.set(false);
        this.filtro.set(null); // que se vea, aunque hubiera un filtro puesto
      },
      error: (error: HttpErrorResponse) => {
        this.errorAccion.set(mensajeDeError(error));
        this.agregando.set(null);
      },
    });
  }

  // Una tarjeta avisó que cambió (estado, progreso o nota): la reemplazamos en la lista.
  alActualizar(actualizada: IEntrada) {
    this.entradas.update((lista) => lista.map((e) => (e._id === actualizada._id ? actualizada : e)));
  }

  confirmarQuitar() {
    const entrada = this.aQuitar();
    if (!entrada) return;
    this.aQuitar.set(null);
    this.api.eliminar(entrada._id).subscribe({
      next: () => this.entradas.update((lista) => lista.filter((e) => e._id !== entrada._id)),
      error: (error: HttpErrorResponse) => this.errorAccion.set(mensajeDeError(error)),
    });
  }
}
