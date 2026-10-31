import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { ESTADOS, TIPOS } from '../entities/entrada.entity.js';
import type { EstadoEntrada, TipoObra } from '../entities/entrada.entity.js';

// Lo que manda el front al agregar una obra (los datos los sacó de AniList).
export class AgregarEntradaDto {
  @IsIn(TIPOS, { message: 'El tipo debe ser "anime" o "manga"' })
  tipo: TipoObra;

  @IsInt({ message: 'El id de AniList no es válido' })
  @Min(1, { message: 'El id de AniList no es válido' })
  idAnilist: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(200, { message: 'El título puede tener hasta 200 caracteres' })
  titulo: string;

  @IsOptional()
  @IsUrl({}, { message: 'La imagen no es una URL válida' })
  imagen?: string;

  // null o ausente = no se sabe cuántos episodios/capítulos tiene.
  @IsOptional()
  @IsInt({ message: 'El total debe ser un número entero' })
  @Min(1, { message: 'El total tiene que ser al menos 1' })
  total?: number | null;

  @IsOptional()
  @IsIn(ESTADOS, { message: 'El estado no es válido' })
  estado?: EstadoEntrada;
}
