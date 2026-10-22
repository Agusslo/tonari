import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  camposIguales,
  contraseñaSegura,
  fechaLocalHoy,
  fechaNoFutura,
} from '../../../shared/validators/validadores';

// Mismas reglas que el back (DTO de registro y validación del archivo).
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const PESO_MAXIMO_IMAGEN = 2 * 1024 * 1024; // 2 MB
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_USUARIO = /^[a-zA-Z0-9_.]+$/;

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly formBuilder = inject(FormBuilder);

  protected readonly hoy = fechaLocalHoy();

  // nonNullable: al resetear, los campos vuelven a '' en vez de null.
  protected readonly formulario = this.formBuilder.nonNullable.group(
    {
      nombre: ['', [Validators.required, Validators.maxLength(50)]],
      apellido: ['', [Validators.required, Validators.maxLength(50)]],
      correo: ['', [Validators.required, Validators.pattern(PATRON_CORREO)]],
      nombreUsuario: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(20),
          Validators.pattern(PATRON_USUARIO),
        ],
      ],
      contraseña: ['', [Validators.required, Validators.minLength(8), contraseñaSegura()]],
      repetirContraseña: ['', [Validators.required]],
      fechaNacimiento: ['', [Validators.required, fechaNoFutura()]],
      descripcion: ['', [Validators.required, Validators.maxLength(200)]],
    },
    { validators: camposIguales('contraseña', 'repetirContraseña') },
  );

  // La imagen no va en el FormGroup: un <input type="file"> no trabaja bien
  // con Reactive Forms, así que la manejamos con signals.
  protected readonly imagen = signal<File | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly formularioListo = signal(false);

  // El "ojito" de cada contraseña: true = se ve el texto, false = puntitos.
  // Van sin ñ porque el template de Angular no la acepta en los nombres.
  protected readonly verContrasena = signal(false);
  protected readonly verRepetirContrasena = signal(false);

  elegirImagen(evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;

    // Liberamos la vista previa anterior para no dejar memoria ocupada.
    const anterior = this.vistaPrevia();
    if (anterior) URL.revokeObjectURL(anterior);
    this.vistaPrevia.set(null);
    this.imagen.set(null);

    if (!archivo) {
      this.errorImagen.set('La imagen de perfil es obligatoria');
      return;
    }
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('La imagen debe ser JPG, PNG o WEBP');
      return;
    }
    if (archivo.size > PESO_MAXIMO_IMAGEN) {
      this.errorImagen.set('La imagen puede pesar hasta 2 MB');
      return;
    }

    this.errorImagen.set(null);
    this.imagen.set(archivo);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  // ¿Mostramos el error de este campo? Solo si el usuario ya lo tocó
  // (o intentó enviar), para no llenar de rojo un formulario recién abierto.
  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    const noCoinciden = campo === 'repetirContraseña' && this.formulario.hasError('noCoinciden');
    return (control.invalid || noCoinciden) && (control.touched || this.intentoEnviar());
  }

  // Traduce el error del campo a un mensaje claro en español.
  mensajeError(campo: keyof typeof this.formulario.controls): string {
    const errores = this.formulario.controls[campo].errors;

    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['minlength'])
      return `Debe tener al menos ${errores['minlength'].requiredLength} caracteres`;
    if (errores?.['maxlength'])
      return `Puede tener hasta ${errores['maxlength'].requiredLength} caracteres`;
    if (errores?.['pattern']) {
      return campo === 'correo'
        ? 'Ingresá un correo válido (por ejemplo, nombre@mail.com)'
        : 'Solo letras, números, punto y guion bajo';
    }
    if (errores?.['sinMayuscula']) return 'Debe tener al menos una mayúscula';
    if (errores?.['sinNumero']) return 'Debe tener al menos un número';
    if (errores?.['fechaFutura']) return 'La fecha no puede ser posterior a hoy';
    if (campo === 'repetirContraseña' && this.formulario.hasError('noCoinciden')) {
      return 'Las contraseñas no coinciden';
    }
    return '';
  }

  enviar() {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched(); // muestra todos los errores de una
    if (!this.imagen()) {
      this.errorImagen.set(this.errorImagen() ?? 'La imagen de perfil es obligatoria');
    }

    if (this.formulario.invalid || !this.imagen()) {
      this.formularioListo.set(false);
      return;
    }

    // TEMPORAL: en la próxima tanda acá se envían los datos al back.
    this.formularioListo.set(true);
  }
}
