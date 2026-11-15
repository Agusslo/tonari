import { computed, effect, Service, signal } from '@angular/core';

export type NombreTema = 'oscuro' | 'claro';

// Dónde se recuerda la elección (solo en este navegador).
const CLAVE = 'tonari-tema';

// Modo claro / oscuro (extra).
// El tema se aplica con un atributo en <html data-tema="claro">: styles.css cambia
// los colores (las variables) según ese atributo, y toda la app se adapta sola.
// index.html lo pone ANTES de que cargue Angular, para que no "parpadee" en oscuro.
@Service()
export class Tema {
  readonly tema = signal<NombreTema>(temaInicial());

  // El logo original es claro (contorno hueso y menta): sobre fondo blanco no se ve.
  // En modo claro se usa la versión con contorno tinta y menta oscura.
  readonly logo = computed(() => (this.tema() === 'claro' ? 'logo-claro.svg' : 'logo.svg'));

  constructor() {
    // Cada vez que cambia: atributo en <html>, color de la barra del celular y se guarda.
    effect(() => {
      const tema = this.tema();
      document.documentElement.dataset['tema'] = tema;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', tema === 'claro' ? '#f4f3ef' : '#111116');
      try {
        localStorage.setItem(CLAVE, tema);
      } catch {
        // navegación privada o almacenamiento bloqueado: vale solo por esta visita
      }
    });
  }

  alternar() {
    this.tema.update((tema) => (tema === 'oscuro' ? 'claro' : 'oscuro'));
  }
}

// Lo que eligió antes; si nunca eligió, lo que tenga configurado el sistema.
function temaInicial(): NombreTema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch {
    // sin almacenamiento: seguimos con el del sistema
  }
  return matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro';
}
