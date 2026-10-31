import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { IPerfilPublico, IResumenSeguir } from '../interfaces/usuario';
import { IAutor } from '../interfaces/publicacion';

// Habla con /usuarios del back (el token lo pone el interceptor).
// Editar MI perfil sigue estando en Auth (porque actualiza el usuario logueado).
@Service()
export class UsuariosApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios`;

  // GET /usuarios/beto -> el perfil público de otro usuario.
  // encodeURIComponent: por si el nombre de usuario tiene algún carácter raro para una URL.
  perfil(nombreUsuario: string) {
    return this.http.get<IPerfilPublico>(`${this.url}/${encodeURIComponent(nombreUsuario)}`);
  }

  // "Seguir" (extra). Quién sigue lo decide el back con el token: acá va solo a quién.
  seguir(id: string) {
    return this.http.post<IResumenSeguir>(`${this.url}/${id}/seguir`, {});
  }

  dejarDeSeguir(id: string) {
    return this.http.delete<IResumenSeguir>(`${this.url}/${id}/seguir`);
  }

  // GET /usuarios/beto/seguidores o /usuarios/beto/siguiendo
  personas(nombreUsuario: string, cual: 'seguidores' | 'siguiendo') {
    return this.http.get<IAutor[]>(`${this.url}/${encodeURIComponent(nombreUsuario)}/${cual}`);
  }
}
