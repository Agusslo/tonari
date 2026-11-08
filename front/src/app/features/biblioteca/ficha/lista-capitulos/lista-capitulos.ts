import { Component, computed, input, output, signal } from '@angular/core';
import { TipoObra } from '../../../../core/interfaces/biblioteca';
import { TomoCapitulos } from '../../../../core/services/catalogo-api';
import { cuandoSale } from '../../../../shared/utils/fechas';

// Un grupo de la lista: un tomo (manga con datos de MangaDex) o un bloque de 25.
interface Grupo {
  clave: string;
  nombre: string;
  desde: number;
  hasta: number;
  numeros: number[];
}

// Bloques de 25; en series muy largas (One Piece) de 100, para no tener 46 bloques.
const tamanoBloque = (n: number) => (n > 300 ? 100 : 25);

// Lista de capítulos / episodios con el "ojito" para marcar visto o leído (estilo MangaDex).
// No guarda nada: avisa al padre (la ficha) hasta qué número marcaste, y el padre
// lo guarda como el progreso. Se marca "hasta dónde": tocar el 50 marca del 1 al 50.
@Component({
  selector: 'app-lista-capitulos',
  templateUrl: './lista-capitulos.html',
  styleUrl: './lista-capitulos.css',
})
export class ListaCapitulos {
  readonly tipo = input.required<TipoObra>();
  readonly progreso = input.required<number>();
  // Cuántos hay en total (si se sabe) y hasta dónde llega la lista.
  readonly cantidad = input.required<number>();
  // Los tomos de MangaDex (solo manga; null = no hay datos y se arma en bloques).
  readonly tomos = input<TomoCapitulos[] | null>(null);
  readonly editable = input(true);
  readonly ocupada = input(false);
  // Anime en emisión: hasta cuál salió y cuándo sale el próximo (null = salieron todos).
  // Los que no salieron se ven apagados y no se pueden marcar.
  readonly salidos = input<number | null>(null);
  readonly proximo = input<{ episodio: number; fecha: Date } | null>(null);

  // El nuevo progreso que eligió el usuario.
  readonly marcar = output<number>();

  protected readonly descendente = signal(false);
  // Qué grupos están abiertos. null = todavía no tocaste ninguno (se abre el que sigue).
  private readonly abiertos = signal<Set<string> | null>(null);

  protected readonly unidad = computed(() => (this.tipo() === 'anime' ? 'Episodio' : 'Capítulo'));
  // En el celu no entra "Episodio 1101": se muestra "Ep. 1101".
  protected readonly unidadCorta = computed(() => (this.tipo() === 'anime' ? 'Ep.' : 'Cap.'));
  protected readonly siguiente = computed(() => this.progreso() + 1);

  protected readonly grupos = computed<Grupo[]>(() => {
    const n = this.cantidad();
    if (n <= 0) return [];
    const tomos = this.tomos();
    return tomos && usarTomos(tomos, n) ? gruposPorTomo(tomos, n) : gruposEnBloques(n, this.unidad());
  });

  // El orden elegido (MangaDex permite ver del último al primero).
  protected readonly gruposVisibles = computed(() => {
    const grupos = this.grupos();
    if (!this.descendente()) return grupos;
    return [...grupos].reverse().map((g) => ({ ...g, numeros: [...g.numeros].reverse() }));
  });

  // El grupo donde está el próximo capítulo/episodio que te toca (se abre solo).
  private readonly grupoSiguiente = computed(() => {
    const grupos = this.grupos();
    const objetivo = Math.min(this.siguiente(), this.cantidad());
    return (grupos.find((g) => objetivo >= g.desde && objetivo <= g.hasta) ?? grupos[0])?.clave;
  });

  protected estaAbierto(clave: string) {
    const abiertos = this.abiertos();
    return abiertos ? abiertos.has(clave) : clave === this.grupoSiguiente();
  }

  protected alternar(clave: string) {
    const abiertos = new Set(this.abiertos() ?? [this.grupoSiguiente()].filter((c) => c !== undefined));
    if (abiertos.has(clave)) abiertos.delete(clave);
    else abiertos.add(clave);
    this.abiertos.set(abiertos);
  }

  protected leido(numero: number) {
    return numero <= this.progreso();
  }

  // ¿Ya salió? (si no se sabe, se asume que sí, como antes)
  protected salio(numero: number) {
    const salidos = this.salidos();
    return salidos === null || numero <= salidos;
  }

  // El próximo que sale (el único de los que no salieron que muestra la fecha).
  protected esProximo(numero: number) {
    return this.proximo()?.episodio === numero;
  }

  // "Sale vie 11:00" (en tu hora local).
  protected textoSale() {
    const proximo = this.proximo();
    return proximo ? `Sale ${cuandoSale(proximo.fecha)}` : '';
  }

  // El último que se puede marcar en un grupo (los que no salieron no cuentan).
  protected tope(grupo: Grupo) {
    const salidos = this.salidos();
    return salidos === null ? grupo.hasta : Math.min(grupo.hasta, salidos);
  }

  // Ojito de un capítulo: si no lo viste, marca hasta ese; si ya lo viste,
  // lo desmarca a él y a los que siguen.
  protected tocarOjo(numero: number) {
    // Uno que no salió no se puede marcar (sí desmarcar, por si quedó marcado de antes).
    if (!this.leido(numero) && !this.salio(numero)) return;
    this.marcar.emit(this.leido(numero) ? numero - 1 : numero);
  }

  protected leidosDelGrupo(grupo: Grupo) {
    return grupo.numeros.filter((n) => n <= this.progreso()).length;
  }

  // "Marcar tomo": todo leído hasta el último del grupo (o desmarcarlo si ya estaba).
  // Si el grupo sigue saliendo, "todo" es hasta el último que salió.
  protected tocarGrupo(grupo: Grupo) {
    const completo = this.progreso() >= this.tope(grupo);
    this.marcar.emit(completo ? grupo.desde - 1 : this.tope(grupo));
  }
}

// Los datos de MangaDex sirven si tienen al menos la mitad de los capítulos.
// Las series con licencia oficial suelen tener casi todos borrados: ahí no sirven los tomos.
function usarTomos(tomos: TomoCapitulos[], n: number) {
  const conocidos = tomos.reduce((suma, t) => suma + t.capitulos.filter((c) => c <= n).length, 0);
  return conocidos >= n / 2;
}

// Del 1 al n, cada capítulo en su tomo. Si a MangaDex le falta alguno,
// va al mismo tomo que el anterior (los tomos son consecutivos).
function gruposPorTomo(tomos: TomoCapitulos[], n: number): Grupo[] {
  const tomoDe = new Map<number, string | null>();
  for (const t of tomos) for (const c of t.capitulos) if (!tomoDe.has(c)) tomoDe.set(c, t.tomo);

  const grupos: Grupo[] = [];
  let tomoActual = tomoDe.get(1) ?? tomos[0]?.tomo ?? null;
  let tomoDelUltimoGrupo: string | null | undefined; // undefined = todavía no hay grupos
  for (let c = 1; c <= n; c++) {
    if (tomoDe.has(c)) tomoActual = tomoDe.get(c)!;
    const ultimo = grupos.at(-1);
    if (ultimo && tomoDelUltimoGrupo === tomoActual) {
      ultimo.numeros.push(c);
      ultimo.hasta = c;
    } else {
      tomoDelUltimoGrupo = tomoActual;
      grupos.push({
        clave: `tomo-${tomoActual}-${c}`, // con el número: la clave nunca se repite
        nombre: tomoActual === null ? 'Sin tomo todavía' : `Tomo ${tomoActual}`,
        desde: c,
        hasta: c,
        numeros: [c],
      });
    }
  }
  return grupos;
}

// Sin tomos: bloques (Episodios 1–25, Episodios 26–50...).
function gruposEnBloques(n: number, unidad: string): Grupo[] {
  const grupos: Grupo[] = [];
  const tamano = tamanoBloque(n);
  for (let desde = 1; desde <= n; desde += tamano) {
    const hasta = Math.min(n, desde + tamano - 1);
    grupos.push({
      clave: `bloque-${desde}`,
      nombre: `${unidad}s`, // el rango (1–25) ya lo muestra la cabecera
      desde,
      hasta,
      numeros: Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i),
    });
  }
  return grupos;
}
