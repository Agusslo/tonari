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
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    } from '@nestjs/common';
    import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
    // Llega como multipart/form-data por si trae imágenes nuevas, las dos opcionales:
    // "imagenPerfil" (la foto) y "banner" (la imagen ancha de arriba, extra).
    // FileFieldsInterceptor (y no FileInterceptor) porque pueden venir DOS archivos,
    // cada uno con su nombre de campo.
    @Patch(':id')
    @UseInterceptors(
        FileFieldsInterceptor(
        [
            { name: 'imagenPerfil', maxCount: 1 },
            { name: 'banner', maxCount: 1 },
        ],
        { defParamCharset: 'utf8' },
        ),
    )
    async actualizar(
        @Param('id') id: string,
        @Req() req: RequestConToken,
        @Body() actualizarUsuarioDto: ActualizarUsuarioDto,
        @UploadedFiles()
        archivos: { imagenPerfil?: Express.Multer.File[]; banner?: Express.Multer.File[] } = {},
    ) {
        // El token dice quién sos: solo podés editar TU perfil.
        // 403 (y no 401): sabemos quién sos, pero esto no te corresponde.
        if (req.usuario.id !== id) {
        throw new ForbiddenException('Solo podés editar tu propio perfil');
        }
        // Cada archivo pasa por las mismas reglas de siempre (2 MB, JPG/PNG/WEBP).
        // Con @UploadedFiles no se puede poner el pipe en el parámetro: se llama a mano.
        const imagenPerfil = await validarImagen('La imagen de perfil', false).transform(
        archivos.imagenPerfil?.[0],
        );
        const banner = await validarImagen('El banner', false).transform(archivos.banner?.[0]);
        return this.usuariosService.actualizar(id, actualizarUsuarioDto, imagenPerfil, banner);
    }
    }