import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Comentario } from './entities/comentario.entity.js';
import { Publicacion } from '../publicaciones/entities/publicacion.entity.js';
import { MensajeComentarioDto } from './dto/mensaje-comentario.dto.js';
import { ListarComentariosDto } from './dto/listar-comentarios.dto.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { guardarImagen } from '../common/imagenes.js';
import type { PayloadToken } from '../auth/token/token.guard.js';

// Los datos del autor que se muestran en cada comentario (nunca correo ni contraseña).
const DATOS_AUTOR = 'nombre apellido nombreUsuario imagenPerfil';

@Injectable()
export class ComentariosService {
  constructor(
    @InjectModel(Comentario.name) private comentarioModel: Model<Comentario>,
    @InjectModel(Publicacion.name) private publicacionModel: Model<Publicacion>,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // POST: guarda el comentario con quién lo hizo (token) y la fecha (createdAt, automática).
  // imagen: opcional (extra). Llega undefined si el comentario no tiene.
  async crear(
    publicacionId: string,
    usuarioId: string,
    { mensaje }: MensajeComentarioDto,
    imagen?: Express.Multer.File,
  ) {
    const publicacion = await this.verificarPublicacion(publicacionId);

    // Primero validamos la publicación y DESPUÉS subimos la imagen:
    // así no queda una imagen suelta en Cloudinary si la publicación no existe.
    const comentario = await this.comentarioModel.create({
      mensaje,
      publicacion: publicacionId,
      usuario: usuarioId,
      imagen: imagen ? await guardarImagen(imagen, 'comentarios') : undefined,
    });

    // Contador en la publicación, para mostrar "💬 3" en la tarjeta sin contar cada vez.
    // $inc suma 1 directamente en Mongo (no hace falta traer la publicación).
    await this.publicacionModel.updateOne({ _id: publicacionId }, { $inc: { cantidadComentarios: 1 } });

    // Aviso al autor de la publicación: "<usuario> comentó tu publicación".
    await this.notificacionesService.avisar({
      destinatario: publicacion.usuario,
      autor: usuarioId,
      tipo: 'comentario',
      publicacion: publicacion._id,
      comentario: comentario._id,
    });

    return comentario.populate('usuario', DATOS_AUTOR);
  }

  // POST de una respuesta: se guarda como un comentario más de la misma publicación,
  // pero con "respondeA" apuntando al comentario principal.
  async responder(
    comentarioId: string,
    usuarioId: string,
    { mensaje }: MensajeComentarioDto,
    imagen?: Express.Multer.File,
  ) {
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
      imagen: imagen ? await guardarImagen(imagen, 'comentarios') : undefined,
    });

    // Los dos contadores: las respuestas del comentario y los comentarios de la publicación.
    await Promise.all([
      this.comentarioModel.updateOne({ _id: principalId }, { $inc: { cantidadRespuestas: 1 } }),
      this.publicacionModel.updateOne({ _id: publicacionId }, { $inc: { cantidadComentarios: 1 } }),
    ]);

    // Aviso a quien escribió el comentario al que se responde: "<usuario> respondió tu comentario".
    await this.notificacionesService.avisar({
      destinatario: comentario.usuario,
      autor: usuarioId,
      tipo: 'respuesta',
      publicacion: publicacionId,
      comentario: respuesta._id,
    });

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

  // DELETE: borra el comentario. Solo el autor o un administrador (si no, 403).
  // Si es un comentario principal, se van también sus respuestas (quedarían colgadas).
  // Devuelve cuántos se borraron, para que el front baje el contador de la publicación.
  async eliminar(id: string, usuario: PayloadToken) {
    const comentario = await this.buscarComentario(id);
    await this.verificarPublicacion(comentario.publicacion.toString());

    const esAutor = comentario.usuario.equals(usuario.id);
    const esAdministrador = usuario.perfil === 'administrador';
    if (!esAutor && !esAdministrador) {
      throw new ForbiddenException('Solo podés eliminar tus propios comentarios'); // 403
    }

    const ids: Types.ObjectId[] = [comentario._id];
    if (!comentario.respondeA) {
      const respuestas = await this.comentarioModel.find({ respondeA: comentario._id }).select('_id');
      ids.push(...respuestas.map((r) => r._id));
    }

    await this.comentarioModel.deleteMany({ _id: { $in: ids } });
    await Promise.all([
      // Los contadores bajan lo mismo que subieron al crear.
      this.publicacionModel.updateOne(
        { _id: comentario.publicacion },
        { $inc: { cantidadComentarios: -ids.length } },
      ),
      // Si era una respuesta, su comentario principal tiene una menos.
      comentario.respondeA
        ? this.comentarioModel.updateOne(
            { _id: comentario.respondeA },
            { $inc: { cantidadRespuestas: -1 } },
          )
        : null,
      // "beto comentó tu publicación" ya no apunta a nada: se borra.
      this.notificacionesService.retirarDeComentarios(ids),
    ]);

    return { mensaje: 'Comentario eliminado', eliminados: ids.length };
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
    // select: solo hace falta el autor (para avisarle cuando le comentan).
    const publicacion = await this.publicacionModel
      .findOne({ _id: id, activa: true })
      .select('usuario');
    if (!publicacion) {
      throw new NotFoundException('La publicación no existe'); // 404
    }
    return publicacion;
  }
}
