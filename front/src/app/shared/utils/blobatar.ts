// Blobatar (https://blobatar.dev): un avatar generado a partir de un texto.
// Usamos el nombre de usuario, que es único: cada cuenta tiene el suyo y siempre el mismo.
// Es la misma URL que guarda el back cuando alguien se registra sin foto.
export function urlBlobatar(nombreUsuario: string) {
  return `https://blobatar.dev/avatar/${encodeURIComponent(nombreUsuario)}`;
}
