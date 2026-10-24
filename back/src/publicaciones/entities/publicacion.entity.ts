    import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
    import { Schema as MongooseSchema, Types } from 'mongoose';
    import { Usuario } from '../../usuarios/entities/usuario.entity.js';

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

    // Los _id de los usuarios que dieron "Me gusta" (Sprint 2, más adelante).
    @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: Usuario.name }], default: [] })
    meGusta: Types.ObjectId[];

    // Baja lógica: en vez de borrarla, se marca como inactiva.
    @Prop({ default: true })
    activa: boolean;
    }

    export const PublicacionSchema = SchemaFactory.createForClass(Publicacion);