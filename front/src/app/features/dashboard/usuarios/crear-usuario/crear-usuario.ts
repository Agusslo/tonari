import { Component, inject, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosApi } from '../../../../core/services/usuarios-api';
import { IUsuarioAdmin } from '../../../../core/interfaces/usuario';
import { mensajeDeError } from '../../../../shared/utils/errores-http';
import { achicarImagen, TIPOS_IMAGEN } from '../../../../shared/utils/achicar-imagen';
import {
  camposIguales,
  contraseñaSegura,
  fechaLocalHoy,
  fechaNoFutura,
} from '../../../../shared/validators/validadores';
import { AutoAlturaDirective } from '../../../../shared/directives/auto-altura.directive';

// Mismas reglas que el registro (y que el back: CrearUsuarioDto extends RegistroDto).
const IMAGEN_OBLIGATORIA = 'La imagen de perfil es obligatoria';
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_USUARIO = /^[a-zA-Z0-9_.]+$/;

// Sprint 4: "Crear usuarios, con el formulario del registro más el perfil
// (usuario o administrador)". La diferencia con el registro: NO inicia sesión
// con la cuenta nueva (el administrador sigue siendo él).
@Component({
  selector: 'app-crear-usuario',
  imports: [ReactiveFormsModule, AutoAlturaDirective],
  templateUrl: './crear-usuario.html',
  // Reusa los estilos del registro (grupos, filas, imagen) + los propios.
  styleUrls: ['../../../auth/registro/registro.css', './crear-usuario.css'],
})
export class CrearUsuario {
  private readonly formBuilder = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApi);

  // Avisa al listado: "se creó este usuario" o "cancelaron".
  readonly creado = output<IUsuarioAdmin>();
  readonly cancelar = output<void>();

  protected readonly hoy = fechaLocalHoy();

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
      // Lo nuevo respecto del registro: los radios "Usuario" / "Administrador".
      perfil: ['usuario' as IUsuarioAdmin['perfil'], [Validators.required]],
    },
    { validators: camposIguales('contraseña', 'repetirContraseña') },
  );

  // La imagen va aparte del FormGroup (igual que en el registro).
  protected readonly imagen = signal<File | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly procesandoImagen = signal(false);

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null); // lo que respondió mal el back
  protected readonly verContrasena = signal(false);

  async elegirImagen(evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;

    const anterior = this.vistaPrevia();
    if (anterior) URL.revokeObjectURL(anterior);
    this.vistaPrevia.set(null);
    this.imagen.set(null);

    if (!archivo) {
      this.errorImagen.set(this.intentoEnviar() ? IMAGEN_OBLIGATORIA : null);
      return;
    }
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('La imagen debe ser JPG, PNG o WEBP');
      return;
    }

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

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    const noCoinciden = campo === 'repetirContraseña' && this.formulario.hasError('noCoinciden');
    return (control.invalid || noCoinciden) && (control.touched || this.intentoEnviar());
  }

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
    this.formulario.markAllAsTouched();

    if (this.procesandoImagen()) return;
    const imagen = this.imagen();
    if (!imagen && !this.errorImagen()) this.errorImagen.set(IMAGEN_OBLIGATORIA);
    if (this.formulario.invalid || !imagen || this.errorImagen() || this.enviando()) return;

    const { repetirContraseña: _repetida, ...datos } = this.formulario.getRawValue();

    this.enviando.set(true);
    this.error.set(null);
    this.usuariosApi.crear(datos, imagen).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        this.creado.emit(usuario); // el listado lo agrega y cierra el formulario
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(mensajeDeError(error)); // ej.: 409 "El correo ya está registrado"
      },
    });
  }
}
