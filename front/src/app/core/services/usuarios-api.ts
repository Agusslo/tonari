import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { IPerfilPublico, IResumenSeguir, IUsuarioAdmin } from '../interfaces/usuario';
import { DatosRegistro } from './auth';
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

  // GET /usuarios/:id/contrasena -> si mi cuenta tiene contraseña (las de Google, no).
  estadoContrasena(id: string) {
    return this.http.get<{ tieneContraseña: boolean }>(`${this.url}/${id}/contrasena`);
  }

  // PATCH /usuarios/:id/contrasena -> crear (cuenta de Google) o cambiar mi contraseña.
  // contraseñaActual solo va si la cuenta ya tenía una.
  cambiarContrasena(id: string, datos: { contraseñaActual?: string; contraseñaNueva: string }) {
    return this.http.patch<{ tieneContraseña: boolean }>(`${this.url}/${id}/contrasena`, datos);
  }

  // ---------- Dashboard del administrador (Sprint 4) ----------
  // Las cuatro rutas tienen AdminGuard en el back: si no sos administrador, 403.

  // GET /usuarios -> todos los usuarios (habilitados y deshabilitados), los más nuevos primero.
  listar() {
    return this.http.get<IUsuarioAdmin[]>(this.url);
  }

  // POST /usuarios -> crear un usuario con los datos del registro + el perfil.
  // Va como FormData (multipart) porque lleva la imagen, igual que el registro.
  crear(datos: DatosRegistro & { perfil: IUsuarioAdmin['perfil'] }, imagenPerfil: File) {
    const formData = new FormData();
    for (const [campo, valor] of Object.entries(datos)) {
      formData.append(campo, valor);
    }
    formData.append('imagenPerfil', imagenPerfil);
    return this.http.post<IUsuarioAdmin>(this.url, formData);
  }

  // DELETE /usuarios/:id -> deshabilitar (baja lógica: el usuario no se borra).
  deshabilitar(id: string) {
    return this.http.delete<IUsuarioAdmin>(`${this.url}/${id}`);
  }

  // POST /usuarios/:id/habilitar -> volver a habilitar (alta lógica).
  habilitar(id: string) {
    return this.http.post<IUsuarioAdmin>(`${this.url}/${id}/habilitar`, {});
  }

  // PATCH /usuarios/:id/perfil -> darle o sacarle el rol de administrador.
  cambiarPerfil(id: string, perfil: IUsuarioAdmin['perfil']) {
    return this.http.patch<IUsuarioAdmin>(`${this.url}/${id}/perfil`, { perfil });
  }
}
