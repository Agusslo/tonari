import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { IAutor } from '../interfaces/publicacion';

// Lo que devuelve GET /buscar?q=... (hasta 5 de cada uno).
export interface IResultadosBusqueda {
  usuarios: IAutor[];
  publicaciones: {
    _id: string;
    titulo: string;
    imagen?: string;
    createdAt: string;
    cantidadMeGusta: number;
    cantidadComentarios: number;
    usuario: { _id: string; nombreUsuario: string };
  }[];
}

// Buscador global (extra): el de la barra de arriba.
@Service()
export class BuscarApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/buscar`;

  // GET /buscar?q=texto
  buscar(texto: string) {
    return this.http.get<IResultadosBusqueda>(this.url, { params: { q: texto } });
  }
}
