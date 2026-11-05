import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { Modal } from '../../../shared/components/modal/modal';
import { Portada } from '../../../shared/components/portada/portada';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { celebrar } from '../../../shared/utils/animaciones';
import { fechaLocalHoy, fechaNoFutura } from '../../../shared/validators/validadores';
import { AutoAlturaDirective } from '../../../shared/directives/auto-altura.directive';

const PATRON_USUARIO = /^[a-zA-Z0-9_.]+$/;

// "Completá tu perfil" (extra): la primera vez que entrás con Google o con Discord
// (rutas /registro/google y /registro/discord, las dos usan este componente).
// Nos dieron tu nombre, correo y foto; faltan los datos que pide la consigna
// para cualquier cuenta: nombre de usuario, fecha de nacimiento y descripción.
// Mismas reglas que el registro común (y que el DTO del back).
@Component({
  selector: 'app-registro-google',
  imports: [ReactiveFormsModule, RouterLink, Avatar, Modal, Portada, AutoAlturaDirective],
  templateUrl: './registro-google.html',
  // Reusa los estilos del registro (grupos, filas, contador) y suma los propios.
  styleUrls: ['../registro/registro.css', './registro-google.css'],
})
export class RegistroGoogle {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly hoy = fechaLocalHoy();

  // Lo que dejó el botón de Google o Discord. Si no hay nada (recargaste la página o
  // entraste escribiendo la dirección), no hay nada que completar: al registro.
  protected readonly pendiente = this.auth.registroPendiente();
  // Para los textos: "Google ya nos pasó..." / "Discord ya nos pasó...".
  protected readonly proveedor = this.pendiente?.proveedor === 'discord' ? 'Discord' : 'Google';

  protected readonly formulario = this.formBuilder.nonNullable.group({
    nombre: [this.pendiente?.datos.nombre ?? '', [Validators.required, Validators.maxLength(50)]],
    apellido: [
      this.pendiente?.datos.apellido ?? '',
      [Validators.required, Validators.maxLength(50)],
    ],
    nombreUsuario: [
      // Con Discord sugerimos tu nombre de usuario de allá (si cumple las reglas de acá).
      usuarioSugerido(this.pendiente?.proveedor === 'discord' ? this.pendiente.datos.nombreUsuario : ''),
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(PATRON_USUARIO),
      ],
    ],
    fechaNacimiento: ['', [Validators.required, fechaNoFutura()]],
    descripcion: ['', [Validators.required, Validators.maxLength(200)]],
  });

  protected readonly intentoEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly resultado = signal<Resultado | null>(null);

  constructor() {
    if (!this.pendiente) this.router.navigate(['/registro'], { replaceUrl: true });
  }

  // Para el <app-avatar>: la foto de Google con tu nombre (por si la foto no carga).
  protected avatar() {
    const { nombre, apellido, nombreUsuario } = this.formulario.getRawValue();
    return {
      nombre: nombre || '?',
      apellido,
      nombreUsuario: nombreUsuario || 'tonari',
      imagenPerfil: this.pendiente?.datos.imagenPerfil ?? '',
    };
  }

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  mensajeError(campo: keyof typeof this.formulario.controls): string {
    const errores = this.formulario.controls[campo].errors;
    if (errores?.['required']) return 'Este campo es obligatorio';
    if (errores?.['minlength'])
      return `Debe tener al menos ${errores['minlength'].requiredLength} caracteres`;
    if (errores?.['maxlength'])
      return `Puede tener hasta ${errores['maxlength'].requiredLength} caracteres`;
    if (errores?.['pattern']) return 'Solo letras, números, punto y guion bajo';
    if (errores?.['fechaFutura']) return 'La fecha no puede ser posterior a hoy';
    return '';
  }

  enviar() {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (!this.pendiente || this.formulario.invalid || this.enviando()) return;

    this.enviando.set(true);
    const datos = this.formulario.getRawValue();
    const pedido =
      this.pendiente.proveedor === 'discord'
        ? this.auth.registroDiscord(this.pendiente.credencial, this.pendiente.nonce, datos)
        : this.auth.registroGoogle(this.pendiente.credencial, datos);
    pedido.subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        celebrar();
        this.resultado.set({
          tipo: 'exito',
          titulo: `¡Bienvenido, ${usuario.nombre}!`,
          mensaje: `Tu cuenta quedó creada con ${this.proveedor} y ya iniciaste sesión.`,
        });
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.resultado.set({
          tipo: 'error',
          titulo: 'No se pudo crear la cuenta',
          mensaje: mensajeDeError(error),
          // 401 = la credencial venció (Google: 1 hora; Discord: 10 minutos): hay que tocar el botón de nuevo.
          // 409 por el correo = ya tenía cuenta: que entre desde el login.
          volverAEmpezar: error.status === 401,
        });
      },
    });
  }

  cerrarResultado() {
    const resultado = this.resultado();
    this.resultado.set(null);
    if (resultado?.tipo === 'exito') this.router.navigate(['/publicaciones']);
    else if (resultado?.volverAEmpezar) this.router.navigate(['/registro']);
  }
}

interface Resultado {
  tipo: 'exito' | 'error';
  titulo: string;
  mensaje: string;
  volverAEmpezar?: boolean;
}

// Discord deja nombres de 2 a 32 letras, números, "_" y ".": acá son de 3 a 20.
// Si el de Discord no entra, el campo arranca vacío.
function usuarioSugerido(nombre: string) {
  return PATRON_USUARIO.test(nombre) && nombre.length >= 3 && nombre.length <= 20 ? nombre : '';
}
