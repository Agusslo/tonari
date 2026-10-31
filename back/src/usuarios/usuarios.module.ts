import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Usuario, UsuarioSchema } from './entities/usuario.entity.js';
import { Seguimiento, SeguimientoSchema } from './entities/seguimiento.entity.js';
import { SeguimientosService } from './seguimientos.service.js';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
      // "Seguir" (extra): quién sigue a quién.
      { name: Seguimiento.name, schema: SeguimientoSchema },
    ]),
  ],
  // Exporta el acceso a las colecciones (autenticación las usa) y el servicio de
  // seguimientos (el muro lo usa para el filtro "Siguiendo").
  exports: [MongooseModule, SeguimientosService],
  providers: [UsuariosService, SeguimientosService],
  controllers: [UsuariosController],
})
export class UsuariosModule {}
