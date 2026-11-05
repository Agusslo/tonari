import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';

// "Cuentas vinculadas" (extra): con qué podés ingresar a TONARI.
export interface ICuentas {
  contraseña: boolean;
  google: { correo: string } | null;
  discord: { id: string; usuario: string; mostrar: boolean } | null;
}

export type Proveedor = 'google' | 'discord';

// Habla con /auth/cuentas. El back siempre trabaja sobre el usuario del token,
// por eso no hay ningún id en las URLs. Todas devuelven el estado actualizado.
@Service()
export class CuentasApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auth/cuentas`;

  // GET /auth/cuentas
  estado() {
    return this.http.get<ICuentas>(this.url);
  }

  // POST /auth/cuentas/google: la credencial que dio el botón de Google + el nonce.
  vincularGoogle(credential: string, nonce: string) {
    return this.http.post<ICuentas>(`${this.url}/google`, { credential, nonce });
  }

  // POST /auth/cuentas/discord: el ticket que dio el back al volver de Discord + el nonce.
  vincularDiscord(ticket: string, nonce: string) {
    return this.http.post<ICuentas>(`${this.url}/discord`, { ticket, nonce });
  }

  // DELETE /auth/cuentas/google o /auth/cuentas/discord
  desvincular(proveedor: Proveedor) {
    return this.http.delete<ICuentas>(`${this.url}/${proveedor}`);
  }

  // PATCH /auth/cuentas/discord: mostrar u ocultar mi Discord en el perfil público.
  mostrarDiscord(mostrar: boolean) {
    return this.http.patch<ICuentas>(`${this.url}/discord`, { mostrar });
  }
}
