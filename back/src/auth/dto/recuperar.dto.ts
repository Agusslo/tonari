import { PickType } from '@nestjs/mapped-types';
import { IsEmail, IsString, Matches } from 'class-validator';
import { RegistroDto } from './registro.dto.js';

// POST /auth/recuperar { correo }
export class RecuperarDto {
  @IsEmail({}, { message: 'El correo no es válido' })
  correo: string;
}

// POST /auth/restablecer/verificar { token }
// El token del link: 64 caracteres hexadecimales (32 bytes al azar).
export class TokenRecuperacionDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'El link no es válido o ya venció. Pedí uno nuevo' })
  token: string;
}

// POST /auth/restablecer { token, contraseña }
// PickType copia el campo "contraseña" de RegistroDto CON sus validaciones
// (8 caracteres, una mayúscula y un número): la regla queda escrita en un solo lugar.
export class RestablecerDto extends PickType(RegistroDto, ['contraseña'] as const) {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'El link no es válido o ya venció. Pedí uno nuevo' })
  token: string;
}
