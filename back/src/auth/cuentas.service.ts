import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { AuthService } from './auth.service.js';
import { DiscordService } from './discord.service.js';
import { DiscordDto } from './dto/discord.dto.js';
import { VincularGoogleDto } from './dto/cuentas.dto.js';

export type Proveedor = 'google' | 'discord';

// "Cuentas vinculadas" (extra), en Mi perfil: con qué podés ingresar a TONARI.
// Cualquier combinación: contraseña, Google y/o Discord.
// Siempre se trabaja sobre el usuario del TOKEN: nadie puede tocar las cuentas de otro.
@Injectable()
export class CuentasService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<Usuario>,
    private readonly authService: AuthService,
    private readonly discordService: DiscordService,
  ) {}

  // GET /auth/cuentas -> { contraseña, google, discord }
  async estado(id: string) {
    const usuario = await this.buscar(id);
    return this.resumen(usuario);
  }

  // POST /auth/cuentas/google: vincular Google.
  // El nonce viene ADENTRO de la credencial (Google lo firma): si no coincide con el que
  // guardó tu navegador, alguien intentó pasarte una credencial suya.
  async vincularGoogle(id: string, { credential, nonce }: VincularGoogleDto) {
    const google = await comoError400(() => this.authService.verificarGoogle(credential));
    if (google.nonce !== nonce) {
      throw new BadRequestException('La vinculación con Google no es válida. Probá de nuevo'); // 400
    }
    await this.libre('googleId', google.sub, id, 'Esa cuenta de Google ya está vinculada a otro usuario de TONARI');

    const usuario = await this.buscar(id);
    usuario.googleId = google.sub;
    usuario.googleCorreo = google.email.toLowerCase();
    await usuario.save();
    return this.resumen(usuario);
  }

  // POST /auth/cuentas/discord: vincular Discord (con el ticket de modo "vincular").
  async vincularDiscord(id: string, { ticket, nonce }: DiscordDto) {
    const discord = await comoError400(() => this.discordService.verificarTicket(ticket, nonce, 'vincular'));
    await this.libre('discordId', discord.id, id, 'Esa cuenta de Discord ya está vinculada a otro usuario de TONARI');

    const usuario = await this.buscar(id);
    usuario.discordId = discord.id;
    usuario.discordUsuario = discord.usuario;
    await usuario.save();
    return this.resumen(usuario);
  }

  // DELETE /auth/cuentas/google o /auth/cuentas/discord.
  // Regla: no te podés quedar sin ninguna forma de ingresar.
  async desvincular(id: string, proveedor: Proveedor) {
    const usuario = await this.buscar(id);
    const otroProveedor = proveedor === 'google' ? usuario.discordId : usuario.googleId;
    if (!usuario.contraseña && !otroProveedor) {
      throw new BadRequestException(
        'No te podés quedar sin forma de ingresar: creá una contraseña o vinculá otra cuenta primero',
      ); // 400
    }

    // undefined = Mongo saca el campo del documento (así no choca con el índice unique).
    if (proveedor === 'google') {
      usuario.googleId = undefined;
      usuario.googleCorreo = undefined;
    } else {
      usuario.discordId = undefined;
      usuario.discordUsuario = undefined;
    }
    await usuario.save();
    return this.resumen(usuario);
  }

  // PATCH /auth/cuentas/discord: mostrar u ocultar el Discord en el perfil público.
  async mostrarDiscord(id: string, mostrar: boolean) {
    const usuario = await this.buscar(id);
    usuario.mostrarDiscord = mostrar;
    await usuario.save();
    return this.resumen(usuario);
  }

  // '+contraseña': la pedimos solo para saber SI existe (nunca se devuelve).
  private async buscar(id: string) {
    const usuario = await this.usuarioModel
      .findOne({ _id: id, habilitado: true })
      .select('+contraseña');
    if (!usuario) throw new UnauthorizedException('Tu sesión ya no es válida'); // 401
    return usuario;
  }

  // Que esa cuenta de Google o Discord no la tenga OTRO usuario de TONARI (409).
  private async libre(campo: 'googleId' | 'discordId', valor: string, miId: string, mensaje: string) {
    const otro = await this.usuarioModel.exists({ [campo]: valor, _id: { $ne: miId } });
    if (otro) throw new ConflictException(mensaje); // 409
  }

  // Lo que ve el front: nunca el hash ni los ids de Google (solo si hay o no, y lo que se muestra).
  private resumen(usuario: Usuario) {
    return {
      contraseña: Boolean(usuario.contraseña),
      google: usuario.googleId ? { correo: usuario.googleCorreo ?? usuario.correo } : null,
      discord: usuario.discordId
        ? // !== false: las cuentas viejas no tienen el campo, y por defecto se muestra.
          { id: usuario.discordId, usuario: usuario.discordUsuario, mostrar: usuario.mostrarDiscord !== false }
        : null,
    };
  }
}

// Acá ya tenés la sesión iniciada: si la credencial de Google o el ticket de Discord
// vencieron, eso NO es "tu sesión no sirve" (401, que en el front te manda al login),
// es un dato inválido (400). Así no te saca de la app por un ticket viejo.
async function comoError400<T>(paso: () => T | Promise<T>): Promise<T> {
  try {
    return await paso();
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw new BadRequestException(error.message); // 400
    }
    throw error;
  }
}
