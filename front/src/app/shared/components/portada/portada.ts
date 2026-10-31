  import { Component, inject } from '@angular/core';
  import { toSignal } from '@angular/core/rxjs-interop';
  import { catchError, of } from 'rxjs';
  import { Anilist } from '../../../core/services/anilist';

  // La portada tipo tapa de manga de las pantallas de acceso (registro y login).
  // Está en un componente porque se repite: se escribe una vez y se usa en las dos.
  @Component({
    selector: 'app-portada',
    templateUrl: './portada.html',
    styleUrl: './portada.css',
  })
  export class Portada {
    private readonly anilist = inject(Anilist);

    // Las tapas del abanico: lo que está en tendencia en AniList.
    // Si AniList no responde, quedan vacías y se ve la trama de puntos (no es un error).
    protected readonly tapas = toSignal(
      this.anilist.tapasEnTendencia().pipe(catchError(() => of<string[]>([]))),
      { initialValue: [] },
    );
    protected readonly lugares = [0, 1, 2];
  }
