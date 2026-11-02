import { Directive, ElementRef, inject, output } from '@angular/core';

// Directiva propia 3: (appClickAfuera)="cerrar()" avisa cuando hacés clic FUERA del
// elemento. Sirve para paneles que se cierran tocando en cualquier otro lado, como el
// buscador de la biblioteca. Es como un evento nuevo que Angular no trae: el output
// se llama igual que la directiva, por eso se escribe como un evento.
@Directive({
  selector: '[appClickAfuera]',
  // document:click escucha los clics de TODA la página, no solo los del elemento.
  host: { '(document:click)': 'alHacerClic($event)' },
})
export class ClickAfueraDirective {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly appClickAfuera = output<void>();

  // El clic que ABRIÓ el panel también llega hasta document, ya con el panel en pantalla.
  // Si no lo ignoráramos, el panel se cerraría en el mismo instante en que se abre.
  // timeStamp: cuándo pasó el clic; solo cuentan los que pasan después de crear la directiva.
  private readonly creadaEn = performance.now();

  protected alHacerClic(evento: MouseEvent) {
    if (evento.timeStamp < this.creadaEn) return;
    // contains: ¿el clic fue en el elemento o en algo de adentro? Entonces no es "afuera".
    // isConnected: si lo que tocaste ya desapareció de la página (por ejemplo, un resultado
    // que se borra al elegirlo), no podemos saber dónde estaba: no cerramos por las dudas.
    const destino = evento.target as Node | null;
    if (!destino || !destino.isConnected || this.elemento.contains(destino)) return;
    this.appClickAfuera.emit();
  }
}
