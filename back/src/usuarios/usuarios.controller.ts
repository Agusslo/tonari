    import { Body, Controller, Param, Patch, UploadedFile, UseInterceptors } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express';
    import { UsuariosService } from './usuarios.service.js';
    import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
    import { validarImagen } from '../common/imagenes.js';

    @Controller('usuarios')
    export class UsuariosController {
    constructor(private readonly usuariosService: UsuariosService) {}

    // PATCH /usuarios/:id -> 200 OK con el usuario actualizado.
    // PATCH (y no PUT) porque se cambia una PARTE del usuario, no el usuario entero.
    // Llega como multipart/form-data por si trae una foto nueva ("imagenPerfil", opcional).
    // Por ahora cualquiera con el id podría editar: en el Sprint 3 el token
    // va a asegurar que solo puedas editar TU perfil.
    @Patch(':id')
    @UseInterceptors(FileInterceptor('imagenPerfil', { defParamCharset: 'utf8' }))
    actualizar(
        @Param('id') id: string,
        @Body() actualizarUsuarioDto: ActualizarUsuarioDto,
        @UploadedFile(validarImagen('La imagen de perfil', false))
        imagenPerfil?: Express.Multer.File,
    ) {
        return this.usuariosService.actualizar(id, actualizarUsuarioDto, imagenPerfil);
    }
    }