import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import IEntrada, { ESTADOS, EstadoEntrada, IFicha, nombreEstado } from '../../../core/interfaces/biblioteca';
import { BibliotecaApi, CambiosEntrada } from '../../../core/services/biblioteca-api';
import { Anilist } from '../../../core/services/anilist';
import { Auth } from '../../../core/services/auth';
import { Modal } from '../../../shared/components/modal/modal';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// Ficha de una obra de la biblioteca (estilo MangaDex): /biblioteca/:id
// Junta dos fuentes:
//  - NUESTRO back: tu seguimiento (estado, por qué capítulo vas, tu nota).
//  - AniList: la info de la obra (sinopsis, géneros, banner). Si AniList no responde,
//    la ficha igual funciona con lo que tenemos guardado (título, tapa, total).
@Component({
  selector: 'app-ficha',
  imports: [RouterLink, Modal],
  templateUrl: './ficha.html',
  styleUrl: './ficha.css',
})
export class Ficha implements OnInit {
  private readonly api = inject(BibliotecaApi);
  private readonly anilist = inject(Anilist);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly titulo = inject(Title);

  // El :id de la ruta (/biblioteca/6adc...), igual que en la página de una publicación.
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly entrada = signal<IEntrada | null>(null);
  protected readonly ficha = signal<IFicha | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAnilist = signal(false);

  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);
  protected readonly confirmarQuitar = signal(false);
  protected readonly sinopsisCompleta = signal(false);

  // Lo que está escrito en el contador (todavía sin guardar).
  protected readonly progresoEscrito = signal('');

  protected readonly estados = ESTADOS;
  protected readonly nombreEstado = nombreEstado;
  protected readonly puntuaciones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Solo el dueño puede cambiarla (si algún día se ven bibliotecas ajenas, queda en solo lectura).
  protected readonly esMia = computed(() => this.entrada()?.usuario === this.auth.usuarioActual()?._id);

  protected readonly unidad = computed(() => (this.entrada()?.tipo === 'anime' ? 'episodio' : 'capítulo'));

  // El total: el guardado, o el de AniList si cuando la agregaste todavía no se sabía.
  protected readonly total = computed(() => this.entrada()?.total ?? this.ficha()?.total ?? null);

  protected readonly porcentaje = computed(() => {
    const total = this.total();
    const progreso = this.entrada()?.progreso ?? 0;
    return total ? Math.min(100, Math.round((progreso / total) * 100)) : null;
  });

  // ¿Cambió el número escrito respecto de lo guardado? (muestra el botón Guardar)
  protected readonly hayCambio = computed(
    () => this.progresoEscrito().trim() !== String(this.entrada()?.progreso ?? ''),
  );

  // La imagen de fondo de la cabecera: el banner, o la tapa (desenfocada por CSS).
  protected readonly fondo = computed(() => this.ficha()?.banner ?? this.ficha()?.tapa ?? this.entrada()?.imagen ?? null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.api.obtener(this.id).subscribe({
      next: (entrada) => {
        this.mostrar(entrada);
        this.cargando.set(false);
        this.titulo.setTitle(`${entrada.titulo} · TONARI`);
        this.cargarFicha(entrada);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }

  // La info de AniList va aparte: si falla, no rompe la página.
  private cargarFicha(entrada: IEntrada) {
    this.errorAnilist.set(false);
    this.anilist.detalle(entrada.idAnilist, entrada.tipo).subscribe({
      next: (ficha) => this.ficha.set(ficha),
      error: () => this.errorAnilist.set(true),
    });
  }

  private mostrar(entrada: IEntrada) {
    this.entrada.set(entrada);
    this.progresoEscrito.set(String(entrada.progreso));
  }

  // ---- Contador: escribís el número y Enter (o "Guardar") ----
  protected escribir(evento: Event) {
    this.progresoEscrito.set((evento.target as HTMLInputElement).value);
  }

  protected guardarProgreso(evento: SubmitEvent) {
    evento.preventDefault(); // un <form> recarga la página si no se lo impedimos
    const texto = this.progresoEscrito().trim();
    const numero = Number(texto);
    if (texto === '' || !Number.isInteger(numero) || numero < 0) {
      this.errorGuardar.set(`Escribí un número de ${this.unidad()} (0 o más).`);
      return;
    }
    const total = this.entrada()?.total;
    if (total != null && numero > total) {
      this.errorGuardar.set(`Tiene ${total} ${this.unidad()}s: no podés pasarte de ahí.`);
      return;
    }
    if (!this.hayCambio()) return;
    this.guardar({ progreso: numero });
  }

  // +1 rápido (para cuando terminás el capítulo de la semana).
  protected sumarUno() {
    const entrada = this.entrada();
    if (!entrada) return;
    this.guardar({ progreso: entrada.progreso + 1 });
  }

  protected cambiarEstado(estado: EstadoEntrada) {
    if (estado !== this.entrada()?.estado) this.guardar({ estado });
  }

  protected elegirPuntuacion(puntuacion: number | null) {
    if (puntuacion !== this.entrada()?.puntuacion) this.guardar({ puntuacion });
  }

  private guardar(cambios: CambiosEntrada) {
    const entrada = this.entrada();
    if (!entrada || this.guardando()) return;
    this.guardando.set(true);
    this.errorGuardar.set(null);
    // El back aplica las reglas (llegar al final = Completado, etc.)
    // y devuelve la obra como quedó: mostramos eso.
    this.api.actualizar(entrada._id, cambios).subscribe({
      next: (actualizada) => {
        this.mostrar(actualizada);
        this.guardando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorGuardar.set(mensajeDeError(error));
        this.progresoEscrito.set(String(entrada.progreso)); // vuelve al número guardado
        this.guardando.set(false);
      },
    });
  }

  protected quitar() {
    const entrada = this.entrada();
    if (!entrada) return;
    this.confirmarQuitar.set(false);
    this.api.eliminar(entrada._id).subscribe({
      next: () => this.router.navigate(['/biblioteca']),
      error: (error: HttpErrorResponse) => this.errorGuardar.set(mensajeDeError(error)),
    });
  }
}
