import { signal } from '@angular/core';
import { achicarImagen, TIPOS_IMAGEN } from './achicar-imagen';

// Si lo que pegaste (Ctrl+V) es una imagen, la devuelve; si no, null.
// Si el portapapeles también trae TEXTO, no la tomamos: al copiar de Word o Excel
// viene el texto y además una "foto" del texto, y ahí querés pegar el texto.
// ("Copiar imagen" del navegador o una captura con Win+Shift+S no traen texto.)
export function imagenDelPortapapeles(evento: ClipboardEvent): File | null {
  const datos = evento.clipboardData;
  if (!datos || datos.types.includes('text/plain')) return null;
  return Array.from(datos.files).find((archivo) => archivo.type.startsWith('image/')) ?? null;
}

// La imagen opcional de un comentario o respuesta (extra), con todo su estado:
// el archivo, la vista previa, si se está achicando y el error.
// Es una clase común (no un servicio): cada formulario crea la suya con "new".
export class ImagenAdjunta {
  readonly archivo = signal<File | null>(null);
  readonly vistaPrevia = signal<string | null>(null);
  readonly procesando = signal(false);
  readonly error = signal<string | null>(null);

  // La elegiste con el botón (<input type="file">).
  desdeInput(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = ''; // así se puede volver a elegir la misma
    if (archivo) this.usar(archivo);
  }

  // La pegaste con Ctrl+V. Si era texto, no hacemos nada y se pega como siempre.
  pegar(evento: ClipboardEvent) {
    const archivo = imagenDelPortapapeles(evento);
    if (!archivo) return;
    evento.preventDefault(); // que no intente pegar "algo" en el textarea
    this.usar(archivo);
  }

  async usar(archivo: File) {
    this.quitar();
    // Mismas reglas que el back: JPG, PNG o WEBP (las capturas de pantalla son PNG).
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.error.set('La imagen debe ser JPG, PNG o WEBP');
      return;
    }
    // Si pesa más de 2 MB, la achicamos antes de subirla (igual que en las publicaciones).
    this.procesando.set(true);
    try {
      const liviana = await achicarImagen(archivo);
      this.archivo.set(liviana);
      this.vistaPrevia.set(URL.createObjectURL(liviana));
    } catch {
      this.error.set('No pudimos procesar esa imagen. Probá con otra');
    } finally {
      this.procesando.set(false);
    }
  }

  quitar() {
    const anterior = this.vistaPrevia();
    if (anterior) URL.revokeObjectURL(anterior); // libera la memoria de la vista previa
    this.archivo.set(null);
    this.vistaPrevia.set(null);
    this.error.set(null);
  }
}
