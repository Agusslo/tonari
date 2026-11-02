import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Paginación del GET: /notificaciones?offset=0&limit=20
export class ListarNotificacionesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un número entero' })
  @Min(0, { message: 'offset no puede ser negativo' })
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit tiene que ser al menos 1' })
  @Max(50, { message: 'limit puede ser como máximo 50' })
  limit: number = 20;
}
