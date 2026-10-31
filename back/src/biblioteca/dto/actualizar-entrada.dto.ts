import { IsIn, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { ESTADOS } from '../entities/entrada.entity.js';
import type { EstadoEntrada } from '../entities/entrada.entity.js';

// PATCH: se manda solo lo que cambia (estado, progreso o puntuación).
export class ActualizarEntradaDto {
  @IsOptional()
  @IsIn(ESTADOS, { message: 'El estado no es válido' })
  estado?: EstadoEntrada;

  @IsOptional()
  @IsInt({ message: 'El progreso debe ser un número entero' })
  @Min(0, { message: 'El progreso no puede ser negativo' })
  progreso?: number;

  // null = sacar la puntuación. ValidateIf: solo se valida el número si no es null.
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsInt({ message: 'La puntuación debe ser un número entero' })
  @Min(1, { message: 'La puntuación va de 1 a 10' })
  @Max(10, { message: 'La puntuación va de 1 a 10' })
  puntuacion?: number | null;
}
