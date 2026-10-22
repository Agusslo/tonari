import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // NestExpressApplication: le dice a TypeScript que usamos Express,
  // así tenemos disponible useStaticAssets.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Valida todos los @Body() contra su DTO antes de llegar al controller.
  // whitelist: borra los campos que no estén declarados (con decoradores) en el DTO.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Sirve los archivos de la carpeta "uploads" como públicos:
  // back/uploads/perfiles/foto.png -> http://localhost:3000/uploads/perfiles/foto.png
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
