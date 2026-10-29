    import {
    Body,
    Controller,
    ForbiddenException,
    Param,
    Patch,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
    } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express';
    import { UsuariosService } from './usuarios.service.js';
    import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
    import { validarImagen } from '../common/imagenes.js';
    import { TokenGuard } from '../auth/token/token.guard.js';
    import type { RequestConToken } from '../auth/token/token.guard.js';

    // Todas las rutas de usuarios piden token (sin token -> 401).
    @Controller('usuarios')
    @UseGuards(TokenGuard)
    export class UsuariosController {
    constructor(private readonly usuariosService: UsuariosService) {}

    // PATCH /usuarios/:id -> 200 OK con el usuario actualizado.
    // PATCH (y no PUT) porque se cambia una PARTE del usuario, no el usuario entero.
    // Llega como multipart/form-data por si trae una foto nueva ("imagenPerfil", opcional).
    @Patch(':id')
    @UseInterceptors(FileInterceptor('imagenPerfil', { defParamCharset: 'utf8' }))
    actualizar(
        @Param('id') id: string,
        @Req() req: RequestConToken,
        @Body() actualizarUsuarioDto: ActualizarUsuarioDto,
        @UploadedFile(validarImagen('La imagen de perfil', false))
        imagenPerfil?: Express.Multer.File,
    ) {
        // El token dice quién sos: solo podés editar TU perfil.
        // 403 (y no 401): sabemos quién sos, pero esto no te corresponde.
        if (req.usuario.id !== id) {
        throw new ForbiddenException('Solo podés editar tu propio perfil');
        }
        return this.usuariosService.actualizar(id, actualizarUsuarioDto, imagenPerfil);
    }
    }