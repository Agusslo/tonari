// Las fotos del celular suelen pesar de 3 a 10 MB, y el back acepta hasta 2 MB
// (y aunque aceptara más, Vercel corta los pedidos de más de 4,5 MB).
// Por eso, antes de subirla, el navegador la redibuja más chica en un <canvas>
// y la vuelve a comprimir: queda en unos cientos de KB y casi no se nota.

// Mismas reglas que el back (common/imagenes.ts).
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const PESO_MAXIMO_IMAGEN = 2 * 1024 * 1024; // 2 MB

const LADO_MAXIMO = 1600; // px del lado más largo: sobra para un avatar o una publicación

// Devuelve la misma imagen si ya pesa menos de 2 MB; si no, una versión achicada.
// Tira error si el navegador no la puede leer o si ni achicada baja de 2 MB.
export async function achicarImagen(archivo: File): Promise<File> {
  if (archivo.size <= PESO_MAXIMO_IMAGEN) return archivo;

  // createImageBitmap respeta la orientación de la foto (EXIF): no sale acostada.
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagen.width * escala);
  canvas.height = Math.round(imagen.height * escala);
  const contexto = canvas.getContext('2d')!;

  // WEBP es lo más liviano. Safari viejo no sabe generarlo (devuelve PNG):
  // en ese caso, JPG con fondo blanco (el JPG no tiene transparencia).
  contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  let blob = await aBlob(canvas, 'image/webp');
  if (blob?.type !== 'image/webp') {
    contexto.globalCompositeOperation = 'destination-over';
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    blob = await aBlob(canvas, 'image/jpeg');
  }
  imagen.close();

  if (!blob || blob.size > PESO_MAXIMO_IMAGEN) throw new Error('No se pudo achicar la imagen');
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], archivo.name.replace(/\.\w+$/, '') + '.' + extension, { type: blob.type });
}

// canvas.toBlob usa un callback: lo pasamos a promesa para poder usar await.
function aBlob(canvas: HTMLCanvasElement, tipo: string) {
  return new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, tipo, 0.85));
}
