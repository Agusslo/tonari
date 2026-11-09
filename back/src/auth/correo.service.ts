import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { LINEA_PNG, MARCA_PNG } from './correo-imagenes.js';

// Manda correos (extra, para "Olvidé mi contraseña") con nodemailer por SMTP.
// SMTP es el "idioma" estándar para mandar mails: sirve con Gmail, Outlook, Brevo, etc.
// Los datos van en el .env (y en Vercel):
//   SMTP_HOST, SMTP_PUERTO, SMTP_USUARIO, SMTP_CLAVE, CORREO_REMITENTE
//
// Sin SMTP configurado:
//   - en tu PC: no manda nada y muestra el link en la consola del back (para probar).
//   - en Vercel: responde 503, porque ahí nadie ve la consola y el link se perdería.
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);

  constructor(private readonly config: ConfigService) {}

  async enviarRecuperacion(destino: string, nombre: string, link: string) {
    const asunto = 'Elegí tu contraseña nueva · TONARI';
    // Dos versiones: texto plano (por si el programa de correo no muestra HTML) y HTML.
    const texto = [
      `Hola ${nombre}:`,
      '',
      'Pediste cambiar tu contraseña de TONARI. Entrá a este link para elegir una nueva:',
      link,
      '',
      'El link sirve una sola vez y vence en 30 minutos.',
      'Si no fuiste vos, ignorá este correo: tu contraseña sigue siendo la misma.',
    ].join('\n');

    const transporte = this.transporte();
    if (!transporte) {
      if (process.env.VERCEL) {
        throw new ServiceUnavailableException('El envío de correos no está configurado'); // 503
      }
      this.logger.warn(`SMTP sin configurar. Link para ${destino}: ${link}`);
      return;
    }

    try {
      await transporte.sendMail({
        from: this.config.get<string>('CORREO_REMITENTE') ?? this.config.get<string>('SMTP_USUARIO'),
        to: destino,
        subject: asunto,
        text: texto,
        html: htmlRecuperacion(nombre, link),
        // Las imágenes van adentro del mail. "cid" es el nombre con el que el HTML
        // las usa: <img src="cid:marca">. Así no dependen de ninguna página publicada.
        attachments: [
          { filename: 'tonari.png', content: Buffer.from(MARCA_PNG, 'base64'), cid: 'marca' },
          { filename: 'linea.png', content: Buffer.from(LINEA_PNG, 'base64'), cid: 'linea' },
        ],
      });
    } catch (error) {
      // El detalle (usuario/clave mal, Gmail bloqueó, etc.) queda en la consola;
      // a la persona le decimos algo entendible.
      this.logger.error(`No se pudo mandar el correo: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'No pudimos mandar el correo. Probá de nuevo en un rato',
      ); // 503
    }
  }

  // Arma la conexión al servidor de correo, o null si falta configurarlo.
  private transporte() {
    const host = this.config.get<string>('SMTP_HOST');
    const usuario = this.config.get<string>('SMTP_USUARIO');
    const clave = this.config.get<string>('SMTP_CLAVE');
    if (!host || !usuario || !clave) return null;

    const puerto = Number(this.config.get<string>('SMTP_PUERTO') ?? 465);
    return nodemailer.createTransport({
      host,
      port: puerto,
      // 465 = conexión cifrada desde el principio. 587 = arranca normal y después se cifra (STARTTLS).
      secure: puerto === 465,
      auth: { user: usuario, pass: clave },
      // Si el servidor de correo no contesta, cortamos a los pocos segundos (sin esto,
      // nodemailer espera hasta 10 minutos y la ruedita del front queda girando).
      connectionTimeout: 10_000, // conectarse
      greetingTimeout: 10_000, // que el servidor salude
      socketTimeout: 20_000, // que conteste durante el envío
    });
  }
}

// El mail con la estética de TONARI (la misma de la página: fondo noche, panel,
// kicker en japonés, título grueso con una palabra en menta, botón píldora).
// Reglas de los mails, distintas a una página:
//   - Estilos "inline" (style="..."): Gmail y casi todos ignoran las etiquetas <style>.
//   - Maquetado con <table>: Outlook no entiende flex ni grid.
//   - Sin fuentes de Google: los programas de correo no las cargan. El título usa
//     "Arial Black" (la más parecida a Dela Gothic que tienen todas las compus), y el
//     logo con "TONARI" y "となり" va como imagen PNG para que se vea igual que en la página.
//   - Sin SVG: Gmail no los muestra. Por eso marca.png y linea.png (en correo-imagenes.ts),
//     que viajan adjuntas en el mismo mail y el HTML las usa con "cid:".
function htmlRecuperacion(nombre: string, link: string) {
  const fuente = "'Zen Kaku Gothic New',Arial,Helvetica,sans-serif";
  const fuenteTitulo = "'Dela Gothic One','Arial Black',Arial,sans-serif";
  const url = escapar(link);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Elegí tu contraseña nueva</title>
</head>
<body style="margin:0;padding:0;background:#111116">
<!-- Texto de vista previa (lo que se ve en la bandeja al lado del asunto) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tocá el botón para elegir tu contraseña nueva. El link vence en 30 minutos.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#111116">
<tr><td align="center" style="padding:36px 14px 28px">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px">

    <!-- Logo, igual que la cabecera de la página -->
    <tr><td style="padding:0 6px 22px">
      <img src="cid:marca" width="229" height="38" alt="TONARI · となり" style="display:block;border:0;color:#f0ede5;font:700 20px ${fuenteTitulo}">
    </td></tr>

    <!-- El panel -->
    <tr><td style="background:#18181f;border:1px solid #26262e;border-radius:24px;overflow:hidden">
      <img src="cid:linea" width="520" height="3" alt="" style="display:block;width:100%;height:3px;border:0">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td style="padding:34px 34px 32px;font-family:${fuente}">

        <!-- Kicker: la rayita + "contraseña" en japonés, como en la pantalla -->
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:4px;color:#b9f3e4"><span style="display:inline-block;width:24px;height:1px;background:#b9f3e4;vertical-align:middle;margin-right:10px"></span><span lang="ja">パスワード</span></p>

        <h1 style="margin:0 0 18px;font-family:${fuenteTitulo};font-size:30px;line-height:1.15;font-weight:900;color:#f0ede5">Elegí tu contraseña <span style="color:#b9f3e4">nueva.</span></h1>

        <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#f0ede5">Hola ${escapar(nombre)}, pediste cambiar tu contraseña de TONARI. Tocá el botón y elegí una nueva.</p>

        <!-- Botón píldora menta -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="border-radius:999px;background:#b9f3e4">
          <a href="${url}" style="display:inline-block;padding:15px 30px;font-family:${fuente};font-size:16px;font-weight:700;color:#111116;text-decoration:none;border-radius:999px">Elegir contraseña&nbsp;&nbsp;&rarr;</a>
        </td></tr>
        </table>

        <!-- Aviso con el velo menta, como los avisos de la página -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 0">
        <tr><td style="padding:13px 16px;background:#1f2a29;border-radius:12px;font-size:14px;line-height:1.5;color:#b9f3e4">
          &#9201;&nbsp; Sirve una sola vez y vence en <strong>30 minutos</strong>.
        </td></tr>
        </table>

        <!-- Por si el botón no anda (algunos programas de correo bloquean los botones) -->
        <p style="margin:24px 0 6px;font-size:13px;line-height:1.5;color:#a6a4b0">¿El botón no anda? Copiá este link en el navegador:</p>
        <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all"><a href="${url}" style="color:#b9f3e4;text-decoration:underline">${url}</a></p>

        <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #26262e;font-size:13px;line-height:1.6;color:#a6a4b0">Si no fuiste vos, ignorá este correo: tu contraseña sigue siendo la misma y nadie puede cambiarla sin este link.</p>

      </td></tr>
      </table>
    </td></tr>

    <!-- Pie, igual que el de la página -->
    <tr><td style="padding:22px 6px 0;font-family:${fuente};font-size:12px;color:#a6a4b0">
      TONARI · <span lang="ja">となり</span> &nbsp;&nbsp;—&nbsp;&nbsp; Un mundo más cerca.
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

// El nombre lo escribió la persona: si tuviera "<" o comillas, rompería el HTML del mail.
function escapar(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
