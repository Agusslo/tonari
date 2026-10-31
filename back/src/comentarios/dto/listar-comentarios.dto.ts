import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Paginación del GET: /publicaciones/<id>/comentarios?offset=0&limit=5
// Igual que en publicaciones: offset = cuántos saltear, limit = cuántos traer.
export class ListarComentariosDto {
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
  limit: number = 5;
}
