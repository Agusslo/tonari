import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogoController } from './catalogo.controller.js';
import { MangadexService } from './mangadex.service.js';
import { SinopsisService } from './sinopsis.service.js';
import { TraductorService } from './traductor.service.js';
import { Sinopsis, SinopsisSchema } from './entities/sinopsis.entity.js';

// Datos de las obras que vienen de APIs externas (MangaDex, AniList, MyMemory).
// En Mongo solo guarda las sinopsis ya traducidas (como caché).
@Module({
  imports: [MongooseModule.forFeature([{ name: Sinopsis.name, schema: SinopsisSchema }])],
  controllers: [CatalogoController],
  providers: [MangadexService, SinopsisService, TraductorService],
})
export class CatalogoModule {}
