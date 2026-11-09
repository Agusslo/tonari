import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

// "Olvidé mi contraseña" (extra): un link para elegir una contraseña nueva.
// Cada pedido crea uno de estos. Sirve UNA vez y vence a los 30 minutos.
//
// En la base NO guardamos el link, guardamos su HASH (sha256), igual que con las
// contraseñas: si alguien llegara a leer esta colección, no podría usar los links.
// (sha256 alcanza y no hace falta bcrypt: el link es un texto al azar de 64
// caracteres, imposible de adivinar probando, y además sha256 deja buscarlo directo.)
@Schema({ collection: 'Recuperaciones', timestamps: true })
export class Recuperacion {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Usuario.name, required: true, index: true })
  usuario: Types.ObjectId;

  @Prop({ required: true, unique: true })
  hash: string;

  @Prop({ required: true })
  vence: Date;
}

export const RecuperacionSchema = SchemaFactory.createForClass(Recuperacion);

// Índice TTL ("time to live"): Mongo borra solo cada documento cuando pasa su fecha
// "vence" (revisa más o menos cada minuto). Así no se juntan links viejos.
// Igual el service revisa "vence" al usarlo, por si Mongo todavía no lo borró.
RecuperacionSchema.index({ vence: 1 }, { expireAfterSeconds: 0 });
