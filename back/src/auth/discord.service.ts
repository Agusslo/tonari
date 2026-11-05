import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

// Ingreso con Discord (extra). Es OAuth2 "clásico" (authorization code):
//   1. GET /auth/discord: te mandamos a Discord a que aceptes darnos tu usuario y correo.
//   2. Discord te devuelve a GET /auth/discord/callback con un "code" de un solo uso.
//   3. El back cambia ese code por un access token (con el CLIENT SECRET, que nunca sale del back)
//      y con ese token le pide a Discord tus datos.
//   4. Te devolvemos al front con un TICKET: un JWT firmado por nosotros con esos datos,
//      que dura 10 minutos. El front lo usa para ingresar, registrarse o vincular.
// Es el mismo truco que con Google: la credencial viaja en el "#" de la URL.

const DISCORD_API = 'https://discord.com/api';
const DURACION_TICKET = '10m';

export type ModoDiscord = 'ingreso' | 'vincular';

// Lo que va adentro del ticket (y lo que usan login, registro y vincular).
export interface DatosDiscord {
  id: string; // id de la cuenta de Discord (no cambia nunca)
  usuario: string; // nombre de usuario (el que se busca en "Agregar amigo")
  nombre: string; // nombre visible ("global_name"), o el usuario si no tiene
  avatar: string; // URL de la foto (o el avatar por defecto de Discord)
  correo: string | null;
  verificado: boolean; // si Discord verificó que el correo es suyo
  modo: ModoDiscord;
  nonce: string;
}

// Lo que responde GET https://discord.com/api/users/@me (manda más campos).
interface UsuarioDiscord {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  email?: string | null;
  verified?: boolean;
}

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(private readonly config: ConfigService) {}

  // Paso 1: la URL de Discord a la que mandamos al navegador.
  // state: un JWT corto con el modo (ingresar o vincular) y el nonce del front.
  // Discord lo devuelve tal cual en el paso 2; como está firmado, nadie puede inventarlo.
  urlAutorizar(modo: ModoDiscord, nonce: string) {
    const { clientId, redirectUri } = this.configuracion();
    if (!nonce || nonce.length < 16) {
      throw new BadRequestException('Falta el código de seguridad (nonce)'); // 400
    }
    const state = jwt.sign({ modo, nonce }, this.secreto(), {
      expiresIn: DURACION_TICKET,
      audience: 'discord-state',
    });
    const parametros = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'identify email', // identify = id, usuario y avatar; email = el correo
      state,
      prompt: 'none', // si ya aceptaste antes, no te vuelve a preguntar
    });
    return `https://discord.com/oauth2/authorize?${parametros}`;
  }

  // Pasos 2 a 4: volviste de Discord. Devuelve la URL del front a la que te mandamos.
  // Nunca tira error: cualquier problema vuelve al front con #error=..., que lo muestra lindo.
  async procesarVuelta(code?: string, state?: string, error?: string) {
    let datosState: { modo: ModoDiscord; nonce: string };
    try {
      datosState = jwt.verify(state ?? '', this.secreto(), {
        audience: 'discord-state',
      }) as { modo: ModoDiscord; nonce: string };
    } catch {
      return this.urlFront({ error: 'invalido' });
    }
    const { modo, nonce } = datosState;

    // Tocaste "Cancelar" en Discord.
    if (error === 'access_denied') return this.urlFront({ error: 'cancelado', modo });
    if (!code) return this.urlFront({ error: 'invalido', modo });

    try {
      const accessToken = await this.cambiarCodigo(code);
      const usuario = await this.pedirUsuario(accessToken);
      const ticket = jwt.sign(
        {
          id: usuario.id,
          usuario: usuario.username,
          nombre: usuario.global_name || usuario.username,
          avatar: urlAvatar(usuario),
          correo: usuario.email?.toLowerCase() ?? null,
          verificado: usuario.verified === true,
          modo,
          nonce,
        } satisfies DatosDiscord,
        this.secreto(),
        { expiresIn: DURACION_TICKET, audience: 'ticket-discord' },
      );
      return this.urlFront({ ticket, modo });
    } catch (e) {
      this.logger.warn(`Falló la vuelta de Discord: ${(e as Error).message}`);
      return this.urlFront({ error: 'discord', modo });
    }
  }

  // Valida un ticket: que lo hayamos firmado nosotros, que no haya vencido, que sea del
  // modo correcto y que el nonce coincida con el que guardó TU navegador.
  verificarTicket(ticket: string, nonce: string, modo: ModoDiscord): DatosDiscord {
    const invalido = 'El ingreso con Discord no es válido o ya venció. Probá de nuevo';
    let datos: DatosDiscord;
    try {
      datos = jwt.verify(ticket, this.secreto(), { audience: 'ticket-discord' }) as DatosDiscord;
    } catch {
      throw new UnauthorizedException(invalido); // 401
    }
    if (datos.modo !== modo || datos.nonce !== nonce) {
      throw new UnauthorizedException(invalido); // 401
    }
    return datos;
  }

  // POST https://discord.com/api/oauth2/token: code -> access token.
  // Va como formulario (x-www-form-urlencoded), así lo pide Discord.
  private async cambiarCodigo(code: string) {
    const { clientId, clientSecret, redirectUri } = this.configuracion();
    const respuesta = await this.pedir(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const { access_token } = (await respuesta.json()) as { access_token?: string };
    if (!access_token) throw new Error('Discord no devolvió access_token');
    return access_token;
  }

  // GET https://discord.com/api/users/@me con el access token: los datos de la cuenta.
  private async pedirUsuario(accessToken: string) {
    const respuesta = await this.pedir(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (await respuesta.json()) as UsuarioDiscord;
  }

  private async pedir(url: string, opciones: RequestInit) {
    const respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(8000) });
    if (!respuesta.ok) throw new Error(`Discord respondió ${respuesta.status}`);
    return respuesta;
  }

  // Las 3 variables de entorno. Si falta alguna, 503 con un mensaje claro.
  private configuracion() {
    const clientId = this.config.get<string>('DISCORD_CLIENT_ID');
    const clientSecret = this.config.get<string>('DISCORD_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('DISCORD_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('El ingreso con Discord no está configurado'); // 503
    }
    return { clientId, clientSecret, redirectUri };
  }

  private secreto() {
    return this.config.getOrThrow<string>('CONTRASENA_DEL_SERVER');
  }

  // A dónde volvés en el front. Igual que con Google: la https (Vercel) o la primera.
  // Todo va en el "#": nunca se manda a ningún servidor.
  private urlFront(datos: Record<string, string>) {
    const fronts = this.config
      .get<string>('URL_FRONT', 'http://localhost:4200')
      .split(',')
      .map((url) => url.trim());
    const front = fronts.find((url) => url.startsWith('https://')) ?? fronts[0];
    return `${front}/ingreso-discord#${new URLSearchParams(datos)}`;
  }
}

// La foto de Discord. Si no tiene, Discord usa uno de sus 6 avatares por defecto
// (cuál depende del id: así lo calcula Discord para las cuentas nuevas).
function urlAvatar({ id, avatar }: UsuarioDiscord) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=256`;
  const indice = Number((BigInt(id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${indice}.png`;
}
