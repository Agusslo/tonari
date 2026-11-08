// "hoy 13:30", "mañana 22:00", "sáb 10:00": cuándo sale un episodio, en tu hora local.
// Lo usan "Esta semana sale" (muro) y la lista de episodios de la ficha.
export function cuandoSale(fecha: Date): string {
  const hora = fecha.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // 21:30 y no "09:30 p. m."
  });
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  if (fecha.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  if (fecha.toDateString() === manana.toDateString()) return `mañana ${hora}`;
  // A más de una semana, con la fecha: "15/11 10:00" (si no, "sáb" sería ambiguo).
  if (fecha.getTime() - hoy.getTime() > 6 * 24 * 60 * 60 * 1000) {
    return `${fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${hora}`;
  }
  const dia = fecha.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return `${dia} ${hora}`;
}
