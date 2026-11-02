import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

// Los tipos de aviso que hay. Cada uno se arma distinto en el front:
// meGusta    -> "A beto le gustó tu publicación"
// seguir     -> "caro te empezó a seguir"
// comentario -> "beto comentó tu publicación"
// respuesta  -> "caro respondió tu comentario"
export const TIPOS_NOTIFICACION = ['meGusta', 'seguir', 'comentario', 'respuesta'] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

// Notificaciones (extra): un documento por cada aviso.
// Los ref van como texto ('Usuario', 'Publicacion'...) y no importando las clases
// para no crear importaciones circulares entre módulos: Mongoose los resuelve
// por nombre al hacer populate.
@Schema({ collection: 'Notificaciones', timestamps: true })
export class Notificacion {
  // A quién le llega (el dueño de la publicación, del comentario o el seguido).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Usuario', required: true })
  destinatario: Types.ObjectId;

  // Quién hizo la acción (el que dio "Me gusta", comentó o empezó a seguir).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Usuario', required: true })
  autor: Types.ObjectId;

  @Prop({ required: true, enum: TIPOS_NOTIFICACION })
  tipo: TipoNotificacion;

  // De qué publicación se trata (todas menos "seguir"): sirve para el link.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Publicacion' })
  publicacion?: Types.ObjectId;

  // El comentario o la respuesta (para mostrar un pedacito del texto).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Comentario' })
  comentario?: Types.ObjectId;

  // false hasta que el destinatario abre la campanita.
  @Prop({ default: false })
  leida: boolean;
}

export const NotificacionSchema = SchemaFactory.createForClass(Notificacion);

// Siempre se buscan "las de un usuario, de la más nueva a la más vieja".
NotificacionSchema.index({ destinatario: 1, createdAt: -1 });
// Y se cuentan "las de un usuario que no leyó" (el numerito rojo).
NotificacionSchema.index({ destinatario: 1, leida: 1 });
// TTL: Mongo borra solo las que tienen más de 60 días, así la colección no crece para siempre.
NotificacionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });
