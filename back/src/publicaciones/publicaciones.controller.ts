import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PublicacionesService } from './publicaciones.service.js';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto.js';
import { ListarPublicacionesDto } from './dto/listar-publicaciones.dto.js';
import { VotarDto } from './dto/votar.dto.js';
import { validarImagen } from '../common/imagenes.js';
import { TokenGuard } from '../auth/token/token.guard.js';
import type { RequestConToken } from '../auth/token/token.guard.js';

// @UseGuards arriba de la clase: TODAS las rutas de publicaciones piden token.
// (Consigna: "Solo se accede a la aplicación estando registrado o logueado".)
// Quién hace cada acción ya NO viaja en el body: sale del token (req.usuario.id),
// que nadie puede falsificar.
@Controller('publicaciones')
@UseGuards(TokenGuard)
export class PublicacionesController {
  constructor(private readonly publicacionesService: PublicacionesService) {}

  // POST /publicaciones -> 201 Created (el status por defecto de @Post)
  // Llega como multipart/form-data: titulo, descripcion y, si tiene, el archivo "imagen".
  @Post()
  @UseInterceptors(FileInterceptor('imagen', { defParamCharset: 'utf8' }))
  crear(
    @Req() req: RequestConToken,
    @Body() crearPublicacionDto: CrearPublicacionDto,
    // Opcional (false): sin archivo sigue de largo; con archivo, se valida.
    @UploadedFile(validarImagen('La imagen', false))
    imagen?: Express.Multer.File,
  ) {
    return this.publicacionesService.crear(crearPublicacionDto, req.usuario.id, imagen);
  }

  // GET /publicaciones -> 200 OK
  // Ejemplo: /publicaciones?orden=meGusta&offset=0&limit=10
  // @Query() junta todos los parámetros de después del "?" y los valida con el DTO.
  @Get()
  listar(@Query() listarPublicacionesDto: ListarPublicacionesDto, @Req() req: RequestConToken) {
    return this.publicacionesService.listar(listarPublicacionesDto, req.usuario.id);
  }

  // GET /publicaciones/:id -> 200 con una publicación (para la página Publicación).
  // Necesita saber quién mira: según eso cambian la encuesta (tu voto) y el spoiler.
  @Get(':id')
  obtener(@Param('id') id: string, @Req() req: RequestConToken) {
    return this.publicacionesService.obtener(id, req.usuario.id);
  }

  // DELETE /publicaciones/:id -> 200 OK (baja lógica)
  // :id es un parámetro de ruta: /publicaciones/6adc04a3... -> id = '6adc04a3...'
  @Delete(':id')
  eliminar(@Param('id') id: string, @Req() req: RequestConToken) {
    return this.publicacionesService.eliminar(id, req.usuario.id);
  }

  // POST /publicaciones/:id/me-gusta -> 201 Created (se crea un "Me gusta")
  @Post(':id/me-gusta')
  darMeGusta(@Param('id') id: string, @Req() req: RequestConToken) {
    return this.publicacionesService.darMeGusta(id, req.usuario.id);
  }

  // DELETE /publicaciones/:id/me-gusta -> 200 OK (se quita el "Me gusta")
  @Delete(':id/me-gusta')
  quitarMeGusta(@Param('id') id: string, @Req() req: RequestConToken) {
    return this.publicacionesService.quitarMeGusta(id, req.usuario.id);
  }

  // POST /publicaciones/:id/votar { opcion } -> 201 con la publicación y los resultados
  // (409 si ya votaste, 400 si cerró o no tiene encuesta)
  @Post(':id/votar')
  votar(@Param('id') id: string, @Req() req: RequestConToken, @Body() { opcion }: VotarDto) {
    return this.publicacionesService.votar(id, req.usuario.id, opcion);
  }
}
