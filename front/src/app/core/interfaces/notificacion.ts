import { IAutor } from './publicacion';

// Notificaciones (extra): lo que devuelve GET /notificaciones.
export type TipoNotificacion = 'meGusta' | 'seguir' | 'comentario' | 'respuesta';

export interface INotificacion {
  _id: string;
  tipo: TipoNotificacion;
  autor: IAutor; // quién hizo la acción (populado)
  publicacion?: { _id: string; titulo: string; imagen?: string }; // todas menos "seguir"
  comentario?: { _id: string; mensaje: string }; // en "comentario" y "respuesta"
  leida: boolean;
  createdAt: string;
}

export interface IListaNotificaciones {
  notificaciones: INotificacion[];
  total: number;
  noLeidas: number;
  offset: number;
  limit: number;
}
