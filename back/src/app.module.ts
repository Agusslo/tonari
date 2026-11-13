import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PublicacionesModule } from './publicaciones/publicaciones.module.js';
import { ComentariosModule } from './comentarios/comentarios.module.js';
import { BibliotecaModule } from './biblioteca/biblioteca.module.js';
import { CatalogoModule } from './catalogo/catalogo.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { EstadisticasModule } from './estadisticas/estadisticas.module.js';

@Module({
  imports: [
    // Lee el archivo back/.env y carga sus variables.
    // isGlobal: cualquier módulo puede usar ConfigService sin importarlo de nuevo.
    ConfigModule.forRoot({ isGlobal: true }),

    // Conexión única a MongoDB (Atlas) para toda la app.
    // forRootAsync + useFactory: espera a que ConfigModule haya leído el .env
    // antes de conectarse (evita el bug del .env de la clase 14).
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),

    UsuariosModule,
    AuthModule,
    PublicacionesModule,
    ComentariosModule,
    BibliotecaModule,
    CatalogoModule,
    NotificacionesModule,
    // Dashboard del administrador (Sprint 4): datos para los gráficos.
    EstadisticasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
