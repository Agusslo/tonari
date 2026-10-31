import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublicacionesService } from './publicaciones.service.js';
import { PublicacionesController } from './publicaciones.controller.js';
import { Publicacion, PublicacionSchema } from './entities/publicacion.entity.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';

@Module({
  imports: [
    // La colección de publicaciones, propia de este módulo.
    MongooseModule.forFeature([{ name: Publicacion.name, schema: PublicacionSchema }]),
    // La colección de usuarios (para validar al autor y traer sus datos).
    UsuariosModule,
  ],
  controllers: [PublicacionesController],
  providers: [PublicacionesService],
  // Exporta el acceso a la colección de publicaciones para que el módulo de
  // comentarios pueda usarla (verificar que exista y contar sus comentarios).
  exports: [MongooseModule],
})
export class PublicacionesModule {}