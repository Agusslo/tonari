import { Component } from "@angular/core";
import { MenuDashboard } from "../menu/menu";
import { Grafico } from "./grafico/grafico";

// Dashboard / Estadísticas (Sprint 4): tres gráficos de tipos distintos
// (barras, líneas y torta), cada uno con su propio rango de fechas.
@Component({
  selector: "app-dashboard-estadisticas",
  imports: [MenuDashboard, Grafico],
  templateUrl: "./estadisticas.html",
  styleUrl: "./estadisticas.css",
})
export class DashboardEstadisticas {}
