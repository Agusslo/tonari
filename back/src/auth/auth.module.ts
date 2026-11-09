import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { DiscordService } from './discord.service.js';
import { CuentasService } from './cuentas.service.js';
import { CorreoService } from './correo.service.js';
import { Recuperacion, RecuperacionSchema } from './entities/recuperacion.entity.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';

@Module({
  // Importa UsuariosModule para poder usar la colección de usuarios.
  // Recuperaciones: los links de "Olvidé mi contraseña" (extra).
  imports: [
    UsuariosModule,
    MongooseModule.forFeature([{ name: Recuperacion.name, schema: RecuperacionSchema }]),
  ],
  controllers: [AuthController],
  // DiscordService: el ida y vuelta con Discord. CuentasService: "Cuentas vinculadas".
  // CorreoService: manda el mail de "Olvidé mi contraseña".
  providers: [AuthService, DiscordService, CuentasService, CorreoService],
})
export class AuthModule {}
