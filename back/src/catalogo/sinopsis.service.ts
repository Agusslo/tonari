import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sinopsis } from './entities/sinopsis.entity.js';
import { TraductorService, decodificarEntidades } from './traductor.service.js';

const URL_ANILIST = 'https://graphql.anilist.co';

// La sinopsis en español de una obra:
//  1) ¿Ya la tradujimos antes? -> sale de Mongo (rápido, sin gastar traducciones).
//  2) Si no: el back le pide la sinopsis a AniList, la traduce con MyMemory,
//     la guarda en Mongo y la devuelve.
// La sinopsis la busca el back en AniList (no la manda el front): así nadie puede
// guardar en nuestra base un texto inventado para una obra.
@Injectable()
export class SinopsisService {
  private readonly logger = new Logger(SinopsisService.name);

  constructor(
    @InjectModel(Sinopsis.name) private sinopsisModel: Model<Sinopsis>,
    private readonly traductor: TraductorService,
  ) {}

  async obtener(idAnilist: number) {
    const guardada = await this.sinopsisModel.findOne({ idAnilist });
    if (guardada) return { original: guardada.original, traducida: guardada.traducida };

    let original: string | null;
    let traducida: string;
    try {
      original = await this.sinopsisDeAnilist(idAnilist);
      if (!original) throw new NotFoundException('Esta obra no tiene sinopsis'); // 404
      traducida = await this.traductor.traducir(original);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(`No se pudo traducir la sinopsis ${idAnilist}: ${(error as Error).message}`);
      throw new BadGatewayException('No se pudo traducir la sinopsis en este momento'); // 502
    }

    // upsert: si dos personas abren la misma obra a la vez, no se duplica
    // (actualiza la que haya o crea una nueva).
    await this.sinopsisModel.updateOne(
      { idAnilist },
      { $set: { original, traducida } },
      { upsert: true },
    );
    return { original, traducida };
  }

  private async sinopsisDeAnilist(idAnilist: number): Promise<string | null> {
    const respuesta = await fetch(URL_ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: 'query ($id: Int) { Media(id: $id) { description(asHtml: false) } }',
        variables: { id: idAnilist },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (respuesta.status === 404) return null; // AniList no tiene esa obra
    if (!respuesta.ok) throw new Error(`AniList respondió ${respuesta.status}`);
    const { data } = (await respuesta.json()) as {
      data: { Media: { description: string | null } | null };
    };
    const descripcion = data.Media?.description;
    return descripcion ? textoPlano(descripcion) : null;
  }
}

// La sinopsis de AniList trae algo de HTML (<br>, <i>): los <br> pasan a saltos
// de línea, el resto de las etiquetas se borra y los &quot; se vuelven comillas.
function textoPlano(html: string): string {
  const texto = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  return decodificarEntidades(texto).replace(/\n{3,}/g, '\n\n').trim();
}
