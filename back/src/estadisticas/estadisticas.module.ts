import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EstadisticasController } from './estadisticas.controller.js';
import { EstadisticasService } from './estadisticas.service.js';
import {
  Comentario,
  ComentarioSchema,
} from '../comentarios/entities/comentario.entity.js';
import { Ingreso, IngresoSchema } from './entities/ingreso.entity.js';
import { PublicacionesModule } from '../publicaciones/publicaciones.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';

@Module({
  imports: [
    // Comentarios: el módulo de comentarios no exporta su colección, así que la registramos acá.
    // Ingresos (Sprint 5): la colección la usa auth para anotar; acá se lee.
    MongooseModule.forFeature([
      { name: Comentario.name, schema: ComentarioSchema },
      { name: Ingreso.name, schema: IngresoSchema },
    ]),
    // Publicaciones exporta su colección (y la de "Me gusta" por día, Sprint 5).
    PublicacionesModule,
    // AdminGuard necesita la colección de usuarios (mira el perfil en la base).
    // Usuarios también exporta la de visitas a perfiles (Sprint 5).
    UsuariosModule,
  ],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
