import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import dns from 'node:dns';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // Algunos routers/proveedores responden mal las consultas DNS de tipo SRV
  // que usa "mongodb+srv://". En tu PC usamos DNS públicos (Google y Cloudflare).
  // En Vercel (process.env.VERCEL existe) no hace falta: su DNS anda bien.
  if (!process.env.VERCEL) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  const app = await NestFactory.create(AppModule);
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

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();