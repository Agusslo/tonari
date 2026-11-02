import { Pipe, PipeTransform } from '@angular/core';

// Pipe propia 3: {{ publicacion.cantidadMeGusta | numeroCorto }} -> 1.250 se ve "1,2 k".
// Como en las redes: un número grande ocupa poco y se lee de un vistazo.
//   0 a 999          -> igual (999)
//   1.000 a 999.999  -> en miles, con un decimal (1,2 k · 15,3 k · 999,9 k)
//   1.000.000 o más  -> en millones (1,5 M)
// Redondea siempre para abajo (Math.floor): 999.999 no puede decir "1000 k".
// Escribimos la regla nosotros porque Intl.NumberFormat 'compact' en español
// mezcla "K" y "k" según el número.
@Pipe({ name: 'numeroCorto' })
export class NumeroCortoPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) return '0';
    if (valor < 1000) return String(valor);
    if (valor < 1_000_000) return `${conUnDecimal(valor / 1000)} k`;
    return `${conUnDecimal(valor / 1_000_000)} M`;
  }
}

// 1.25 -> "1,2" y 15 -> "15" (con coma decimal, como se escribe en Argentina).
function conUnDecimal(numero: number) {
  return (Math.floor(numero * 10) / 10).toLocaleString('es-AR', { maximumFractionDigits: 1 });
}
