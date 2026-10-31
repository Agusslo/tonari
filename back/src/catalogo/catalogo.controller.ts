import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MangadexService } from './mangadex.service.js';
import { CapitulosMangaDto } from './dto/capitulos-manga.dto.js';
import { TokenGuard } from '../auth/token/token.guard.js';

// Catálogo (extra): datos de las obras que vienen de APIs externas.
@Controller('catalogo')
@UseGuards(TokenGuard)
export class CatalogoController {
  constructor(private readonly mangadexService: MangadexService) {}

  // GET /catalogo/manga/30002/capitulos?titulo=Berserk -> los capítulos por tomo (de MangaDex)
  // ParseIntPipe: el :idAnilist llega como texto y lo pasa a número; si no es un número, 400.
  @Get('manga/:idAnilist/capitulos')
  capitulos(
    @Param(
      'idAnilist',
      new ParseIntPipe({ exceptionFactory: () => new BadRequestException('El id de AniList no es válido') }),
    )
    idAnilist: number,
    @Query() capitulosMangaDto: CapitulosMangaDto,
  ) {
    return this.mangadexService.capitulos(idAnilist, capitulosMangaDto);
  }
}
