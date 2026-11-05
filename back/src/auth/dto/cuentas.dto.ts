import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

// POST /auth/cuentas/google: vincular Google desde Mi perfil.
// nonce: Google lo mete ADENTRO de la credencial (lo pedimos al dibujar el botón),
// así sabemos que esa credencial se pidió desde TU navegador para vincular.
export class VincularGoogleDto {
  @IsString()
  @IsNotEmpty({ message: 'Falta la credencial de Google' })
  credential: string;

  @IsString()
  @IsNotEmpty({ message: 'Falta el código de seguridad (nonce)' })
  nonce: string;
}

// PATCH /auth/cuentas/discord: mostrar u ocultar mi Discord en el perfil público.
export class MostrarDiscordDto {
  @IsBoolean({ message: 'mostrar tiene que ser true o false' })
  mostrar: boolean;
}
