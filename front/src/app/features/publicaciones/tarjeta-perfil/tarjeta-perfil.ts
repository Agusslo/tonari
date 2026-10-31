import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import IUsuario from '../../../core/interfaces/usuario';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { aparecerConRebote, contarHasta } from '../../../shared/utils/animaciones';
import { urlBanner } from '../../../shared/utils/cloudinary';

// Tarjeta de la columna lateral del muro: tu perfil resumido (con sesión)
// o la invitación a sumarte (sin sesión).
@Component({
  selector: 'app-tarjeta-perfil',
  imports: [RouterLink, Avatar],
  templateUrl: './tarjeta-perfil.html',
  styleUrl: './tarjeta-perfil.css',
})
export class TarjetaPerfil {
  protected readonly urlBanner = urlBanner;

  readonly usuario = input<IUsuario | null>(null);
  // Cuántas publicaciones tiene (null = todavía no se sabe).
  readonly totalPublicaciones = input<number | null>(null);

  private readonly avatar = viewChild(Avatar, { read: ElementRef });

  // El número que se ve: GSAP lo hace "contar" hasta el total.
  protected readonly publicacionesMostradas = signal(0);

  // "oct 2026": desde cuándo está en TONARI.
  protected readonly miembroDesde = computed(() => {
    const usuario = this.usuario();
    if (!usuario) return '';
    return new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' })
      .format(new Date(usuario.createdAt))
      .replace('.', '');
  });

  constructor() {
    effect(() => {
      const total = this.totalPublicaciones();
      if (total !== null) {
        // untracked: el efecto depende solo del total, no del número que va contando.
        contarHasta(untracked(this.publicacionesMostradas), total, (valor) =>
          this.publicacionesMostradas.set(valor),
        );
      }
    });

    afterNextRender(() => {
      const avatar = this.avatar();
      if (avatar) aparecerConRebote(avatar.nativeElement);
    });
  }
}
