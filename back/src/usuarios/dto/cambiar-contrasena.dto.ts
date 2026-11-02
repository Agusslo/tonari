import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

// PATCH /usuarios/:id/contrasena: crear una contraseña (cuentas de Google)
// o cambiar la que ya tenés.
export class CambiarContrasenaDto {
  // Solo hace falta si la cuenta YA tiene contraseña: así, si alguien agarra tu
  // sesión abierta en otra compu, no puede cambiártela sin saber la actual.
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Ingresá tu contraseña actual' })
  contraseñaActual?: string;

  // Las mismas reglas que en el registro (consigna: 8 caracteres, una mayúscula y un número).
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/[A-Z]/, { message: 'La contraseña debe tener al menos una mayúscula' })
  @Matches(/\d/, { message: 'La contraseña debe tener al menos un número' })
  contraseñaNueva: string;
}
