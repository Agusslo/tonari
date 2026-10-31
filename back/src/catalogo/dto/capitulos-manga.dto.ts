import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// GET /catalogo/manga/:idAnilist/capitulos?titulo=Berserk&alternativo=...&idMal=2
// Los títulos sirven para buscar el manga en MangaDex; el id de AniList (y el de
// MyAnimeList) para confirmar que encontramos la obra correcta.
export class CapitulosMangaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Falta el título para buscar el manga' })
  @IsNotEmpty({ message: 'Falta el título para buscar el manga' })
  @MaxLength(200, { message: 'El título puede tener hasta 200 caracteres' })
  titulo: string;

  // Otro título (por ejemplo, el inglés), por si con el primero no aparece.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El título alternativo no es válido' })
  @MaxLength(200, { message: 'El título puede tener hasta 200 caracteres' })
  alternativo?: string;

  // Lo que llega por la URL es texto: @Type lo convierte a número antes de validar.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El id de MyAnimeList no es válido' })
  @Min(1, { message: 'El id de MyAnimeList no es válido' })
  idMal?: number;
}
