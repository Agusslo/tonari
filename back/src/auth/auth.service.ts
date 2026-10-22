    import { ConflictException, Injectable } from '@nestjs/common';
    import { InjectModel } from '@nestjs/mongoose';
    import { Model } from 'mongoose';
    import bcrypt from 'bcryptjs';
    import { Usuario } from '../usuarios/entities/usuario.entity.js';
    import { RegistroDto } from './dto/registro.dto.js';

    @Injectable()
    export class AuthService {
    constructor(
        @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
    ) {}

    async registro(registroDto: RegistroDto) {
        // 1. Revisar que el usuario no exista (correo y nombre de usuario son únicos).
        const existente = await this.usuarioModel.findOne({
        $or: [
            { correo: registroDto.correo.toLowerCase() },
            { nombreUsuario: registroDto.nombreUsuario },
        ],
        });
        if (existente) {
        const mensaje =
            existente.correo === registroDto.correo.toLowerCase()
            ? 'El correo ya está registrado'
            : 'El nombre de usuario ya está en uso';
        throw new ConflictException(mensaje); // 409
        }

        // 2. Hashear la contraseña. El 10 es el "costo": cuántas vueltas hace el algoritmo.
        const hash = await bcrypt.hash(registroDto.contraseña, 10);

        // 3. Guardar el usuario con el hash en lugar de la contraseña.
        const usuario = await this.usuarioModel.create({
        nombre: registroDto.nombre,
        apellido: registroDto.apellido,
        correo: registroDto.correo,
        nombreUsuario: registroDto.nombreUsuario,
        contraseña: hash,
        fechaNacimiento: registroDto.fechaNacimiento,
        descripcion: registroDto.descripcion,
        imagenPerfil: registroDto.imagenPerfil,
        });

        // 4. Devolver los datos SIN la contraseña. select:false solo aplica a las
        //    búsquedas: el documento recién creado todavía la trae, hay que sacarla.
        const { contraseña: _contraseña, ...datos } = usuario.toObject();
        return datos;
    }
    }