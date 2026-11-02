// Se usa con "ng build" (producción, el deploy en Vercel).
// apiUrl: la URL pública del back en Vercel. Sin "/" al final:
// los servicios le agregan "/auth/login", "/publicaciones", etc.
export const environment = {
    apiUrl: 'https://tonari-back.vercel.app',
    // Client ID de Google (ingreso con Google). No es secreto: viaja en el botón
    // y cualquiera lo ve en el navegador. Lo secreto es el "client secret", que no usamos.
    googleClientId: '154479107950-pr8c63p9v2ddbmcokjd9l9ur760rbut4.apps.googleusercontent.com',
};
