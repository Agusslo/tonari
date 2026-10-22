import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    // Conexión única a MongoDB para toda la app.
    // Usa MONGO_URI si existe (por ejemplo Atlas); si no, el Mongo local de Compass.
    MongooseModule.forRoot(
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/tonari',
    ),
    UsuariosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
