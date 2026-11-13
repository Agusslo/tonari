import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

// Sprint 5: "'Me gusta' otorgados por día".
// La publicación guarda QUIÉNES le dieron "Me gusta" (meGusta: [ids]), pero no CUÁNDO.
// Para contarlos por día, cada "Me gusta" también se anota acá con su fecha.
// Si lo quitan, se borra: cuenta solo los que siguen dados.
@Schema({
  collection: 'MeGustas',
  timestamps: { createdAt: true, updatedAt: false },
})
export class MeGusta {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Usuario.name,
    required: true,
  })
  usuario: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Publicacion',
    required: true,
  })
  publicacion: Types.ObjectId;
}

export const MeGustaSchema = SchemaFactory.createForClass(MeGusta);

MeGustaSchema.index({ createdAt: 1 });
MeGustaSchema.index({ usuario: 1, publicacion: 1 });
