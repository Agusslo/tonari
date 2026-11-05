import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
import { DiscordDto, RegistroDiscordDto } from './dto/discord.dto.js';
import { MostrarDiscordDto, VincularGoogleDto } from './dto/cuentas.dto.js';
import { DiscordService } from './discord.service.js';
import type { ModoDiscord } from './discord.service.js';
import { CuentasService } from './cuentas.service.js';
import type { Proveedor } from './cuentas.service.js';
import { validarImagen } from '../common/imagenes.js';
import { TokenGuard } from './token/token.guard.js';
import type { RequestConToken } from './token/token.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly discordService: DiscordService,
    private readonly cuentasService: CuentasService,
  ) {}

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

  // ---------- Ingreso con Discord (extra) ----------

  // GET /auth/discord?modo=ingreso|vincular&nonce=... -> 302 a Discord.
  // Es un GET porque el front no lo llama con HttpClient: el navegador VA a esta URL
  // (es un link), y nosotros lo mandamos a la página de Discord para aceptar.
  @Get('discord')
  @Redirect()
  irADiscord(@Query('modo') modo: string, @Query('nonce') nonce: string) {
    if (modo !== 'ingreso' && modo !== 'vincular') {
      throw new BadRequestException('modo tiene que ser "ingreso" o "vincular"'); // 400
    }
    return { url: this.discordService.urlAutorizar(modo as ModoDiscord, nonce), statusCode: 302 };
  }

  // GET /auth/discord/callback?code=...&state=... -> 302 de vuelta al front.
  // Esta es la "Redirect URI" que se registra en el Discord Developer Portal.
  @Get('discord/callback')
  @Redirect()
  async volverDeDiscord(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    return { url: await this.discordService.procesarVuelta(code, state, error), statusCode: 302 };
  }

  // POST /auth/discord -> 200. Igual que /auth/google: { nuevo: false, usuario, token }
  // o { nuevo: true, datos } para completar el perfil.
  @Post('discord')
  @HttpCode(200)
  loginDiscord(@Body() discordDto: DiscordDto) {
    return this.authService.loginDiscord(discordDto);
  }

  // POST /auth/discord/registro -> 201 con { usuario, token }.
  @Post('discord/registro')
  registroDiscord(@Body() registroDiscordDto: RegistroDiscordDto) {
    return this.authService.registroDiscord(registroDiscordDto);
  }

  // ---------- Cuentas vinculadas (extra) ----------
  // Todas con token: trabajan SIEMPRE sobre el usuario del token (no hay :id en la URL).
  // Todas devuelven { contraseña, google, discord } actualizado.

  // GET /auth/cuentas
  @Get('cuentas')
  @UseGuards(TokenGuard)
  cuentas(@Req() req: RequestConToken) {
    return this.cuentasService.estado(req.usuario.id);
  }

  // POST /auth/cuentas/google { credential, nonce } -> 200
  @Post('cuentas/google')
  @HttpCode(200)
  @UseGuards(TokenGuard)
  vincularGoogle(@Req() req: RequestConToken, @Body() dto: VincularGoogleDto) {
    return this.cuentasService.vincularGoogle(req.usuario.id, dto);
  }

  // POST /auth/cuentas/discord { ticket, nonce } -> 200
  @Post('cuentas/discord')
  @HttpCode(200)
  @UseGuards(TokenGuard)
  vincularDiscord(@Req() req: RequestConToken, @Body() dto: DiscordDto) {
    return this.cuentasService.vincularDiscord(req.usuario.id, dto);
  }

  // PATCH /auth/cuentas/discord { mostrar } -> 200. Mostrar/ocultar en el perfil público.
  @Patch('cuentas/discord')
  @UseGuards(TokenGuard)
  mostrarDiscord(@Req() req: RequestConToken, @Body() { mostrar }: MostrarDiscordDto) {
    return this.cuentasService.mostrarDiscord(req.usuario.id, mostrar);
  }

  // DELETE /auth/cuentas/google o /auth/cuentas/discord -> 200 (desvincular).
  @Delete('cuentas/:proveedor')
  @UseGuards(TokenGuard)
  desvincular(@Req() req: RequestConToken, @Param('proveedor') proveedor: string) {
    if (proveedor !== 'google' && proveedor !== 'discord') {
      throw new BadRequestException('Solo se puede desvincular "google" o "discord"'); // 400
    }
    return this.cuentasService.desvincular(req.usuario.id, proveedor as Proveedor);
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