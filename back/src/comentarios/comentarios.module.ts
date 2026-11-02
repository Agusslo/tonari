import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComentariosService } from './comentarios.service.js';
import { ComentariosController } from './comentarios.controller.js';
import { Comentario, ComentarioSchema } from './entities/comentario.entity.js';
import { PublicacionesModule } from '../publicaciones/publicaciones.module.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';

@Module({
  imports: [
    // La colección de comentarios, propia de este módulo.
    MongooseModule.forFeature([{ name: Comentario.name, schema: ComentarioSchema }]),
    // PublicacionesModule exporta su colección: la usamos para verificar que la
    // publicación exista y para sumarle 1 al contador de comentarios.
    PublicacionesModule,
    // Para avisar "comentó tu publicación" y "respondió tu comentario".
    NotificacionesModule,
  ],
  controllers: [ComentariosController],
  providers: [ComentariosService],
})
export class ComentariosModule {}
