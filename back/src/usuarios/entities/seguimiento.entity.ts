import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from './usuario.entity.js';

// "Seguir" (extra, no lo pide la consigna): un documento por cada par
// "seguidor sigue a seguido". Ejemplo: Beto sigue a Caro ->
// { seguidor: <id de Beto>, seguido: <id de Caro> }.
// Va en su propia colección (y no como una lista adentro del usuario) porque
// así contar seguidores, listar y filtrar el muro son consultas simples.
@Schema({ collection: 'Seguimientos', timestamps: true })
export class Seguimiento {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Usuario.name, required: true })
  seguidor: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Usuario.name, required: true })
  seguido: Types.ObjectId;
}

export const SeguimientoSchema = SchemaFactory.createForClass(Seguimiento);

// No se puede seguir dos veces a la misma persona: Mongo lo rechaza (error 11000 -> 409).
SeguimientoSchema.index({ seguidor: 1, seguido: 1 }, { unique: true });
// Para contar rápido los seguidores de alguien.
SeguimientoSchema.index({ seguido: 1 });
