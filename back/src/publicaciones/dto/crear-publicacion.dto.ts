    import { BadRequestException } from '@nestjs/common';
    import { plainToInstance, Transform } from 'class-transformer';
    import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    validateSync,
    } from 'class-validator';
    import { TIPOS } from '../../biblioteca/entities/entrada.entity.js';
    import type { TipoObra } from '../../biblioteca/entities/entrada.entity.js';

    // Las duraciones posibles de una encuesta, en horas: 1 día, 3 días o 1 semana.
    export const DURACIONES_ENCUESTA = [24, 72, 168];

    // Encuesta (extra): 2 a 4 opciones y cuánto dura.
    export class EncuestaDto {
    @IsArray({ message: 'Las opciones de la encuesta tienen que ser una lista' })
    @ArrayMinSize(2, { message: 'La encuesta necesita al menos 2 opciones' })
    @ArrayMaxSize(4, { message: 'La encuesta puede tener hasta 4 opciones' })
    @IsString({ each: true, message: 'Cada opción debe ser un texto' })
    @IsNotEmpty({ each: true, message: 'Ninguna opción puede quedar vacía' })
    @MaxLength(80, { each: true, message: 'Cada opción puede tener hasta 80 caracteres' })
    // Les sacamos los espacios de los costados (así "  Sí " y "Sí" son la misma).
    @Transform(({ value }) =>
        Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value,
    )
    opciones: string[];

    @IsIn(DURACIONES_ENCUESTA, { message: 'La encuesta puede durar 24, 72 o 168 horas' })
    duracionHoras: number;
    }

    // Spoiler (extra): de qué obra y hasta qué episodio/capítulo.
    export class SpoilerDto {
    @IsIn(TIPOS, { message: 'El tipo de la obra debe ser "anime" o "manga"' })
    tipo: TipoObra;

    @IsInt({ message: 'El id de AniList no es válido' })
    @Min(1, { message: 'El id de AniList no es válido' })
    idAnilist: number;

    @IsString({ message: 'El título de la obra debe ser un texto' })
    @IsNotEmpty({ message: 'Falta el título de la obra' })
    @MaxLength(200, { message: 'El título de la obra puede tener hasta 200 caracteres' })
    titulo: string;

    // Opcional: sin "hasta", es spoiler de toda la obra.
    @IsOptional()
    @IsInt({ message: 'El episodio/capítulo debe ser un número entero' })
    @Min(1, { message: 'El episodio/capítulo tiene que ser al menos 1' })
    hasta?: number | null;
    }

    // La publicación llega como multipart/form-data (por la imagen), y en un formulario
    // todo viaja como TEXTO. Por eso la encuesta y el spoiler llegan como JSON en un texto:
    //   encuesta = '{"opciones":["Sí","No"],"duracionHoras":24}'
    // Este @Transform lo convierte en objeto (de la clase del DTO) y lo valida con las
    // reglas de arriba. Si algo está mal, corta con 400 y los mensajes tal cual
    // (con @ValidateNested saldrían como "encuesta.La encuesta necesita...").
    function desdeJson<T extends object>(clase: new () => T, nombre: string) {
    return Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return undefined;
        let datos: unknown = value;
        if (typeof value === 'string') {
        try {
            datos = JSON.parse(value);
        } catch {
            datos = null;
        }
        }
        if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
        throw new BadRequestException([`${nombre} no tiene un formato válido`]); // 400
        }
        const instancia = plainToInstance(clase, datos);
        // whitelist: igual que el ValidationPipe, borra lo que no está en el DTO.
        const errores = validateSync(instancia, { whitelist: true, stopAtFirstError: true });
        if (errores.length) {
        throw new BadRequestException(errores.flatMap((e) => Object.values(e.constraints ?? {}))); // 400
        }
        return instancia;
    });
    }

    export class CrearPublicacionDto {
    @IsString({ message: 'El título debe ser un texto' })
    @IsNotEmpty({ message: 'El título es obligatorio' })
    @MaxLength(100, { message: 'El título puede tener hasta 100 caracteres' })
    titulo: string;

    @IsString({ message: 'La descripción debe ser un texto' })
    @IsNotEmpty({ message: 'La descripción es obligatoria' })
    @MaxLength(1000, { message: 'La descripción puede tener hasta 1000 caracteres' })
    descripcion: string;

    // Opcional: encuesta (la pregunta es el título).
    @IsOptional()
    @desdeJson(EncuestaDto, 'La encuesta')
    @IsObject()
    encuesta?: EncuestaDto;

    // Opcional: aviso de spoilers.
    @IsOptional()
    @desdeJson(SpoilerDto, 'El spoiler')
    @IsObject()
    spoiler?: SpoilerDto;

    // Quién publica NO va acá: el controller lo saca del token (req.usuario.id).
    // Si alguien manda "usuario" en el body, whitelist lo borra.
    }