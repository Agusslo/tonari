import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { DiscordService } from './discord.service.js';
import { CuentasService } from './cuentas.service.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';

@Module({
  // Importa UsuariosModule para poder usar la colección de usuarios.
  imports: [UsuariosModule],
  controllers: [AuthController],
  // DiscordService: el ida y vuelta con Discord. CuentasService: "Cuentas vinculadas".
  providers: [AuthService, DiscordService, CuentasService],
})
export class AuthModule {}
