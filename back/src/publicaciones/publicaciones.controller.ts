import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PublicacionesService } from './publicaciones.service.js';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto.js';
import { AccionUsuarioDto } from './dto/accion-usuario.dto.js';
import { ListarPublicacionesDto } from './dto/listar-publicaciones.dto.js';
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
  // Ejemplo: /publicaciones?orden=meGusta&offset=0&limit=10
  // @Query() junta todos los parámetros de después del "?" y los valida con el DTO.
  @Get()
  listar(@Query() listarPublicacionesDto: ListarPublicacionesDto) {
    return this.publicacionesService.listar(listarPublicacionesDto);
  }

  // DELETE /publicaciones/:id -> 200 OK (baja lógica)
  // :id es un parámetro de ruta: /publicaciones/6adc04a3... -> id = '6adc04a3...'
  @Delete(':id')
  eliminar(@Param('id') id: string, @Body() accionUsuarioDto: AccionUsuarioDto) {
    return this.publicacionesService.eliminar(id, accionUsuarioDto.usuario);
  }

  // POST /publicaciones/:id/me-gusta -> 201 Created (se crea un "Me gusta")
  @Post(':id/me-gusta')
  darMeGusta(@Param('id') id: string, @Body() accionUsuarioDto: AccionUsuarioDto) {
    return this.publicacionesService.darMeGusta(id, accionUsuarioDto.usuario);
  }

  // DELETE /publicaciones/:id/me-gusta -> 200 OK (se quita el "Me gusta")
  @Delete(':id/me-gusta')
  quitarMeGusta(@Param('id') id: string, @Body() accionUsuarioDto: AccionUsuarioDto) {
    return this.publicacionesService.quitarMeGusta(id, accionUsuarioDto.usuario);
  }
}