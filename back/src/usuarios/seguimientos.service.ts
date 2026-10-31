import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Seguimiento } from './entities/seguimiento.entity.js';
import { Usuario } from './entities/usuario.entity.js';

// Los datos que se muestran de cada persona en las listas de seguidores/seguidos.
const DATOS_PUBLICOS = 'nombre apellido nombreUsuario imagenPerfil';

@Injectable()
export class SeguimientosService {
  constructor(
    @InjectModel(Seguimiento.name) private seguimientoModel: Model<Seguimiento>,
    @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
  ) {}

  // Los números de un perfil: cuántos lo siguen, a cuántos sigue, si YO lo sigo
  // y si ÉL me sigue a mí ("Te sigue"). Las 4 consultas a la vez (Promise.all).
  async resumen(usuarioId: Types.ObjectId | string, quienPregunta: string) {
    const [seguidores, siguiendo, loSigo, meSigue] = await Promise.all([
      this.seguimientoModel.countDocuments({ seguido: usuarioId }),
      this.seguimientoModel.countDocuments({ seguidor: usuarioId }),
      this.seguimientoModel.exists({ seguidor: quienPregunta, seguido: usuarioId }),
      this.seguimientoModel.exists({ seguidor: usuarioId, seguido: quienPregunta }),
    ]);
    return { seguidores, siguiendo, loSigo: loSigo !== null, meSigue: meSigue !== null };
  }

  // POST /usuarios/:id/seguir
  async seguir(seguidorId: string, seguidoId: string) {
    await this.validar(seguidorId, seguidoId);
    try {
      await this.seguimientoModel.create({ seguidor: seguidorId, seguido: seguidoId });
    } catch (error) {
      // 11000 = el índice único: ya lo seguía.
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Ya seguís a este usuario'); // 409
      }
      throw error;
    }
    // Se devuelven los números nuevos para que el front los muestre sin pedir de nuevo.
    return this.resumen(seguidoId, seguidorId);
  }

  // DELETE /usuarios/:id/seguir
  async dejarDeSeguir(seguidorId: string, seguidoId: string) {
    if (!isValidObjectId(seguidoId)) {
      throw new BadRequestException('El id del usuario no es válido'); // 400
    }
    const { deletedCount } = await this.seguimientoModel.deleteOne({
      seguidor: seguidorId,
      seguido: seguidoId,
    });
    if (deletedCount === 0) {
      throw new NotFoundException('No seguías a este usuario'); // 404
    }
    return this.resumen(seguidoId, seguidorId);
  }

  // GET /usuarios/:nombreUsuario/seguidores  o  /siguiendo
  // populate: en vez de los _id, los datos públicos de cada persona.
  async listar(nombreUsuario: string, cual: 'seguidores' | 'siguiendo') {
    const usuario = await this.usuarioModel.findOne({ nombreUsuario, habilitado: true });
    if (!usuario) {
      throw new NotFoundException('Ese usuario no existe'); // 404
    }
    // Seguidores: los documentos donde él es el "seguido", y mostramos al "seguidor".
    // Siguiendo: al revés.
    const [filtro, mostrar] =
      cual === 'seguidores'
        ? [{ seguido: usuario._id }, 'seguidor']
        : [{ seguidor: usuario._id }, 'seguido'];
    const seguimientos = await this.seguimientoModel
      .find(filtro)
      .sort({ createdAt: -1 }) // los más recientes primero
      .limit(100)
      .populate({ path: mostrar, select: DATOS_PUBLICOS, match: { habilitado: true } });
    // match: si alguno fue dado de baja, el populate lo deja en null: lo sacamos.
    return seguimientos.map((s) => s.get(mostrar)).filter((persona) => persona !== null);
  }

  // Los _id de las personas que sigo (para el filtro "Siguiendo" del muro).
  async idsQueSigo(seguidorId: string) {
    const seguimientos = await this.seguimientoModel.find({ seguidor: seguidorId }).select('seguido');
    return seguimientos.map((s) => s.seguido);
  }

  private async validar(seguidorId: string, seguidoId: string) {
    if (!isValidObjectId(seguidoId)) {
      throw new BadRequestException('El id del usuario no es válido'); // 400
    }
    if (seguidorId === seguidoId) {
      throw new BadRequestException('No podés seguirte a vos mismo'); // 400
    }
    const existe = await this.usuarioModel.exists({ _id: seguidoId, habilitado: true });
    if (!existe) {
      throw new NotFoundException('Ese usuario no existe'); // 404
    }
  }
}
