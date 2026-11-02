import { Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service.js';
import { ListarNotificacionesDto } from './dto/listar-notificaciones.dto.js';
import { TokenGuard } from '../auth/token/token.guard.js';
import type { RequestConToken } from '../auth/token/token.guard.js';

// Todas piden token, y cada uno ve SOLO las suyas: el destinatario sale del token,
// nunca de la URL (nadie puede pedir las notificaciones de otro).
@Controller('notificaciones')
@UseGuards(TokenGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  // GET /notificaciones?offset=0&limit=20 -> { notificaciones, total, noLeidas, offset, limit }
  @Get()
  listar(@Req() req: RequestConToken, @Query() listarNotificacionesDto: ListarNotificacionesDto) {
    return this.notificacionesService.listar(req.usuario.id, listarNotificacionesDto);
  }

  // GET /notificaciones/no-leidas -> { noLeidas: 3 }
  @Get('no-leidas')
  noLeidas(@Req() req: RequestConToken) {
    return this.notificacionesService.contarNoLeidas(req.usuario.id);
  }

  // PATCH /notificaciones/leidas -> { noLeidas: 0 }
  // PATCH porque cambia una parte (el campo "leida") de varias notificaciones.
  @Patch('leidas')
  marcarLeidas(@Req() req: RequestConToken) {
    return this.notificacionesService.marcarLeidas(req.usuario.id);
  }
}
