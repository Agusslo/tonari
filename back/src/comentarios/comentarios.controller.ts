import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ComentariosService } from './comentarios.service.js';
import { MensajeComentarioDto } from './dto/mensaje-comentario.dto.js';
import { ListarComentariosDto } from './dto/listar-comentarios.dto.js';
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
  @Post('publicaciones/:id/comentarios')
  crear(
    @Param('id') publicacionId: string,
    @Req() req: RequestConToken,
    @Body() mensajeComentarioDto: MensajeComentarioDto,
  ) {
    return this.comentariosService.crear(publicacionId, req.usuario.id, mensajeComentarioDto);
  }

  // GET /publicaciones/:id/comentarios?offset=0&limit=5 -> 200 con { comentarios, total, offset, limit }
  @Get('publicaciones/:id/comentarios')
  listar(@Param('id') publicacionId: string, @Query() listarComentariosDto: ListarComentariosDto) {
    return this.comentariosService.listar(publicacionId, listarComentariosDto);
  }

  // POST /comentarios/:id/respuestas -> 201 con la respuesta creada.
  @Post('comentarios/:id/respuestas')
  responder(
    @Param('id') comentarioId: string,
    @Req() req: RequestConToken,
    @Body() mensajeComentarioDto: MensajeComentarioDto,
  ) {
    return this.comentariosService.responder(comentarioId, req.usuario.id, mensajeComentarioDto);
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
}
