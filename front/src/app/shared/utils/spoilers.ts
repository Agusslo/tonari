// Spoilers en el texto (extra): lo que se escribe entre dos barras dobles queda tapado,
// como en Discord:  "El final es ||que gana Frieren||"  ->  "El final es ▒▒▒▒▒▒".
// [\s\S]+? = cualquier cosa (también saltos de línea), lo más corta posible:
// así "||a|| y ||b||" son DOS spoilers y no uno solo de "a|| y ||b".
const PATRON_SPOILER = /\|\|([\s\S]+?)\|\|/g;

export interface ParteTexto {
  texto: string;
  spoiler: boolean;
}

// Corta el texto en partes normales y partes spoiler (para mostrarlas distinto).
export function partirSpoilers(texto: string): ParteTexto[] {
  const partes: ParteTexto[] = [];
  let desde = 0;
  for (const encontrado of texto.matchAll(PATRON_SPOILER)) {
    const inicio = encontrado.index;
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), spoiler: false });
    partes.push({ texto: encontrado[1], spoiler: true });
    desde = inicio + encontrado[0].length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), spoiler: false });
  return partes;
}

// Para los lugares donde no se puede tocar para ver (extractos, avisos): lo reemplaza.
export function ocultarSpoilers(texto: string) {
  return texto.replace(PATRON_SPOILER, '[spoiler]');
}
