import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Modal } from '../../../shared/components/modal/modal';
import { Portada } from '../../../shared/components/portada/portada';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { urlBlobatar } from '../../../shared/utils/blobatar';
import { celebrar } from '../../../shared/utils/animaciones';
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
  imports: [ReactiveFormsModule, RouterLink, Modal, Portada],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

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

  // Sin foto elegida, el círculo muestra el blobatar que le va a tocar.
  // debounceTime: se actualiza cuando deja de escribir, no en cada tecla.
  private readonly nombreUsuario = toSignal(
    this.formulario.controls.nombreUsuario.valueChanges.pipe(debounceTime(400)),
    { initialValue: '' },
  );
  protected readonly blobatar = computed(() => {
    const nombre = this.nombreUsuario().trim();
    return PATRON_USUARIO.test(nombre) ? urlBlobatar(nombre) : null;
  });

  // Mientras se espera la respuesta del back: botón deshabilitado y "Creando cuenta…"
  protected readonly enviando = signal(false);
  // Lo que muestra el modal (null = modal cerrado)
  protected readonly resultado = signal<Resultado | null>(null);

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

    // Es opcional: si no elige nada, se queda con su blobatar.
    if (!archivo) {
      this.errorImagen.set(null);
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

    // La imagen es opcional (null = el back le asigna un blobatar).
    const imagen = this.imagen();
    if (this.formulario.invalid || this.errorImagen() || this.enviando()) return;

    // "repetirContraseña" solo sirve en el front: al back no se manda.
    const { repetirContraseña: _repetida, ...datos } = this.formulario.getRawValue();

    this.enviando.set(true);
    this.auth.registro(datos, imagen).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        celebrar(); // confeti de bienvenida
        this.resultado.set({
          tipo: 'exito',
          titulo: `¡Bienvenido, ${usuario.nombre}!`,
          mensaje:
            'Tu cuenta quedó creada y ya iniciaste sesión. ¡Vamos a ver qué se comparte!',
        });
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.resultado.set({
          tipo: 'error',
          titulo: 'No se pudo crear la cuenta',
          mensaje: mensajeDeError(error),
        });
      },
    });
  }

  // Se llama al cerrar el modal (con el botón o con Escape).
  cerrarResultado() {
    const fueExito = this.resultado()?.tipo === 'exito';
    this.resultado.set(null);
    if (fueExito) this.router.navigate(['/publicaciones']);
  }
}

interface Resultado {
  tipo: 'exito' | 'error';
  titulo: string;
  mensaje: string;
}