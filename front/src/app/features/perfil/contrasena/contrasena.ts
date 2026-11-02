import { Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosApi } from '../../../core/services/usuarios-api';
import { camposIguales, contraseñaSegura } from '../../../shared/validators/validadores';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// "Contraseña" en Mi perfil.
//   - Cuenta creada con Google (sin contraseña): "Crear contraseña", para poder entrar
//     también con correo o nombre de usuario (por ejemplo, desde otra compu).
//   - Cuenta con contraseña: "Cambiar contraseña" (pide la actual).
@Component({
  selector: 'app-contrasena',
  imports: [ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './contrasena.html',
  styleUrl: './contrasena.css',
})
export class Contrasena implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApi);

  readonly usuarioId = input.required<string>();

  // null = todavía no sabemos (cargando).
  protected readonly tieneContrasena = signal<boolean | null>(null);
  protected readonly errorEstado = signal(false);

  protected readonly abierto = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly listo = signal<string | null>(null); // mensaje de éxito
  protected readonly intentoEnviar = signal(false);
  protected readonly verContrasenas = signal(false); // el "ojito" (vale para los 3 campos)

  // Las mismas reglas que en el registro.
  protected readonly formulario = this.formBuilder.nonNullable.group(
    {
      actual: ['', [Validators.required]],
      nueva: ['', [Validators.required, Validators.minLength(8), contraseñaSegura()]],
      repetir: ['', [Validators.required]],
    },
    { validators: camposIguales('nueva', 'repetir') },
  );

  ngOnInit() {
    this.cargarEstado();
  }

  protected cargarEstado() {
    this.errorEstado.set(false);
    this.usuariosApi.estadoContrasena(this.usuarioId()).subscribe({
      next: ({ tieneContraseña }) => this.tieneContrasena.set(tieneContraseña),
      error: () => this.errorEstado.set(true),
    });
  }

  protected abrir() {
    this.formulario.reset();
    this.intentoEnviar.set(false);
    this.error.set(null);
    this.listo.set(null);
    // Sin contraseña no hay "actual" que pedir: un campo deshabilitado no cuenta
    // para la validación (y en guardar() no se manda).
    if (this.tieneContrasena()) this.formulario.controls.actual.enable();
    else this.formulario.controls.actual.disable();
    this.abierto.set(true);
  }

  protected cancelar() {
    this.abierto.set(false);
    this.formulario.reset();
  }

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    const noCoinciden = campo === 'repetir' && this.formulario.hasError('noCoinciden');
    return (control.invalid || noCoinciden) && (control.touched || this.intentoEnviar());
  }

  mensajeError(campo: keyof typeof this.formulario.controls): string {
    const errores = this.formulario.controls[campo].errors;
    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['minlength'])
      return `Debe tener al menos ${errores['minlength'].requiredLength} caracteres`;
    if (errores?.['sinMayuscula']) return 'Debe tener al menos una mayúscula';
    if (errores?.['sinNumero']) return 'Debe tener al menos un número';
    if (campo === 'repetir' && this.formulario.hasError('noCoinciden')) {
      return 'Las contraseñas no coinciden';
    }
    return '';
  }

  protected guardar() {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) return;

    const { actual, nueva } = this.formulario.getRawValue();
    const creando = !this.tieneContrasena();
    this.enviando.set(true);
    this.error.set(null);

    this.usuariosApi
      .cambiarContrasena(this.usuarioId(), {
        // "repetir" solo sirve en el front. "actual" va solo si la cuenta ya tenía.
        ...(creando ? {} : { contraseñaActual: actual }),
        contraseñaNueva: nueva,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.tieneContrasena.set(true);
          this.abierto.set(false);
          this.formulario.reset();
          this.listo.set(
            creando
              ? 'Listo: ahora también podés ingresar con tu correo o nombre de usuario y esta contraseña.'
              : 'Listo, tu contraseña quedó cambiada.',
          );
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          this.error.set(mensajeDeError(error));
        },
      });
  }
}
