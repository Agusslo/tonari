import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import IPublicacion, { IPaginaPublicaciones, IParametrosListado } from '../interfaces/publicacion';

// Todo lo que habla con /publicaciones del back pasa por acá.
// (Se llama "PublicacionesApi" para no confundirse con la pantalla "Publicaciones".)
@Service()
export class PublicacionesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/publicaciones`;

  // GET /publicaciones?orden=...&offset=...&limit=...
  // { params } arma la parte de después del "?" a partir de un objeto.
  listar(parametros: IParametrosListado = {}) {
    // Sacamos los que vengan vacíos: HttpClient no acepta valores undefined.
    const params = Object.fromEntries(
      Object.entries(parametros).filter(([, valor]) => valor !== undefined),
    );
    return this.http.get<IPaginaPublicaciones>(this.url, { params });
  }

  // GET /publicaciones/:id -> una sola publicación (para la página Publicación)
  obtener(id: string) {
    return this.http.get<IPublicacion>(`${this.url}/${id}`);
  }

  // POST /publicaciones -> crea una publicación (multipart/form-data porque
  // puede llevar una imagen; con JSON no se puede mandar un archivo).
  crear(datos: { titulo: string; descripcion: string; usuario: string }, imagen: File | null) {
    const formData = new FormData();
    formData.append('titulo', datos.titulo);
    formData.append('descripcion', datos.descripcion);
    formData.append('usuario', datos.usuario);
    if (imagen) formData.append('imagen', imagen); // opcional
    return this.http.post<IPublicacion>(this.url, formData);
  }

  // POST /publicaciones/:id/me-gusta -> devuelve la publicación actualizada
  darMeGusta(id: string, usuario: string) {
    return this.http.post<IPublicacion>(`${this.url}/${id}/me-gusta`, { usuario });
  }

  // DELETE /publicaciones/:id/me-gusta (el DELETE también puede llevar body)
  quitarMeGusta(id: string, usuario: string) {
    return this.http.delete<IPublicacion>(`${this.url}/${id}/me-gusta`, { body: { usuario } });
  }

  // DELETE /publicaciones/:id -> baja lógica
  eliminar(id: string, usuario: string) {
    return this.http.delete<{ mensaje: string }>(`${this.url}/${id}`, { body: { usuario } });
  }
}