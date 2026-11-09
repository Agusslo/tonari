import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Modal } from '../../../shared/components/modal/modal';
import { Portada } from '../../../shared/components/portada/portada';
import { BotonGoogle } from '../../../shared/components/boton-google/boton-google';
import { contraseñaSegura } from '../../../shared/validators/validadores';
import { mensajeDeError } from '../../../shared/utils/errores-http';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Modal, Portada, BotonGoogle],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // Consigna: por correo o nombre de usuario, y la contraseña con
  // al menos 8 caracteres, una mayúscula y un número.
  protected readonly formulario = this.formBuilder.nonNullable.group({
    usuario: ['', [Validators.required]],
    contraseña: ['', [Validators.required, Validators.minLength(8), contraseñaSegura()]],
  });

  protected readonly intentoEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly verContrasena = signal(false);
  // Mensaje del modal de error (null = modal cerrado)
  protected readonly error = signal<string | null>(null);
  // "Listo, tu contraseña quedó cambiada" (viene en el state desde /restablecer).
  protected readonly aviso = signal<string | null>(avisoRecibido());

  // Para "¿Olvidaste tu contraseña?": si lo que escribiste parece un correo, lo pasamos.
  protected correoEscrito(): string {
    const valor = this.formulario.controls.usuario.value.trim();
    return valor.includes('@') ? valor : '';
  }

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  mensajeError(campo: keyof typeof this.formulario.controls): string {
    const errores = this.formulario.controls[campo].errors;
    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['minlength']) return 'La contraseña tiene al menos 8 caracteres';
    if (errores?.['sinMayuscula']) return 'La contraseña tiene al menos una mayúscula';
    if (errores?.['sinNumero']) return 'La contraseña tiene al menos un número';
    return '';
  }

  enviar() {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) return;

    const { usuario, contraseña } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.auth.login(usuario.trim(), contraseña).subscribe({
      next: () => {
        this.enviando.set(false);
        this.router.navigate(['/publicaciones']);
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }
}

// history.state: lo que mandó la pantalla anterior al navegar (router.navigate con state).
function avisoRecibido(): string | null {
  const aviso = (history.state as { aviso?: unknown } | null)?.aviso;
  return typeof aviso === 'string' ? aviso : null;
}