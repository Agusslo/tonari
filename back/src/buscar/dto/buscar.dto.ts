import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// GET /buscar?q=frieren -> lo que escribió en el buscador de arriba.
export class BuscarDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Escribí qué buscar' })
  @MinLength(2, { message: 'Escribí al menos 2 letras' })
  @MaxLength(50, { message: 'La búsqueda puede tener hasta 50 caracteres' })
  q: string;
}
