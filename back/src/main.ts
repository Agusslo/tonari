import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Valida todos los @Body() contra su DTO antes de llegar al controller.
  // whitelist: borra los campos que no estén declarados (con decoradores) en el DTO.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();