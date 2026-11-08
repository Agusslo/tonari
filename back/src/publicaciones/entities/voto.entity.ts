import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Publicacion } from './publicacion.entity.js';

// Un voto en la encuesta de una publicación (extra).
// Va en una colección APARTE y no adentro de la publicación por dos motivos:
//   1. Privacidad: la publicación viaja entera al front; si tuviera la lista de quién
//      votó qué, cualquiera la podría ver en la pestaña Red.
//   2. Un voto por persona garantizado por Mongo: el índice único de abajo rechaza
//      el segundo voto aunque lleguen dos pedidos al mismo tiempo (doble clic).
@Schema({ collection: 'Votos', timestamps: true })
export class Voto {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Publicacion.name, required: true })
  publicacion: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Usuario.name, required: true })
  usuario: Types.ObjectId;

  // La posición de la opción elegida (0, 1, 2 o 3).
  @Prop({ required: true, min: 0 })
  opcion: number;
}

export const VotoSchema = SchemaFactory.createForClass(Voto);

VotoSchema.index({ publicacion: 1, usuario: 1 }, { unique: true });
