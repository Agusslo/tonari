import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

// Sprint 5: "Visitas a mi perfil (de usuarios que no sean uno mismo)".
// Se guarda una cada vez que alguien abre el perfil de OTRO (/usuarios/beto).
// Entrar a tu propio perfil no cuenta: ni siquiera se guarda.
@Schema({
  collection: 'Visitas',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Visita {
  // El dueño del perfil visitado.
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Usuario.name,
    required: true,
  })
  perfil: Types.ObjectId;

  // Quién lo visitó.
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Usuario.name,
    required: true,
  })
  visitante: Types.ObjectId;
}

export const VisitaSchema = SchemaFactory.createForClass(Visita);

// La estadística busca "las visitas a MI perfil en tal rango de fechas".
VisitaSchema.index({ perfil: 1, createdAt: 1 });
