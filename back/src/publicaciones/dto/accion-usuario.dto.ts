    import { IsMongoId } from 'class-validator';

    // Quién hace la acción (eliminar, dar o quitar "Me gusta").
    // Por ahora viaja en el body; en el Sprint 3 lo vamos a sacar del token JWT.
    export class AccionUsuarioDto {
    @IsMongoId({ message: 'El usuario no es válido' })
    usuario: string;
    }