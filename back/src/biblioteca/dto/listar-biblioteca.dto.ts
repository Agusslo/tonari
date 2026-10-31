import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { TIPOS } from '../entities/entrada.entity.js';
import type { TipoObra } from '../entities/entrada.entity.js';

// GET /biblioteca?usuario=<id>&tipo=anime
// Sin "usuario": la biblioteca de quien hace el pedido (la del token).
export class ListarBibliotecaDto {
  @IsOptional()
  @IsMongoId({ message: 'El usuario no es válido' })
  usuario?: string;

  @IsOptional()
  @IsIn(TIPOS, { message: 'El tipo debe ser "anime" o "manga"' })
  tipo?: TipoObra;
}
