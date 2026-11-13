import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

// Encabezado del dashboard (Sprint 4) con las dos pestañas: Usuarios y Estadísticas.
@Component({
  selector: "app-menu-dashboard",
  imports: [RouterLink, RouterLinkActive],
  templateUrl: "./menu.html",
  styleUrl: "./menu.css",
})
export class MenuDashboard {}
