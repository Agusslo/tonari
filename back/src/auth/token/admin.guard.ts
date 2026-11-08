import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import type { RequestConToken } from './token.guard.js';

// Sprint 4: "Se debe validar que el token pertenezca a un administrador".
// Va SIEMPRE después de TokenGuard (que es el que lee el token y deja req.usuario):
//   @UseGuards(TokenGuard, AdminGuard)
// Nest los corre en ese orden; si el primero corta, el segundo ni se ejecuta.
//
// ¿Por qué buscamos al usuario en la base si el token ya dice "perfil"?
// Porque el token es una "foto" del momento en que iniciaste sesión. Dura 15 minutos,
// pero /auth/refrescar arma el token nuevo COPIANDO los datos del viejo: si a alguien
// le sacan el rol de administrador, su token seguiría diciendo "administrador"
// mientras la app lo siga refrescando. La base siempre tiene el dato de AHORA.
//
// Para usarlo, el módulo tiene que tener acceso a la colección de usuarios
// (importar UsuariosModule, o ser UsuariosModule).
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestConToken>();

    // Si alguien se olvida de poner TokenGuard antes, no hay usuario: cortamos igual.
    if (!req.usuario) {
      throw new UnauthorizedException('Tenés que iniciar sesión'); // 401
    }

    // select: solo los dos campos que hacen falta (no traemos el documento entero).
    const usuario = await this.usuarioModel.findById(req.usuario.id).select('perfil habilitado');

    // Lo borraron o lo deshabilitaron después de que inició sesión: ya no es "alguien válido".
    if (!usuario || !usuario.habilitado) {
      throw new UnauthorizedException('Tu cuenta no está habilitada'); // 401
    }

    // Sabemos quién es, pero no tiene permiso: 403 (no 401).
    if (usuario.perfil !== 'administrador') {
      throw new ForbiddenException('Solo un administrador puede hacer esto'); // 403
    }
    return true;
  }
}
