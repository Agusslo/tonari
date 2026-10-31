import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import IComentario, { IPaginaComentarios } from '../interfaces/comentario';

// Todo lo que habla con los comentarios del back pasa por acá.
// El token lo agrega el interceptor: acá nunca se manda quién comenta.
@Service()
export class ComentariosApi {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;

  // GET /publicaciones/:id/comentarios?offset=...&limit=... (los más nuevos primero)
  listar(publicacionId: string, offset = 0, limit = 5) {
    return this.http.get<IPaginaComentarios>(
      `${this.url}/publicaciones/${publicacionId}/comentarios`,
      { params: { offset, limit } },
    );
  }

  // POST /publicaciones/:id/comentarios -> devuelve el comentario creado
  crear(publicacionId: string, mensaje: string) {
    return this.http.post<IComentario>(
      `${this.url}/publicaciones/${publicacionId}/comentarios`,
      { mensaje },
    );
  }

  // GET /comentarios/:id/respuestas?offset=...&limit=... (en orden de llegada)
  listarRespuestas(comentarioId: string, offset = 0, limit = 5) {
    return this.http.get<IPaginaComentarios>(`${this.url}/comentarios/${comentarioId}/respuestas`, {
      params: { offset, limit },
    });
  }

  // POST /comentarios/:id/respuestas -> devuelve la respuesta creada
  responder(comentarioId: string, mensaje: string) {
    return this.http.post<IComentario>(`${this.url}/comentarios/${comentarioId}/respuestas`, {
      mensaje,
    });
  }

  // PUT /comentarios/:id -> devuelve el comentario editado (modificado: true)
  editar(id: string, mensaje: string) {
    return this.http.put<IComentario>(`${this.url}/comentarios/${id}`, { mensaje });
  }
}
