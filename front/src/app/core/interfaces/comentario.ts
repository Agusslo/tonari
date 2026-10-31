import { IAutor } from './publicacion';

// Forma de un comentario tal como lo devuelve el back.
export default interface IComentario {
  _id: string;
  mensaje: string;
  publicacion: string; // _id de la publicación a la que pertenece
  usuario: IAutor; // el autor viene "populado", igual que en las publicaciones
  modificado: boolean; // true si el autor lo editó (el front muestra "editado")
  respondeA?: string | null; // si es una respuesta: el _id del comentario principal
  cantidadRespuestas?: number; // los comentarios viejos no lo tienen (= 0)
  createdAt: string; // la fecha del comentario
  updatedAt: string;
}

// Lo que devuelve GET /publicaciones/:id/comentarios: una "página" y el total.
export interface IPaginaComentarios {
  comentarios: IComentario[];
  total: number;
  offset: number;
  limit: number;
}
