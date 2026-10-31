import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Comentario } from './entities/comentario.entity.js';
import { Publicacion } from '../publicaciones/entities/publicacion.entity.js';
import { MensajeComentarioDto } from './dto/mensaje-comentario.dto.js';
import { ListarComentariosDto } from './dto/listar-comentarios.dto.js';

// Los datos del autor que se muestran en cada comentario (nunca correo ni contraseña).
const DATOS_AUTOR = 'nombre apellido nombreUsuario imagenPerfil';

@Injectable()
export class ComentariosService {
  constructor(
    @InjectModel(Comentario.name) private comentarioModel: Model<Comentario>,
    @InjectModel(Publicacion.name) private publicacionModel: Model<Publicacion>,
  ) {}

  // POST: guarda el comentario con quién lo hizo (token) y la fecha (createdAt, automática).
  async crear(publicacionId: string, usuarioId: string, { mensaje }: MensajeComentarioDto) {
    await this.verificarPublicacion(publicacionId);

    const comentario = await this.comentarioModel.create({
      mensaje,
      publicacion: publicacionId,
      usuario: usuarioId,
    });

    // Contador en la publicación, para mostrar "💬 3" en la tarjeta sin contar cada vez.
    // $inc suma 1 directamente en Mongo (no hace falta traer la publicación).
    await this.publicacionModel.updateOne({ _id: publicacionId }, { $inc: { cantidadComentarios: 1 } });

    return comentario.populate('usuario', DATOS_AUTOR);
  }

  // POST de una respuesta: se guarda como un comentario más de la misma publicación,
  // pero con "respondeA" apuntando al comentario principal.
  async responder(comentarioId: string, usuarioId: string, { mensaje }: MensajeComentarioDto) {
    const comentario = await this.buscarComentario(comentarioId);
    // Un solo nivel: si responden a una respuesta, va al hilo de su comentario principal.
    const principalId = comentario.respondeA ?? comentario._id;
    const publicacionId = comentario.publicacion.toString();
    await this.verificarPublicacion(publicacionId);

    const respuesta = await this.comentarioModel.create({
      mensaje,
      publicacion: publicacionId,
      usuario: usuarioId,
      respondeA: principalId,
    });

    // Los dos contadores: las respuestas del comentario y los comentarios de la publicación.
    await Promise.all([
      this.comentarioModel.updateOne({ _id: principalId }, { $inc: { cantidadRespuestas: 1 } }),
      this.publicacionModel.updateOne({ _id: publicacionId }, { $inc: { cantidadComentarios: 1 } }),
    ]);

    return respuesta.populate('usuario', DATOS_AUTOR);
  }

  // GET de las respuestas de un comentario, paginadas, en orden de llegada
  // (las más viejas primero: así se leen como una conversación).
  async listarRespuestas(comentarioId: string, { offset, limit }: ListarComentariosDto) {
    const comentario = await this.buscarComentario(comentarioId);
    await this.verificarPublicacion(comentario.publicacion.toString());

    const filtro = { respondeA: comentario._id };
    const [respuestas, total] = await Promise.all([
      this.comentarioModel
        .find(filtro)
        .sort({ createdAt: 1 })
        .skip(offset)
        .limit(limit)
        .populate('usuario', DATOS_AUTOR),
      this.comentarioModel.countDocuments(filtro),
    ]);

    return { comentarios: respuestas, total, offset, limit };
  }

  // GET: comentarios de una publicación, paginados, los más recientes primero.
  // Solo los principales: las respuestas se piden aparte, por comentario.
  async listar(publicacionId: string, { offset, limit }: ListarComentariosDto) {
    await this.verificarPublicacion(publicacionId);

    // respondeA: null también encuentra los comentarios viejos, que no tienen el campo.
    const filtro = { publicacion: publicacionId, respondeA: null };
    // Las dos consultas a la vez: la "página" pedida y el total (para saber si hay más).
    const [comentarios, total] = await Promise.all([
      this.comentarioModel
        .find(filtro)
        .sort({ createdAt: -1 }) // -1: del más nuevo al más viejo
        .skip(offset)
        .limit(limit)
        .populate('usuario', DATOS_AUTOR),
      this.comentarioModel.countDocuments(filtro),
    ]);

    return { comentarios, total, offset, limit };
  }

  // PUT: cambia el mensaje y lo marca como modificado. Solo el autor (si no, 403).
  async editar(id: string, usuarioId: string, { mensaje }: MensajeComentarioDto) {
    const comentario = await this.buscarComentario(id);
    // Si la publicación fue dada de baja, sus comentarios tampoco se pueden tocar.
    await this.verificarPublicacion(comentario.publicacion.toString());

    if (!comentario.usuario.equals(usuarioId)) {
      throw new ForbiddenException('Solo podés editar tus propios comentarios'); // 403
    }

    comentario.mensaje = mensaje;
    comentario.modificado = true;
    await comentario.save();
    return comentario.populate('usuario', DATOS_AUTOR);
  }

  // El comentario tiene que existir (400 si el id no es válido, 404 si no está).
  private async buscarComentario(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('El id del comentario no es válido'); // 400
    }
    const comentario = await this.comentarioModel.findById(id);
    if (!comentario) {
      throw new NotFoundException('El comentario no existe'); // 404
    }
    return comentario;
  }

  // La publicación tiene que existir y estar activa (las dadas de baja no se comentan
  // ni se muestran sus comentarios).
  private async verificarPublicacion(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('El id de la publicación no es válido'); // 400
    }
    const existe = await this.publicacionModel.exists({ _id: id, activa: true });
    if (!existe) {
      throw new NotFoundException('La publicación no existe'); // 404
    }
  }
}
