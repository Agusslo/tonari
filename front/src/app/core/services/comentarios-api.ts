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
  // Con imagen (extra) va como multipart/form-data; sin imagen, JSON como siempre.
  crear(publicacionId: string, mensaje: string, imagen: File | null = null) {
    return this.http.post<IComentario>(
      `${this.url}/publicaciones/${publicacionId}/comentarios`,
      cuerpo(mensaje, imagen),
    );
  }

  // GET /comentarios/:id/respuestas?offset=...&limit=... (en orden de llegada)
  listarRespuestas(comentarioId: string, offset = 0, limit = 5) {
    return this.http.get<IPaginaComentarios>(`${this.url}/comentarios/${comentarioId}/respuestas`, {
      params: { offset, limit },
    });
  }

  // POST /comentarios/:id/respuestas -> devuelve la respuesta creada
  responder(comentarioId: string, mensaje: string, imagen: File | null = null) {
    return this.http.post<IComentario>(
      `${this.url}/comentarios/${comentarioId}/respuestas`,
      cuerpo(mensaje, imagen),
    );
  }

  // PUT /comentarios/:id -> devuelve el comentario editado (modificado: true)
  editar(id: string, mensaje: string) {
    return this.http.put<IComentario>(`${this.url}/comentarios/${id}`, { mensaje });
  }
}

// Sin imagen: { mensaje } en JSON. Con imagen: FormData (un archivo no viaja en JSON).
function cuerpo(mensaje: string, imagen: File | null) {
  if (!imagen) return { mensaje };
  const formData = new FormData();
  formData.append('mensaje', mensaje);
  formData.append('imagen', imagen);
  return formData;
}
