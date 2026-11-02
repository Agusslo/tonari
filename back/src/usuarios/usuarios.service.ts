    import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
    import { InjectModel } from '@nestjs/mongoose';
    import { isValidObjectId, Model } from 'mongoose';
    import bcrypt from 'bcryptjs';
    import { Usuario } from './entities/usuario.entity.js';
    import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
    import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto.js';
    import { guardarImagen } from '../common/imagenes.js';

    @Injectable()
    export class UsuariosService {
    constructor(@InjectModel(Usuario.name) private usuarioModel: Model<Usuario>) {}

    // El perfil que ven los demás. select: solo los campos públicos (el correo y la
    // fecha de nacimiento son datos personales: esos los ve solo el dueño en Mi Perfil).
    // Un usuario deshabilitado (baja lógica) no se muestra: 404, como si no existiera.
    async perfilPublico(nombreUsuario: string) {
        const usuario = await this.usuarioModel
        .findOne({ nombreUsuario, habilitado: true })
        .select('nombre apellido nombreUsuario imagenPerfil banner descripcion perfil createdAt');
        if (!usuario) {
        throw new NotFoundException('Ese usuario no existe'); // 404
        }
        return usuario;
    }

    // Editar mi perfil: cambia solo los campos que vinieron y, si mandaron
    // una foto nueva, la guarda y reemplaza la URL.
    async actualizar(
        id: string,
        datos: ActualizarUsuarioDto,
        imagen?: Express.Multer.File,
        banner?: Express.Multer.File,
    ) {
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
        // Banner nuevo -> a Cloudinary (carpeta tonari/banners). Si no mandan uno
        // pero piden quitarlo, se borra el campo (undefined = Mongo lo saca del documento).
        if (banner) usuario.banner = await guardarImagen(banner, 'banners');
        else if (datos.quitarBanner) usuario.banner = undefined;

        await usuario.save();

        // Igual que en el login: todos los datos menos la contraseña.
        // (findOne no la trae por el select:false, pero por las dudas la sacamos.)
        const { contraseña: _contraseña, ...sinContraseña } = usuario.toObject();
        return sinContraseña;
    }

    // GET /usuarios/:id/contrasena -> ¿mi cuenta tiene contraseña?
    // Las que se crearon con Google no tienen: entran solo con el botón.
    // Nunca se devuelve la contraseña (ni el hash): solo true o false.
    // $nin [null, '']: "que no sea null ni vacía" (null también agarra al campo que no existe).
    async estadoContrasena(id: string) {
        if (!isValidObjectId(id)) {
        throw new BadRequestException('El id del usuario no es válido'); // 400
        }
        const tieneContraseña = await this.usuarioModel.exists({
        _id: id,
        contraseña: { $nin: [null, ''] },
        });
        return { tieneContraseña: tieneContraseña !== null };
    }

    // PATCH /usuarios/:id/contrasena -> crear una contraseña (cuenta de Google) o cambiarla.
    // Así alguien que se registró con Google puede entrar también con correo y contraseña,
    // por ejemplo desde una compu donde no tiene su cuenta de Google abierta.
    async cambiarContrasena(id: string, { contraseñaActual, contraseñaNueva }: CambiarContrasenaDto) {
        if (!isValidObjectId(id)) {
        throw new BadRequestException('El id del usuario no es válido'); // 400
        }
        // '+contraseña': la pedimos a propósito (el schema la oculta) para compararla.
        const usuario = await this.usuarioModel
        .findOne({ _id: id, habilitado: true })
        .select('+contraseña');
        if (!usuario) {
        throw new NotFoundException('El usuario no existe'); // 404
        }

        // Si ya tenía contraseña, hay que saber la actual para cambiarla.
        // 400 (y no 401): un 401 haría que el front cierre la sesión.
        if (usuario.contraseña) {
        if (!contraseñaActual) {
            throw new BadRequestException('Ingresá tu contraseña actual'); // 400
        }
        const correcta = await bcrypt.compare(contraseñaActual, usuario.contraseña);
        if (!correcta) {
            throw new BadRequestException('La contraseña actual no es correcta'); // 400
        }
        if (contraseñaActual === contraseñaNueva) {
            throw new BadRequestException('La contraseña nueva tiene que ser distinta de la actual'); // 400
        }
        }

        // Igual que en el registro: se guarda el hash, nunca la contraseña.
        usuario.contraseña = await bcrypt.hash(contraseñaNueva, 10);
        await usuario.save();
        return { tieneContraseña: true };
    }
    }