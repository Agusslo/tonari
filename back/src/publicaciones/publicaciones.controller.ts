    import { Body, Controller, Get, Post } from '@nestjs/common';
    import { PublicacionesService } from './publicaciones.service.js';
    import { CrearPublicacionDto } from './dto/crear-publicacion.dto.js';

    @Controller('publicaciones')
    export class PublicacionesController {
    constructor(private readonly publicacionesService: PublicacionesService) {}

    // POST /publicaciones -> 201 Created (el status por defecto de @Post)
    @Post()
    crear(@Body() crearPublicacionDto: CrearPublicacionDto) {
        return this.publicacionesService.crear(crearPublicacionDto);
    }

    // GET /publicaciones -> 200 OK
    @Get()
    listar() {
        return this.publicacionesService.listar();
    }
    }