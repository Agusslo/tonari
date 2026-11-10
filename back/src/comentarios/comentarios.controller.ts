import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ComentariosService } from './comentarios.service.js';
import { MensajeComentarioDto } from './dto/mensaje-comentario.dto.js';
import { ListarComentariosDto } from './dto/listar-comentarios.dto.js';
import { validarImagen } from '../common/imagenes.js';
import { TokenGuard } from '../auth/token/token.guard.js';
import type { RequestConToken } from '../auth/token/token.guard.js';

// @Controller() sin prefijo: así cada ruta escribe su camino completo.
// Los comentarios "cuelgan" de una publicación (/publicaciones/:id/comentarios),
// pero para editar uno alcanza con su propio id (/comentarios/:id).
@Controller()
@UseGuards(TokenGuard)
export class ComentariosController {
  constructor(private readonly comentariosService: ComentariosService) {}

  // POST /publicaciones/:id/comentarios -> 201 con el comentario creado.
  // Imagen opcional (extra): si la trae, llega como multipart/form-data (mensaje + "imagen"),
  // igual que al crear una publicación. Sin imagen sigue andando con JSON común.
  @Post('publicaciones/:id/comentarios')
  @UseInterceptors(FileInterceptor('imagen', { defParamCharset: 'utf8' }))
  crear(
    @Param('id') publicacionId: string,
    @Req() req: RequestConToken,
    @Body() mensajeComentarioDto: MensajeComentarioDto,
    @UploadedFile(validarImagen('La imagen', false)) imagen?: Express.Multer.File,
  ) {
    return this.comentariosService.crear(publicacionId, req.usuario.id, mensajeComentarioDto, imagen);
  }

  // GET /publicaciones/:id/comentarios?offset=0&limit=5 -> 200 con { comentarios, total, offset, limit }
  @Get('publicaciones/:id/comentarios')
  listar(@Param('id') publicacionId: string, @Query() listarComentariosDto: ListarComentariosDto) {
    return this.comentariosService.listar(publicacionId, listarComentariosDto);
  }

  // POST /comentarios/:id/respuestas -> 201 con la respuesta creada.
  // También puede llevar imagen (multipart), igual que un comentario.
  @Post('comentarios/:id/respuestas')
  @UseInterceptors(FileInterceptor('imagen', { defParamCharset: 'utf8' }))
  responder(
    @Param('id') comentarioId: string,
    @Req() req: RequestConToken,
    @Body() mensajeComentarioDto: MensajeComentarioDto,
    @UploadedFile(validarImagen('La imagen', false)) imagen?: Express.Multer.File,
  ) {
    return this.comentariosService.responder(comentarioId, req.usuario.id, mensajeComentarioDto, imagen);
  }

  // GET /comentarios/:id/respuestas?offset=0&limit=5 -> 200 con { comentarios, total, offset, limit }
  @Get('comentarios/:id/respuestas')
  listarRespuestas(
    @Param('id') comentarioId: string,
    @Query() listarComentariosDto: ListarComentariosDto,
  ) {
    return this.comentariosService.listarRespuestas(comentarioId, listarComentariosDto);
  }

  // PUT /comentarios/:id -> 200 con el comentario editado (modificado: true).
  @Put('comentarios/:id')
  editar(
    @Param('id') id: string,
    @Req() req: RequestConToken,
    @Body() mensajeComentarioDto: MensajeComentarioDto,
  ) {
    return this.comentariosService.editar(id, req.usuario.id, mensajeComentarioDto);
  }

  // DELETE /comentarios/:id -> 200 con { mensaje, eliminados }.
  // Un comentario principal se lleva sus respuestas; "eliminados" dice cuántos fueron.
  @Delete('comentarios/:id')
  eliminar(@Param('id') id: string, @Req() req: RequestConToken) {
    return this.comentariosService.eliminar(id, req.usuario);
  }
}
