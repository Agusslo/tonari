import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// El body para crear (POST) y para editar (PUT) un comentario: solo el mensaje.
// Quién lo escribe sale del token; la publicación, de la URL.
export class MensajeComentarioDto {
  // @Transform: le saca los espacios de las puntas ANTES de validar.
  // Sin esto, "   " pasaría @IsNotEmpty (no está vacío: tiene espacios),
  // Mongo lo recortaría a "" y fallaría con un 500 en vez de un 400 claro.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El comentario debe ser un texto' })
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  @MaxLength(500, { message: 'El comentario puede tener hasta 500 caracteres' })
  mensaje: string;
}
