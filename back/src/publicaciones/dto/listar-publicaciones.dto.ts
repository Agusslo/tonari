    import { Type } from 'class-transformer';
    import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

    // Los parámetros de búsqueda del GET (lo que va después del "?" en la URL):
    // /publicaciones?orden=meGusta&usuario=<id>&offset=0&limit=10
    // Todos son opcionales: si no vienen, se usa el valor por defecto (el "= ...").
    export class ListarPublicacionesDto {
    @IsOptional()
    @IsIn(['fecha', 'meGusta'], { message: 'El orden debe ser "fecha" o "meGusta"' })
    orden: 'fecha' | 'meGusta' = 'fecha';

    // Para ver solo las publicaciones de un usuario (por ejemplo, en Mi Perfil).
    @IsOptional()
    @IsMongoId({ message: 'El usuario no es válido' })
    usuario?: string;

    // Cuántas saltear (para pasar de página). En la URL todo llega como texto:
    // @Type(() => Number) convierte "20" en 20 antes de validar.
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'offset debe ser un número entero' })
    @Min(0, { message: 'offset no puede ser negativo' })
    offset: number = 0;

    // Cuántas traer como máximo. Tope de 50 para que nadie pida "todas".
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'limit debe ser un número entero' })
    @Min(1, { message: 'limit tiene que ser al menos 1' })
    @Max(50, { message: 'limit puede ser como máximo 50' })
    limit: number = 10;
    }