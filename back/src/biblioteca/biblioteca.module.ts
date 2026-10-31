import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BibliotecaController } from './biblioteca.controller.js';
import { BibliotecaService } from './biblioteca.service.js';
import { Entrada, EntradaSchema } from './entities/entrada.entity.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Entrada.name, schema: EntradaSchema }])],
  controllers: [BibliotecaController],
  providers: [BibliotecaService],
})
export class BibliotecaModule {}
