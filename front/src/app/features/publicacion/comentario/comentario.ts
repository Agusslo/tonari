import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import IComentario from '../../../core/interfaces/comentario';
import IUsuario from '../../../core/interfaces/usuario';
import { ComentariosApi } from '../../../core/services/comentarios-api';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { TiempoRelativoPipe } from '../../../shared/pipes/tiempo-relativo.pipe';
import { AutoAlturaDirective } from '../../../shared/directives/auto-altura.directive';
import { TextoSpoiler } from '../../../shared/components/texto-spoiler/texto-spoiler';
import { ImagenAdjunta } from '../../../shared/utils/imagen-adjunta';
import { BotonImagen } from '../../../shared/components/imagen-adjunta/boton-imagen';
import { VistaImagen } from '../../../shared/components/imagen-adjunta/vista-imagen';
import { Modal } from '../../../shared/components/modal/modal';

// Cuántas respuestas se traen por vez ("Ver respuestas" y cada "Ver más").
const RESPUESTAS_POR_TANDA = 5;

// Un comentario de la lista. Si es tuyo, se puede editar ahí mismo:
// el texto se cambia por un campo con "Guardar" y "Cancelar".
// Cualquiera puede responderlo: las respuestas van debajo, en un solo nivel
// (este mismo componente se usa para cada respuesta, con esRespuesta = true).
@Component({
  selector: 'app-comentario',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Avatar, TiempoRelativoPipe, AutoAlturaDirective, TextoSpoiler, BotonImagen, VistaImagen, Modal],
  templateUrl: './comentario.html',
  styleUrl: './comentario.css',
})
export class Comentario {
  private readonly api = inject(ComentariosApi);

  readonly comentario = input.required<IComentario>();
  readonly usuario = input<IUsuario | null>(null); // quién está mirando
  readonly esRespuesta = input(false);

  // Avisa al padre que el comentario cambió, para que lo reemplace en su lista.
  readonly actualizado = output<IComentario>();
  // Una respuesta avisa a su comentario principal que quieren responderle
  // (el campo para escribir es uno solo, el del principal).
  readonly pideResponder = output<IComentario>();
  // Avisa a la página que se sumó una respuesta (para el contador de la publicación).
  readonly respondido = output<void>();
  // Avisa al padre que este comentario se borró, con cuántos se fueron
  // (un principal se lleva sus respuestas), para sacarlo de la lista y bajar contadores.
  readonly eliminado = output<number>();
  // Avisa a la página que se borró una respuesta de este hilo (contador de la publicación).
  readonly respuestaEliminada = output<void>();

  // Solo el autor puede editarlo (el back lo valida igual: si no, 403).
  protected readonly esMio = computed(
    () => this.usuario()?._id === this.comentario().usuario._id,
  );
  // Borrar: el autor o un administrador (igual que con las publicaciones).
  protected readonly puedeEliminar = computed(
    () => this.esMio() || this.usuario()?.perfil === 'administrador',
  );

  // ---------- Eliminar ----------
  protected readonly aEliminar = signal(false); // abre el modal de confirmación
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal<string | null>(null);

  pedirEliminar() {
    this.errorEliminar.set(null);
    this.aEliminar.set(true);
  }

  cerrarEliminar() {
    if (!this.eliminando()) this.aEliminar.set(false);
  }

  confirmarEliminar() {
    if (this.eliminando()) return;
    this.eliminando.set(true);
    this.errorEliminar.set(null);
    this.api.eliminar(this.comentario()._id).subscribe({
      next: ({ eliminados }) => {
        this.eliminando.set(false);
        this.aEliminar.set(false);
        this.eliminado.emit(eliminados); // el padre lo saca de la lista
      },
      error: (error: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.errorEliminar.set(mensajeDeError(error)); // queda abierto, con el error
      },
    });
  }

  protected readonly editando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  // FormGroup con un solo campo: conecta el <form> con (ngSubmit) (sin él,
  // apretar "Guardar" enviaría el form "a la antigua" y recargaría la página).
  protected readonly formulario = new FormGroup({
    mensaje: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
  });
  protected readonly mensaje = this.formulario.controls.mensaje;

  empezarAEditar() {
    this.mensaje.setValue(this.comentario().mensaje); // arranca con el texto actual
    this.error.set(null);
    this.editando.set(true);
  }

  cancelar() {
    this.editando.set(false);
  }

  guardar() {
    const texto = this.mensaje.value.trim();
    if (!texto || this.mensaje.invalid || this.guardando()) return;

    // Si no cambió nada, no hace falta pedirle nada al back.
    if (texto === this.comentario().mensaje) {
      this.editando.set(false);
      return;
    }

    this.guardando.set(true);
    this.api.editar(this.comentario()._id, texto).subscribe({
      next: (editado) => {
        this.guardando.set(false);
        this.editando.set(false);
        this.actualizado.emit(editado); // el padre lo reemplaza en la lista
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  // ---------- Respuestas ----------
  protected readonly respuestas = signal<IComentario[]>([]);
  // Arranca con el contador que manda el back; se suma 1 con cada respuesta nueva.
  protected readonly totalRespuestas = linkedSignal(() => this.comentario().cantidadRespuestas ?? 0);
  protected readonly abiertas = signal(false); // ¿se ven las respuestas?
  protected readonly cargandoRespuestas = signal(false);
  protected readonly errorRespuestas = signal<string | null>(null);
  protected readonly faltanRespuestas = computed(
    () => this.totalRespuestas() - this.respuestas().length,
  );

  protected readonly respondiendo = signal(false); // ¿está abierto el campo para responder?
  protected readonly enviandoRespuesta = signal(false);
  // Imagen opcional de la respuesta (extra): con el botón o pegándola (Ctrl+V).
  protected readonly imagenRespuesta = new ImagenAdjunta();
  protected readonly errorRespuesta = signal<string | null>(null);
  protected readonly formularioRespuesta = new FormGroup({
    mensaje: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
  });
  protected readonly respuesta = this.formularioRespuesta.controls.mensaje;
  private readonly campoRespuesta = viewChild<ElementRef<HTMLTextAreaElement>>('campoRespuesta');

  // "Responder": en una respuesta, le pasa el pedido al comentario principal.
  responder() {
    if (this.esRespuesta()) {
      this.pideResponder.emit(this.comentario());
    } else {
      this.abrirRespuesta(this.comentario());
    }
  }

  // Abre el campo para responder. Si se responde a otra persona dentro del hilo,
  // arranca con su @usuario (como en Instagram), para que se sepa a quién le habla.
  abrirRespuesta(a: IComentario) {
    const mencion =
      a._id !== this.comentario()._id && a.usuario._id !== this.usuario()?._id
        ? `@${a.usuario.nombreUsuario} `
        : '';
    if (mencion) this.respuesta.setValue(mencion);
    this.errorRespuesta.set(null);
    this.respondiendo.set(true);
    // Esperamos a que aparezca el campo y le damos el foco, con el cursor al final.
    setTimeout(() => {
      const campo = this.campoRespuesta()?.nativeElement;
      campo?.focus();
      campo?.setSelectionRange(campo.value.length, campo.value.length);
    });
  }

  cancelarRespuesta() {
    this.respondiendo.set(false);
    this.formularioRespuesta.reset();
    this.imagenRespuesta.quitar();
  }

  enviarRespuesta() {
    const texto = this.respuesta.value.trim();
    if (!texto || this.respuesta.invalid || this.enviandoRespuesta() || this.imagenRespuesta.procesando()) return;

    this.enviandoRespuesta.set(true);
    this.errorRespuesta.set(null);
    this.api.responder(this.comentario()._id, texto, this.imagenRespuesta.archivo()).subscribe({
      next: (nueva) => {
        this.enviandoRespuesta.set(false);
        this.respondiendo.set(false);
        this.formularioRespuesta.reset();
        this.imagenRespuesta.quitar();
        this.totalRespuestas.update((total) => total + 1);
        this.respondido.emit();
        // Con el hilo abierto, la nueva va al final. Si estaba cerrado, se abre
        // (trae las primeras) y se asegura de que la nueva se vea.
        if (this.abiertas()) {
          this.respuestas.update((lista) => [...lista, nueva]);
        } else {
          this.verRespuestas(nueva);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.enviandoRespuesta.set(false);
        this.errorRespuesta.set(mensajeDeError(error));
      },
    });
  }

  // Muestra / oculta el hilo. La primera vez trae las primeras respuestas.
  alternarRespuestas() {
    if (this.abiertas()) {
      this.abiertas.set(false);
    } else if (this.respuestas().length) {
      this.abiertas.set(true);
    } else {
      this.verRespuestas();
    }
  }

  private verRespuestas(nueva?: IComentario) {
    this.abiertas.set(true);
    this.cargarRespuestas(0, nueva);
  }

  // "Ver más respuestas": trae las siguientes y las suma al final.
  cargarMasRespuestas() {
    this.cargarRespuestas(this.respuestas().length);
  }

  private cargarRespuestas(offset: number, nueva?: IComentario) {
    if (this.cargandoRespuestas()) return;
    this.cargandoRespuestas.set(true);
    this.errorRespuestas.set(null);
    this.api.listarRespuestas(this.comentario()._id, offset, RESPUESTAS_POR_TANDA).subscribe({
      next: (pagina) => {
        this.respuestas.update((actuales) => {
          // Sin repetidos (por si alguien respondió mientras tanto).
          const ids = new Set(actuales.map((r) => r._id));
          const lista = [...actuales, ...pagina.comentarios.filter((r) => !ids.has(r._id))];
          // La que recién escribí, aunque no haya entrado en esta tanda.
          if (nueva && !lista.some((r) => r._id === nueva._id)) lista.push(nueva);
          return lista;
        });
        this.totalRespuestas.set(Math.max(pagina.total, this.respuestas().length));
        this.cargandoRespuestas.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorRespuestas.set(mensajeDeError(error));
        this.cargandoRespuestas.set(false);
      },
    });
  }

  // Una respuesta se editó: la reemplazamos en el hilo.
  alEditarRespuesta(editada: IComentario) {
    this.respuestas.update((lista) => lista.map((r) => (r._id === editada._id ? editada : r)));
  }

  // Una respuesta se borró: sale del hilo, baja el "Ver N respuestas" y le avisamos a la página.
  alEliminarRespuesta(id: string) {
    this.respuestas.update((lista) => lista.filter((r) => r._id !== id));
    this.totalRespuestas.update((total) => Math.max(total - 1, 0));
    if (this.totalRespuestas() === 0) this.abiertas.set(false);
    this.respuestaEliminada.emit();
  }
}
