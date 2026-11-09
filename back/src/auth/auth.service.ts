import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { RegistroDto } from './dto/registro.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { GoogleDto } from './dto/google.dto.js';
import { RegistroGoogleDto } from './dto/registro-google.dto.js';
import { DiscordDto, RegistroDiscordDto } from './dto/discord.dto.js';
import { DiscordService } from './discord.service.js';
import { guardarImagen } from '../common/imagenes.js';
import { PayloadToken } from './token/token.guard.js';
import { Recuperacion } from './entities/recuperacion.entity.js';
import { RecuperarDto, RestablecerDto } from './dto/recuperar.dto.js';
import { CorreoService } from './correo.service.js';

// "Olvidé mi contraseña": cuánto dura el link y cada cuánto se puede pedir otro.
const DURACION_LINK_MS = 30 * 60 * 1000; // 30 minutos
const ESPERA_REENVIO_MS = 2 * 60 * 1000; // 2 minutos

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
    @InjectModel(Recuperacion.name) private recuperacionModel: Model<Recuperacion>,
    private readonly config: ConfigService,
    private readonly discordService: DiscordService,
    private readonly correoService: CorreoService,
  ) {}

  async registro(registroDto: RegistroDto, imagen: Express.Multer.File) {
    // 1. Revisar que el usuario no exista (correo y nombre de usuario son únicos).
    const existente = await this.usuarioModel.findOne({
      $or: [
        { correo: registroDto.correo.toLowerCase() },
        { nombreUsuario: registroDto.nombreUsuario },
      ],
    });
    if (existente) {
      const mensaje =
        existente.correo === registroDto.correo.toLowerCase()
          ? 'El correo ya está registrado'
          : 'El nombre de usuario ya está en uso';
      throw new ConflictException(mensaje); // 409
    }

    // 2. Hashear la contraseña. El 10 es el "costo": cuántas vueltas hace el algoritmo.
    const hash = await bcrypt.hash(registroDto.contraseña, 10);

    // 3. Guardar la imagen de perfil (obligatoria, ya validada en el controller) y obtener su URL.
    const urlImagen = await guardarImagen(imagen, 'perfiles');

    // 4. Guardar el usuario con el hash en lugar de la contraseña.
    const usuario = await this.usuarioModel.create({
      nombre: registroDto.nombre,
      apellido: registroDto.apellido,
      correo: registroDto.correo,
      nombreUsuario: registroDto.nombreUsuario,
      contraseña: hash,
      fechaNacimiento: registroDto.fechaNacimiento,
      descripcion: registroDto.descripcion,
      imagenPerfil: urlImagen,
    });

    // 5. Devolver los datos (SIN la contraseña) y el token: queda logueado.
    return this.respuestaConToken(usuario);
  }

  async login(loginDto: LoginDto) {
    // 1. Buscar por correo O por nombre de usuario.
    //    select('+contraseña'): pide explícitamente el campo que el schema oculta
    //    (select: false), porque acá sí lo necesitamos para comparar.
    const usuario = await this.usuarioModel
      .findOne({
        $or: [
          { correo: loginDto.usuario.toLowerCase() },
          { nombreUsuario: loginDto.usuario },
        ],
      })
      .select('+contraseña');

    // Las cuentas creadas con Google o Discord pueden no tener contraseña: se entra con el botón.
    if (usuario && !usuario.contraseña) {
      const botones = [usuario.googleId && 'Google', usuario.discordId && 'Discord'].filter(Boolean);
      throw new UnauthorizedException(
        `Esta cuenta no tiene contraseña: ingresá con ${botones.join(' o ')}`,
      ); // 401
    }

    // 2. Comparar la contraseña recibida con el hash guardado.
    //    bcrypt.compare hashea la recibida con los mismos datos y compara.
    const contraseñaCorrecta =
      usuario !== null &&
      (await bcrypt.compare(loginDto.contraseña, usuario.contraseña ?? ''));

    // Mismo mensaje si no existe el usuario o si la contraseña está mal:
    // así nadie puede averiguar qué correos están registrados.
    if (!usuario || !contraseñaCorrecta) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos'); // 401
    }

    // 3. Un usuario deshabilitado no puede ingresar (consigna, Sprint 4).
    if (!usuario.habilitado) {
      throw new ForbiddenException(
        'Tu cuenta está deshabilitada. Contactá a un administrador.',
      ); // 403
    }

    // 4. Devolver los datos del usuario (menos la contraseña) y el token.
    return this.respuestaConToken(usuario);
  }

  // ---------- Olvidé mi contraseña (extra) ----------

  // POST /auth/recuperar { correo }. Si hay una cuenta con ese correo, le manda un link.
  // Responde SIEMPRE lo mismo, exista o no la cuenta: si dijera "ese correo no existe",
  // cualquiera podría probar correos para saber quién usa TONARI (igual que en el login).
  async recuperar({ correo }: RecuperarDto) {
    const respuesta = {
      mensaje:
        'Si hay una cuenta con ese correo, te mandamos un link para elegir una contraseña nueva.',
    };

    const usuario = await this.usuarioModel.findOne({ correo: correo.toLowerCase() });
    // Sin cuenta, o deshabilitada (no podría entrar igual): no mandamos nada.
    if (!usuario || !usuario.habilitado) return respuesta;

    // Si pidió otro hace menos de 2 minutos, no mandamos de nuevo: así nadie puede
    // llenarle la casilla de mails a otra persona tocando el botón muchas veces.
    const reciente = await this.recuperacionModel.exists({
      usuario: usuario._id,
      createdAt: { $gt: new Date(Date.now() - ESPERA_REENVIO_MS) },
    });
    if (reciente) return respuesta;

    // 32 bytes al azar (criptográficamente seguros) = 64 caracteres hexadecimales.
    // Imposible de adivinar. Este texto va en el link; en la base guardamos su hash.
    const token = randomBytes(32).toString('hex');

    // Solo sirve el ÚLTIMO link que pediste: borramos los anteriores.
    await this.recuperacionModel.deleteMany({ usuario: usuario._id });
    await this.recuperacionModel.create({
      usuario: usuario._id,
      hash: hashToken(token),
      vence: new Date(Date.now() + DURACION_LINK_MS),
    });

    // El token va en el "#" del link, igual que la credencial de Google: lo que va
    // después del # no se manda a ningún servidor (ni queda en sus registros).
    const link = `${this.urlFront()}/restablecer#token=${token}`;
    try {
      await this.correoService.enviarRecuperacion(usuario.correo, usuario.nombre, link);
    } catch (error) {
      // Si el mail no salió, borramos el link: así puede pedir otro enseguida
      // (si no, tendría que esperar los 2 minutos por un mail que nunca le llegó).
      await this.recuperacionModel.deleteMany({ usuario: usuario._id });
      throw error;
    }
    return respuesta;
  }

  // POST /auth/restablecer/verificar { token }. El front lo llama al abrir el link,
  // para avisarte ANTES de que escribas la contraseña si el link ya no sirve.
  async verificarRecuperacion(token: string) {
    await this.buscarRecuperacion(token);
    return { valido: true };
  }

  // POST /auth/restablecer { token, contraseña }. Guarda la contraseña nueva.
  async restablecer({ token, contraseña }: RestablecerDto) {
    const recuperacion = await this.buscarRecuperacion(token);

    const usuario = await this.usuarioModel.findById(recuperacion.usuario);
    if (!usuario || !usuario.habilitado) {
      await this.recuperacionModel.deleteMany({ usuario: recuperacion.usuario });
      throw new BadRequestException('El link no es válido o ya venció. Pedí uno nuevo'); // 400
    }

    // Igual que en el registro: guardamos el HASH. Si la cuenta era solo de Google o
    // Discord (sin contraseña), desde ahora también puede entrar con correo y contraseña.
    usuario.contraseña = await bcrypt.hash(contraseña, 10);
    await usuario.save();

    // El link ya se usó: lo borramos (y cualquier otro que hubiera), así sirve UNA vez.
    await this.recuperacionModel.deleteMany({ usuario: usuario._id });

    return { mensaje: 'Listo, tu contraseña quedó cambiada. Ya podés ingresar con ella.' };
  }

  // Busca el link por el hash del token y revisa que no haya vencido.
  // 400 (y no 401) a propósito: el interceptor del front trata cualquier 401 como
  // "se te venció la sesión" y te manda al login.
  private async buscarRecuperacion(token: string) {
    const recuperacion = await this.recuperacionModel.findOne({
      hash: hashToken(token),
      vence: { $gt: new Date() },
    });
    if (!recuperacion) {
      throw new BadRequestException('El link no es válido o ya venció. Pedí uno nuevo'); // 400
    }
    return recuperacion;
  }

  // ---------- Ingreso con Google (extra) ----------

  // POST /auth/google. Tocaste "Continuar con Google" y el front nos manda la
  // credencial que le dio Google. Dos casos:
  //   - ya tenés cuenta (por tu googleId, o por tu correo) -> igual que el login: { usuario, token }
  //   - es la primera vez -> todavía no hay cuenta: devolvemos lo que nos dio Google
  //     para que el front te muestre "Completá tu perfil" (faltan usuario, fecha y descripción).
  async loginGoogle({ credential }: GoogleDto) {
    const google = await this.verificarGoogle(credential);
    const correo = google.email.toLowerCase();

    // 1. ¿Ya entró con esta cuenta de Google antes?
    let usuario = await this.usuarioModel.findOne({ googleId: google.sub });

    // 2. Si no, ¿hay una cuenta común con ese correo? Google ya verificó que el
    //    correo es tuyo, así que la vinculamos: desde ahora entrás de las dos formas.
    if (!usuario) {
      usuario = await this.usuarioModel.findOne({ correo });
      if (usuario?.googleId) {
        throw new ConflictException('Ese correo ya está vinculado a otra cuenta de Google'); // 409
      }
    }

    // 3. Primera vez: no hay cuenta todavía.
    if (!usuario) {
      return {
        nuevo: true,
        datos: {
          nombre: google.given_name ?? google.name ?? '',
          apellido: google.family_name ?? '',
          correo,
          imagenPerfil: fotoGrande(google.picture),
        },
      };
    }

    if (!usuario.habilitado) {
      throw new ForbiddenException(
        'Tu cuenta está deshabilitada. Contactá a un administrador.',
      ); // 403
    }

    if (!usuario.googleId) {
      usuario.googleId = google.sub;
      usuario.googleCorreo = correo;
      await usuario.save();
    }
    return { nuevo: false, ...this.respuestaConToken(usuario) };
  }

  // POST /auth/google/registro. Completaste el perfil: creamos la cuenta.
  // El correo y la foto salen de la credencial de Google (no del body),
  // así nadie puede crear una cuenta con un correo que no es suyo.
  async registroGoogle({ credential, ...datos }: RegistroGoogleDto) {
    const google = await this.verificarGoogle(credential);
    const correo = google.email.toLowerCase();

    const existente = await this.usuarioModel.findOne({
      $or: [{ googleId: google.sub }, { correo }, { nombreUsuario: datos.nombreUsuario }],
    });
    if (existente) {
      const esSuya = existente.googleId === google.sub || existente.correo === correo;
      throw new ConflictException(
        esSuya
          ? 'Ya tenés una cuenta con ese correo: ingresá con "Continuar con Google"'
          : 'El nombre de usuario ya está en uso',
      ); // 409
    }

    if (!google.picture) {
      throw new BadRequestException(
        'Tu cuenta de Google no tiene foto: creá la cuenta con el formulario común',
      ); // 400
    }

    try {
      const usuario = await this.usuarioModel.create({
        ...datos,
        correo,
        googleId: google.sub,
        googleCorreo: correo,
        // Sin contraseña: esta cuenta entra con Google.
        imagenPerfil: fotoGrande(google.picture),
      });
      return this.respuestaConToken(usuario);
    } catch (error) {
      // 11000 = índice único repetido (alguien sacó ese nombre justo antes que vos).
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('El nombre de usuario ya está en uso'); // 409
      }
      throw error;
    }
  }

  // A dónde vuelve el navegador después de elegir la cuenta en Google.
  // URL_FRONT puede tener varias URLs separadas por coma (localhost y Vercel):
  // elegimos la https (la de Vercel) y, si no hay, la primera (tu PC).
  // La credencial va en el "#" (fragmento) a propósito: lo que está después del #
  // nunca se manda a ningún servidor, solo lo lee el front. Y el front lo borra enseguida.
  urlVueltaDeGoogle(credential?: string) {
    const fragmento = credential ? `credential=${encodeURIComponent(credential)}` : 'error=1';
    return `${this.urlFront()}/ingreso-google#${fragmento}`;
  }

  // La URL del front para armar links (la vuelta de Google, el link del mail).
  private urlFront() {
    const fronts = this.config
      .get<string>('URL_FRONT', 'http://localhost:4200')
      .split(',')
      .map((url) => url.trim());
    return fronts.find((url) => url.startsWith('https://')) ?? fronts[0];
  }

  // Le pregunta a Google si la credencial es real (tokeninfo revisa la firma y
  // que no haya vencido) y después revisamos nosotros que sea PARA TONARI:
  //   aud = nuestro Client ID (si no, sería un token de otra app que alguien reusa)
  //   iss = la emitió Google
  //   email_verified = Google comprobó que el correo es de esa persona
  // Con un fetch alcanza: no hace falta instalar la librería de Google.
  // Es pública porque también la usa "Cuentas vinculadas" (CuentasService) para vincular Google.
  async verificarGoogle(credential: string): Promise<DatosGoogle> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException('El ingreso con Google no está configurado'); // 503
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { signal: AbortSignal.timeout(8000) },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No pudimos comunicarnos con Google. Probá de nuevo en un rato',
      ); // 503
    }

    const invalida = 'El ingreso con Google no es válido o ya venció. Probá de nuevo';
    if (!respuesta.ok) throw new UnauthorizedException(invalida); // 401

    const datos = (await respuesta.json()) as DatosGoogle;
    const emisorOk = datos.iss === 'accounts.google.com' || datos.iss === 'https://accounts.google.com';
    if (datos.aud !== clientId || !emisorOk || !datos.sub || !datos.email) {
      throw new UnauthorizedException(invalida); // 401
    }
    // tokeninfo lo manda como texto ("true"); por las dudas aceptamos también el booleano.
    if (String(datos.email_verified) !== 'true') {
      throw new UnauthorizedException('Tu correo de Google no está verificado'); // 401
    }
    return datos;
  }

  // ---------- Ingreso con Discord (extra) ----------
  // Igual que Google, pero en vez de una credencial de Google llega un TICKET que firmó
  // nuestro propio back al volver de Discord (ver discord.service.ts).

  // POST /auth/discord. Mismos dos casos que loginGoogle: ya tenés cuenta, o es la primera vez.
  async loginDiscord({ ticket, nonce }: DiscordDto) {
    const discord = this.discordService.verificarTicket(ticket, nonce, 'ingreso');

    // 1. ¿Ya entró con esta cuenta de Discord antes?
    let usuario = await this.usuarioModel.findOne({ discordId: discord.id });

    // 2. Si no, ¿hay una cuenta con ese correo? Solo si Discord verificó que el correo es suyo:
    //    si no, cualquiera podría poner tu correo en Discord y entrar a tu cuenta de TONARI.
    if (!usuario && discord.correo && discord.verificado) {
      usuario = await this.usuarioModel.findOne({ correo: discord.correo });
      if (usuario?.discordId) {
        throw new ConflictException('Ese correo ya está vinculado a otra cuenta de Discord'); // 409
      }
    }

    // 3. Primera vez: devolvemos lo que dio Discord para "Completá tu perfil".
    if (!usuario) {
      this.correoVerificado(discord.correo, discord.verificado);
      return {
        nuevo: true,
        datos: {
          nombre: discord.nombre,
          apellido: '', // Discord no tiene apellido: lo completa la persona
          correo: discord.correo,
          imagenPerfil: discord.avatar,
          nombreUsuario: discord.usuario, // sugerencia: lo puede cambiar
        },
      };
    }

    if (!usuario.habilitado) {
      throw new ForbiddenException(
        'Tu cuenta está deshabilitada. Contactá a un administrador.',
      ); // 403
    }

    // Se vincula (si entró por el correo) y se actualiza el nombre de Discord por si lo cambió.
    usuario.discordId = discord.id;
    usuario.discordUsuario = discord.usuario;
    await usuario.save();
    return { nuevo: false, ...this.respuestaConToken(usuario) };
  }

  // POST /auth/discord/registro. Completaste el perfil: creamos la cuenta.
  // Correo y foto salen del ticket (firmado por nosotros), nunca del body.
  async registroDiscord({ ticket, nonce, ...datos }: RegistroDiscordDto) {
    const discord = this.discordService.verificarTicket(ticket, nonce, 'ingreso');
    const correo = this.correoVerificado(discord.correo, discord.verificado);

    const existente = await this.usuarioModel.findOne({
      $or: [{ discordId: discord.id }, { correo }, { nombreUsuario: datos.nombreUsuario }],
    });
    if (existente) {
      const esSuya = existente.discordId === discord.id || existente.correo === correo;
      throw new ConflictException(
        esSuya
          ? 'Ya tenés una cuenta con ese correo: ingresá con "Continuar con Discord"'
          : 'El nombre de usuario ya está en uso',
      ); // 409
    }

    try {
      const usuario = await this.usuarioModel.create({
        ...datos,
        correo,
        discordId: discord.id,
        discordUsuario: discord.usuario,
        // Sin contraseña: esta cuenta entra con Discord (después puede crear una).
        imagenPerfil: discord.avatar,
      });
      return this.respuestaConToken(usuario);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('El nombre de usuario ya está en uso'); // 409
      }
      throw error;
    }
  }

  // Para crear una cuenta hace falta un correo, y que Discord haya verificado que es suyo.
  private correoVerificado(correo: string | null, verificado: boolean) {
    if (!correo || !verificado) {
      throw new BadRequestException(
        'Tu cuenta de Discord no tiene un correo verificado. Verificalo en Discord o creá la cuenta con el formulario',
      ); // 400
    }
    return correo;
  }

  // POST /auth/autorizar. El guard ya validó el token (firma y vencimiento).
  // Acá buscamos al usuario para devolver sus datos actualizados: el token
  // solo tiene id, nombre de usuario y perfil.
  async autorizar(payload: PayloadToken) {
    const usuario = await this.usuarioModel.findById(payload.id);

    // Puede pasar que lo hayan deshabilitado (o borrado) después de loguearse.
    if (!usuario || !usuario.habilitado) {
      throw new UnauthorizedException('Tu sesión ya no es válida'); // 401
    }

    return this.sinContraseña(usuario);
  }

  // POST /auth/refrescar. Mismo payload, 15 minutos nuevos.
  refrescar(payload: PayloadToken) {
    return { token: this.generarToken(payload) };
  }

  // Firma el token con el secreto del server. Vence a los 15 minutos (consigna).
  // Armamos el objeto de nuevo a propósito: el payload que viene del guard
  // trae iat y exp viejos, y jsonwebtoken no deja firmar con exp y expiresIn juntos.
  private generarToken({ id, nombreUsuario, perfil }: PayloadToken) {
    return jwt.sign(
      { id, nombreUsuario, perfil },
      this.config.getOrThrow<string>('CONTRASENA_DEL_SERVER'),
      { expiresIn: '15m' },
    );
  }

  // Lo que devuelven login y registro: { usuario, token }.
  private respuestaConToken(usuario: { toObject(): Usuario & { _id: unknown } }) {
    const datos = this.sinContraseña(usuario);
    const token = this.generarToken({
      id: String(datos._id),
      nombreUsuario: datos.nombreUsuario,
      perfil: datos.perfil,
    });
    return { usuario: datos, token };
  }

  // select:false solo aplica a las búsquedas: un documento recién creado,
  // o uno pedido con '+contraseña', la trae. Acá se la sacamos antes de responder.
  private sinContraseña<T extends { contraseña?: string }>(usuario: { toObject(): T }) {
    const { contraseña: _contraseña, ...datos } = usuario.toObject();
    return datos;
  }
}

// Lo que nos interesa de la respuesta de tokeninfo (manda más campos).
export interface DatosGoogle {
  sub: string; // id de la cuenta de Google
  aud: string; // para qué app es (nuestro Client ID)
  iss: string; // quién la emitió
  email: string;
  email_verified: string | boolean;
  nonce?: string; // solo si el front lo pidió al dibujar el botón (para vincular)
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

// sha256 del token del link: lo que se guarda y se busca en la base.
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// Google manda la foto chiquita (96px, "=s96-c" al final de la URL).
// Cambiando ese número pedimos una más grande, para que no se vea pixelada.
function fotoGrande(url?: string) {
  return url?.replace(/=s\d+-c$/, '=s400-c') ?? '';
}
