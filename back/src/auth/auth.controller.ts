import {
  Body,
  Controller,
  HttpCode,
  Post,
  Redirect,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service.js';
import { RegistroDto } from './dto/registro.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { GoogleDto } from './dto/google.dto.js';
import { RegistroGoogleDto } from './dto/registro-google.dto.js';
import { validarImagen } from '../common/imagenes.js';
import { TokenGuard } from './token/token.guard.js';
import type { RequestConToken } from './token/token.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/registro -> 201 Created si sale bien (es el default de @Post).
  // Llega como multipart/form-data: campos de texto + el archivo "imagenPerfil".
  // Devuelve { usuario, token }.
  @Post('registro')
  // defParamCharset 'utf8': sin esto, los nombres de campo con ñ ("contraseña")
  // llegan rotos en multipart/form-data y la contraseña se pierde.
  @UseInterceptors(FileInterceptor('imagenPerfil', { defParamCharset: 'utf8' }))
  registro(
    @Body() registroDto: RegistroDto,
    // Obligatoria: sin archivo responde 400 "La imagen de perfil es obligatoria".
    // JPG/PNG/WEBP y hasta 2 MB (reglas en common/imagenes.ts)
    @UploadedFile(validarImagen('La imagen de perfil', true))
    imagenPerfil: Express.Multer.File,
  ) {
    return this.authService.registro(registroDto, imagenPerfil);
  }

  // POST /auth/login -> 200 OK con { usuario, token }.
  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // POST /auth/google -> 200. Ingreso con Google (extra).
  // Con cuenta: { nuevo: false, usuario, token }. Primera vez: { nuevo: true, datos }
  // (datos = nombre, apellido, correo y foto que dio Google, para completar el perfil).
  @Post('google')
  @HttpCode(200)
  loginGoogle(@Body() googleDto: GoogleDto) {
    return this.authService.loginGoogle(googleDto);
  }

  // POST /auth/google/redirect -> 303 de vuelta al front (modo "redirección" de Google).
  // El botón no abre una ventanita (que Brave, Safari o los navegadores de Instagram
  // bloquean): te lleva a Google en la misma pestaña, y cuando elegís tu cuenta
  // GOOGLE hace un POST de formulario (no JSON) a esta URL con la credencial.
  // Acá no hacemos nada más que devolverte al front con la credencial en el "#" de la
  // URL; el front la manda a POST /auth/google, que es el que la verifica.
  // @Redirect(): Nest responde con la URL y el código que devuelve el método.
  @Post('google/redirect')
  @Redirect()
  volverDeGoogle(@Body('credential') credential?: string) {
    return { url: this.authService.urlVueltaDeGoogle(credential), statusCode: 303 };
  }

  // POST /auth/google/registro -> 201 con { usuario, token }.
  // Va como JSON (no multipart): no hay archivo, la foto es la de Google.
  @Post('google/registro')
  registroGoogle(@Body() registroGoogleDto: RegistroGoogleDto) {
    return this.authService.registroGoogle(registroGoogleDto);
  }

  // POST /auth/autorizar -> 200 con los datos del usuario, o 401.
  // El front lo llama al abrir la app (pantalla Cargando) para saber
  // si el token guardado sigue sirviendo.
  @Post('autorizar')
  @HttpCode(200)
  @UseGuards(TokenGuard)
  autorizar(@Req() req: RequestConToken) {
    return this.authService.autorizar(req.usuario);
  }

  // POST /auth/refrescar -> 200 con { token } nuevo (15 minutos más), o 401.
  @Post('refrescar')
  @HttpCode(200)
  @UseGuards(TokenGuard)
  refrescar(@Req() req: RequestConToken) {
    return this.authService.refrescar(req.usuario);
  }
}