import { IsIn } from 'class-validator';
import type { Perfil } from '../entities/usuario.entity.js';

// PATCH /usuarios/:id/perfil (solo administradores): dar o sacar el rol de administrador.
export class CambiarPerfilDto {
  @IsIn(['usuario', 'administrador'], {
    message: 'El perfil debe ser "usuario" o "administrador"',
  })
  perfil: Perfil;
}
