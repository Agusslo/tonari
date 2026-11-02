import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Publicacion } from './entities/publicacion.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { SeguimientosService } from '../usuarios/seguimientos.service.js';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto.js';
import { ListarPublicacionesDto } from './dto/listar-publicaciones.dto.js';
import { guardarImagen } from '../common/imagenes.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';

// Los datos del autor que se muestran en cada publicación.
// Nunca la contraseña (igual tiene select:false) ni el correo.
const DATOS_AUTOR = 'nombre apellido nombreUsuario imagenPerfil';

@Injectable()
export class PublicacionesService {
  constructor(
    @InjectModel(Publicacion.name) private publicacionModel: Model<Publicacion>,
    @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
    private readonly seguimientosService: SeguimientosService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // usuarioId: quién publica (viene del token). imagen es opcional:
  // llega undefined si la publicación no tiene.
  async crear(
    crearPublicacionDto: CrearPublicacionDto,
    usuarioId: string,
    imagen?: Express.Multer.File,
  ) {
    // 1. El autor tiene que existir y estar habilitado (si no, 404).
    await this.buscarUsuario(usuarioId);

    // 2. Si mandaron imagen, guardarla y quedarse con su URL.
    const urlImagen = imagen ? await guardarImagen(imagen, 'publicaciones') : undefined;

    // 3. Guardar la publicación (meGusta y activa toman su valor por defecto).
    //    Si no hay imagen, el campo directamente no se guarda.
    const publicacion = await this.publicacionModel.create({
      titulo: crearPublicacionDto.titulo,
      descripcion: crearPublicacionDto.descripcion,
      usuario: usuarioId,
      imagen: urlImagen,
    });

    // 4. Devolverla con los datos del autor en vez de solo su _id.
    return publicacion.populate('usuario', DATOS_AUTOR);
  }

  // GET con orden, filtro por usuario y paginación.
  // quienPide: el usuario del token (para el filtro "Siguiendo").
  async listar({ orden, usuario, offset, limit, siguiendo }: ListarPublicacionesDto, quienPide: string) {
    // Qué publicaciones entran: solo las activas y, si piden, solo las de un usuario
    // o solo las de la gente que sigo ($in = "el autor es alguno de esta lista").
    let filtro: Record<string, unknown> = { activa: true };
    if (siguiendo) {
      filtro = { activa: true, usuario: { $in: await this.seguimientosService.idsQueSigo(quienPide) } };
    } else if (usuario) {
      filtro = { activa: true, usuario };
    }

    // Por "Me gusta": las que más tienen primero (y a igual cantidad, la más nueva).
    // Por fecha: la más nueva primero. (-1 = de mayor a menor)
    const ordenamiento: Record<string, 1 | -1> =
      orden === 'meGusta' ? { cantidadMeGusta: -1, createdAt: -1 } : { createdAt: -1 };

    // Las dos consultas a la vez (Promise.all): la página pedida y el total.
    const [publicaciones, total] = await Promise.all([
      this.publicacionModel
        .find(filtro)
        .sort(ordenamiento)
        .skip(offset) // saltear las de las páginas anteriores
        .limit(limit) // quedarse con las de esta página
        .populate('usuario', DATOS_AUTOR),
      this.publicacionModel.countDocuments(filtro),
    ]);

    // El total sirve en el front para saber cuántas páginas hay.
    return { publicaciones, total, offset, limit };
  }

  // Una sola publicación (activa), con los datos del autor.
  async obtener(id: string) {
    const publicacion = await this.buscarActiva(id);
    return publicacion.populate('usuario', DATOS_AUTOR);
  }

  // Baja lógica: no se borra, se marca activa = false.
  // Solo puede hacerlo quien la creó o un administrador.
  async eliminar(id: string, usuarioId: string) {
    const publicacion = await this.buscarActiva(id);
    const usuario = await this.buscarUsuario(usuarioId);

    // .equals(): los _id son objetos (ObjectId), no textos; se comparan así.
    const esAutor = publicacion.usuario.equals(usuario._id);
    const esAdministrador = usuario.perfil === 'administrador';
    if (!esAutor && !esAdministrador) {
      throw new ForbiddenException(
        'Solo quien creó la publicación o un administrador pueden eliminarla',
      ); // 403
    }

    publicacion.activa = false;
    await publicacion.save();
    // Sus notificaciones (me gusta, comentarios) ya no apuntan a nada: se borran.
    await this.notificacionesService.retirarDePublicacion(publicacion._id);
    return { mensaje: 'Publicación eliminada' };
  }

  // Un solo "Me gusta" por usuario por publicación.
  async darMeGusta(id: string, usuarioId: string) {
    const publicacion = await this.buscarActiva(id);
    await this.buscarUsuario(usuarioId);

    if (publicacion.meGusta.some((meGusta) => meGusta.equals(usuarioId))) {
      throw new ConflictException('Ya le diste "Me gusta" a esta publicación'); // 409
    }

    publicacion.meGusta.push(new Types.ObjectId(usuarioId));
    publicacion.cantidadMeGusta = publicacion.meGusta.length;
    await publicacion.save();
    // Aviso al autor: "<usuario> le gustó tu publicación" (si no es él mismo).
    await this.notificacionesService.avisar({
      destinatario: publicacion.usuario,
      autor: usuarioId,
      tipo: 'meGusta',
      publicacion: publicacion._id,
    });
    return publicacion.populate('usuario', DATOS_AUTOR);
  }

  // Solo se puede quitar si el usuario lo había dado.
  async quitarMeGusta(id: string, usuarioId: string) {
    const publicacion = await this.buscarActiva(id);
    await this.buscarUsuario(usuarioId);

    if (!publicacion.meGusta.some((meGusta) => meGusta.equals(usuarioId))) {
      throw new BadRequestException('No le habías dado "Me gusta" a esta publicación'); // 400
    }

    publicacion.meGusta = publicacion.meGusta.filter((meGusta) => !meGusta.equals(usuarioId));
    publicacion.cantidadMeGusta = publicacion.meGusta.length;
    await publicacion.save();
    // Si lo saca, el aviso también se va.
    await this.notificacionesService.retirar({
      autor: usuarioId,
      tipo: 'meGusta',
      publicacion: publicacion._id,
    });
    return publicacion.populate('usuario', DATOS_AUTOR);
  }

  // ---------- Ayudantes (los usan los métodos de arriba) ----------

  // Busca una publicación que exista y no esté dada de baja.
  private async buscarActiva(id: string) {
    // Si el id ni siquiera tiene formato de _id de Mongo, ni lo buscamos.
    if (!isValidObjectId(id)) {
      throw new BadRequestException('El id de la publicación no es válido'); // 400
    }
    const publicacion = await this.publicacionModel.findOne({ _id: id, activa: true });
    if (!publicacion) {
      throw new NotFoundException('La publicación no existe'); // 404
    }
    return publicacion;
  }

  // Busca un usuario que exista y esté habilitado.
  private async buscarUsuario(id: string) {
    const usuario = await this.usuarioModel.findOne({ _id: id, habilitado: true });
    if (!usuario) {
      throw new NotFoundException('El usuario no existe'); // 404
    }
    return usuario;
  }
}