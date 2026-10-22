import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  // Puede ser el correo o el nombre de usuario (los dos son únicos).
  @IsString()
  @IsNotEmpty({ message: 'Ingresá tu correo o nombre de usuario' })
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'Ingresá tu contraseña' })
  contraseña: string;
}
