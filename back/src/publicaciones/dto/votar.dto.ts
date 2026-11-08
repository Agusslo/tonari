import { IsInt, Max, Min } from 'class-validator';

// POST /publicaciones/:id/votar  { "opcion": 1 }
// La posición de la opción (empieza en 0). Quién vota sale del token.
export class VotarDto {
  @Max(3, { message: 'Esa opción no existe' })
  @Min(0, { message: 'Esa opción no existe' })
  @IsInt({ message: 'La opción debe ser un número entero' })
  opcion: number;
}
