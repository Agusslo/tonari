import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import IUsuario from '../../../core/interfaces/usuario';
import { fechaLocalHoy, fechaNoFutura } from '../../../shared/validators/validadores';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { achicarImagen, TIPOS_IMAGEN } from '../../../shared/utils/achicar-imagen';

// Formulario para editar mi perfil (consigna: "cada usuario debe poder ver y editar su perfil").
@Component({
  selector: 'app-editar-perfil',
  imports: [ReactiveFormsModule, Avatar],
  templateUrl: './editar-perfil.html',
  styleUrl: './editar-perfil.css',
})
export class EditarPerfil implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);

  readonly usuario = input.required<IUsuario>();
  readonly guardado = output<void>(); // avisa que se guardó
  readonly cancelar = output<void>(); // avisa que se canceló

  protected readonly hoy = fechaLocalHoy();

  protected readonly formulario = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    apellido: ['', [Validators.required, Validators.maxLength(50)]],
    fechaNacimiento: ['', [Validators.required, fechaNoFutura()]],
    descripcion: ['', [Validators.required, Validators.maxLength(200)]],
  });

  protected readonly imagen = signal<File | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly procesandoImagen = signal(false); // mientras se achica una foto pesada

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  // Al abrir, el formulario arranca con mis datos actuales.
  ngOnInit() {
    const usuario = this.usuario();
    this.formulario.setValue({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      // '2004-12-04T00:00:00.000Z' -> '2004-12-04' (lo que espera el <input type="date">)
      fechaNacimiento: usuario.fechaNacimiento.slice(0, 10),
      descripcion: usuario.descripcion,
    });
  }

  async elegirImagen(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    this.quitarImagen();
    if (!archivo) return; // la foto es opcional: si no elige, queda la actual

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('La imagen debe ser JPG, PNG o WEBP');
      entrada.value = '';
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
      entrada.value = '';
    } finally {
      this.procesandoImagen.set(false);
    }
  }

  quitarImagen() {
    const anterior = this.vistaPrevia();
    if (anterior) URL.revokeObjectURL(anterior);
    this.imagen.set(null);
    this.vistaPrevia.set(null);
    this.errorImagen.set(null);
  }

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  mensajeError(campo: keyof typeof this.formulario.controls): string {
    const errores = this.formulario.controls[campo].errors;
    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['maxlength'])
      return `Puede tener hasta ${errores['maxlength'].requiredLength} caracteres`;
    if (errores?.['fechaFutura']) return 'La fecha no puede ser posterior a hoy';
    return '';
  }

  guardar() {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.errorImagen() || this.procesandoImagen() || this.enviando()) return;

    const datos = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);

    this.auth
      .actualizarPerfil(
        this.usuario()._id,
        {
          nombre: datos.nombre.trim(),
          apellido: datos.apellido.trim(),
          fechaNacimiento: datos.fechaNacimiento,
          descripcion: datos.descripcion.trim(),
        },
        this.imagen(),
      )
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.quitarImagen();
          this.guardado.emit();
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          this.error.set(mensajeDeError(error));
        },
      });
  }
}
