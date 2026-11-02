import { Pipe, PipeTransform } from '@angular/core';

// Pipe propia 1: {{ publicacion.createdAt | tiempoRelativo }} -> "hace 5 min", "ayer"...
// Como en Twitter o Instagram: para algo reciente importa "cuánto hace", no la fecha exacta.
// Pasada la semana, muestra la fecha (dd/mm/aaaa), porque "hace 47 días" ya no se entiende.
//
// Es "pura" (el default): Angular solo la vuelve a calcular cuando cambia la fecha que
// recibe. Por eso "hace 1 min" no avanza solo mientras mirás; se actualiza al recargar o
// cuando la pantalla se vuelve a dibujar. A cambio, es muy barata.
@Pipe({ name: 'tiempoRelativo' })
export class TiempoRelativoPipe implements PipeTransform {
  transform(fecha: string | Date | null | undefined): string {
    if (!fecha) return '';
    const momento = new Date(fecha);
    if (Number.isNaN(momento.getTime())) return '';

    const segundos = Math.round((Date.now() - momento.getTime()) / 1000);
    // Un reloj un poco adelantado puede dar segundos negativos: lo tratamos como "recién".
    if (segundos < 60) return 'recién';

    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} min`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;

    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'ayer';
    if (dias < 7) return `hace ${dias} días`;

    // Hora argentina, igual que el resto de las fechas de TONARI.
    return momento.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }
}
