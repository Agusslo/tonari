    import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express';
    import { PublicacionesService } from './publicaciones.service.js';
    import { CrearPublicacionDto } from './dto/crear-publicacion.dto.js';
    import { validarImagen } from '../common/imagenes.js';

    @Controller('publicaciones')
    export class PublicacionesController {
    constructor(private readonly publicacionesService: PublicacionesService) {}

    // POST /publicaciones -> 201 Created (el status por defecto de @Post)
    // Llega como multipart/form-data: titulo, descripcion, usuario y,
    // si tiene, el archivo "imagen".
    @Post()
    @UseInterceptors(FileInterceptor('imagen', { defParamCharset: 'utf8' }))
    crear(
        @Body() crearPublicacionDto: CrearPublicacionDto,
        // Opcional (false): sin archivo sigue de largo; con archivo, se valida.
        @UploadedFile(validarImagen('La imagen', false))
        imagen?: Express.Multer.File,
    ) {
        return this.publicacionesService.crear(crearPublicacionDto, imagen);
    }

    // GET /publicaciones -> 200 OK
    @Get()
    listar() {
        return this.publicacionesService.listar();
    }
    }