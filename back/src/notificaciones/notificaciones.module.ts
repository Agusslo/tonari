import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notificacion, NotificacionSchema } from './entities/notificacion.entity.js';
import { NotificacionesService } from './notificaciones.service.js';
import { NotificacionesController } from './notificaciones.controller.js';

// Este módulo NO importa a usuarios, publicaciones ni comentarios: son ellos los que
// lo importan a él para avisar. Si se importaran mutuamente, Nest no podría
// decidir cuál crear primero (dependencia circular).
@Module({
  imports: [MongooseModule.forFeature([{ name: Notificacion.name, schema: NotificacionSchema }])],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  // Exporta el servicio para que los otros módulos puedan llamar a avisar() y retirar().
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
