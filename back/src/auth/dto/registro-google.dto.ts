import { PickType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString } from 'class-validator';
import { RegistroDto } from './registro.dto.js';

// POST /auth/google/registro: completar el perfil la primera vez que entrás con Google.
// PickType copia del RegistroDto solo estos campos, CON sus validaciones
// (así las reglas del nombre de usuario, la fecha, etc. están escritas una sola vez).
// No van correo, contraseña ni imagen: el correo y la foto los da Google,
// y la contraseña no hace falta (entrás con Google).
export class RegistroGoogleDto extends PickType(RegistroDto, [
  'nombre',
  'apellido',
  'nombreUsuario',
  'fechaNacimiento',
  'descripcion',
] as const) {
  @IsString()
  @IsNotEmpty({ message: 'Falta la credencial de Google' })
  credential: string;
}
