import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { fechaLocalHoy } from '../../../shared/validators/validadores';

// Encabezado del dashboard (Sprint 4): título, la fecha de hoy y las dos
// pestañas (Usuarios y Estadísticas).
@Component({
  selector: 'app-menu-dashboard',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './menu.html',
  styleUrl: './menu.css',
})
export class MenuDashboard {
  protected readonly hoyIso = fechaLocalHoy();
  // "jueves 13 de noviembre" (con mayúscula adelante)
  protected readonly hoyTexto = capitalizar(
    new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
  );
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
