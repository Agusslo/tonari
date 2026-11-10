import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notificacion, TipoNotificacion } from './entities/notificacion.entity.js';
import { ListarNotificacionesDto } from './dto/listar-notificaciones.dto.js';

// Lo que se muestra de quien hizo la acción (nunca correo ni contraseña).
const DATOS_AUTOR = 'nombre apellido nombreUsuario imagenPerfil';

type Id = Types.ObjectId | string;

interface DatosNotificacion {
  destinatario: Id;
  autor: Id;
  tipo: TipoNotificacion;
  publicacion?: Id;
  comentario?: Id;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectModel(Notificacion.name) private notificacionModel: Model<Notificacion>,
  ) {}

  // ---------- Las usan los otros servicios (me gusta, seguir, comentarios) ----------

  // Crea un aviso. Nunca tira error: si falla, el "Me gusta" (o lo que sea) igual
  // tiene que funcionar; una notificación perdida no es motivo para un 500.
  async avisar(datos: DatosNotificacion) {
    // Si me doy "Me gusta" a mí mismo o respondo mi comentario, no me aviso.
    if (datos.destinatario.toString() === datos.autor.toString()) return;
    try {
      await this.notificacionModel.create(datos);
    } catch (error) {
      this.logger.warn(`No se pudo crear la notificación: ${(error as Error).message}`);
    }
  }

  // Al sacar el "Me gusta" o dejar de seguir, el aviso ya no tiene sentido: se borra.
  // Así, dar y sacar "Me gusta" diez veces no le llena la campanita al otro.
  // Se pasa todo (también el destinatario) para borrar SOLO ese aviso y no otros del mismo autor.
  async retirar(datos: Partial<DatosNotificacion>) {
    try {
      await this.notificacionModel.deleteMany(datos);
    } catch (error) {
      this.logger.warn(`No se pudo borrar la notificación: ${(error as Error).message}`);
    }
  }

  // Si se borran comentarios (o respuestas), sus avisos también se van.
  async retirarDeComentarios(comentarios: Id[]) {
    try {
      await this.notificacionModel.deleteMany({ comentario: { $in: comentarios } });
    } catch (error) {
      this.logger.warn(`No se pudieron borrar las notificaciones: ${(error as Error).message}`);
    }
  }

  // Si se da de baja una publicación, sus avisos también se van.
  async retirarDePublicacion(publicacion: Id) {
    try {
      await this.notificacionModel.deleteMany({ publicacion });
    } catch (error) {
      this.logger.warn(`No se pudieron borrar las notificaciones: ${(error as Error).message}`);
    }
  }

  // ---------- Las usa el controller (la campanita) ----------

  // GET /notificaciones: las mías, de la más nueva a la más vieja, con los datos
  // de quién la hizo, el título de la publicación y un pedacito del comentario.
  async listar(destinatario: string, { offset, limit }: ListarNotificacionesDto) {
    const filtro = { destinatario };
    const [notificaciones, total, noLeidas] = await Promise.all([
      this.notificacionModel
        .find(filtro)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        // match: si el autor fue dado de baja o la publicación se borró, el populate
        // deja null y abajo se descarta ese aviso.
        .populate({ path: 'autor', select: DATOS_AUTOR, match: { habilitado: true } })
        .populate({ path: 'publicacion', select: 'titulo imagen', match: { activa: true } })
        .populate({ path: 'comentario', select: 'mensaje' }),
      this.notificacionModel.countDocuments(filtro),
      this.notificacionModel.countDocuments({ ...filtro, leida: false }),
    ]);

    const visibles = notificaciones.filter(
      (n) => n.autor !== null && (n.tipo === 'seguir' || n.publicacion !== null),
    );
    return { notificaciones: visibles, total, noLeidas, offset, limit };
  }

  // GET /notificaciones/no-leidas: solo el numerito (el front lo pide cada tanto).
  async contarNoLeidas(destinatario: string) {
    const noLeidas = await this.notificacionModel.countDocuments({ destinatario, leida: false });
    return { noLeidas };
  }

  // PATCH /notificaciones/leidas: al abrir la campanita, todas pasan a leídas.
  // updateMany cambia todas de una sola vez, sin traerlas.
  async marcarLeidas(destinatario: string) {
    await this.notificacionModel.updateMany({ destinatario, leida: false }, { leida: true });
    return { noLeidas: 0 };
  }
}
