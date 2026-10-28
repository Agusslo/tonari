    import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
    import { InjectModel } from '@nestjs/mongoose';
    import { isValidObjectId, Model } from 'mongoose';
    import { Usuario } from './entities/usuario.entity.js';
    import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
    import { guardarImagen } from '../common/imagenes.js';

    @Injectable()
    export class UsuariosService {
    constructor(@InjectModel(Usuario.name) private usuarioModel: Model<Usuario>) {}

    // Editar mi perfil: cambia solo los campos que vinieron y, si mandaron
    // una foto nueva, la guarda y reemplaza la URL.
    async actualizar(id: string, datos: ActualizarUsuarioDto, imagen?: Express.Multer.File) {
        if (!isValidObjectId(id)) {
        throw new BadRequestException('El id del usuario no es válido'); // 400
        }
        const usuario = await this.usuarioModel.findOne({ _id: id, habilitado: true });
        if (!usuario) {
        throw new NotFoundException('El usuario no existe'); // 404
        }

        // Solo los campos que llegaron (los demás quedan como estaban).
        if (datos.nombre !== undefined) usuario.nombre = datos.nombre;
        if (datos.apellido !== undefined) usuario.apellido = datos.apellido;
        if (datos.descripcion !== undefined) usuario.descripcion = datos.descripcion;
        if (datos.fechaNacimiento !== undefined) {
        usuario.fechaNacimiento = new Date(datos.fechaNacimiento);
        }
        if (imagen) usuario.imagenPerfil = await guardarImagen(imagen, 'perfiles');

        await usuario.save();

        // Igual que en el login: todos los datos menos la contraseña.
        // (findOne no la trae por el select:false, pero por las dudas la sacamos.)
        const { contraseña: _contraseña, ...sinContraseña } = usuario.toObject();
        return sinContraseña;
    }
    }