import { IsNotEmpty, IsString } from 'class-validator';

// POST /auth/google: lo que manda el front después de que tocaste "Continuar con Google".
// "credential" es el ID token (un JWT) que firma Google y que el botón le da al front.
// Se llama así (en inglés) porque es el nombre que usa Google.
export class GoogleDto {
  @IsString()
  @IsNotEmpty({ message: 'Falta la credencial de Google' })
  credential: string;
}
