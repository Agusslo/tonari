import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

export type TipoObra = 'anime' | 'manga';
// en-curso = "viendo" (anime) o "leyendo" (manga): el front pone la palabra según el tipo.
export type EstadoEntrada = 'pendiente' | 'en-curso' | 'completado' | 'abandonado';

export const TIPOS: TipoObra[] = ['anime', 'manga'];
export const ESTADOS: EstadoEntrada[] = ['pendiente', 'en-curso', 'completado', 'abandonado'];

// Una "entrada" de la biblioteca: un anime o manga que un usuario agregó a su lista.
// Los datos de la obra (título, portada, total) vienen de AniList (una API pública de anime
// y manga) y se guardan acá: así la biblioteca carga sin depender de que AniList responda.
@Schema({ collection: 'Biblioteca', timestamps: true })
export class Entrada {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Usuario.name, required: true })
  usuario: Types.ObjectId;

  @Prop({ required: true, enum: TIPOS })
  tipo: TipoObra;

  // El id de la obra en AniList: identifica la obra aunque cambie el título.
  @Prop({ required: true })
  idAnilist: number;

  @Prop({ required: true, trim: true })
  titulo: string;

  @Prop()
  imagen?: string;

  // Cantidad de episodios (anime) o capítulos (manga). null = desconocido
  // (por ejemplo, una serie que todavía se está emitiendo).
  @Prop({ type: Number, default: null })
  total: number | null;

  @Prop({ required: true, enum: ESTADOS, default: 'pendiente' })
  estado: EstadoEntrada;

  // Por qué episodio o capítulo vas.
  @Prop({ default: 0, min: 0 })
  progreso: number;

  // Puntuación de 1 a 10 (como en AniList o MyAnimeList). null = sin puntuar.
  @Prop({ type: Number, default: null, min: 1, max: 10 })
  puntuacion: number | null;
}

export const EntradaSchema = SchemaFactory.createForClass(Entrada);

// Una misma obra no puede estar dos veces en la biblioteca de un usuario:
// el índice único hace que Mongo lo rechace aunque lleguen dos pedidos a la vez.
EntradaSchema.index({ usuario: 1, tipo: 1, idAnilist: 1 }, { unique: true });
