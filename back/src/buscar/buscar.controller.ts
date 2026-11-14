import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BuscarService } from './buscar.service.js';
import { BuscarDto } from './dto/buscar.dto.js';
import { TokenGuard } from '../auth/token/token.guard.js';

// GET /buscar?q=texto -> { usuarios, publicaciones } (hasta 5 de cada uno).
// Con token, como el resto de la app. 400 si q tiene menos de 2 letras.
@Controller('buscar')
@UseGuards(TokenGuard)
export class BuscarController {
  constructor(private readonly buscarService: BuscarService) {}

  @Get()
  buscar(@Query() { q }: BuscarDto) {
    return this.buscarService.buscar(q);
  }
}
