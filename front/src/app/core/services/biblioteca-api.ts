import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import IEntrada, { EstadoEntrada, IObra, TipoObra } from '../interfaces/biblioteca';

// Lo que se puede cambiar de una obra de la biblioteca.
export interface CambiosEntrada {
  estado?: EstadoEntrada;
  progreso?: number;
  puntuacion?: number | null;
  total?: number | null; // lo manda la ficha si AniList ya sabe el total y nosotros no
}

// Habla con /biblioteca de NUESTRO back (el token lo pone el interceptor).
@Service()
export class BibliotecaApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/biblioteca`;

  // Mi biblioteca (o la de otro usuario, si se pasa su _id).
  listar(usuario?: string) {
    const params: Record<string, string> = usuario ? { usuario } : {};
    return this.http.get<IEntrada[]>(this.url, { params });
  }

  // Una obra de MI biblioteca por tipo + id de AniList (la ficha, con la URL linda).
  obtenerPorObra(tipo: TipoObra, idAnilist: number) {
    return this.http.get<IEntrada>(`${this.url}/obra/${tipo}/${idAnilist}`);
  }

  // Una obra sola, por su _id de Mongo.
  obtener(id: string) {
    return this.http.get<IEntrada>(`${this.url}/${id}`);
  }

  // Agrega una obra que vino del buscador (AniList).
  agregar(obra: IObra, estado: EstadoEntrada = 'pendiente') {
    return this.http.post<IEntrada>(this.url, {
      tipo: obra.tipo,
      idAnilist: obra.idAnilist,
      titulo: obra.titulo,
      imagen: obra.imagen,
      total: obra.total,
      estado,
    });
  }

  actualizar(id: string, cambios: CambiosEntrada) {
    return this.http.patch<IEntrada>(`${this.url}/${id}`, cambios);
  }

  eliminar(id: string) {
    return this.http.delete<{ mensaje: string }>(`${this.url}/${id}`);
  }
}
