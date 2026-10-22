    import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

    // Validadores propios (como en la clase 4): reciben el control y devuelven
    // un objeto con el error si falla, o null si está todo bien.

    // Consigna: la contraseña debe tener al menos una mayúscula y un número.
    // (El largo mínimo de 8 lo controla Validators.minLength.)
    export function contraseñaSegura(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const valor: string = control.value ?? '';
        if (!valor) return null; // si está vacío, de eso se encarga Validators.required
        const errores: ValidationErrors = {};
        if (!/[A-Z]/.test(valor)) errores['sinMayuscula'] = true;
        if (!/\d/.test(valor)) errores['sinNumero'] = true;
        return Object.keys(errores).length ? errores : null;
    };
    }

    // Se aplica al FormGroup entero, porque compara DOS campos entre sí.
    export function camposIguales(campo: string, repetido: string): ValidatorFn {
    return (grupo: AbstractControl): ValidationErrors | null => {
        const valor = grupo.get(campo)?.value;
        const valorRepetido = grupo.get(repetido)?.value;
        if (!valorRepetido) return null;
        return valor === valorRepetido ? null : { noCoinciden: true };
    };
    }

    // La fecha de nacimiento no puede ser posterior a hoy.
    export function fechaNoFutura(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const valor: string = control.value ?? '';
        if (!valor) return null;
        // Se compara como texto 'YYYY-MM-DD' con la fecha LOCAL de hoy (lección del TP1).
        return valor > fechaLocalHoy() ? { fechaFutura: true } : null;
    };
    }

    // Fecha de hoy en hora local, formato 'YYYY-MM-DD'.
    // No usamos toISOString() porque devuelve la fecha en UTC: a la noche en
    // Argentina (UTC-3) ya sería "mañana".
    export function fechaLocalHoy(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
    }