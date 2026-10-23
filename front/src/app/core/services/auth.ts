    import { HttpClient } from '@angular/common/http';
    import { inject, Service } from '@angular/core';
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
        return this.http.post<IUsuario>(`${this.url}/login`, { usuario, contraseña });
    }
    }