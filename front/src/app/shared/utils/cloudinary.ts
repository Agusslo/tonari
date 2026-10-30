// Las fotos se guardan en Cloudinary tal cual se subieron (pueden ser grandes).
// Si el navegador las achica de golpe a un círculo chiquito, se ven granuladas.
// Cloudinary permite pedir la imagen ya transformada agregando parámetros a la URL:
//   c_fill,g_auto,w_,h_ -> recorte cuadrado centrado en lo importante (la cara)
//   q_auto,f_auto       -> buena calidad y el formato más liviano que soporte el navegador
// Las URLs que no son de Cloudinary (blobatar, vista previa local) quedan igual.
export function urlCuadrada(url: string, tam: number) {
  const marca = '/image/upload/';
  if (!url.includes('res.cloudinary.com') || !url.includes(marca)) return url;
  return url.replace(marca, `${marca}c_fill,g_auto,w_${tam},h_${tam}/q_auto:good/f_auto/`);
}
