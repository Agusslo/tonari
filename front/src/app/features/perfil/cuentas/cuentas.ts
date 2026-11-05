import { Component, ElementRef, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Auth } from '../../../core/services/auth';
import { CuentasApi, ICuentas, Proveedor } from '../../../core/services/cuentas-api';
import { BotonGoogle } from '../../../shared/components/boton-google/boton-google';
import { BotonDiscord } from '../../../shared/components/boton-discord/boton-discord';
import { ImagenRespaldoDirective } from '../../../shared/directives/imagen-respaldo.directive';
import { mensajeDeError } from '../../../shared/utils/errores-http';

// "Cuentas vinculadas" (extra), en Mi perfil, abajo de la contraseña.
// Google y Discord: vincular, desvincular y (Discord) mostrarlo o no en tu perfil.
// Vincular saca la pestaña de TONARI (a Google o a Discord) y vuelve a /ingreso-google
// o /ingreso-discord, que terminan la vinculación y te traen de nuevo acá con un aviso.
@Component({
  selector: 'app-cuentas',
  imports: [BotonGoogle, BotonDiscord, ImagenRespaldoDirective],
  templateUrl: './cuentas.html',
  // Mismo estilo de fila que la contraseña, más lo propio.
  styleUrls: ['../contrasena/contrasena.css', './cuentas.css'],
})
export class Cuentas {
  private readonly cuentasApi = inject(CuentasApi);
  private readonly auth = inject(Auth);

  protected readonly cuentas = signal<ICuentas | null>(null);
  protected readonly errorEstado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupado = signal(false);
  // Desvincular pide confirmar: guarda cuál se está por desvincular.
  protected readonly confirmando = signal<Proveedor | null>(null);

  // El aviso que dejó /ingreso-google o /ingreso-discord al volver ("Listo: vinculaste...").
  protected readonly aviso = signal<string | null>(
    (inject(Location).getState() as { aviso?: string } | null)?.aviso ?? null,
  );

  private readonly elemento = inject(ElementRef<HTMLElement>);
  // Si volvés de vincular, bajamos hasta esta sección para que veas el aviso
  // (una sola vez, cuando terminan de cargar las cuentas).
  private bajarAlAviso = this.aviso() !== null;

  constructor() {
    this.cargar();
  }

  protected cargar() {
    this.errorEstado.set(false);
    this.cuentasApi.estado().subscribe({
      next: (cuentas) => {
        this.cuentas.set(cuentas);
        if (this.bajarAlAviso) {
          this.bajarAlAviso = false;
          // setTimeout: después de que el router termine de subir la página (scroll 'top').
          setTimeout(() => this.elemento.nativeElement.scrollIntoView({ block: 'center' }));
        }
      },
      error: () => this.errorEstado.set(true),
    });
  }

  protected desvincular(proveedor: Proveedor) {
    this.confirmando.set(null);
    const nombre = proveedor === 'google' ? 'Google' : 'Discord';
    this.hacer(this.cuentasApi.desvincular(proveedor), `Desvinculaste tu cuenta de ${nombre}.`);
  }

  protected mostrarDiscord(evento: Event) {
    const mostrar = (evento.target as HTMLInputElement).checked;
    this.hacer(
      this.cuentasApi.mostrarDiscord(mostrar),
      mostrar ? 'Tu Discord se ve en tu perfil.' : 'Tu Discord ya no se ve en tu perfil.',
    );
  }

  // Lo común a desvincular y mostrar/ocultar: llamar, actualizar la sección y avisar.
  // autorizar(): refresca tus datos para que la insignia de Discord de arriba se actualice.
  private hacer(pedido: Observable<ICuentas>, mensajeOk: string) {
    this.ocupado.set(true);
    this.error.set(null);
    this.aviso.set(null);
    pedido.subscribe({
      next: (cuentas) => {
        this.ocupado.set(false);
        this.cuentas.set(cuentas);
        this.aviso.set(mensajeOk);
        this.auth.autorizar().subscribe({ error: () => {} });
      },
      error: (error: HttpErrorResponse) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(error));
        this.cargar(); // por si el switch quedó en un estado que no es el real
      },
    });
  }
}
