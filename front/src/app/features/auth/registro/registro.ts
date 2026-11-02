import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Modal } from '../../../shared/components/modal/modal';
import { Portada } from '../../../shared/components/portada/portada';
import { BotonGoogle } from '../../../shared/components/boton-google/boton-google';
import { mensajeDeError } from '../../../shared/utils/errores-http';
import { celebrar } from '../../../shared/utils/animaciones';
import { achicarImagen, TIPOS_IMAGEN } from '../../../shared/utils/achicar-imagen';
import {
  camposIguales,
  contraseñaSegura,
  fechaLocalHoy,
  fechaNoFutura,
} from '../../../shared/validators/validadores';

// Mismas reglas que el back (DTO de registro y validación del archivo).
const IMAGEN_OBLIGATORIA = 'La imagen de perfil es obligatoria';
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_USUARIO = /^[a-zA-Z0-9_.]+$/;

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, Modal, Portada, BotonGoogle],
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
  protected readonly procesandoImagen = signal(false); // mientras se achica una foto pesada

  // Mientras se espera la respuesta del back: botón deshabilitado y "Creando cuenta…"
  protected readonly enviando = signal(false);
  // Lo que muestra el modal (null = modal cerrado)
  protected readonly resultado = signal<Resultado | null>(null);

  // El "ojito" de cada contraseña: true = se ve el texto, false = puntitos.
  // Van sin ñ porque el template de Angular no la acepta en los nombres.
  protected readonly verContrasena = signal(false);
  protected readonly verRepetirContrasena = signal(false);

  async elegirImagen(evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;

    // Liberamos la vista previa anterior para no dejar memoria ocupada.
    const anterior = this.vistaPrevia();
    if (anterior) URL.revokeObjectURL(anterior);
    this.vistaPrevia.set(null);
    this.imagen.set(null);

    // Es obligatoria: si sacó la que había elegido y ya intentó enviar, se lo marcamos.
    if (!archivo) {
      this.errorImagen.set(this.intentoEnviar() ? IMAGEN_OBLIGATORIA : null);
      return;
    }
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('La imagen debe ser JPG, PNG o WEBP');
      return;
    }

    // Si pesa más de 2 MB (las fotos del celular), la achicamos antes de subirla.
    this.procesandoImagen.set(true);
    try {
      const liviana = await achicarImagen(archivo);
      this.errorImagen.set(null);
      this.imagen.set(liviana);
      this.vistaPrevia.set(URL.createObjectURL(liviana));
    } catch {
      this.errorImagen.set('No pudimos procesar esa imagen. Probá con otra');
    } finally {
      this.procesandoImagen.set(false);
    }
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

    // La imagen es obligatoria: sin ella no se envía (ni mientras se está achicando).
    if (this.procesandoImagen()) return;
    const imagen = this.imagen();
    if (!imagen && !this.errorImagen()) this.errorImagen.set(IMAGEN_OBLIGATORIA);
    if (this.formulario.invalid || !imagen || this.errorImagen() || this.enviando()) return;

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

  // El botón de Google falló: lo mostramos en el mismo modal que los errores del registro.
  errorGoogle(mensaje: string) {
    this.resultado.set({ tipo: 'error', titulo: 'No se pudo continuar con Google', mensaje });
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