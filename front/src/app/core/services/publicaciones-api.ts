    import { HttpClient } from '@angular/common/http';
    import { inject, Service } from '@angular/core';
    import { environment } from '../../../environments/environment';
    import { IPaginaPublicaciones, IParametrosListado } from '../interfaces/publicacion';

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
    }