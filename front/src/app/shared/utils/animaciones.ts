import { gsap } from 'gsap';
import confetti from 'canvas-confetti';

// Festejo con confeti (canvas-confetti) en los colores de TONARI:
// al crear la cuenta. Sale desde los dos costados de abajo.
export function celebrar() {
  const opciones = {
    particleCount: 70,
    spread: 70,
    startVelocity: 45,
    colors: ['#b9f3e4', '#c7b8ff', '#f0ede5'],
    disableForReducedMotion: true, // respeta "reducir movimiento"
  };
  confetti({ ...opciones, angle: 60, origin: { x: 0, y: 0.9 } });
  confetti({ ...opciones, angle: 120, origin: { x: 1, y: 0.9 } });
}

// Elementos que ya entraron: así un "Me gusta" (que redibuja la lista)
// no vuelve a animar las tarjetas que ya estaban en pantalla.
const yaAnimados = new WeakSet<Element>();

const menosMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Aparece creciendo con un pequeño rebote (por ejemplo, una foto de perfil).
export function aparecerConRebote(elemento: Element) {
  if (menosMovimiento()) return;
  gsap.from(elemento, {
    scale: 0.6,
    opacity: 0,
    duration: 0.8,
    delay: 0.2,
    ease: 'back.out(1.8)',
    clearProps: 'opacity,transform',
  });
}

// Cuenta de un número a otro (0 → 12) y avisa cada valor intermedio.
export function contarHasta(desde: number, hasta: number, alCambiar: (valor: number) => void) {
  if (menosMovimiento() || desde === hasta) {
    alCambiar(hasta);
    return;
  }
  const contador = { valor: desde };
  gsap.to(contador, {
    valor: hasta,
    duration: 1.1,
    ease: 'power2.out',
    onUpdate: () => alCambiar(Math.round(contador.valor)),
  });
}

// Entrada en cascada con GSAP: cada elemento sube y aparece un poquito
// después que el anterior. Si el usuario pidió menos movimiento, no se anima.
export function entrarEnCascada(elementos: Element[]) {
  const nuevos = elementos.filter((elemento) => !yaAnimados.has(elemento));
  if (nuevos.length === 0) return;
  nuevos.forEach((elemento) => yaAnimados.add(elemento));

  if (menosMovimiento()) return;

  gsap.from(nuevos, {
    opacity: 0,
    y: 28,
    scale: 0.98,
    duration: 0.6,
    ease: 'power3.out',
    stagger: 0.08,
    // Al terminar se borran los estilos en línea, para que el :hover
    // de la tarjeta (que también usa transform) siga funcionando.
    clearProps: 'opacity,transform',
  });
}
