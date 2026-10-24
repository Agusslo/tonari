    import { Injectable, NotFoundException } from '@nestjs/common';
    import { InjectModel } from '@nestjs/mongoose';
    import { Model } from 'mongoose';
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
        // 1. El autor tiene que existir y estar habilitado.
        const autor = await this.usuarioModel.exists({
        _id: crearPublicacionDto.usuario,
        habilitado: true,
        });
        if (!autor) {
        throw new NotFoundException('El usuario no existe'); // 404
        }

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
    }