import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Publicacion } from '../publicaciones/entities/publicacion.entity.js';
import { Comentario } from '../comentarios/entities/comentario.entity.js';
import { RangoFechasDto } from './dto/rango-fechas.dto.js';

// Las fechas se cuentan en hora argentina: un comentario de las 23:30 del lunes es
// del lunes, aunque en UTC (como guarda Mongo) ya sea martes.
const ZONA = 'America/Argentina/Buenos_Aires';
const DIA_MS = 24 * 60 * 60 * 1000;
const MAXIMO_DIAS = 366;

// Estadísticas para el dashboard del administrador (Sprint 4).
// Las tres usan "aggregate": una lista de pasos que Mongo hace uno detrás del otro
// ($match filtra, $group agrupa y cuenta, $sort ordena, $lookup trae datos de otra
// colección, como populate). Así la cuenta la hace la base y no traemos todo al back.
@Injectable()
export class EstadisticasService {
  constructor(
    @InjectModel(Publicacion.name)
    private readonly publicacionModel: Model<Publicacion>,
    @InjectModel(Comentario.name)
    private readonly comentarioModel: Model<Comentario>,
  ) {}

  // GET /estadisticas/publicaciones-por-usuario -> gráfico de barras.
  // Cuántas publicaciones hizo cada usuario en el rango (las 10 personas con más).
  async publicacionesPorUsuario(filtro: RangoFechasDto) {
    const { desde, hasta, inicio, fin } = rango(filtro);
    const datos = await this.publicacionModel.aggregate<{
      nombreUsuario: string;
      nombre: string;
      imagenPerfil: string;
      cantidad: number;
    }>([
      // Solo las activas: las dadas de baja ya no están en la app.
      { $match: { activa: true, createdAt: { $gte: inicio, $lte: fin } } },
      { $group: { _id: '$usuario', cantidad: { $sum: 1 } } },
      { $sort: { cantidad: -1, _id: 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'Usuarios',
          localField: '_id',
          foreignField: '_id',
          as: 'autor',
        },
      },
      { $unwind: '$autor' },
      {
        $project: {
          _id: 0,
          nombreUsuario: '$autor.nombreUsuario',
          nombre: { $concat: ['$autor.nombre', ' ', '$autor.apellido'] },
          // La foto, para mostrarla al pasar el mouse por la barra
          imagenPerfil: '$autor.imagenPerfil',
          cantidad: 1,
        },
      },
    ]);
    return { desde, hasta, datos };
  }

  // GET /estadisticas/comentarios -> gráfico de líneas.
  // Cuántos comentarios se hicieron cada día del rango (los días sin comentarios van con 0).
  async comentariosPorDia(filtro: RangoFechasDto) {
    const { desde, hasta, inicio, fin } = rango(filtro);
    const porDia = await this.comentarioModel.aggregate<{
      _id: string;
      cantidad: number;
    }>([
      { $match: { createdAt: { $gte: inicio, $lte: fin } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: ZONA,
            },
          },
          cantidad: { $sum: 1 },
        },
      },
    ]);
    // Mongo solo devuelve los días que tuvieron comentarios: completamos los demás con 0
    // para que la línea del gráfico no "saltee" días.
    const cantidades = new Map(porDia.map((d) => [d._id, d.cantidad]));
    const datos = diasEntre(desde, hasta).map((fecha) => ({
      fecha,
      cantidad: cantidades.get(fecha) ?? 0,
    }));
    const total = datos.reduce((suma, d) => suma + d.cantidad, 0);
    return { desde, hasta, total, datos };
  }

  // GET /estadisticas/comentarios-por-publicacion -> gráfico de torta.
  // Las publicaciones con más comentarios en el rango (las 6 primeras + "Otras").
  async comentariosPorPublicacion(filtro: RangoFechasDto) {
    const { desde, hasta, inicio, fin } = rango(filtro);
    const porPublicacion = await this.comentarioModel.aggregate<{
      _id: string;
      titulo: string;
      cantidad: number;
    }>([
      { $match: { createdAt: { $gte: inicio, $lte: fin } } },
      { $group: { _id: '$publicacion', cantidad: { $sum: 1 } } },
      {
        $lookup: {
          from: 'Publicaciones',
          localField: '_id',
          foreignField: '_id',
          as: 'publicacion',
        },
      },
      { $unwind: '$publicacion' },
      { $match: { 'publicacion.activa': true } },
      { $sort: { cantidad: -1, _id: 1 } },
      { $project: { titulo: '$publicacion.titulo', cantidad: 1 } },
    ]);
    // Una torta con muchas porciones no se lee: las 6 primeras y el resto junto.
    const primeras = porPublicacion.slice(0, 6).map((p) => ({
      id: String(p._id),
      titulo: p.titulo,
      cantidad: p.cantidad,
    }));
    const resto = porPublicacion
      .slice(6)
      .reduce((suma, p) => suma + p.cantidad, 0);
    const datos =
      resto > 0
        ? [...primeras, { id: null, titulo: 'Otras', cantidad: resto }]
        : primeras;
    const total = porPublicacion.reduce((suma, p) => suma + p.cantidad, 0);
    return { desde, hasta, total, datos };
  }
}

// Convierte ?desde&hasta en fechas reales. Sin fechas: los últimos 30 días.
// "inicio" es las 00:00 del primer día y "fin" las 23:59:59 del último (hora argentina).
function rango(filtro: RangoFechasDto) {
  const hoy = fechaArgentina(new Date());
  const hasta = filtro.hasta ?? hoy;
  const desde =
    filtro.desde ??
    fechaArgentina(
      new Date(Date.parse(`${hasta}T12:00:00-03:00`) - 29 * DIA_MS),
    );
  const inicio = new Date(`${desde}T00:00:00.000-03:00`);
  const fin = new Date(`${hasta}T23:59:59.999-03:00`);

  if (!fechaReal(desde) || !fechaReal(hasta)) {
    throw new BadRequestException('Alguna de las fechas no existe'); // 400 (ej.: 2026-02-31)
  }
  if (inicio > fin) {
    throw new BadRequestException(
      'La fecha "desde" no puede ser posterior a "hasta"',
    ); // 400
  }
  if ((fin.getTime() - inicio.getTime()) / DIA_MS > MAXIMO_DIAS) {
    throw new BadRequestException('El rango puede ser de hasta un año'); // 400
  }
  return { desde, hasta, inicio, fin };
}

// ¿Existe ese día? JavaScript acepta "2026-02-31" y lo pasa al 3 de marzo:
// si al volver a texto no da lo mismo, la fecha no existía.
function fechaReal(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

// "2026-11-13" de una fecha, en hora argentina.
function fechaArgentina(fecha: Date) {
  return fecha.toLocaleDateString('en-CA', { timeZone: ZONA });
}

// Todos los días entre dos fechas "AAAA-MM-DD", incluidos los dos.
function diasEntre(desde: string, hasta: string) {
  const dias: string[] = [];
  for (
    let t = Date.parse(`${desde}T12:00:00-03:00`);
    t <= Date.parse(`${hasta}T12:00:00-03:00`);
    t += DIA_MS
  ) {
    dias.push(fechaArgentina(new Date(t)));
  }
  return dias;
}
