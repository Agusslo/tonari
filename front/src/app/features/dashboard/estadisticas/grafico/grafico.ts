import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
} from "chart.js";
import {
  Estadistica,
  EstadisticasApi,
  IComentariosPorDia,
  IComentariosPorPublicacion,
  IPublicacionesPorUsuario,
} from "../../../../core/services/estadisticas-api";
import { mensajeDeError } from "../../../../shared/utils/errores-http";
import { fechaLocalHoy } from "../../../../shared/validators/validadores";

// Chart.js: registramos solo las piezas que usamos (barras, líneas y torta),
// así no se descarga la librería entera.
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);
// La letra de TONARI también en los textos del gráfico (ejes, leyenda, tooltips).
Chart.defaults.font.family = "'Zen Kaku Gothic New', system-ui, sans-serif";

// Colores de TONARI (los de styles.css). Chart.js dibuja en un <canvas>,
// así que no puede leer las variables CSS: van escritos acá.
const MENTA = "#b9f3e4";
const LILA = "#c7b8ff";
const HUESO = "#f0ede5";
const TEXTO_SEC = "#a6a4b0";
const LINEA = "rgba(240, 237, 229, 0.08)";
const PANEL = "#18181f";
const PORCIONES = [
  MENTA,
  LILA,
  "#ffd59e",
  "#ff9bb3",
  "#9ecbff",
  "#d4f59e",
  "#5f5d6b",
];

const DIA_MS = 24 * 60 * 60 * 1000;

// Cada fila de la tabla oculta (para lectores de pantalla) y del gráfico.
interface Punto {
  etiqueta: string;
  cantidad: number;
}

// Una tarjeta del dashboard de estadísticas: el rango de fechas propio (desde / hasta)
// y el gráfico. Cada tarjeta pide SUS datos al back cuando cambia su rango.
@Component({
  selector: "app-grafico",
  templateUrl: "./grafico.html",
  styleUrl: "./grafico.css",
})
export class Grafico {
  private readonly api = inject(EstadisticasApi);

  readonly cual = input.required<Estadistica>();
  readonly titulo = input.required<string>();
  readonly descripcion = input("");

  protected readonly hoy = fechaLocalHoy();
  // Por defecto: los últimos 30 días (hoy incluido).
  protected readonly desde = signal(restarDias(this.hoy, 29));
  protected readonly hasta = signal(this.hoy);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly puntos = signal<Punto[]>([]);
  protected readonly total = signal<number | null>(null);

  // Torta = comentarios por publicación; líneas = comentarios por día; barras = el resto.
  protected readonly tipo = computed(() =>
    this.cual() === "comentarios-por-publicacion"
      ? "pie"
      : this.cual() === "comentarios"
        ? "line"
        : "bar",
  );

  // ¿Hay algo para dibujar? (con todo en 0 no tiene sentido un gráfico vacío)
  protected readonly hayDatos = computed(() =>
    this.puntos().some((p) => p.cantidad > 0),
  );

  // Error del rango antes de ir al back (el back igual lo valida: 400).
  protected readonly errorRango = computed(() => {
    if (!this.desde() || !this.hasta()) return "Elegí las dos fechas";
    if (this.desde() > this.hasta())
      return '"Desde" no puede ser posterior a "Hasta"';
    return null;
  });

  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>("lienzo");
  private grafico: Chart | null = null;

  constructor() {
    // Cada vez que cambia el rango (o la estadística), se piden los datos de nuevo.
    // onCleanup cancela el pedido anterior si todavía no había vuelto.
    effect((onCleanup) => {
      const cual = this.cual();
      const desde = this.desde();
      const hasta = this.hasta();
      if (this.errorRango()) return;

      this.cargando.set(true);
      this.error.set(null);
      const pedido = this.api.obtener(cual, desde, hasta).subscribe({
        next: (respuesta) => {
          this.puntos.set(aPuntos(cual, respuesta));
          this.total.set("total" in respuesta ? respuesta.total : null);
          this.cargando.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.cargando.set(false);
          this.error.set(mensajeDeError(error));
        },
      });
      onCleanup(() => pedido.unsubscribe());
    });

    // Con los datos y el <canvas> listos, se (re)dibuja el gráfico.
    effect(() => {
      const lienzo = this.lienzo()?.nativeElement;
      const puntos = this.puntos();
      this.grafico?.destroy();
      this.grafico = null;
      if (!lienzo || !this.hayDatos()) return;
      this.grafico = new Chart(lienzo, configuracion(this.tipo(), puntos));
    });

    // Al salir de la pantalla, liberamos el gráfico.
    inject(DestroyRef).onDestroy(() => this.grafico?.destroy());
  }

  // Botones rápidos: 7, 30 o 90 días hasta hoy.
  protected ultimosDias(dias: number) {
    this.hasta.set(this.hoy);
    this.desde.set(restarDias(this.hoy, dias - 1));
  }

  protected esRapido(dias: number) {
    return (
      this.hasta() === this.hoy &&
      this.desde() === restarDias(this.hoy, dias - 1)
    );
  }

  protected cambiarDesde(evento: Event) {
    this.desde.set((evento.target as HTMLInputElement).value);
  }

  protected cambiarHasta(evento: Event) {
    this.hasta.set((evento.target as HTMLInputElement).value);
  }
}

// Lo que manda el back, pasado a una lista de { etiqueta, cantidad }.
function aPuntos(cual: Estadistica, respuesta: unknown): Punto[] {
  if (cual === "publicaciones-por-usuario") {
    return (respuesta as IPublicacionesPorUsuario).datos.map((d) => ({
      etiqueta: `@${d.nombreUsuario}`,
      cantidad: d.cantidad,
    }));
  }
  if (cual === "comentarios") {
    return (respuesta as IComentariosPorDia).datos.map((d) => ({
      etiqueta: `${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}`, // 2026-11-13 -> 13/11
      cantidad: d.cantidad,
    }));
  }
  return (respuesta as IComentariosPorPublicacion).datos.map((d) => ({
    etiqueta: d.titulo,
    cantidad: d.cantidad,
  }));
}

// La configuración de Chart.js para cada tipo de gráfico, con los colores de TONARI.
function configuracion(
  tipo: "bar" | "line" | "pie",
  puntos: Punto[],
): ChartConfiguration {
  const etiquetas = puntos.map((p) => p.etiqueta);
  const valores = puntos.map((p) => p.cantidad);
  const tooltip = {
    backgroundColor: PANEL,
    borderColor: LINEA,
    borderWidth: 1,
    titleColor: HUESO,
    bodyColor: HUESO,
    padding: 10,
  };

  if (tipo === "pie") {
    return {
      type: "pie",
      data: {
        labels: etiquetas,
        datasets: [
          {
            data: valores,
            backgroundColor: PORCIONES,
            borderColor: PANEL, // separa las porciones con el color del panel
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: HUESO, boxWidth: 12, padding: 14 },
          },
          tooltip,
        },
      },
    };
  }

  // Ejes comunes de barras y líneas: solo números enteros (no hay "medio comentario").
  const escalas = {
    x: {
      ticks: { color: TEXTO_SEC, maxRotation: 0, autoSkipPadding: 12 },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      ticks: { color: TEXTO_SEC, precision: 0 },
      grid: { color: LINEA },
      border: { display: false },
    },
  };

  if (tipo === "line") {
    return {
      type: "line",
      data: {
        labels: etiquetas,
        datasets: [
          {
            label: "Comentarios",
            data: valores,
            borderColor: MENTA,
            backgroundColor: "rgba(185, 243, 228, 0.12)",
            fill: true,
            // monotone: la curva suaviza sin pasar por debajo de 0 entre dos días.
            cubicInterpolationMode: "monotone",
            pointRadius: puntos.length > 45 ? 0 : 3,
            pointHoverRadius: 5,
            pointBackgroundColor: MENTA,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: escalas,
        plugins: { legend: { display: false }, tooltip },
      },
    };
  }

  return {
    type: "bar",
    data: {
      labels: etiquetas,
      datasets: [
        {
          label: "Publicaciones",
          data: valores,
          backgroundColor: LILA,
          hoverBackgroundColor: MENTA,
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: escalas,
      plugins: { legend: { display: false }, tooltip },
    },
  };
}

// "2026-11-13" menos N días -> "AAAA-MM-DD" (al mediodía, para no pisar el cambio de día).
function restarDias(fecha: string, dias: number) {
  const d = new Date(new Date(`${fecha}T12:00:00`).getTime() - dias * DIA_MS);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
