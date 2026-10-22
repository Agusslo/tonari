    import {
    IsDateString,
    IsEmail,
    IsNotEmpty,
    IsString,
    IsUrl,
    Matches,
    MaxLength,
    MinLength,
    } from 'class-validator';

    // Lo que el front tiene que mandar para registrarse.
    // "perfil" NO está acá a propósito: si alguien lo manda, whitelist lo borra
    // y nadie puede registrarse como administrador por su cuenta.
    export class RegistroDto {
    @IsString()
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @MaxLength(50)
    nombre: string;

    @IsString()
    @IsNotEmpty({ message: 'El apellido es obligatorio' })
    @MaxLength(50)
    apellido: string;

    @IsEmail({}, { message: 'El correo no es válido' })
    correo: string;

    @IsString()
    @MinLength(3, {
        message: 'El nombre de usuario debe tener al menos 3 caracteres',
    })
    @MaxLength(20, {
        message: 'El nombre de usuario puede tener hasta 20 caracteres',
    })
    @Matches(/^[a-zA-Z0-9_.]+$/, {
        message:
        'El nombre de usuario solo puede tener letras, números, punto y guion bajo',
    })
    nombreUsuario: string;

    // Consigna: al menos 8 caracteres, una mayúscula y un número.
    @IsString()
    @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    @Matches(/[A-Z]/, {
        message: 'La contraseña debe tener al menos una mayúscula',
    })
    @Matches(/\d/, { message: 'La contraseña debe tener al menos un número' })
    contraseña: string;

    // Formato 'YYYY-MM-DD' (por ejemplo '2000-05-21').
    @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
    fechaNacimiento: string;

    @IsString()
    @IsNotEmpty({ message: 'La descripción es obligatoria' })
    @MaxLength(200, {
        message: 'La descripción puede tener hasta 200 caracteres',
    })
    descripcion: string;

    // TEMPORAL: por ahora recibe una URL. En la próxima tanda se reemplaza
    // por la subida real del archivo de imagen.
    @IsUrl({}, { message: 'La imagen de perfil debe ser una URL válida' })
    imagenPerfil: string;
    }