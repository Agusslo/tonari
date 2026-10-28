    import { HttpClient } from '@angular/common/http';
    import { inject, Service, signal } from '@angular/core';
    import { tap } from 'rxjs';
    import { environment } from '../../../environments/environment';
    import IUsuario from '../interfaces/usuario';

    // Los datos de texto del registro (la imagen va aparte, como archivo).
    export interface DatosRegistro {
    nombre: string;
    apellido: string;
    correo: string;
    nombreUsuario: string;
    contraseña: string;
    fechaNacimiento: string; // 'YYYY-MM-DD'
    descripcion: string;
    }

    // Todo lo que habla con /auth del back pasa por acá:
    // los componentes nunca llaman al back directo.
    @Service()
    export class Auth {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/auth`;

    // El usuario que ingresó (null = nadie). Lo leen las pantallas, por ejemplo
    // Mi Perfil. Por ahora vive en memoria: si recargás la página se pierde.
    // En el Sprint 3, con el token JWT, lo vamos a recuperar al recargar.
    private readonly usuario = signal<IUsuario | null>(null);
    readonly usuarioActual = this.usuario.asReadonly();

    // POST /auth/registro. Va como FormData (multipart/form-data) porque lleva
    // un archivo: con JSON no se puede mandar una imagen.
    registro(datos: DatosRegistro, imagenPerfil: File) {
        const formData = new FormData();
        for (const [campo, valor] of Object.entries(datos)) {
        formData.append(campo, valor);
        }
        formData.append('imagenPerfil', imagenPerfil);

        return this.http.post<IUsuario>(`${this.url}/registro`, formData);
    }

    // POST /auth/login. "usuario" puede ser el correo o el nombre de usuario.
    login(usuario: string, contraseña: string) {
        return this.http
        .post<IUsuario>(`${this.url}/login`, { usuario, contraseña })
        .pipe(tap((usuarioLogueado) => this.usuario.set(usuarioLogueado)));
    }

    // Cerrar sesión: se olvida quién estaba logueado.
    // (En el Sprint 3 también se va a borrar el token guardado.)
    cerrarSesion() {
        this.usuario.set(null);
    }
    }