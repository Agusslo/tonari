import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Caché de sinopsis traducidas al español.
// AniList solo tiene la sinopsis en inglés. La primera vez que alguien abre la ficha
// de una obra, el back la traduce y la guarda acá; las próximas veces (de cualquier
// usuario) sale directo de Mongo, sin volver a traducir.
@Schema({ collection: 'Sinopsis', timestamps: true })
export class Sinopsis {
  // De qué obra es (id de AniList). unique: una sola traducción por obra.
  @Prop({ required: true, unique: true })
  idAnilist: number;

  // El texto original en inglés (por si se quiere ver el original).
  @Prop({ required: true })
  original: string;

  @Prop({ required: true })
  traducida: string;
}

export const SinopsisSchema = SchemaFactory.createForClass(Sinopsis);
