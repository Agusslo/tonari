import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { IPerfilPublico } from '../interfaces/usuario';

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
}
