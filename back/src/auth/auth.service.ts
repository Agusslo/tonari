import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { RegistroDto } from './dto/registro.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
  ) {}

  async registro(registroDto: RegistroDto, imagen: Express.Multer.File) {
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

    // 3. Guardar la imagen de perfil y obtener su URL.
    const urlImagen = await this.guardarImagen(imagen, 'perfiles');

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

    // 5. Devolver los datos SIN la contraseña. select:false solo aplica a las
    //    búsquedas: el documento recién creado todavía la trae, hay que sacarla.
    const { contraseña: _contraseña, ...datos } = usuario.toObject();
    return datos;
  }

  // Guarda la imagen en back/uploads/<carpeta>/ con un nombre único
  // y devuelve la URL pública para guardarla en la base de datos.
  private async guardarImagen(imagen: Express.Multer.File, carpeta: string) {
    const extension = imagen.mimetype.split('/')[1]; // jpeg | png | webp
    const nombreArchivo = `${randomUUID()}.${extension}`;

    const directorio = join(process.cwd(), 'uploads', carpeta);
    await mkdir(directorio, { recursive: true }); // crea la carpeta si no existe
    await writeFile(join(directorio, nombreArchivo), imagen.buffer);

    // Se lee acá adentro (y no arriba del archivo) para que tome el valor real
    // de la variable de entorno cuando exista (el bug del .env de la clase 14).
    const urlPublica = process.env.URL_PUBLICA ?? 'http://localhost:3000';
    return `${urlPublica}/uploads/${carpeta}/${nombreArchivo}`;
  }
}
