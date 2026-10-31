import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Entrada, TIPOS } from './entities/entrada.entity.js';
import type { TipoObra } from './entities/entrada.entity.js';
import { AgregarEntradaDto } from './dto/agregar-entrada.dto.js';
import { ActualizarEntradaDto } from './dto/actualizar-entrada.dto.js';
import { ListarBibliotecaDto } from './dto/listar-biblioteca.dto.js';

@Injectable()
export class BibliotecaService implements OnModuleInit {
  constructor(@InjectModel(Entrada.name) private entradaModel: Model<Entrada>) {}

  // Al arrancar el back: deja los índices de Mongo iguales a los del schema.
  // Mongoose crea los índices nuevos solo, pero NO borra los viejos. Antes la obra
  // se identificaba con "malId" (Jikan) y ahora con "idAnilist": sin esto, el índice
  // único viejo seguiría en Atlas y rechazaría la segunda obra de cada usuario.
  async onModuleInit() {
    await this.entradaModel.syncIndexes();
  }

  // La biblioteca de un usuario (la propia si no se indica otro), lo último tocado primero.
  listar(usuarioToken: string, { usuario, tipo }: ListarBibliotecaDto) {
    const filtro = tipo ? { usuario: usuario ?? usuarioToken, tipo } : { usuario: usuario ?? usuarioToken };
    return this.entradaModel.find(filtro).sort({ updatedAt: -1 });
  }

  // Una obra de MI biblioteca buscada por tipo + id de AniList (para las URLs lindas:
  // /biblioteca/anime/154587-sousou-no-frieren). No hace falta el _id de Mongo:
  // usuario + tipo + idAnilist ya es único (es el índice único del schema).
  async obtenerPorObra(usuarioId: string, tipo: string, idAnilist: number) {
    if (!TIPOS.includes(tipo as TipoObra)) {
      throw new BadRequestException('El tipo debe ser "anime" o "manga"'); // 400
    }
    // "as TipoObra": ya revisamos arriba que es "anime" o "manga".
    const entrada = await this.entradaModel.findOne({
      usuario: usuarioId,
      tipo: tipo as TipoObra,
      idAnilist,
    });
    if (!entrada) {
      throw new NotFoundException('Esa obra no está en tu biblioteca'); // 404
    }
    return entrada;
  }

  // Una obra sola (400 si el id no es válido, 404 si no existe).
  async obtener(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('El id no es válido'); // 400
    }
    const entrada = await this.entradaModel.findById(id);
    if (!entrada) {
      throw new NotFoundException('Esa obra no está en la biblioteca'); // 404
    }
    return entrada;
  }

  async agregar(usuarioId: string, dto: AgregarEntradaDto) {
    try {
      const entrada = new this.entradaModel({
        usuario: usuarioId,
        tipo: dto.tipo,
        idAnilist: dto.idAnilist,
        titulo: dto.titulo,
        imagen: dto.imagen,
        total: dto.total ?? null,
        estado: dto.estado ?? 'pendiente',
      });
      this.aplicarReglas(entrada, { estado: dto.estado });
      return await entrada.save();
    } catch (error) {
      // 11000 = Mongo rechazó el índice único: esa obra ya estaba en la biblioteca.
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Esa obra ya está en tu biblioteca'); // 409
      }
      throw error;
    }
  }

  async actualizar(id: string, usuarioId: string, dto: ActualizarEntradaDto) {
    const entrada = await this.buscarPropia(id, usuarioId);

    // Si llega un total nuevo, el progreso se compara contra ese.
    if (dto.total !== undefined) entrada.total = dto.total;

    if (dto.progreso !== undefined && entrada.total !== null && dto.progreso > entrada.total) {
      throw new BadRequestException(`El progreso no puede pasar de ${entrada.total}`); // 400
    }

    // Solo se pisa lo que vino en el pedido.
    if (dto.estado !== undefined) entrada.estado = dto.estado;
    if (dto.progreso !== undefined) entrada.progreso = dto.progreso;
    if (dto.puntuacion !== undefined) entrada.puntuacion = dto.puntuacion;

    this.aplicarReglas(entrada, dto);
    return entrada.save();
  }

  async eliminar(id: string, usuarioId: string) {
    const entrada = await this.buscarPropia(id, usuarioId);
    await entrada.deleteOne();
    return { mensaje: 'La obra se quitó de tu biblioteca' };
  }

  // Reglas para que estado y progreso no se contradigan (las decide el back,
  // así valen igual desde la app o desde Postman):
  //  - Si llegaste al último episodio/capítulo -> "completado".
  //  - Si lo marcás "completado" y se sabe el total -> el progreso pasa al total.
  //  - Si bajás el progreso de algo "completado" -> vuelve a "en curso".
  //  - Si avanzás algo estando en "pendiente" -> pasa a "en curso".
  //  - Si llega el total y ya la tenías completa (o ibas por el final) -> queda completa.
  private aplicarReglas(entrada: Entrada, cambios: ActualizarEntradaDto) {
    const { total } = entrada;
    if (cambios.total !== undefined && total !== null) {
      if (entrada.estado === 'completado' || entrada.progreso >= total) {
        entrada.estado = 'completado';
        entrada.progreso = total;
        return;
      }
    }
    if (cambios.estado === 'completado' && total !== null) {
      entrada.progreso = total;
      return;
    }
    if (cambios.progreso !== undefined && total !== null) {
      if (entrada.progreso >= total) {
        entrada.estado = 'completado';
        return;
      }
      if (entrada.estado === 'completado' && cambios.estado === undefined) {
        entrada.estado = 'en-curso';
        return;
      }
    }
    if (entrada.estado === 'pendiente' && entrada.progreso > 0) {
      entrada.estado = 'en-curso';
    }
  }

  // La entrada tiene que existir (si no, 404) y ser tuya (si no, 403).
  private async buscarPropia(id: string, usuarioId: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('El id no es válido'); // 400
    }
    const entrada = await this.entradaModel.findById(id);
    if (!entrada) {
      throw new NotFoundException('Esa obra no está en la biblioteca'); // 404
    }
    if (!entrada.usuario.equals(usuarioId)) {
      throw new ForbiddenException('Solo podés cambiar tu propia biblioteca'); // 403
    }
    return entrada;
  }
}
