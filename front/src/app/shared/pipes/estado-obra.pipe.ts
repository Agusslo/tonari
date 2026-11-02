import { Pipe, PipeTransform } from '@angular/core';
import { EstadoEntrada, nombreEstado, TipoObra } from '../../core/interfaces/biblioteca';

// Pipe propia 2: {{ entrada.estado | estadoObra: entrada.tipo }} -> "Viendo", "Leyendo", "Completado"...
// El estado se guarda como 'en-curso' (un código), pero en pantalla depende del tipo:
// un anime lo estás "Viendo" y un manga lo estás "Leyendo".
// Recibe un parámetro extra (el tipo), que va después de los dos puntos.
// Antes cada componente tenía "protected readonly nombreEstado = nombreEstado" para
// poder llamar a la función desde el HTML; con la pipe, el template la usa directo.
@Pipe({ name: 'estadoObra' })
export class EstadoObraPipe implements PipeTransform {
  transform(estado: EstadoEntrada, tipo: TipoObra): string {
    return nombreEstado(estado, tipo);
  }
}
