import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Publicacion } from '../../publicaciones/entities/publicacion.entity.js';

// timestamps: true -> Mongoose agrega createdAt (la fecha del comentario, que pide
// la consigna) y updatedAt (cuándo se editó por última vez).
@Schema({ collection: 'Comentarios', timestamps: true })
export class Comentario {
  @Prop({ required: true, trim: true })
  mensaje: string;

  // A qué publicación pertenece (referencia, igual que "usuario" en Publicacion).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Publicacion.name, required: true })
  publicacion: Types.ObjectId;

  // Quién lo escribió (sale del token, nunca del body).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Usuario.name, required: true })
  usuario: Types.ObjectId;

  // Consigna: al editarlo se marca "modificado: true" y el front lo anuncia.
  @Prop({ default: false })
  modificado: boolean;

  // Si es una respuesta: a qué comentario responde. null = comentario "principal".
  // Las respuestas tienen un solo nivel (como en Instagram): responder a una
  // respuesta la cuelga del mismo comentario principal.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Comentario', default: null })
  respondeA: Types.ObjectId | null;

  // Cuántas respuestas tiene, para mostrar "Ver 3 respuestas" sin contarlas cada vez.
  @Prop({ default: 0 })
  cantidadRespuestas: number;
}

export const ComentarioSchema = SchemaFactory.createForClass(Comentario);

// Índice: los comentarios siempre se buscan "de una publicación, del más nuevo al
// más viejo". Con este índice Mongo los encuentra ya ordenados, sin recorrer todos.
ComentarioSchema.index({ publicacion: 1, createdAt: -1 });
// Y las respuestas, "de un comentario, en orden de llegada".
ComentarioSchema.index({ respondeA: 1, createdAt: 1 });
