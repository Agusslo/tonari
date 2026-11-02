import { afterNextRender, Directive, DoCheck, ElementRef, inject } from '@angular/core';

// Directiva propia 1: <textarea appAutoAltura> crece (y se achica) con lo que escribís,
// así no aparece una barrita de scroll adentro de un campo chiquito.
// Hay una forma solo con CSS (field-sizing: content), pero Firefox y Safari todavía
// no la soportan; con la directiva anda en todos los navegadores.
//
// Una directiva de atributo no tiene template: se "pega" a un elemento que ya existe
// (acá, el textarea) y le cambia el comportamiento. ElementRef es ese elemento.
@Directive({
  selector: 'textarea[appAutoAltura]',
  // host: escucha el evento "input" del textarea (cada tecla, pegar, borrar).
  host: { '(input)': 'ajustar()' },
})
export class AutoAlturaDirective implements DoCheck {
  private readonly textarea = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;
  private ultimoValor = '';

  constructor() {
    // Al aparecer (por ejemplo, al editar un comentario largo): ya del tamaño justo.
    afterNextRender(() => this.ajustar());
  }

  // ngDoCheck corre en cada revisión de Angular. Lo usamos para el caso en que el texto
  // cambia sin que escribas: después de enviar, el formulario se resetea a '' y el
  // campo tiene que volver a achicarse (eso no dispara "input").
  ngDoCheck() {
    if (this.textarea.value !== this.ultimoValor) this.ajustar();
  }

  protected ajustar() {
    this.ultimoValor = this.textarea.value;
    // 1. 'auto': vuelve al alto natural (las filas de "rows"), así también se achica.
    // 2. scrollHeight: lo que mide el texto completo. Se suman los bordes porque con
    //    box-sizing: border-box el height los incluye y scrollHeight no.
    this.textarea.style.height = 'auto';
    const bordes = this.textarea.offsetHeight - this.textarea.clientHeight;
    this.textarea.style.height = `${this.textarea.scrollHeight + bordes}px`;
  }
}
