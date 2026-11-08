    import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
    import { Schema as MongooseSchema, Types } from 'mongoose';
    import { Usuario } from '../../usuarios/entities/usuario.entity.js';
    import { TIPOS } from '../../biblioteca/entities/entrada.entity.js';
    import type { TipoObra } from '../../biblioteca/entities/entrada.entity.js';

    // ---------- Encuesta (extra) ----------
    // _id: false = son "subdocumentos" que viven ADENTRO de la publicación, sin _id propio.

    // Una opción de la encuesta y cuántos votos lleva.
    @Schema({ _id: false })
    export class OpcionEncuesta {
    @Prop({ required: true, trim: true })
    texto: string;

    // Lo suma el back con $inc al votar (QUIÉN votó va en la colección Votos).
    @Prop({ default: 0 })
    votos: number;
    }
    export const OpcionEncuestaSchema = SchemaFactory.createForClass(OpcionEncuesta);

    @Schema({ _id: false })
    export class Encuesta {
    // De 2 a 4 opciones (lo valida el DTO). La pregunta es el título de la publicación.
    @Prop({ type: [OpcionEncuestaSchema], required: true })
    opciones: OpcionEncuesta[];

    // Cuándo cierra: después de esta fecha ya no se puede votar.
    @Prop({ required: true })
    cierra: Date;
    }
    export const EncuestaSchema = SchemaFactory.createForClass(Encuesta);

    // ---------- Spoiler (extra) ----------
    // "Esta publicación tiene spoilers de <obra> hasta el episodio/capítulo <hasta>".
    // La obra se identifica igual que en la biblioteca: tipo + id de AniList.
    @Schema({ _id: false })
    export class Spoiler {
    @Prop({ required: true, enum: TIPOS })
    tipo: TipoObra;

    @Prop({ required: true })
    idAnilist: number;

    // El título se guarda para mostrar "Spoiler de Frieren" sin preguntarle a AniList.
    @Prop({ required: true, trim: true })
    titulo: string;

    // Hasta qué episodio/capítulo. null = de toda la obra (incluido el final).
    @Prop({ type: Number, default: null })
    hasta: number | null;
    }
    export const SpoilerSchema = SchemaFactory.createForClass(Spoiler);

    @Schema({ collection: 'Publicaciones', timestamps: true })
    export class Publicacion {
    @Prop({ required: true, trim: true })
    titulo: string;

    @Prop({ required: true, trim: true })
    descripcion: string;

    // URL de la imagen (opcional: una publicación puede no tener imagen).
    @Prop()
    imagen?: string;

    // Quién la creó. Se guarda solo el _id del usuario (una "referencia"),
    // y con populate() Mongoose trae sus datos cuando los necesitamos.
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: Usuario.name, required: true })
    usuario: Types.ObjectId;

    // Los _id de los usuarios que dieron "Me gusta" (uno por usuario).
    @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: Usuario.name }], default: [] })
    meGusta: Types.ObjectId[];

    // Cuántos "Me gusta" tiene (siempre igual a meGusta.length).
    // Se guarda aparte para poder ORDENAR por cantidad directamente en Mongo.
    @Prop({ default: 0 })
    cantidadMeGusta: number;

    // Cuántos comentarios tiene (lo suma el módulo de comentarios al crear uno).
    // Sirve para mostrar el número en la tarjeta sin contar los comentarios cada vez.
    @Prop({ default: 0 })
    cantidadComentarios: number;

    // Encuesta (extra, opcional): si no tiene, el campo no se guarda.
    @Prop({ type: EncuestaSchema })
    encuesta?: Encuesta;

    // Aviso de spoilers (extra, opcional).
    @Prop({ type: SpoilerSchema })
    spoiler?: Spoiler;

    // Baja lógica: en vez de borrarla, se marca como inactiva.
    @Prop({ default: true })
    activa: boolean;
    }

    export const PublicacionSchema = SchemaFactory.createForClass(Publicacion);