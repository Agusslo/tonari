import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service.js';
import { RegistroDto } from './dto/registro.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/registro -> 201 Created si sale bien (es el default de @Post).
  // Llega como multipart/form-data: campos de texto + el archivo "imagenPerfil".
  @Post('registro')
  // defParamCharset 'utf8': sin esto, los nombres de campo con ñ ("contraseña")
  // llegan rotos en multipart/form-data y la contraseña se pierde.
  @UseInterceptors(FileInterceptor('imagenPerfil', { defParamCharset: 'utf8' }))
  registro(
    @Body() registroDto: RegistroDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 2 * 1024 * 1024, // 2 MB
            errorMessage: 'La imagen de perfil puede pesar hasta 2 MB',
          }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
            errorMessage: 'La imagen de perfil debe ser JPG, PNG o WEBP',
          }),
        ],
        exceptionFactory: (error) =>
          new BadRequestException(
            error === 'File is required'
              ? 'La imagen de perfil es obligatoria'
              : error,
          ),
      }),
    )
    imagenPerfil: Express.Multer.File,
  ) {
    return this.authService.registro(registroDto, imagenPerfil);
  }
}
