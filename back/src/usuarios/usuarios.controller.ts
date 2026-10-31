    import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
    } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express';
    import { UsuariosService } from './usuarios.service.js';
    import { SeguimientosService } from './seguimientos.service.js';
    import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
    import { validarImagen } from '../common/imagenes.js';
    import { TokenGuard } from '../auth/token/token.guard.js';
    import type { RequestConToken } from '../auth/token/token.guard.js';

    // Todas las rutas de usuarios piden token (sin token -> 401).
    @Controller('usuarios')
    @UseGuards(TokenGuard)
    export class UsuariosController {
    constructor(
        private readonly usuariosService: UsuariosService,
        private readonly seguimientosService: SeguimientosService,
    ) {}

    // GET /usuarios/beto -> el perfil PÚBLICO de otro usuario (para verlo desde una
    // publicación o un comentario). Solo datos públicos: sin correo ni fecha de nacimiento.
    // Suma los números de "seguir": seguidores, a cuántos sigue y si yo (el del token) lo sigo.
    @Get(':nombreUsuario')
    async perfilPublico(@Param('nombreUsuario') nombreUsuario: string, @Req() req: RequestConToken) {
        const usuario = await this.usuariosService.perfilPublico(nombreUsuario);
        const numeros = await this.seguimientosService.resumen(usuario._id, req.usuario.id);
        return { ...usuario.toObject(), ...numeros };
    }

    // GET /usuarios/beto/seguidores y /usuarios/beto/siguiendo -> listas de personas
    @Get(':nombreUsuario/seguidores')
    seguidores(@Param('nombreUsuario') nombreUsuario: string) {
        return this.seguimientosService.listar(nombreUsuario, 'seguidores');
    }

    @Get(':nombreUsuario/siguiendo')
    siguiendo(@Param('nombreUsuario') nombreUsuario: string) {
        return this.seguimientosService.listar(nombreUsuario, 'siguiendo');
    }

    // POST /usuarios/:id/seguir -> 201 con los números nuevos (409 si ya lo seguías).
    // Quién sigue sale del TOKEN, no del body: nadie puede hacer que otro siga a alguien.
    @Post(':id/seguir')
    seguir(@Param('id') id: string, @Req() req: RequestConToken) {
        return this.seguimientosService.seguir(req.usuario.id, id);
    }

    // DELETE /usuarios/:id/seguir -> 200 con los números nuevos (404 si no lo seguías).
    @Delete(':id/seguir')
    dejarDeSeguir(@Param('id') id: string, @Req() req: RequestConToken) {
        return this.seguimientosService.dejarDeSeguir(req.usuario.id, id);
    }

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