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
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  ChartType,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  Plugin,
  ScriptableContext,
  PointElement,
  Tooltip,
  TooltipModel,
} from 'chart.js';
import {
  Estadistica,
  EstadisticasApi,
  IComentariosPorDia,
  IComentariosPorPublicacion,
  IPublicacionesPorUsuario,
  IVisitasPorDia,
} from '../../../../core/services/estadisticas-api';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { mensajeDeError } from '../../../../shared/utils/errores-http';
import { fechaLocalHoy } from '../../../../shared/validators/validadores';

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
// La letra de TONARI también en los textos del gráfico (ejes, tooltips).
Chart.defaults.font.family = "'Zen Kaku Gothic New', system-ui, sans-serif";
Chart.defaults.font.size = 12;

// Colores de TONARI (los de styles.css). Chart.js dibuja en un <canvas>,
// así que no puede leer las variables CSS: van escritos acá.
const MENTA = '#b9f3e4';
const MENTA_CLARA = '#dcfaf2';
const HUESO = '#f0ede5';
const TEXTO_SEC = '#a6a4b0';
const LINEA = 'rgba(240, 237, 229, 0.07)';
const PANEL = '#18181f';

// Porciones de la torta: los tonos de la marca (menta, lila, ámbar, rosa, azul, verde)
// oscurecidos para el fondo oscuro. Orden fijo, validado para daltonismo (diferencia
// ΔE ≥ 13 entre vecinas) y con contraste ≥ 3:1 contra el panel.
// "Otras" va siempre en gris: no es una publicación, es el resto junto.
export const PORCIONES = ['#26a48b', '#9085e9', '#c98500', '#d55181', '#3987e5', '#6f9e2e'];
export const COLOR_OTRAS = '#77757f';

const DIA_MS = 24 * 60 * 60 * 1000;

// bar = barras horizontales (por usuario), line = líneas (por día),
// columnas = barras verticales (por día), pie = torta.
type TipoGrafico = 'bar' | 'line' | 'columnas' | 'pie';

// Qué gráfico usa cada estadística y cómo se nombra lo que cuenta ("1 ingreso", "3 visitas").
const INFO: Record<Estadistica, { tipo: TipoGrafico; uno: string; varios: string }> = {
  'publicaciones-por-usuario': { tipo: 'bar', uno: 'publicación', varios: 'publicaciones' },
  comentarios: { tipo: 'line', uno: 'comentario', varios: 'comentarios' },
  'comentarios-por-publicacion': { tipo: 'pie', uno: 'comentario', varios: 'comentarios' },
  // Sprint 5
  'ingresos-por-usuario': { tipo: 'bar', uno: 'ingreso', varios: 'ingresos' },
  'visitas-perfil': { tipo: 'line', uno: 'visita', varios: 'visitas' },
  'me-gusta': { tipo: 'columnas', uno: '"Me gusta"', varios: '"Me gusta"' },
};

// Lo que cuenta cada gráfico, en singular y plural.
type Unidad = { uno: string; varios: string };
const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

// Cada fila del gráfico (y de la tabla oculta para lectores de pantalla).
interface Punto {
  etiqueta: string;
  cantidad: number;
  detalle?: string; // texto extra para el tooltip (ej.: nombre completo)
  resto?: boolean; // la porción "Otras" de la torta
  autor?: Autor; // barras: quién es, para la foto del tooltip
}

// Lo que necesita <app-avatar> para dibujar la foto (o su respaldo).
interface Autor {
  nombre: string;
  apellido: string;
  nombreUsuario: string;
  imagenPerfil: string;
}

// El tooltip de las barras va en HTML (en el canvas no se puede poner la foto):
// dónde está la punta de la barra y de quién es.
interface Burbuja {
  x: number;
  y: number;
  izquierda: boolean; // cerca del borde derecho: se abre hacia la izquierda
  indice: number;
  punto: Punto;
}

// Lo que Chart.js le pasa al tooltip "external".
type ContextoTooltip = { chart: Chart; tooltip: TooltipModel<ChartType> };

// Los números chicos de arriba de cada gráfico.
interface Metrica {
  etiqueta: string;
  valor: string;
  nota?: string;
}

// Una tarjeta del dashboard de estadísticas: el rango de fechas propio (desde / hasta),
// un resumen en números y el gráfico. Cada tarjeta pide SUS datos al back cuando
// cambia su rango.
@Component({
  selector: 'app-grafico',
  imports: [Avatar],
  templateUrl: './grafico.html',
  styleUrl: './grafico.css',
})
export class Grafico {
  private readonly api = inject(EstadisticasApi);

  readonly cual = input.required<Estadistica>();
  readonly titulo = input.required<string>();
  readonly descripcion = input('');

  protected readonly hoy = fechaLocalHoy();
  protected readonly rapidos = [7, 30, 90];
  // Por defecto: los últimos 30 días (hoy incluido).
  protected readonly desde = signal(restarDias(this.hoy, 29));
  protected readonly hasta = signal(this.hoy);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly puntos = signal<Punto[]>([]);
  protected readonly total = signal<number | null>(null);
  // Visitas a mi perfil (Sprint 5): cuántas personas distintas.
  protected readonly visitantes = signal<number | null>(null);

  // Qué gráfico es (ver INFO) y cómo se llama lo que cuenta.
  protected readonly tipo = computed(() => INFO[this.cual()].tipo);
  protected readonly unidad = computed<Unidad>(() => INFO[this.cual()]);

  // ¿Hay algo para dibujar? (con todo en 0 no tiene sentido un gráfico vacío)
  protected readonly hayDatos = computed(() => this.puntos().some((p) => p.cantidad > 0));

  // Error del rango antes de ir al back (el back igual lo valida: 400).
  protected readonly errorRango = computed(() => {
    if (!this.desde() || !this.hasta()) return 'Elegí las dos fechas';
    if (this.desde() > this.hasta()) return '"Desde" no puede ser posterior a "Hasta"';
    return null;
  });

  // "14/10/2026 – 13/11/2026 · 31 días"
  protected readonly dias = computed(() =>
    this.errorRango() ? 0 : diasEntre(this.desde(), this.hasta()),
  );
  protected readonly rangoTexto = computed(() =>
    this.errorRango() ? '' : `${aTexto(this.desde())} – ${aTexto(this.hasta())}`,
  );

  // La suma de lo que se ve (la torta y las líneas además la traen del back).
  private readonly suma = computed(
    () => this.total() ?? this.puntos().reduce((s, p) => s + p.cantidad, 0),
  );

  // Tres números que resumen el gráfico, según cuál sea.
  protected readonly metricas = computed<Metrica[]>(() => {
    const puntos = this.puntos();
    const suma = this.suma();
    const mayor = puntos.reduce<Punto | null>(
      (max, p) => (!p.resto && p.cantidad > (max?.cantidad ?? 0) ? p : max),
      null,
    );

    const { uno, varios } = this.unidad();
    const titulo = mayuscula(varios);

    if (this.tipo() === 'bar') {
      // Ingresos trae el total de TODOS del back; publicaciones suma solo el top 10.
      const conTotal = this.total() !== null;
      const quien = this.cual() === 'ingresos-por-usuario' ? 'usuario' : 'autor';
      return [
        {
          etiqueta: titulo,
          valor: numero.format(suma),
          nota: !conTotal && puntos.length >= 10 ? 'del top 10' : 'en el período',
        },
        {
          etiqueta: quien === 'autor' ? 'Autores' : 'Usuarios',
          valor: numero.format(puntos.length),
          nota: `${numero.format(puntos.length ? sumaPuntos(puntos) / puntos.length : 0)} por ${quien}`,
        },
        {
          etiqueta: 'Más activo',
          valor: mayor?.etiqueta ?? '—',
          nota: mayor ? plural(mayor.cantidad, uno, varios) : undefined,
        },
      ];
    }

    if (this.tipo() === 'line' || this.tipo() === 'columnas') {
      const promedio = {
        etiqueta: 'Promedio diario',
        valor: numero.format(this.dias() ? suma / this.dias() : 0),
        nota: `${varios} por día`,
      };
      // Visitas: en vez del promedio, cuántas personas distintas entraron.
      const visitantes = this.visitantes();
      const segunda =
        visitantes === null
          ? promedio
          : {
              etiqueta: 'Visitantes',
              valor: numero.format(visitantes),
              nota: visitantes === 1 ? 'persona distinta' : 'personas distintas',
            };
      return [
        { etiqueta: titulo, valor: numero.format(suma), nota: 'en el período' },
        segunda,
        {
          etiqueta: 'Día pico',
          valor: mayor?.etiqueta ?? '—',
          nota: mayor ? plural(mayor.cantidad, uno, varios) : undefined,
        },
      ];
    }

    const conResto = puntos.some((p) => p.resto);
    const publicaciones = puntos.filter((p) => !p.resto).length;
    return [
      { etiqueta: 'Comentarios', valor: numero.format(suma), nota: 'en el período' },
      {
        etiqueta: 'Publicaciones',
        valor: `${publicaciones}${conResto ? '+' : ''}`,
        nota: 'con comentarios',
      },
      {
        etiqueta: 'La más comentada',
        valor: mayor?.etiqueta ?? '—',
        nota: mayor ? `${porcentaje(mayor.cantidad, suma)} del total` : undefined,
      },
    ];
  });

  // Leyenda de la torta (en HTML: se lee mejor que la de Chart.js y trae el %).
  protected readonly leyenda = computed(() => {
    const suma = this.suma();
    return this.puntos().map((p, i) => ({
      ...p,
      color: colorPorcion(p, i),
      porcentaje: porcentaje(p.cantidad, suma),
      ancho: suma ? (p.cantidad / suma) * 100 : 0,
    }));
  });

  // Tooltip con foto de las barras (null = no se está pasando el mouse).
  protected readonly burbuja = signal<Burbuja | null>(null);
  protected readonly numero = numero;

  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');
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
          this.total.set('total' in respuesta ? respuesta.total : null);
          this.visitantes.set('visitantes' in respuesta ? respuesta.visitantes : null);
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
      this.burbuja.set(null);
      if (!lienzo || !this.hayDatos()) return;
      this.grafico = new Chart(
        lienzo,
        configuracion(this.tipo(), puntos, this.suma(), this.unidad(), (contexto) =>
          this.moverBurbuja(contexto),
        ),
      );
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
    return this.hasta() === this.hoy && this.desde() === restarDias(this.hoy, dias - 1);
  }

  protected cambiarDesde(evento: Event) {
    this.desde.set((evento.target as HTMLInputElement).value);
  }

  protected cambiarHasta(evento: Event) {
    this.hasta.set((evento.target as HTMLInputElement).value);
  }

  // Chart.js avisa cada vez que el tooltip cambia (en cada movimiento del mouse):
  // solo actualizamos la burbuja si cambió de barra o de lugar.
  private moverBurbuja({ chart, tooltip }: ContextoTooltip) {
    const dato = tooltip.dataPoints?.[0];
    if (tooltip.opacity === 0 || !dato) {
      if (this.burbuja()) this.burbuja.set(null);
      return;
    }
    const actual = this.burbuja();
    const x = tooltip.caretX;
    const y = tooltip.caretY;
    if (actual && actual.indice === dato.dataIndex && actual.x === x && actual.y === y) return;
    this.burbuja.set({
      x,
      y,
      izquierda: x > chart.width * 0.55,
      indice: dato.dataIndex,
      punto: this.puntos()[dato.dataIndex],
    });
  }

  // Pasar el mouse por la leyenda resalta esa porción de la torta (y su tooltip).
  protected resaltar(indice: number | null) {
    const grafico = this.grafico;
    if (!grafico) return;
    const activos = indice === null ? [] : [{ datasetIndex: 0, index: indice }];
    grafico.setActiveElements(activos);
    grafico.tooltip?.setActiveElements(activos, { x: 0, y: 0 });
    grafico.update();
  }
}

// Lo que manda el back, pasado a una lista de { etiqueta, cantidad }.
function aPuntos(cual: Estadistica, respuesta: unknown): Punto[] {
  // Por usuario (Sprint 4 y 5): la misma forma, con la foto para el tooltip.
  if (cual === 'publicaciones-por-usuario' || cual === 'ingresos-por-usuario') {
    return (respuesta as IPublicacionesPorUsuario).datos.map((d) => ({
      etiqueta: `@${d.nombreUsuario}`,
      cantidad: d.cantidad,
      detalle: d.nombre,
      autor: {
        // El back manda el nombre completo: lo separamos para las iniciales del avatar.
        nombre: d.nombre.split(' ')[0] ?? '',
        apellido: d.nombre.split(' ').slice(1).join(' '),
        nombreUsuario: d.nombreUsuario,
        imagenPerfil: d.imagenPerfil ?? '',
      },
    }));
  }
  // Por día: comentarios, visitas a mi perfil y "Me gusta".
  if (cual === 'comentarios' || cual === 'visitas-perfil' || cual === 'me-gusta') {
    return (respuesta as IComentariosPorDia | IVisitasPorDia).datos.map((d) => ({
      etiqueta: `${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}`, // 2026-11-13 -> 13/11
      cantidad: d.cantidad,
    }));
  }
  return (respuesta as IComentariosPorPublicacion).datos.map((d) => ({
    etiqueta: d.titulo,
    cantidad: d.cantidad,
    resto: d.id === null,
  }));
}

function colorPorcion(punto: Punto, indice: number) {
  return punto.resto ? COLOR_OTRAS : PORCIONES[indice % PORCIONES.length];
}

// Línea punteada vertical en el día que está bajo el mouse (gráfico de líneas).
const lineaGuia: Plugin = {
  id: 'lineaGuia',
  afterDatasetsDraw(grafico) {
    const activo = grafico.tooltip?.getActiveElements()[0];
    if (!activo) return;
    const { ctx, chartArea } = grafico;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(activo.element.x, chartArea.top);
    ctx.lineTo(activo.element.x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(240, 237, 229, 0.22)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  },
};

// La configuración de Chart.js para cada tipo de gráfico, con los colores de TONARI.
function configuracion(
  tipo: TipoGrafico,
  puntos: Punto[],
  suma: number,
  unidad: Unidad,
  alMoverTooltip: (contexto: ContextoTooltip) => void,
): ChartConfiguration {
  const etiquetas = puntos.map((p) => p.etiqueta);
  const valores = puntos.map((p) => p.cantidad);
  // Tooltip con el estilo de los paneles de la app.
  const tooltip = {
    backgroundColor: 'rgba(24, 24, 31, 0.96)',
    borderColor: 'rgba(240, 237, 229, 0.14)',
    borderWidth: 1,
    cornerRadius: 10,
    padding: { x: 12, y: 10 },
    titleColor: HUESO,
    titleFont: { weight: 'bold' as const, size: 13 },
    bodyColor: TEXTO_SEC,
    bodyFont: { size: 12 },
    caretSize: 5,
    displayColors: false,
  };

  if (tipo === 'pie') {
    return {
      type: 'pie',
      data: {
        labels: etiquetas,
        datasets: [
          {
            data: valores,
            backgroundColor: puntos.map(colorPorcion),
            borderColor: PANEL, // separa las porciones con el color del panel
            borderWidth: 2,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 12 },
        plugins: {
          legend: { display: false }, // la leyenda va en HTML, al lado
          tooltip: {
            ...tooltip,
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              label: (item) => {
                const valor = item.raw as number;
                return ` ${plural(valor, 'comentario', 'comentarios')} · ${porcentaje(valor, suma)}`;
              },
            },
          },
        },
      },
    };
  }

  if (tipo === 'line') {
    return {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: [
          {
            label: mayuscula(unidad.varios),
            data: valores,
            borderColor: MENTA,
            borderWidth: 2,
            // Degradé de menta que se apaga hacia abajo
            backgroundColor: ({ chart }: ScriptableContext<'line'>) => {
              const area = chart.chartArea;
              if (!area) return 'transparent';
              const degrade = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              degrade.addColorStop(0, 'rgba(185, 243, 228, 0.26)');
              degrade.addColorStop(1, 'rgba(185, 243, 228, 0)');
              return degrade;
            },
            fill: true,
            // monotone: la curva suaviza sin pasar por debajo de 0 entre dos días.
            cubicInterpolationMode: 'monotone',
            pointRadius: puntos.length > 31 ? 0 : 3,
            pointBackgroundColor: MENTA,
            pointBorderWidth: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: MENTA,
            pointHoverBorderColor: PANEL, // aro del color del panel
            pointHoverBorderWidth: 3,
            pointHitRadius: 12,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ticks: { color: TEXTO_SEC, maxRotation: 0, autoSkipPadding: 16 },
            grid: { display: false },
            border: { color: LINEA },
          },
          y: {
            beginAtZero: true,
            ticks: { color: TEXTO_SEC, precision: 0, padding: 8 },
            grid: { color: LINEA },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltip,
            callbacks: {
              label: (item) => plural(item.raw as number, unidad.uno, unidad.varios),
            },
          },
        },
      },
      plugins: [lineaGuia],
    };
  }

  // Columnas (Sprint 5, "Me gusta" por día): una barra vertical por día.
  if (tipo === 'columnas') {
    return {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [
          {
            label: mayuscula(unidad.varios),
            data: valores,
            backgroundColor: MENTA,
            hoverBackgroundColor: MENTA_CLARA,
            borderRadius: 3,
            borderSkipped: 'start', // redondeada solo la punta
            maxBarThickness: 18,
            categoryPercentage: 0.8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: TEXTO_SEC, maxRotation: 0, autoSkipPadding: 16 },
            grid: { display: false },
            border: { color: LINEA },
          },
          y: {
            beginAtZero: true,
            ticks: { color: TEXTO_SEC, precision: 0, padding: 8 },
            grid: { color: LINEA },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltip,
            callbacks: {
              label: (item) => plural(item.raw as number, unidad.uno, unidad.varios),
            },
          },
        },
      },
    };
  }

  // Barras horizontales: los nombres de usuario se leen enteros, sin inclinarse.
  return {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [
        {
          label: mayuscula(unidad.varios),
          data: valores,
          backgroundColor: MENTA,
          hoverBackgroundColor: MENTA_CLARA,
          borderRadius: 4,
          borderSkipped: 'start', // redondeada solo la punta, no la base
          maxBarThickness: 22,
          categoryPercentage: 0.75,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: TEXTO_SEC, precision: 0 },
          grid: { color: LINEA },
          border: { display: false },
        },
        y: {
          ticks: { color: HUESO, padding: 6 },
          grid: { display: false },
          border: { color: LINEA },
        },
      },
      plugins: {
        legend: { display: false },
        // El de Chart.js se apaga: lo dibuja el componente, con la foto del autor.
        tooltip: { enabled: false, external: alMoverTooltip },
      },
    },
  };
}

// "publicaciones" -> "Publicaciones" ('"Me gusta"' queda igual)
function mayuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// La suma de lo que se ve en el gráfico (sin contar el total que manda el back).
function sumaPuntos(puntos: Punto[]) {
  return puntos.reduce((suma, p) => suma + p.cantidad, 0);
}

// "1 comentario" / "3 comentarios"
function plural(cantidad: number, uno: string, varios: string) {
  return `${numero.format(cantidad)} ${cantidad === 1 ? uno : varios}`;
}

// "42 %" (sin decimales salvo que sea menos de 1 %)
function porcentaje(parte: number, total: number) {
  if (!total) return '0 %';
  const valor = (parte / total) * 100;
  return `${valor < 1 ? valor.toFixed(1).replace('.', ',') : Math.round(valor)} %`;
}

// "2026-11-13" menos N días -> "AAAA-MM-DD" (al mediodía, para no pisar el cambio de día).
function restarDias(fecha: string, dias: number) {
  const d = new Date(new Date(`${fecha}T12:00:00`).getTime() - dias * DIA_MS);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Cuántos días hay entre dos fechas, las dos incluidas.
function diasEntre(desde: string, hasta: string) {
  const inicio = new Date(`${desde}T12:00:00`).getTime();
  const fin = new Date(`${hasta}T12:00:00`).getTime();
  return Math.round((fin - inicio) / DIA_MS) + 1;
}

// "2026-11-13" -> "13/11/2026"
function aTexto(fecha: string) {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}
