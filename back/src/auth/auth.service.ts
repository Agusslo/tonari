import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { RegistroDto } from './dto/registro.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { guardarImagen, urlBlobatar } from '../common/imagenes.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
  ) {}

  async registro(registroDto: RegistroDto, imagen: Express.Multer.File | undefined) {
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

    // 3. Guardar la imagen de perfil y obtener su URL. Si no subió ninguna,
    //    se le asigna su blobatar: así todos tienen una "identidad".
    const urlImagen = imagen
      ? await guardarImagen(imagen, 'perfiles')
      : urlBlobatar(registroDto.nombreUsuario);

    // 4. Guardar el usuario con el hash en lugar de la contraseña.
    const usuario = await this.usuarioModel.create({
      nombre: registroDto.nombre,
      apellido: registroDto.apellido,
      correo: registroDto.correo,
      nombreUsuario: registroDto.nombreUsuario,
      contraseña: hash,
      fechaNacimiento: registroDto.fechaNacimiento,
      descripcion: registroDto.descripcion,
      imagenPerfil: urlImagen,
    });

    // 5. Devolver los datos SIN la contraseña.
    return this.sinContraseña(usuario);
  }

  async login(loginDto: LoginDto) {
    // 1. Buscar por correo O por nombre de usuario.
    //    select('+contraseña'): pide explícitamente el campo que el schema oculta
    //    (select: false), porque acá sí lo necesitamos para comparar.
    const usuario = await this.usuarioModel
      .findOne({
        $or: [
          { correo: loginDto.usuario.toLowerCase() },
          { nombreUsuario: loginDto.usuario },
        ],
      })
      .select('+contraseña');

    // 2. Comparar la contraseña recibida con el hash guardado.
    //    bcrypt.compare hashea la recibida con los mismos datos y compara.
    const contraseñaCorrecta =
      usuario !== null &&
      (await bcrypt.compare(loginDto.contraseña, usuario.contraseña));

    // Mismo mensaje si no existe el usuario o si la contraseña está mal:
    // así nadie puede averiguar qué correos están registrados.
    if (!usuario || !contraseñaCorrecta) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos'); // 401
    }

    // 3. Un usuario deshabilitado no puede ingresar (consigna, Sprint 4).
    if (!usuario.habilitado) {
      throw new ForbiddenException(
        'Tu cuenta está deshabilitada. Contactá a un administrador.',
      ); // 403
    }

    // 4. Devolver todos los datos del usuario, menos la contraseña.
    return this.sinContraseña(usuario);
  }

  // select:false solo aplica a las búsquedas: un documento recién creado,
  // o uno pedido con '+contraseña', la trae. Acá se la sacamos antes de responder.
  private sinContraseña(usuario: { toObject(): Usuario }) {
    const { contraseña: _contraseña, ...datos } = usuario.toObject();
    return datos;
  }
}