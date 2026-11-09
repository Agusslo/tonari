import { IsIn } from 'class-validator';
import { RegistroDto } from '../../auth/dto/registro.dto.js';
import type { Perfil } from '../entities/usuario.entity.js';

// POST /usuarios (solo administradores, Sprint 4): "mismos datos que el registro" + el perfil.
// "extends RegistroDto": hereda todos los campos CON sus validaciones (nombre, correo,
// contraseña con mayúscula y número, etc.). Si mañana cambia una regla del registro,
// cambia acá también, sin copiar nada.
//
// En el registro común "perfil" NO existe (whitelist lo borra: nadie se registra solo
// como administrador). Acá sí, porque esta ruta la usa un administrador.
export class CrearUsuarioDto extends RegistroDto {
  @IsIn(['usuario', 'administrador'], { message: 'El perfil debe ser "usuario" o "administrador"' })
  perfil: Perfil;
}
