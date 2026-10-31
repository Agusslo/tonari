import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller.js';
import { MangadexService } from './mangadex.service.js';

// No usa Mongo: solo consulta APIs externas (por ahora, MangaDex).
@Module({
  controllers: [CatalogoController],
  providers: [MangadexService],
})
export class CatalogoModule {}
