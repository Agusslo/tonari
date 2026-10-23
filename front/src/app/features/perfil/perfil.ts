import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-perfil',
  imports: [DatePipe, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil {
  // El usuario que ingresó (o null), el mismo que usa Publicaciones.
  protected readonly usuario = inject(Auth).usuarioActual;
}