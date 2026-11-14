import { Module } from '@nestjs/common';
import { BuscarController } from './buscar.controller.js';
import { BuscarService } from './buscar.service.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { PublicacionesModule } from '../publicaciones/publicaciones.module.js';

// Buscador global (extra). Los dos módulos exportan sus colecciones.
@Module({
  imports: [UsuariosModule, PublicacionesModule],
  controllers: [BuscarController],
  providers: [BuscarService],
})
export class BuscarModule {}
