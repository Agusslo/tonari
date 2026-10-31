import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// MyMemory (https://mymemory.translated.net): API de traducción gratis, sin clave.
// Límites: hasta 500 letras por pedido y unas 5.000 por día (50.000 si se manda un
// correo en la variable de entorno MYMEMORY_EMAIL, que es opcional).
// Por eso guardamos cada sinopsis traducida en Mongo: se traduce UNA sola vez.
const URL_MYMEMORY = 'https://api.mymemory.translated.net/get';
const MAXIMO_POR_PEDIDO = 450; // un poco menos de 500, por las dudas

interface RespuestaMyMemory {
  responseData: { translatedText: string };
  responseStatus: number | string;
}

@Injectable()
export class TraductorService {
  constructor(private readonly config: ConfigService) {}

  // Traduce un texto largo: se corta en partes que entren en un pedido,
  // se traducen una por una (en orden) y se vuelven a juntar.
  // Se respetan los párrafos: cada salto de línea queda donde estaba.
  async traducir(texto: string, de = 'en', a = 'es'): Promise<string> {
    const parrafos = texto.split('\n');
    const traducidos: string[] = [];
    for (const parrafo of parrafos) {
      if (!parrafo.trim()) {
        traducidos.push('');
        continue;
      }
      const partes: string[] = [];
      for (const pedazo of cortar(parrafo)) {
        partes.push(await this.pedir(pedazo, de, a));
      }
      traducidos.push(partes.join(' '));
    }
    return traducidos.join('\n');
  }

  private async pedir(texto: string, de: string, a: string) {
    const params = new URLSearchParams({ q: texto, langpair: `${de}|${a}` });
    const correo = this.config.get<string>('MYMEMORY_EMAIL');
    if (correo) params.set('de', correo);

    const respuesta = await fetch(`${URL_MYMEMORY}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!respuesta.ok) throw new Error(`MyMemory respondió ${respuesta.status}`);
    const datos = (await respuesta.json()) as RespuestaMyMemory;

    // Cuando se acaba el cupo del día, MyMemory responde "bien" pero con un aviso
    // en lugar de la traducción: eso lo tratamos como error (y no se guarda).
    const traduccion = datos.responseData?.translatedText ?? '';
    if (Number(datos.responseStatus) !== 200 || traduccion.startsWith('MYMEMORY WARNING')) {
      throw new Error(`MyMemory no tradujo (estado ${datos.responseStatus})`);
    }
    return decodificarEntidades(traduccion);
  }
}

// Corta un párrafo en pedazos de hasta MAXIMO_POR_PEDIDO letras, sin partir oraciones
// (se corta después de un punto, signo de pregunta o de exclamación).
function cortar(parrafo: string): string[] {
  if (parrafo.length <= MAXIMO_POR_PEDIDO) return [parrafo];
  const oraciones = parrafo.split(/(?<=[.!?])\s+/);
  const pedazos: string[] = [];
  let actual = '';
  for (const oracion of oraciones) {
    if (actual && (actual + ' ' + oracion).length > MAXIMO_POR_PEDIDO) {
      pedazos.push(actual);
      actual = oracion;
    } else {
      actual = actual ? `${actual} ${oracion}` : oracion;
    }
  }
  if (actual) pedazos.push(actual);
  // Una oración larguísima (sin puntos) se corta igual, por largo.
  return pedazos.flatMap((p) =>
    p.length <= MAXIMO_POR_PEDIDO ? [p] : (p.match(new RegExp(`.{1,${MAXIMO_POR_PEDIDO}}(\\s|$)`, 'g')) ?? [p]),
  );
}

// Las APIs a veces devuelven caracteres "escapados" (&quot; &#39; &amp;...):
// los pasamos al carácter de verdad.
export function decodificarEntidades(texto: string): string {
  const entidades: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&rsquo;': '’',
    '&lsquo;': '‘',
    '&ldquo;': '“',
    '&rdquo;': '”',
  };
  return texto
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (entidad) => entidades[entidad.toLowerCase()] ?? entidad);
}
