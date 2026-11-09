import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Portada } from '../../../shared/components/portada/portada';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// /recuperar (extra): "¿Olvidaste tu contraseña?". Ponés tu correo y el back te manda
// un mail con un link para elegir una nueva (ese link abre /restablecer).
@Component({
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink, Portada],
  templateUrl: './recuperar.html',
  styleUrl: './recuperar.css',
})
export class Recuperar {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);

  // Si en el login ya habías escrito tu correo, viene en el "state" de la navegación
  // (no en la URL: así el correo no queda en el historial).
  protected readonly formulario = this.formBuilder.nonNullable.group({
    correo: [correoDelLogin(), [Validators.required, Validators.email]],
  });

  protected readonly intentoEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  // El mensaje del back cuando salió bien (null = todavía no se mandó).
  protected readonly enviado = signal<string | null>(null);

  mostrarError(): boolean {
    const control = this.formulario.controls.correo;
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  mensajeError(): string {
    const errores = this.formulario.controls.correo.errors;
    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['email']) return 'El correo no es válido';
    return '';
  }

  enviar() {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);
    this.auth.recuperar(this.formulario.getRawValue().correo.trim()).subscribe({
      next: ({ mensaje }) => {
        this.enviando.set(false);
        this.enviado.set(mensaje);
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  // "Probar con otro correo": vuelve al formulario.
  otroCorreo() {
    this.enviado.set(null);
    this.intentoEnviar.set(false);
  }
}

// history.state: lo que mandó el login con [state] en el routerLink.
function correoDelLogin(): string {
  const correo = (history.state as { correo?: unknown } | null)?.correo;
  return typeof correo === 'string' ? correo : '';
}
