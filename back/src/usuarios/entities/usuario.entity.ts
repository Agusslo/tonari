import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type Perfil = 'usuario' | 'administrador';

@Schema({ collection: 'Usuarios', timestamps: true })
export class Usuario {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  apellido: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  correo: string;

  @Prop({ required: true, unique: true, trim: true })
  nombreUsuario: string;

  // Se guarda el HASH, nunca la contraseña real.
  // select: false -> no viene en las consultas salvo que se pida explícitamente.
  @Prop({ required: true, select: false })
  contraseña: string;

  @Prop({ required: true })
  fechaNacimiento: Date;

  @Prop({ required: true, trim: true })
  descripcion: string;

  // URL de la imagen de perfil (la imagen en sí se guarda en otro lado).
  @Prop({ required: true })
  imagenPerfil: string;

  @Prop({
    required: true,
    enum: ['usuario', 'administrador'],
    default: 'usuario',
  })
  perfil: Perfil;

  // Para la baja lógica de usuarios (Sprint 4).
  @Prop({ default: true })
  habilitado: boolean;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
