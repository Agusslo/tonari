import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Portada } from '../../../shared/components/portada/portada';
import { camposIguales, contraseñaSegura } from '../../../shared/validators/validadores';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// En qué paso está la pantalla.
type Estado = 'verificando' | 'formulario' | 'invalido' | 'sin-conexion';

// /restablecer#token=... (extra): el link que llega por mail en "Olvidé mi contraseña".
// Igual que /ingreso-google, el token viene en el fragmento (#) y lo borramos enseguida
// de la barra de direcciones.
@Component({
  selector: 'app-restablecer',
  imports: [ReactiveFormsModule, RouterLink, Portada],
  templateUrl: './restablecer.html',
  styleUrl: '../recuperar/recuperar.css',
})
export class Restablecer {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  private readonly token: string;

  protected readonly estado = signal<Estado>('verificando');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly verContrasenas = signal(false);

  // Las mismas reglas que en el registro y en "Cambiar contraseña".
  protected readonly formulario = this.formBuilder.nonNullable.group(
    {
      nueva: ['', [Validators.required, Validators.minLength(8), contraseñaSegura()]],
      repetir: ['', [Validators.required]],
    },
    { validators: camposIguales('nueva', 'repetir') },
  );

  constructor() {
    const fragmento = new URLSearchParams(inject(ActivatedRoute).snapshot.fragment ?? '');
    inject(Location).replaceState('/restablecer');
    this.token = fragmento.get('token') ?? '';
    this.verificar();
  }

  // Antes de mostrar el formulario preguntamos si el link sirve: así, si venció,
  // te enterás ahora y no después de escribir la contraseña dos veces.
  protected verificar() {
    if (!this.token) {
      this.estado.set('invalido');
      return;
    }
    this.estado.set('verificando');
    this.auth.verificarRecuperacion(this.token).subscribe({
      next: () => this.estado.set('formulario'),
      error: (error: HttpErrorResponse) =>
        this.estado.set(error.status === 0 ? 'sin-conexion' : 'invalido'),
    });
  }

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    const noCoinciden = campo === 'repetir' && this.formulario.hasError('noCoinciden');
    return (control.invalid || noCoinciden) && (control.touched || this.intentoEnviar());
  }

  mensajeError(campo: keyof typeof this.formulario.controls): string {
    const errores = this.formulario.controls[campo].errors;
    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['minlength']) return 'Debe tener al menos 8 caracteres';
    if (errores?.['sinMayuscula']) return 'Debe tener al menos una mayúscula';
    if (errores?.['sinNumero']) return 'Debe tener al menos un número';
    if (campo === 'repetir' && this.formulario.hasError('noCoinciden')) {
      return 'Las contraseñas no coinciden';
    }
    return '';
  }

  guardar() {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);
    this.auth.restablecer(this.token, this.formulario.getRawValue().nueva).subscribe({
      // Al login con el aviso (en el "state", como hace Google con Mi perfil).
      // replaceUrl: si tocás "atrás" no volvés a un link que ya no sirve.
      next: ({ mensaje }) =>
        this.router.navigate(['/login'], { replaceUrl: true, state: { aviso: mensaje } }),
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // 400 = el link venció mientras escribías (o ya se usó en otra pestaña).
        if (error.status === 400 && !Array.isArray(error.error?.message)) {
          this.estado.set('invalido');
          return;
        }
        this.error.set(mensajeDeError(error));
      },
    });
  }
}
