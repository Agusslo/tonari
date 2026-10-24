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
    import { CrearPublicacionDto } from './dto/crear-publicacion.dto.js';
    import { guardarImagen } from '../common/imagenes.js';

    // Los datos del autor que se muestran en cada publicación.
    // Nunca la contraseña (igual tiene select:false) ni el correo.
    const DATOS_AUTOR = 'nombre apellido nombreUsuario imagenPerfil';

    @Injectable()
    export class PublicacionesService {
    constructor(
        @InjectModel(Publicacion.name) private publicacionModel: Model<Publicacion>,
        @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
    ) {}

    // imagen es opcional: llega undefined si la publicación no tiene.
    async crear(crearPublicacionDto: CrearPublicacionDto, imagen?: Express.Multer.File) {
        // 1. El autor tiene que existir y estar habilitado (si no, 404).
        await this.buscarUsuario(crearPublicacionDto.usuario);

        // 2. Si mandaron imagen, guardarla y quedarse con su URL.
        const urlImagen = imagen ? await guardarImagen(imagen, 'publicaciones') : undefined;

        // 3. Guardar la publicación (meGusta y activa toman su valor por defecto).
        //    Si no hay imagen, el campo directamente no se guarda.
        const publicacion = await this.publicacionModel.create({
        titulo: crearPublicacionDto.titulo,
        descripcion: crearPublicacionDto.descripcion,
        usuario: crearPublicacionDto.usuario,
        imagen: urlImagen,
        });

        // 4. Devolverla con los datos del autor en vez de solo su _id.
        return publicacion.populate('usuario', DATOS_AUTOR);
    }

    // Las últimas publicaciones activas, de la más nueva a la más vieja.
    // (El ordenamiento por "Me gusta", el filtro y la paginación vienen después.)
    listar() {
        return this.publicacionModel
        .find({ activa: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('usuario', DATOS_AUTOR);
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
        await publicacion.save();
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
        await publicacion.save();
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