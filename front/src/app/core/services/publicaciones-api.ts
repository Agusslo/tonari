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