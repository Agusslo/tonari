import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PublicacionesApi } from '../../../core/services/publicaciones-api';
import { BibliotecaApi } from '../../../core/services/biblioteca-api';
import IEntrada from '../../../core/interfaces/biblioteca';
import IPublicacion, { INuevaEncuesta, INuevoSpoiler } from '../../../core/interfaces/publicacion';
import IUsuario from '../../../core/interfaces/usuario';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { achicarImagen, TIPOS_IMAGEN } from '../../../shared/utils/achicar-imagen';
import { imagenDelPortapapeles } from '../../../shared/utils/imagen-adjunta';
import { AutoAlturaDirective } from '../../../shared/directives/auto-altura.directive';

// Formulario para publicar: título, descripción e imagen opcional (consigna).
// Extras: encuesta (2 a 4 opciones) y aviso de spoilers de una obra de tu biblioteca.
@Component({
  selector: 'app-crear-publicacion',
  imports: [ReactiveFormsModule, Avatar, AutoAlturaDirective],
  templateUrl: './crear-publicacion.html',
  styleUrl: './crear-publicacion.css',
})
export class CrearPublicacion {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(PublicacionesApi);
  private readonly bibliotecaApi = inject(BibliotecaApi);

  // Quién publica (lo pasa la pantalla) y el aviso de "ya se publicó".
  readonly usuario = input.required<IUsuario>();
  readonly creada = output<IPublicacion>();

  protected readonly formulario = this.formBuilder.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', [Validators.required, Validators.maxLength(1000)]],
  });

  // La imagen va aparte (un <input type="file"> no trabaja bien con Reactive Forms).
  protected readonly imagen = signal<File | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly procesandoImagen = signal(false); // mientras se achica una foto pesada

  protected readonly intentoEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly publicado = signal(false); // muestra "¡Publicado!" un ratito

  // Contador circular: cuánto se escribió del mensaje (máximo 1000).
  protected readonly largoDescripcion = toSignal(
    this.formulario.controls.descripcion.valueChanges,
    { initialValue: '' },
  );
  protected readonly restantes = computed(() => 1000 - this.largoDescripcion().length);
  protected readonly progreso = computed(() => Math.min(1, this.largoDescripcion().length / 1000));

  // ---------- Encuesta (extra) ----------
  // La pregunta es el título; acá van las opciones y cuánto dura.
  protected readonly conEncuesta = signal(false);
  protected readonly opciones = signal<string[]>(['', '']);
  protected readonly duracion = signal(24);
  protected readonly DURACIONES = [
    { horas: 24, texto: '1 día' },
    { horas: 72, texto: '3 días' },
    { horas: 168, texto: '1 semana' },
  ];

  // ---------- Spoiler (extra) ----------
  // La obra se elige de TU biblioteca (así ya tenemos su id de AniList, tipo y total).
  protected readonly conSpoiler = signal(false);
  protected readonly obras = signal<IEntrada[] | null>(null); // null = todavía no se cargó
  protected readonly errorObras = signal<string | null>(null);
  protected readonly obraElegida = signal<IEntrada | null>(null);
  protected readonly hasta = signal<number | null>(null); // null = toda la obra

  // El error de la encuesta o el spoiler (se muestra recién al tocar Publicar).
  protected readonly errorExtras = computed(() => (this.intentoEnviar() ? this.validarExtras() : null));

  alternarEncuesta() {
    this.conEncuesta.update((valor) => !valor);
  }

  cambiarOpcion(indice: number, valor: string) {
    this.opciones.update((lista) => lista.map((opcion, i) => (i === indice ? valor : opcion)));
  }

  agregarOpcion() {
    if (this.opciones().length < 4) this.opciones.update((lista) => [...lista, '']);
  }

  quitarOpcion(indice: number) {
    if (this.opciones().length > 2) this.opciones.update((lista) => lista.filter((_, i) => i !== indice));
  }

  alternarSpoiler() {
    this.conSpoiler.update((valor) => !valor);
    // La biblioteca se pide recién la primera vez que abrís el panel.
    if (this.conSpoiler() && this.obras() === null) {
      this.errorObras.set(null);
      this.bibliotecaApi.listar().subscribe({
        next: (obras) => this.obras.set(obras),
        error: (error: HttpErrorResponse) => {
          this.obras.set([]);
          this.errorObras.set(mensajeDeError(error));
        },
      });
    }
  }

  elegirObra(id: string) {
    this.obraElegida.set(this.obras()?.find((obra) => obra._id === id) ?? null);
  }

  cambiarHasta(valor: string) {
    this.hasta.set(valor === '' ? null : Number(valor));
  }

  // Las mismas reglas que el back (el back igual las vuelve a revisar).
  private validarExtras(): string | null {
    if (this.conEncuesta()) {
      const llenas = this.opciones().map((opcion) => opcion.trim()).filter(Boolean);
      if (llenas.length < 2) return 'La encuesta necesita al menos 2 opciones';
      if (new Set(llenas.map((opcion) => opcion.toLowerCase())).size !== llenas.length) {
        return 'La encuesta tiene opciones repetidas';
      }
    }
    if (this.conSpoiler()) {
      const obra = this.obraElegida();
      if (!obra) return 'Elegí de qué obra son los spoilers';
      const hasta = this.hasta();
      if (hasta !== null) {
        if (!Number.isInteger(hasta) || hasta < 1) return 'El episodio/capítulo tiene que ser un número desde 1';
        if (obra.total !== null && hasta > obra.total) return `${obra.titulo} tiene ${obra.total} en total`;
      }
    }
    return null;
  }

  private armarEncuesta(): INuevaEncuesta | undefined {
    if (!this.conEncuesta()) return undefined;
    return {
      opciones: this.opciones().map((opcion) => opcion.trim()).filter(Boolean),
      duracionHoras: this.duracion(),
    };
  }

  private armarSpoiler(): INuevoSpoiler | undefined {
    const obra = this.obraElegida();
    if (!this.conSpoiler() || !obra) return undefined;
    return { tipo: obra.tipo, idAnilist: obra.idAnilist, titulo: obra.titulo, hasta: this.hasta() };
  }

  private limpiarExtras() {
    this.conEncuesta.set(false);
    this.opciones.set(['', '']);
    this.duracion.set(24);
    this.conSpoiler.set(false);
    this.obraElegida.set(null);
    this.hasta.set(null);
  }

  async elegirImagen(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    this.quitarImagen();
    if (!archivo) return; // es opcional: no elegir nada no es un error
    await this.usarImagen(archivo, entrada);
  }

  // Extra: pegar una imagen con Ctrl+V (una captura, o "Copiar imagen" en el navegador)
  // estando en el título o el mensaje. Si lo que pegás es texto, se pega como siempre.
  pegarImagen(evento: ClipboardEvent, entradaImagen: HTMLInputElement) {
    const archivo = imagenDelPortapapeles(evento);
    if (!archivo) return;
    evento.preventDefault();
    entradaImagen.value = ''; // si antes habías elegido un archivo, queda reemplazado
    this.quitarImagen();
    this.usarImagen(archivo);
  }

  // Lo mismo para las dos formas (elegida o pegada): validar el tipo y achicarla.
  private async usarImagen(archivo: File, entrada?: HTMLInputElement) {
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('La imagen debe ser JPG, PNG o WEBP');
      if (entrada) entrada.value = '';
      return;
    }

    // Si pesa más de 2 MB (las fotos del celular), la achicamos antes de subirla.
    this.procesandoImagen.set(true);
    try {
      const liviana = await achicarImagen(archivo);
      this.imagen.set(liviana);
      this.vistaPrevia.set(URL.createObjectURL(liviana));
    } catch {
      this.errorImagen.set('No pudimos procesar esa imagen. Probá con otra');
      if (entrada) entrada.value = '';
    } finally {
      this.procesandoImagen.set(false);
    }
  }

  quitarImagen() {
    const anterior = this.vistaPrevia();
    if (anterior) URL.revokeObjectURL(anterior); // libera la memoria de la vista previa
    this.imagen.set(null);
    this.vistaPrevia.set(null);
    this.errorImagen.set(null);
  }

  mostrarError(campo: 'titulo' | 'descripcion'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  mensajeError(campo: 'titulo' | 'descripcion'): string {
    const errores = this.formulario.controls[campo].errors;
    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['maxlength'])
      return `Puede tener hasta ${errores['maxlength'].requiredLength} caracteres`;
    return '';
  }

  publicar(entradaImagen: HTMLInputElement) {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.errorImagen() || this.procesandoImagen() || this.enviando()) return;
    if (this.validarExtras()) return; // el mensaje lo muestra errorExtras

    const { titulo, descripcion } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);

    this.api
      .crear(
        {
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          usuario: this.usuario()._id,
          encuesta: this.armarEncuesta(),
          spoiler: this.armarSpoiler(),
        },
        this.imagen(),
      )
      .subscribe({
        next: (publicacion) => {
          this.enviando.set(false);
          // Dejamos el formulario limpio para la próxima.
          this.formulario.reset();
          this.intentoEnviar.set(false);
          this.quitarImagen();
          this.limpiarExtras();
          entradaImagen.value = '';
          this.publicado.set(true);
          setTimeout(() => this.publicado.set(false), 2500);
          this.creada.emit(publicacion);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          this.error.set(mensajeDeError(error));
        },
      });
  }
}