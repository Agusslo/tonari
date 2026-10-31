    import { Transform } from 'class-transformer';
    import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

    // Lo que se puede cambiar al editar el perfil. Todo es opcional (se manda solo
    // lo que cambia), pero si un campo viene, tiene que ser válido.
    // El correo y el nombre de usuario NO están: son los datos con los que se
    // ingresa y tienen que ser únicos, así que no se editan desde acá.
    export class ActualizarUsuarioDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
    @MaxLength(50, { message: 'El nombre puede tener hasta 50 caracteres' })
    nombre?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'El apellido no puede quedar vacío' })
    @MaxLength(50, { message: 'El apellido puede tener hasta 50 caracteres' })
    apellido?: string;

    @IsOptional()
    @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
    fechaNacimiento?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'La descripción no puede quedar vacía' })
    @MaxLength(200, { message: 'La descripción puede tener hasta 200 caracteres' })
    descripcion?: string;
    
    // "quitarBanner=true": borrar el banner (y que quede el fondo por defecto).
    // Llega como texto en el multipart: @Transform lo pasa a booleano.
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    quitarBanner?: boolean;
    }
