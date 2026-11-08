import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, isValidObjectId, Model, Types } from 'mongoose';
import { Publicacion } from './entities/publicacion.entity.js';
import { Voto } from './entities/voto.entity.js';
import { Entrada } from '../biblioteca/entities/entrada.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { SeguimientosService } from '../usuarios/seguimientos.service.js';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto.js';
import { ListarPublicacionesDto } from './dto/listar-publicaciones.dto.js';
import { guardarImagen } from '../common/imagenes.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';

// Los datos del autor que se muestran en cada publicación.
// Nunca la contraseña (igual tiene select:false) ni el correo.
const DATOS_AUTOR = 'nombre apellido nombreUsuario imagenPerfil';

// Por qué se muestra un spoiler sin taparlo (null = se tapa).
type SpoilerLiberado = 'autor' | 'completado' | 'progreso' | null;

@Injectable()
export class PublicacionesService {
  constructor(
    @InjectModel(Publicacion.name) private publicacionModel: Model<Publicacion>,
    @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
    @InjectModel(Voto.name) private votoModel: Model<Voto>,
    @InjectModel(Entrada.name) private entradaModel: Model<Entrada>,
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

    // 2. Encuesta (opcional): sin opciones repetidas ("Sí" y "sí" cuentan igual).
    const { encuesta, spoiler } = crearPublicacionDto;
    if (encuesta) {
      const distintas = new Set(encuesta.opciones.map((opcion) => opcion.toLowerCase()));
      if (distintas.size !== encuesta.opciones.length) {
        throw new BadRequestException('La encuesta tiene opciones repetidas'); // 400
      }
    }

    // 3. Si mandaron imagen, guardarla y quedarse con su URL.
    const urlImagen = imagen ? await guardarImagen(imagen, 'publicaciones') : undefined;

    // 4. Guardar la publicación (meGusta y activa toman su valor por defecto).
    //    Si no hay imagen, encuesta o spoiler, esos campos directamente no se guardan.
    const publicacion = await this.publicacionModel.create({
      titulo: crearPublicacionDto.titulo,
      descripcion: crearPublicacionDto.descripcion,
      usuario: usuarioId,
      imagen: urlImagen,
      encuesta: encuesta && {
        opciones: encuesta.opciones.map((texto) => ({ texto, votos: 0 })),
        // La encuesta cierra dentro de N horas (en milisegundos: horas * 60 * 60 * 1000).
        cierra: new Date(Date.now() + encuesta.duracionHoras * 3_600_000),
      },
      spoiler: spoiler && { ...spoiler, hasta: spoiler.hasta ?? null },
    });

    // 5. Devolverla con los datos del autor en vez de solo su _id.
    await publicacion.populate('usuario', DATOS_AUTOR);
    return this.prepararUna(publicacion, usuarioId);
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
    return { publicaciones: await this.preparar(publicaciones, quienPide), total, offset, limit };
  }

  // Una sola publicación (activa), con los datos del autor.
  async obtener(id: string, quienMira: string) {
    const publicacion = await this.buscarActiva(id);
    await publicacion.populate('usuario', DATOS_AUTOR);
    return this.prepararUna(publicacion, quienMira);
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
    await publicacion.populate('usuario', DATOS_AUTOR);
    return this.prepararUna(publicacion, usuarioId);
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
    await publicacion.populate('usuario', DATOS_AUTOR);
    return this.prepararUna(publicacion, usuarioId);
  }

  // Votar en la encuesta (extra). Un voto por persona y no se puede cambiar
  // (como en Twitter/X: así nadie "acomoda" el resultado después de verlo).
  async votar(id: string, usuarioId: string, opcion: number) {
    const publicacion = await this.buscarActiva(id);
    await this.buscarUsuario(usuarioId);

    const { encuesta } = publicacion;
    if (!encuesta) {
      throw new BadRequestException('Esta publicación no tiene encuesta'); // 400
    }
    if (opcion >= encuesta.opciones.length) {
      throw new BadRequestException('Esa opción no existe'); // 400
    }
    if (encuesta.cierra.getTime() <= Date.now()) {
      throw new BadRequestException('La encuesta ya cerró'); // 400
    }

    // 1. Guardar QUIÉN votó. Si ya había votado, el índice único lo rechaza (11000):
    //    no hace falta buscar antes, y funciona aunque lleguen dos clics a la vez.
    try {
      await this.votoModel.create({ publicacion: publicacion._id, usuario: usuarioId, opcion });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Ya votaste en esta encuesta'); // 409
      }
      throw error;
    }

    // 2. Sumar el voto con $inc: Mongo suma 1 "en el lugar", sin leer y volver a guardar.
    //    Si dos personas votan a la vez, se suman las dos (con save() una pisaría a la otra).
    //    "encuesta.opciones.1.votos" = el campo votos de la opción en la posición 1.
    const actualizada = await this.publicacionModel
      .findByIdAndUpdate(
        publicacion._id,
        { $inc: { [`encuesta.opciones.${opcion}.votos`]: 1 } },
        { new: true }, // que devuelva la publicación YA actualizada
      )
      .populate('usuario', DATOS_AUTOR);
    return this.prepararUna(actualizada!, usuarioId);
  }

  // ---------- Ayudantes (los usan los métodos de arriba) ----------

  // Antes de mandar publicaciones al front, se "preparan" para QUIEN las mira:
  //  - Encuesta: le agregamos miVoto, totalVotos y si ya cerró. Los votos de cada opción
  //    solo se mandan si ya votaste o si cerró: si no, cualquiera vería el resultado
  //    parcial en la pestaña Red antes de votar (y votaría "al ganador").
  //    El autor también vota en su propia encuesta, como en Twitter/X.
  //  - Spoiler: decidimos si se tapa mirando TU biblioteca. Se muestra si sos el autor,
  //    si la obra está "completado" o si ya vas por el episodio/capítulo del spoiler.
  // Para no hacer una consulta por publicación, se buscan todos los votos y todas las
  // obras de la página de una vez ($in / $or) y después se reparten.
  private async preparar(publicaciones: HydratedDocument<Publicacion>[], quienMira: string) {
    const conEncuesta = publicaciones.filter((p) => p.encuesta).map((p) => p._id);
    const obras = publicaciones
      .filter((p) => p.spoiler)
      .map((p) => ({ tipo: p.spoiler!.tipo, idAnilist: p.spoiler!.idAnilist }));

    const [votos, entradas] = await Promise.all([
      conEncuesta.length
        ? this.votoModel.find({ usuario: quienMira, publicacion: { $in: conEncuesta } })
        : [],
      obras.length ? this.entradaModel.find({ usuario: quienMira, $or: obras }) : [],
    ]);

    const ahora = Date.now();
    return publicaciones.map((documento) => {
      // toObject(): de documento de Mongoose a objeto común, para poder agregarle campos.
      const publicacion = documento.toObject();
      const autor = publicacion.usuario as unknown as { _id: Types.ObjectId };
      const esAutor = autor._id.equals(quienMira);

      let encuesta: Record<string, unknown> | undefined;
      if (publicacion.encuesta) {
        const miVoto = votos.find((voto) => voto.publicacion.equals(documento._id))?.opcion ?? null;
        const cerrada = new Date(publicacion.encuesta.cierra).getTime() <= ahora;
        const verResultados = miVoto !== null || cerrada;
        encuesta = {
          opciones: publicacion.encuesta.opciones.map(({ texto, votos: cantidad }) => ({
            texto,
            votos: verResultados ? cantidad : null,
          })),
          cierra: publicacion.encuesta.cierra,
          cerrada,
          totalVotos: publicacion.encuesta.opciones.reduce((suma, o) => suma + o.votos, 0),
          miVoto,
          verResultados,
        };
      }

      let spoiler: Record<string, unknown> | undefined;
      if (publicacion.spoiler) {
        const { tipo, idAnilist, hasta } = publicacion.spoiler;
        const entrada = entradas.find((e) => e.tipo === tipo && e.idAnilist === idAnilist);
        let liberado: SpoilerLiberado = null;
        if (esAutor) liberado = 'autor';
        else if (entrada?.estado === 'completado') liberado = 'completado';
        else if (entrada && hasta !== null && entrada.progreso >= hasta) liberado = 'progreso';
        spoiler = { ...publicacion.spoiler, liberado, miProgreso: entrada?.progreso ?? null };
      }

      return { ...publicacion, encuesta, spoiler };
    });
  }

  private async prepararUna(publicacion: HydratedDocument<Publicacion>, quienMira: string) {
    const [preparada] = await this.preparar([publicacion], quienMira);
    return preparada;
  }

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