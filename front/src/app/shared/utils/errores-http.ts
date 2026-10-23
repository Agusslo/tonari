    import { HttpErrorResponse } from '@angular/common/http';

    // Convierte la respuesta de error del back en un mensaje claro para el usuario.
    // Lo usan el registro, el login y (más adelante) el resto de las pantallas.
    export function mensajeDeError(error: HttpErrorResponse): string {
    // status 0: el pedido ni llegó (back apagado, sin internet, CORS)
    if (error.status === 0) {
        return 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    }
    // Nest manda { message: '...' } o, si falló el DTO, { message: ['...', '...'] }
    const mensaje = error.error?.message;
    if (Array.isArray(mensaje)) return mensaje.join('. ');
    if (typeof mensaje === 'string') return mensaje;
    return 'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.';
    }