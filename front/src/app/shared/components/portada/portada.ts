  import { Component } from '@angular/core';

  // La portada tipo tapa de manga de las pantallas de acceso (registro y login).
  // Está en un componente porque se repite: se escribe una vez y se usa en las dos.
  @Component({
    selector: 'app-portada',
    templateUrl: './portada.html',
    styleUrl: './portada.css',
  })
  export class Portada {}