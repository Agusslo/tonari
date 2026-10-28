import { gsap } from 'gsap';

// Elementos que ya entraron: así un "Me gusta" (que redibuja la lista)
// no vuelve a animar las tarjetas que ya estaban en pantalla.
const yaAnimados = new WeakSet<Element>();

// Entrada en cascada con GSAP: cada elemento sube y aparece un poquito
// después que el anterior. Si el usuario pidió menos movimiento, no se anima.
export function entrarEnCascada(elementos: Element[]) {
  const nuevos = elementos.filter((elemento) => !yaAnimados.has(elemento));
  if (nuevos.length === 0) return;
  nuevos.forEach((elemento) => yaAnimados.add(elemento));

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
