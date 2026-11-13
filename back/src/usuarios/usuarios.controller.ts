    import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    } from '@nestjs/common';
    import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
    import { UsuariosService } from './usuarios.service.js';
    import { SeguimientosService } from './seguimientos.service.js';
    import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
    import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto.js';
    import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
    import { CambiarPerfilDto } from './dto/cambiar-perfil.dto.js';
    import { validarImagen } from '../common/imagenes.js';
    import { TokenGuard } from '../auth/token/token.guard.js';
    import { AdminGuard } from '../auth/token/admin.guard.js';
    import type { RequestConToken } from '../auth/token/token.guard.js';

    // Todas las rutas de usuarios piden token (sin token -> 401).
    @Controller('usuarios')
    @UseGuards(TokenGuard)
    export class UsuariosController {
    constructor(
        private readonly usuariosService: UsuariosService,
        private readonly seguimientosService: SeguimientosService,
    ) {}

    // ---------- Administración (Sprint 4) ----------
    // @UseGuards(AdminGuard) en cada ruta: se SUMA al TokenGuard de la clase.
    // Nest corre primero el de la clase (¿quién sos? -> 401) y después este
    // (¿sos administrador AHORA, según la base? -> 403). Si uno corta, no llega al método.

    // GET /usuarios -> 200 con el listado de usuarios (habilitados y deshabilitados).
    @Get()
    @UseGuards(AdminGuard)
    listar() {
        return this.usuariosService.listar();
    }

    // POST /usuarios -> 201 con el usuario creado (409 si el correo o el usuario ya existen).
    // Igual que el registro: multipart/form-data con los datos + la foto "imagenPerfil"
    // (obligatoria), y además "perfil": "usuario" o "administrador".
    @Post()
    @UseGuards(AdminGuard)
    @UseInterceptors(FileInterceptor('imagenPerfil', { defParamCharset: 'utf8' }))
    crear(
        @Body() crearUsuarioDto: CrearUsuarioDto,
        @UploadedFile(validarImagen('La imagen de perfil', true)) imagenPerfil: Express.Multer.File,
    ) {
        return this.usuariosService.crear(crearUsuarioDto, imagenPerfil);
    }

    // DELETE /usuarios/:id -> 200 con el usuario deshabilitado (baja lógica).
    // 400 si te querés deshabilitar a vos mismo; 409 si ya estaba deshabilitado.
    @Delete(':id')
    @UseGuards(AdminGuard)
    deshabilitar(@Param('id') id: string, @Req() req: RequestConToken) {
        return this.usuariosService.deshabilitar(id, req.usuario.id);
    }

    // POST /usuarios/:id/habilitar -> 201 con el usuario habilitado (alta lógica).
    // 409 si ya estaba habilitado.
    @Post(':id/habilitar')
    @UseGuards(AdminGuard)
    habilitar(@Param('id') id: string) {
        return this.usuariosService.habilitar(id);
    }

    // PATCH /usuarios/:id/perfil -> 200 con el usuario actualizado.
    // Body: { "perfil": "administrador" } para darle el rol, o "usuario" para sacárselo.
    // 400 si querés cambiar tu propio perfil; 409 si ya tenía ese perfil.
    @Patch(':id/perfil')
    @UseGuards(AdminGuard)
    cambiarPerfil(
        @Param('id') id: string,
        @Body() cambiarPerfilDto: CambiarPerfilDto,
        @Req() req: RequestConToken,
    ) {
        return this.usuariosService.cambiarPerfil(id, cambiarPerfilDto.perfil, req.usuario.id);
    }

    // ---------- Perfiles y seguir ----------

    // GET /usuarios/beto -> el perfil PÚBLICO de otro usuario (para verlo desde una
    // publicación o un comentario). Solo datos públicos: sin correo ni fecha de nacimiento.
    // Suma los números de "seguir": seguidores, a cuántos sigue y si yo (el del token) lo sigo.
    @Get(':nombreUsuario')
    async perfilPublico(@Param('nombreUsuario') nombreUsuario: string, @Req() req: RequestConToken) {
        const usuario = await this.usuariosService.perfilPublico(nombreUsuario);
        // Sprint 5: cuenta como visita (si no es tu propio perfil).
        await this.usuariosService.registrarVisita(usuario._id, req.usuario.id);
        const numeros = await this.seguimientosService.resumen(usuario._id, req.usuario.id);
        return { ...usuario, ...numeros };
    }

    // GET /usuarios/beto/seguidores y /usuarios/beto/siguiendo -> listas de personas
    @Get(':nombreUsuario/seguidores')
    seguidores(@Param('nombreUsuario') nombreUsuario: string) {
        return this.seguimientosService.listar(nombreUsuario, 'seguidores');
    }

    @Get(':nombreUsuario/siguiendo')
    siguiendo(@Param('nombreUsuario') nombreUsuario: string) {
        return this.seguimientosService.listar(nombreUsuario, 'siguiendo');
    }

    // POST /usuarios/:id/seguir -> 201 con los números nuevos (409 si ya lo seguías).
    // Quién sigue sale del TOKEN, no del body: nadie puede hacer que otro siga a alguien.
    @Post(':id/seguir')
    seguir(@Param('id') id: string, @Req() req: RequestConToken) {
        return this.seguimientosService.seguir(req.usuario.id, id);
    }

    // DELETE /usuarios/:id/seguir -> 200 con los números nuevos (404 si no lo seguías).
    @Delete(':id/seguir')
    dejarDeSeguir(@Param('id') id: string, @Req() req: RequestConToken) {
        return this.seguimientosService.dejarDeSeguir(req.usuario.id, id);
    }

    // GET /usuarios/:id/contrasena -> { tieneContraseña: true/false }
    // ("contrasena" sin ñ en la URL: las URLs con ñ se codifican raro, %C3%B1.)
    @Get(':id/contrasena')
    estadoContrasena(@Param('id') id: string, @Req() req: RequestConToken) {
        this.soloElDueño(id, req, 'Solo podés ver los datos de tu propia cuenta');
        return this.usuariosService.estadoContrasena(id);
    }

    // PATCH /usuarios/:id/contrasena -> crear o cambiar MI contraseña.
    @Patch(':id/contrasena')
    cambiarContrasena(
        @Param('id') id: string,
        @Req() req: RequestConToken,
        @Body() cambiarContrasenaDto: CambiarContrasenaDto,
    ) {
        this.soloElDueño(id, req, 'Solo podés cambiar tu propia contraseña');
        return this.usuariosService.cambiarContrasena(id, cambiarContrasenaDto);
    }

    // PATCH /usuarios/:id -> 200 OK con el usuario actualizado.
    // PATCH (y no PUT) porque se cambia una PARTE del usuario, no el usuario entero.
    // Llega como multipart/form-data por si trae imágenes nuevas, las dos opcionales:
    // "imagenPerfil" (la foto) y "banner" (la imagen ancha de arriba, extra).
    // FileFieldsInterceptor (y no FileInterceptor) porque pueden venir DOS archivos,
    // cada uno con su nombre de campo.
    @Patch(':id')
    @UseInterceptors(
        FileFieldsInterceptor(
        [
            { name: 'imagenPerfil', maxCount: 1 },
            { name: 'banner', maxCount: 1 },
        ],
        { defParamCharset: 'utf8' },
        ),
    )
    async actualizar(
        @Param('id') id: string,
        @Req() req: RequestConToken,
        @Body() actualizarUsuarioDto: ActualizarUsuarioDto,
        @UploadedFiles()
        archivos: { imagenPerfil?: Express.Multer.File[]; banner?: Express.Multer.File[] } = {},
    ) {
        // El token dice quién sos: solo podés editar TU perfil.
        // 403 (y no 401): sabemos quién sos, pero esto no te corresponde.
        if (req.usuario.id !== id) {
        throw new ForbiddenException('Solo podés editar tu propio perfil');
        }
        // Cada archivo pasa por las mismas reglas de siempre (2 MB, JPG/PNG/WEBP).
        // Con @UploadedFiles no se puede poner el pipe en el parámetro: se llama a mano.
        const imagenPerfil = await validarImagen('La imagen de perfil', false).transform(
        archivos.imagenPerfil?.[0],
        );
        const banner = await validarImagen('El banner', false).transform(archivos.banner?.[0]);
        return this.usuariosService.actualizar(id, actualizarUsuarioDto, imagenPerfil, banner);
    }

    // El token dice quién sos: estas rutas son solo para tu propia cuenta (403 si no).
    private soloElDueño(id: string, req: RequestConToken, mensaje: string) {
        if (req.usuario.id !== id) {
        throw new ForbiddenException(mensaje);
        }
    }
    }