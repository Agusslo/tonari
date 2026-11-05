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
  // Obligatoria salvo para las cuentas que entran con Google o Discord (esas pueden
  // no tener contraseña). required con una función: Mongoose la evalúa
  // con el documento como "this" cada vez que guarda.
  @Prop({
    required: function (this: Usuario) {
      return !this.googleId && !this.discordId;
    },
    select: false,
  })
  contraseña?: string;

  // Ingreso con Google (extra): el "sub" del token de Google, un id que identifica
  // a la cuenta de Google para siempre (el correo puede cambiar, el sub no).
  // unique + sparse: no puede haber dos usuarios con el mismo googleId, pero
  // los que no tienen (los de correo y contraseña) no cuentan para el índice.
  @Prop({ unique: true, sparse: true })
  googleId?: string;

  // El correo de la cuenta de Google vinculada (para mostrarlo en "Cuentas vinculadas":
  // puede ser distinto del correo con el que te registraste).
  @Prop()
  googleCorreo?: string;

  // Ingreso con Discord (extra): el id de la cuenta de Discord (no cambia nunca).
  // unique + sparse, igual que googleId.
  @Prop({ unique: true, sparse: true })
  discordId?: string;

  // El nombre de usuario de Discord (el que se busca en "Agregar amigo").
  @Prop()
  discordUsuario?: string;

  // Si quiere que su Discord aparezca en el perfil público ("Ver en Discord").
  @Prop({ default: true })
  mostrarDiscord: boolean;

  @Prop({ required: true })
  fechaNacimiento: Date;

  @Prop({ required: true, trim: true })
  descripcion: string;

  // URL de la imagen de perfil (la imagen en sí se guarda en otro lado).
  @Prop({ required: true })
  imagenPerfil: string;

  // Banner (extra, como en Twitter): la imagen ancha de arriba del perfil.
  // Opcional: se agrega desde "Editar perfil" una vez creada la cuenta.
  @Prop()
  banner?: string;

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
