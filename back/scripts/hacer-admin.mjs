// Convierte una cuenta en administrador (o la vuelve usuario) directo en la base.
// Sirve para crear el PRIMER administrador: desde la app solo un admin puede hacer admins.
//
// Uso (parado en la carpeta back):
//   node scripts/hacer-admin.mjs pepo            -> @pepo pasa a administrador
//   node scripts/hacer-admin.mjs pepo usuario    -> @pepo vuelve a ser usuario
//
// Usa la MONGO_URI del back/.env (la misma base que la app).
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ quiet: true });

const [nombreUsuario, perfil = 'administrador'] = process.argv.slice(2);

if (!nombreUsuario || !['usuario', 'administrador'].includes(perfil)) {
  console.log('Uso: node scripts/hacer-admin.mjs <nombreUsuario> [usuario|administrador]');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.log('Falta MONGO_URI en back/.env');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);
  const resultado = await mongoose.connection
    .collection('Usuarios')
    .findOneAndUpdate({ nombreUsuario }, { $set: { perfil } }, { returnDocument: 'after' });

  // Según la versión del driver, devuelve el documento o { value: documento }.
  const usuario = resultado && 'value' in resultado ? resultado.value : resultado;
  if (!usuario) {
    console.log(`No existe ningún usuario @${nombreUsuario}`);
    process.exitCode = 1;
  } else {
    console.log(`Listo: @${usuario.nombreUsuario} ahora es ${usuario.perfil}.`);
    console.log('Cerrá sesión en TONARI y volvé a entrar para ver el Dashboard.');
  }
} catch (error) {
  console.log('No se pudo conectar o actualizar:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
