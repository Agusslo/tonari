import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

// Sprint 5: "Cantidad de ingresos (login) por usuario".
// Cada vez que alguien inicia sesión (con contraseña, Google o Discord, o al crear
// la cuenta) se guarda uno de estos. createdAt (timestamps) es el momento del ingreso.
@Schema({
  collection: 'Ingresos',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Ingreso {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Usuario.name,
    required: true,
  })
  usuario: Types.ObjectId;

  // Cómo entró: lo muestra la estadística como detalle.
  @Prop({
    required: true,
    enum: ['contraseña', 'google', 'discord', 'registro'],
  })
  metodo: string;
}

export const IngresoSchema = SchemaFactory.createForClass(Ingreso);

// Las estadísticas filtran por fecha: el índice evita recorrer toda la colección.
IngresoSchema.index({ createdAt: 1 });
