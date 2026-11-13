import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';

// Las tres estadísticas del dashboard (Sprint 4). Solo administradores (AdminGuard en el back).
export type Estadistica =
  'publicaciones-por-usuario' | 'comentarios' | 'comentarios-por-publicacion';

// Lo que devuelve cada ruta: el rango que se usó y los datos para el gráfico.
export interface IPublicacionesPorUsuario {
  desde: string;
  hasta: string;
  datos: { nombreUsuario: string; nombre: string; imagenPerfil?: string; cantidad: number }[];
}

export interface IComentariosPorDia {
  desde: string;
  hasta: string;
  total: number;
  datos: { fecha: string; cantidad: number }[]; // un elemento por día, con 0 si no hubo
}

export interface IComentariosPorPublicacion {
  desde: string;
  hasta: string;
  total: number;
  datos: { id: string | null; titulo: string; cantidad: number }[]; // id null = "Otras"
}

export interface RespuestaEstadistica {
  'publicaciones-por-usuario': IPublicacionesPorUsuario;
  comentarios: IComentariosPorDia;
  'comentarios-por-publicacion': IComentariosPorPublicacion;
}

@Service()
export class EstadisticasApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/estadisticas`;

  // GET /estadisticas/<cual>?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
  obtener<T extends Estadistica>(cual: T, desde: string, hasta: string) {
    return this.http.get<RespuestaEstadistica[T]>(`${this.url}/${cual}`, {
      params: { desde, hasta },
    });
  }
}
