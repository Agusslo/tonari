import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { Perfil } from '../../usuarios/entities/usuario.entity.js';

// Lo que guardamos adentro del token: quién es y qué rol tiene.
// (iat y exp los agrega jsonwebtoken solo: cuándo se creó y cuándo vence.)
export interface PayloadToken {
  id: string;
  nombreUsuario: string;
  perfil: Perfil;
}

// Un Request de Express que, después de pasar por el guard, trae al usuario del token.
export type RequestConToken = Request & { usuario: PayloadToken };

// Un guard decide si un pedido puede llegar al controller (true) o no (excepción).
// Se usa con @UseGuards(TokenGuard) arriba de la ruta o del controller entero.
@Injectable()
export class TokenGuard implements CanActivate {
  // El secreto se lee con ConfigService (cuando el .env ya está cargado).
  // En la clase se leía con process.env arriba de todo del archivo, y ahí
  // todavía no estaba cargado el .env: el secreto quedaba en el valor por defecto.
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestConToken>();

    // El front lo manda en el header -> Authorization: Bearer eyJhbGciOi...
    const [tipo, token] = req.headers.authorization?.split(' ') ?? [];

    // 401 (y no 403): 401 = "no sé quién sos" (falta el token o no sirve).
    // 403 = "sé quién sos, pero no podés hacer esto" (por ejemplo, borrar algo ajeno).
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Tenés que iniciar sesión');
    }

    try {
      // verify revisa la firma (que nadie lo haya modificado) y que no esté vencido.
      // Si algo falla, tira un error y caemos en el catch.
      const payload = jwt.verify(
        token,
        this.config.getOrThrow<string>('CONTRASENA_DEL_SERVER'),
      ) as PayloadToken;

      // Lo dejamos en el request: el controller lo lee con @Req().
      req.usuario = payload;
      return true;
    } catch (error) {
      const mensaje =
        error instanceof jwt.TokenExpiredError
          ? 'Tu sesión venció. Volvé a iniciar sesión'
          : 'Token no válido';
      throw new UnauthorizedException(mensaje);
    }
  }
}