import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PublicacionesApi } from '../../../core/services/publicaciones-api';
import IPublicacion from '../../../core/interfaces/publicacion';
import IUsuario from '../../../core/interfaces/usuario';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { Avatar } from '../../../shared/components/avatar/avatar';

// Mismas reglas que el back (DTO y validación de la imagen).
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const PESO_MAXIMO_IMAGEN = 2 * 1024 * 1024; // 2 MB

// Formulario para publicar: título, descripción e imagen opcional (consigna).
@Component({
  selector: 'app-crear-publicacion',
  imports: [ReactiveFormsModule, Avatar],
  templateUrl: './crear-publicacion.html',
  styleUrl: './crear-publicacion.css',
})
export class CrearPublicacion {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(PublicacionesApi);

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

  elegirImagen(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    this.quitarImagen();
    if (!archivo) return; // es opcional: no elegir nada no es un error

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('La imagen debe ser JPG, PNG o WEBP');
      entrada.value = '';
      return;
    }
    if (archivo.size > PESO_MAXIMO_IMAGEN) {
      this.errorImagen.set('La imagen puede pesar hasta 2 MB');
      entrada.value = '';
      return;
    }
    this.imagen.set(archivo);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
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
    if (this.formulario.invalid || this.errorImagen() || this.enviando()) return;

    const { titulo, descripcion } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);

    this.api
      .crear({ titulo: titulo.trim(), descripcion: descripcion.trim(), usuario: this.usuario()._id }, this.imagen())
      .subscribe({
        next: (publicacion) => {
          this.enviando.set(false);
          // Dejamos el formulario limpio para la próxima.
          this.formulario.reset();
          this.intentoEnviar.set(false);
          this.quitarImagen();
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