import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service.js';
import { RegistroDto } from './dto/registro.dto.js';
import { LoginDto } from './dto/login.dto.js';
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
    // Opcional (si no viene, se le asigna un blobatar). Si viene:
    // JPG/PNG/WEBP y hasta 2 MB (reglas en common/imagenes.ts)
    @UploadedFile(validarImagen('La imagen de perfil', false))
    imagenPerfil: Express.Multer.File | undefined,
  ) {
    return this.authService.registro(registroDto, imagenPerfil);
  }

  // POST /auth/login -> 200 OK con { usuario, token }.
  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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