    import {
    BadRequestException,
    FileTypeValidator,
    MaxFileSizeValidator,
    ParseFilePipe,
    } from '@nestjs/common';
    import { randomUUID } from 'node:crypto';
    import { mkdir, writeFile } from 'node:fs/promises';
    import { join } from 'node:path';

    // Todo lo de imágenes en un solo lugar: lo usan el registro (foto de perfil)
    // y las publicaciones (imagen opcional), así las reglas son las mismas.

    // Valida el archivo que llega con @UploadedFile().
    // "nombre" es para los mensajes: 'La imagen de perfil', 'La imagen', etc.
    export function validarImagen(nombre: string, obligatoria: boolean) {
    return new ParseFilePipe({
        // fileIsRequired: false -> si no mandan archivo, sigue de largo (llega undefined)
        fileIsRequired: obligatoria,
        validators: [
        new MaxFileSizeValidator({
            maxSize: 2 * 1024 * 1024, // 2 MB
            errorMessage: `${nombre} puede pesar hasta 2 MB`,
        }),
        new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
            errorMessage: `${nombre} debe ser JPG, PNG o WEBP`,
        }),
        ],
        exceptionFactory: (error) =>
        new BadRequestException(
            error === 'File is required' ? `${nombre} es obligatoria` : error,
        ),
    });
    }

    // Foto de perfil por defecto: un blobatar (https://blobatar.dev), un avatar
    // generado a partir del nombre de usuario. Como el nombre de usuario es único,
    // cada cuenta recibe su propio blobatar, y siempre el mismo.
    export function urlBlobatar(nombreUsuario: string) {
    return `https://blobatar.dev/avatar/${encodeURIComponent(nombreUsuario)}`;
    }

    // Guarda la imagen en back/uploads/<carpeta>/ con un nombre único
    // y devuelve la URL pública para guardarla en la base de datos.
    export async function guardarImagen(imagen: Express.Multer.File, carpeta: string) {
    const extension = imagen.mimetype.split('/')[1]; // jpeg | png | webp
    const nombreArchivo = `${randomUUID()}.${extension}`;

    const directorio = join(process.cwd(), 'uploads', carpeta);
    await mkdir(directorio, { recursive: true }); // crea la carpeta si no existe
    await writeFile(join(directorio, nombreArchivo), imagen.buffer);

    // Se lee acá adentro (y no arriba del archivo) para que tome el valor real
    // de la variable de entorno cuando exista (el bug del .env de la clase 14).
    const urlPublica = process.env.URL_PUBLICA ?? 'http://localhost:3000';
    return `${urlPublica}/uploads/${carpeta}/${nombreArchivo}`;
    }