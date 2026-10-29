    import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

    export class CrearPublicacionDto {
    @IsString({ message: 'El título debe ser un texto' })
    @IsNotEmpty({ message: 'El título es obligatorio' })
    @MaxLength(100, { message: 'El título puede tener hasta 100 caracteres' })
    titulo: string;

    @IsString({ message: 'La descripción debe ser un texto' })
    @IsNotEmpty({ message: 'La descripción es obligatoria' })
    @MaxLength(1000, { message: 'La descripción puede tener hasta 1000 caracteres' })
    descripcion: string;

    // Quién publica NO va acá: el controller lo saca del token (req.usuario.id).
    // Si alguien manda "usuario" en el body, whitelist lo borra.
    }