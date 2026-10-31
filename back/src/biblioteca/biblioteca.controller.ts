import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BibliotecaService } from './biblioteca.service.js';
import { AgregarEntradaDto } from './dto/agregar-entrada.dto.js';
import { ActualizarEntradaDto } from './dto/actualizar-entrada.dto.js';
import { ListarBibliotecaDto } from './dto/listar-biblioteca.dto.js';
import { TokenGuard } from '../auth/token/token.guard.js';
import type { RequestConToken } from '../auth/token/token.guard.js';

// Mi Biblioteca: la lista de anime y manga de cada usuario (extra, no lo pide la consigna).
// Todas las rutas piden token; quién hace el pedido sale del token.
@Controller('biblioteca')
@UseGuards(TokenGuard)
export class BibliotecaController {
  constructor(private readonly bibliotecaService: BibliotecaService) {}

  // GET /biblioteca?tipo=anime -> mi biblioteca (o la de otro con ?usuario=<id>)
  @Get()
  listar(@Req() req: RequestConToken, @Query() listarBibliotecaDto: ListarBibliotecaDto) {
    return this.bibliotecaService.listar(req.usuario.id, listarBibliotecaDto);
  }

  // POST /biblioteca -> 201 con la obra agregada (409 si ya estaba)
  @Post()
  agregar(@Req() req: RequestConToken, @Body() agregarEntradaDto: AgregarEntradaDto) {
    return this.bibliotecaService.agregar(req.usuario.id, agregarEntradaDto);
  }

  // PATCH /biblioteca/:id -> cambia estado, progreso o puntuación (solo la propia)
  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Req() req: RequestConToken,
    @Body() actualizarEntradaDto: ActualizarEntradaDto,
  ) {
    return this.bibliotecaService.actualizar(id, req.usuario.id, actualizarEntradaDto);
  }

  // DELETE /biblioteca/:id -> la quita de la biblioteca (solo la propia)
  @Delete(':id')
  eliminar(@Param('id') id: string, @Req() req: RequestConToken) {
    return this.bibliotecaService.eliminar(id, req.usuario.id);
  }
}
