    import {
    BadRequestException,
    FileTypeValidator,
    InternalServerErrorException,
    MaxFileSizeValidator,
    ParseFilePipe,
    } from '@nestjs/common';
    import { randomUUID } from 'node:crypto';
    import { v2 as cloudinary } from 'cloudinary';

    // Todo lo de imágenes en un solo lugar: lo usan el registro (foto de perfil,
    // obligatoria) y las publicaciones (imagen opcional), así las reglas son las mismas.

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

    // Sube la imagen a Cloudinary (storage externo, clase 16) y devuelve su URL
    // para guardarla en la base de datos. Antes se guardaba en back/uploads/, pero
    // en Vercel el disco es de solo lectura y además se borra en cada deploy.
    // "carpeta" ordena las imágenes en Cloudinary: tonari/perfiles, tonari/publicaciones.
    export async function guardarImagen(imagen: Express.Multer.File, carpeta: string) {
    // Las claves se leen acá adentro (y no arriba del archivo) para que tomen el
    // valor real del .env (el bug del .env de la clase 14).
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Como en la clase: el archivo (que Multer tiene en memoria, en imagen.buffer)
    // se pasa a texto base64 y se arma una "data URI": data:image/png;base64,iVBOR...
    const base64 = imagen.buffer.toString('base64');
    const uri = `data:${imagen.mimetype};base64,${base64}`;

    try {
        const resultado = await cloudinary.uploader.upload(uri, {
        folder: `tonari/${carpeta}`,
        public_id: randomUUID(), // nombre único; la extensión la agrega Cloudinary
        });
        // secure_url (https) y no url (http): el front en Vercel es https y el
        // navegador bloquea imágenes http dentro de una página https.
        return resultado.secure_url;
    } catch {
        // Claves mal puestas, Cloudinary caído, etc.: mensaje claro en vez de un 500 genérico.
        throw new InternalServerErrorException(
        'No se pudo guardar la imagen. Intentá de nuevo en unos minutos.',
        );
    }
    }
