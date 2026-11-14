import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Publicacion } from '../publicaciones/entities/publicacion.entity.js';

// Cuántos resultados de cada tipo devuelve (es un desplegable, no una página).
const MAXIMO = 5;

// Buscador global (extra): usuarios y publicaciones desde la barra de arriba.
@Injectable()
export class BuscarService {
  constructor(
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
    @InjectModel(Publicacion.name)
    private readonly publicacionModel: Model<Publicacion>,
  ) {}

  async buscar(texto: string) {
    // "Contiene", sin importar mayúsculas (la "i"). escapar(): si alguien escribe
    // un ".", "*" o "(", se busca ese carácter y no se interpreta como regex.
    const patron = new RegExp(escapar(texto), 'i');

    const [usuarios, publicaciones] = await Promise.all([
      // Usuarios habilitados cuyo usuario, nombre o apellido contenga el texto.
      this.usuarioModel
        .find({
          habilitado: true,
          $or: [
            { nombreUsuario: patron },
            { nombre: patron },
            { apellido: patron },
          ],
        })
        .select('nombre apellido nombreUsuario imagenPerfil')
        .sort({ nombreUsuario: 1 })
        .limit(MAXIMO),
      // Publicaciones activas por TÍTULO. La descripción no se busca a propósito:
      // puede tener spoilers tapados y el buscador los dejaría adivinar.
      this.publicacionModel
        .find({ activa: true, titulo: patron })
        .select(
          'titulo imagen createdAt cantidadMeGusta cantidadComentarios usuario',
        )
        .sort({ createdAt: -1 })
        .limit(MAXIMO)
        .populate('usuario', 'nombreUsuario'),
    ]);

    return { usuarios, publicaciones };
  }
}

function escapar(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
