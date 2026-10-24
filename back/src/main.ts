import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // NestExpressApplication: le dice a TypeScript que usamos Express,
  // así tenemos disponible useStaticAssets.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // CORS: el front corre en otro origen (otro puerto en tu PC, otro dominio en
  // el deploy), y el navegador bloquea esos pedidos salvo que el back los permita.
  // URL_FRONT puede tener varias URLs separadas por coma.
  app.enableCors({
    origin: config.get<string>('URL_FRONT', 'http://localhost:4200').split(','),
  });

  // Valida todos los @Body() y @Query() contra su DTO antes de llegar al controller.
  // whitelist: borra los campos que no estén declarados (con decoradores) en el DTO.
  // transform: entrega al controller el DTO ya convertido (por ejemplo, "10" -> 10)
  // y con sus valores por defecto.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Sirve los archivos de la carpeta "uploads" como públicos:
  // back/uploads/perfiles/foto.png -> http://localhost:3000/uploads/perfiles/foto.png
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();