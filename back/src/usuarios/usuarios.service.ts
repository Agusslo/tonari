    import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    } from '@nestjs/common';
    import { InjectModel } from '@nestjs/mongoose';
    import { isValidObjectId, Model } from 'mongoose';
    import bcrypt from 'bcryptjs';
    import { Usuario } from './entities/usuario.entity.js';
    import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
    import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto.js';
    import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
    import { guardarImagen } from '../common/imagenes.js';

    // Lo que ve el administrador de cada usuario en el listado (nunca la contraseña).
    const DATOS_ADMIN =
    'nombre apellido correo nombreUsuario imagenPerfil perfil habilitado googleId discordId createdAt';

    @Injectable()
    export class UsuariosService {
    constructor(@InjectModel(Usuario.name) private usuarioModel: Model<Usuario>) {}

    // ---------- Administración (Sprint 4: solo administradores) ----------
    // Que quien llama sea administrador NO se revisa acá: lo hace AdminGuard antes
    // de llegar al controller. El service solo hace el trabajo.

    // GET /usuarios -> TODOS los usuarios, habilitados y deshabilitados (el admin
    // necesita ver a los deshabilitados para poder volver a habilitarlos).
    // Los más nuevos primero.
    listar() {
        return this.usuarioModel.find().select(DATOS_ADMIN).sort({ createdAt: -1 });
    }

    // POST /usuarios -> el admin crea un usuario (los mismos pasos que el registro)
    // eligiendo su perfil. A diferencia del registro, NO devuelve token: el admin
    // sigue logueado como él mismo, no "entra" con la cuenta nueva.
    async crear(datos: CrearUsuarioDto, imagen: Express.Multer.File) {
        // 1. Correo y nombre de usuario son únicos: 409 con un mensaje claro.
        const existente = await this.usuarioModel.findOne({
        $or: [{ correo: datos.correo.toLowerCase() }, { nombreUsuario: datos.nombreUsuario }],
        });
        if (existente) {
        throw new ConflictException(
            existente.correo === datos.correo.toLowerCase()
            ? 'El correo ya está registrado'
            : 'El nombre de usuario ya está en uso',
        ); // 409
        }

        // 2. Contraseña encriptada y foto a Cloudinary, igual que en el registro.
        const hash = await bcrypt.hash(datos.contraseña, 10);
        const urlImagen = await guardarImagen(imagen, 'perfiles');

        try {
        const usuario = await this.usuarioModel.create({
            nombre: datos.nombre,
            apellido: datos.apellido,
            correo: datos.correo,
            nombreUsuario: datos.nombreUsuario,
            contraseña: hash,
            fechaNacimiento: datos.fechaNacimiento,
            descripcion: datos.descripcion,
            imagenPerfil: urlImagen,
            perfil: datos.perfil, // lo único distinto del registro
        });
        const { contraseña: _contraseña, ...sinContraseña } = usuario.toObject();
        return sinContraseña;
        } catch (error) {
        // Por si dos pedidos con el mismo correo llegan a la vez: el índice único
        // de Mongo frena al segundo (código 11000) y respondemos 409, no 500.
        if ((error as { code?: number }).code === 11000) {
            throw new ConflictException('El correo o el nombre de usuario ya están en uso'); // 409
        }
        throw error;
        }
    }

    // DELETE /usuarios/:id -> baja lógica: no se borra, queda habilitado = false.
    // Desde ese momento no puede ingresar (el login le avisa) y su perfil da 404.
    // adminId: quién lo pide (del token). No se puede deshabilitar a sí mismo:
    // así siempre queda al menos un administrador que puede entrar.
    async deshabilitar(id: string, adminId: string) {
        if (id === adminId) {
        throw new BadRequestException('No podés deshabilitar tu propia cuenta'); // 400
        }
        const usuario = await this.buscarPorId(id);
        if (!usuario.habilitado) {
        throw new ConflictException('Ese usuario ya está deshabilitado'); // 409
        }
        usuario.habilitado = false;
        await usuario.save();
        return this.usuarioModel.findById(id).select(DATOS_ADMIN);
    }

    // POST /usuarios/:id/habilitar -> alta lógica: vuelve a poder usar la app.
    async habilitar(id: string) {
        const usuario = await this.buscarPorId(id);
        if (usuario.habilitado) {
        throw new ConflictException('Ese usuario ya está habilitado'); // 409
        }
        usuario.habilitado = true;
        await usuario.save();
        return this.usuarioModel.findById(id).select(DATOS_ADMIN);
    }

    // Un usuario por _id, esté habilitado o no (400 si el id no tiene formato, 404 si no existe).
    private async buscarPorId(id: string) {
        if (!isValidObjectId(id)) {
        throw new BadRequestException('El id del usuario no es válido'); // 400
        }
        const usuario = await this.usuarioModel.findById(id);
        if (!usuario) {
        throw new NotFoundException('El usuario no existe'); // 404
        }
        return usuario;
    }

    // ---------- Perfil ----------

    // El perfil que ven los demás. select: solo los campos públicos (el correo y la
    // fecha de nacimiento son datos personales: esos los ve solo el dueño en Mi Perfil).
    // Un usuario deshabilitado (baja lógica) no se muestra: 404, como si no existiera.
    async perfilPublico(nombreUsuario: string) {
        const usuario = await this.usuarioModel
        .findOne({ nombreUsuario, habilitado: true })
        .select('nombre apellido nombreUsuario imagenPerfil banner descripcion perfil createdAt discordId discordUsuario mostrarDiscord');
        if (!usuario) {
        throw new NotFoundException('Ese usuario no existe'); // 404
        }
        // Discord (extra): solo si lo vinculó Y eligió mostrarlo. Se arma como "discord"
        // y se sacan los campos sueltos, así nunca sale el id si eligió ocultarlo.
        const { discordId, discordUsuario, mostrarDiscord, ...publico } = usuario.toObject();
        const discord =
        discordId && mostrarDiscord !== false ? { id: discordId, usuario: discordUsuario } : null;
        return { ...publico, discord };
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