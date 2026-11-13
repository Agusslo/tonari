import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EstadisticasController } from "./estadisticas.controller.js";
import { EstadisticasService } from "./estadisticas.service.js";
import {
  Comentario,
  ComentarioSchema,
} from "../comentarios/entities/comentario.entity.js";
import { PublicacionesModule } from "../publicaciones/publicaciones.module.js";
import { UsuariosModule } from "../usuarios/usuarios.module.js";

@Module({
  imports: [
    // Comentarios: el módulo de comentarios no exporta su colección, así que la registramos acá.
    MongooseModule.forFeature([
      { name: Comentario.name, schema: ComentarioSchema },
    ]),
    // Publicaciones exporta su colección.
    PublicacionesModule,
    // AdminGuard necesita la colección de usuarios (mira el perfil en la base).
    UsuariosModule,
  ],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
