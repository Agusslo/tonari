import { PickType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString } from 'class-validator';
import { RegistroDto } from './registro.dto.js';

// POST /auth/discord y POST /auth/cuentas/discord.
// ticket: lo firmó NUESTRO back al volver de Discord (con los datos de la cuenta).
// nonce: el número al azar que el front guardó ANTES de ir a Discord. El back revisa
// que sea el mismo que viaja adentro del ticket: así nadie puede mandarte un link con
// SU ticket para que tu sesión termine vinculada a su cuenta de Discord.
export class DiscordDto {
  @IsString()
  @IsNotEmpty({ message: 'Falta el ticket de Discord' })
  ticket: string;

  @IsString()
  @IsNotEmpty({ message: 'Falta el código de seguridad (nonce)' })
  nonce: string;
}

// POST /auth/discord/registro: completar el perfil la primera vez que entrás con Discord.
// Igual que RegistroGoogleDto: PickType copia estos campos CON sus validaciones.
export class RegistroDiscordDto extends PickType(RegistroDto, [
  'nombre',
  'apellido',
  'nombreUsuario',
  'fechaNacimiento',
  'descripcion',
] as const) {
  @IsString()
  @IsNotEmpty({ message: 'Falta el ticket de Discord' })
  ticket: string;

  @IsString()
  @IsNotEmpty({ message: 'Falta el código de seguridad (nonce)' })
  nonce: string;
}
