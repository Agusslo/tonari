import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Usuario, UsuarioSchema } from './entities/usuario.entity.js';

@Module({
imports: [
    MongooseModule.forFeature([{ name: Usuario.name, schema: UsuarioSchema }]),
],
// Exporta el acceso a la colección para que el módulo de autenticación pueda usarla.
exports: [MongooseModule],
})
export class UsuariosModule {}