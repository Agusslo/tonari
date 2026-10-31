import { TipoObra } from '../../core/interfaces/biblioteca';

// "Slug": un texto convertido a algo que queda lindo en una URL.
// "Sousou no Frieren: ¡Más allá!" -> "sousou-no-frieren-mas-alla"
//  - normalize('NFD') separa cada letra de su acento ("á" -> "a" + "´")
//    y el replace borra esos acentos sueltos.
//  - todo lo que no sea letra o número pasa a ser un guion.
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// La URL de la ficha de una obra: /biblioteca/anime/154587-sousou-no-frieren
// El número (id de AniList) es lo que usa la app para encontrarla;
// el texto de después es solo para que se lea lindo.
export function rutaFicha(obra: { tipo: TipoObra; idAnilist: number; titulo: string }) {
  const texto = slug(obra.titulo);
  return ['/biblioteca', obra.tipo, texto ? `${obra.idAnilist}-${texto}` : `${obra.idAnilist}`];
}
