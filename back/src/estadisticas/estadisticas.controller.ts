import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service.js';
import { RangoFechasDto } from './dto/rango-fechas.dto.js';
import { TokenGuard } from '../auth/token/token.guard.js';
import { AdminGuard } from '../auth/token/admin.guard.js';

// Sprint 4: "Estadísticas controller (validar que el token sea de un administrador)".
// Los dos guards en la clase: valen para todas las rutas. Primero TokenGuard
// (¿quién sos? -> 401) y después AdminGuard (¿sos administrador? -> 403).
// Todas aceptan ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (sin fechas: los últimos 30 días).
@Controller('estadisticas')
@UseGuards(TokenGuard, AdminGuard)
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  // GET /estadisticas/publicaciones-por-usuario -> publicaciones de cada usuario
  @Get('publicaciones-por-usuario')
  publicacionesPorUsuario(@Query() filtro: RangoFechasDto) {
    return this.estadisticasService.publicacionesPorUsuario(filtro);
  }

  // GET /estadisticas/comentarios -> comentarios hechos por día
  @Get('comentarios')
  comentariosPorDia(@Query() filtro: RangoFechasDto) {
    return this.estadisticasService.comentariosPorDia(filtro);
  }

  // GET /estadisticas/comentarios-por-publicacion -> comentarios de cada publicación
  @Get('comentarios-por-publicacion')
  comentariosPorPublicacion(@Query() filtro: RangoFechasDto) {
    return this.estadisticasService.comentariosPorPublicacion(filtro);
  }
}
