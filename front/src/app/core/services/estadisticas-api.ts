import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';

// Las estadísticas del dashboard: tres del Sprint 4 y tres del Sprint 5.
// Solo administradores (AdminGuard en el back).
export type Estadistica =
  | 'publicaciones-por-usuario'
  | 'comentarios'
  | 'comentarios-por-publicacion'
  | 'ingresos-por-usuario'
  | 'visitas-perfil'
  | 'me-gusta';

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

// Sprint 5: inicios de sesión de cada usuario (los 10 que más) y el total de todos.
export interface IIngresosPorUsuario extends IPublicacionesPorUsuario {
  total: number;
}

// Sprint 5: visitas a MI perfil por día, y cuántas personas distintas fueron.
export interface IVisitasPorDia extends IComentariosPorDia {
  visitantes: number;
}

export interface RespuestaEstadistica {
  'publicaciones-por-usuario': IPublicacionesPorUsuario;
  comentarios: IComentariosPorDia;
  'comentarios-por-publicacion': IComentariosPorPublicacion;
  'ingresos-por-usuario': IIngresosPorUsuario;
  'visitas-perfil': IVisitasPorDia;
  'me-gusta': IComentariosPorDia; // misma forma: un número por día
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
