// Iconos de las tropas reclutables, dibujados a mano como los de los edificios (provisionales hasta tener arte): el arma o la pieza que distingue a cada
// una sobre un lienzo de 32×32, con `currentColor` para el trazo y `--relleno` para las superficies, así el botón los tiñe según su estado.

const T = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const R = 'fill="var(--relleno, rgba(205,160,90,0.25))" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"';

/** Una lanza de (x1,y1) a la punta (x2,y2), con la hoja en forma de hoja de laurel. */
const lanza = (x1: number, y1: number, x2: number, y2: number): string => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
  const bx = x2 - ux * 5, by = y2 - uy * 5, px = -uy * 1.8, py = ux * 1.8;
  const f = (n: number): string => n.toFixed(1);
  return `<path ${T} d="M${x1} ${y1}L${f(bx)} ${f(by)}"/><path ${R} d="M${f(bx)} ${f(by)}Q${f(bx + px + ux * 2)} ${f(by + py + uy * 2)} ${x2} ${y2}Q${f(bx - px + ux * 2)} ${f(by - py + uy * 2)} ${f(bx)} ${f(by)}Z"/>`;
};
/** Escudo redondo con umbo. */
const escudo = (cx: number, cy: number, r: number): string => `<circle ${R} cx="${cx}" cy="${cy}" r="${r}"/><circle ${T} cx="${cx}" cy="${cy}" r="${(r / 4).toFixed(1)}"/>`;
/** Cabeza de caballo mirando a la izquierda. */
const caballo = `<path ${R} d="M23 28c0-6-1-11-4-14l-5-6c-1-1-3-1-4 0L5 12c-1 1-1 3 1 3l5 0 3 3c2 2 3 6 3 10Z"/><path ${T} d="M15 8l2-4 1 4M19 14c2-2 4-2 6-1M9 11h.1"/>`;
/** Arco simple con su flecha. */
const arco = `<path ${T} d="M10 4c9 4 9 20 0 24M10 4v24"/><path ${T} d="M6 16h20M22 13l4 3-4 3M6 14l2 2-2 2"/>`;
/** Arco compuesto (recurvo). */
const arcoCompuesto = `<path ${T} d="M12 3c-2 1-1 3 0 4 6 4 6 14 0 18-1 1-2 3 0 4M12 7v18"/><path ${T} d="M8 16h18M22 13l4 3-4 3"/>`;
/** Honda: dos cuerdas y la bolsa con la piedra. */
const honda = `<path ${T} d="M6 4c2 8 6 14 10 18M14 4c0 8 2 14 2 18"/><path ${R} d="M13 21c1-1 5-1 6 1l-1 4c-1 1-3 1-4 0Z"/>`;
const espada = (largo: number): string => `<path ${R} d="M16 ${28 - largo}l2 3v${largo - 9}h-4v-${largo - 9}Z"/><path ${T} d="M11 22h10M16 22v5M14.5 28h3"/>`;
const hacha = `<path ${T} d="M10 28L22 6"/><path ${R} d="M17 10c3-4 8-4 11-2-2 3-2 8 0 11-4 0-8-3-9-6Z"/>`;

const DIBUJOS: Record<string, string> = {
  // Centro Urbano: la leva y los oficios.
  milicia_lanceros: `${lanza(9, 29, 24, 3)}${escudo(10, 20, 6)}`,
  lenadores: `<path ${R} d="M3 22h18v5H3z"/><circle ${T} cx="6" cy="24.5" r="1.4"/><path ${T} d="M14 20L26 6"/><path ${R} d="M22 8c2-3 6-3 8-1-2 2-2 5-1 7-3 0-5-2-6-4Z"/>`,
  granjeros: `<path ${T} d="M9 28L19 14"/><path ${R} d="M19 14c-4-6-1-12 6-11-4 2-5 6-3 9Z"/><path ${T} d="M24 28V14M24 18l-3-3M24 18l3-3M24 22l-3-3M24 22l3-3"/>`,
  mineros: `<path ${T} d="M9 28L21 9"/><path ${R} d="M8 9c6-4 14-4 20 2-6-2-13-2-20-2Z"/><path ${R} d="M20 28l2-5 5-1 3 6Z"/>`,
  // Barracón: infantería.
  lanceros_mimbre: `${lanza(6, 29, 21, 3)}<path ${R} d="M13 12h12v15l-6 3-6-3Z"/><path ${T} d="M13 17h12M13 22h12M17 12v17M21 12v17"/>`,
  espadachines_cobre: `${espada(24)}<path ${R} d="M21 5h8l-1.5 3 1.5 3h-8l1.5-3Z"/>`,
  hacheros_ligeros: hacha,
  espadachines_bronce: `${escudo(21, 17, 8)}${espada(24)}`,
  lanceros_pesados: `${lanza(5, 29, 24, 3)}${lanza(27, 29, 8, 3)}${escudo(16, 19, 8)}`,
  hacheros_armados: `<path ${T} d="M16 4v25"/><path ${R} d="M16 8c-4-3-9-3-11 0 2 3 2 7 0 10 2 3 7 3 11 0Z"/><path ${R} d="M16 8c4-3 9-3 11 0-2 3-2 7 0 10-2 3-7 3-11 0Z"/>`,
  guerreros_filisteos: `<path ${R} d="M7 17h18v4H7z"/><path ${T} d="M9 17V6M12 17V4M15 17V3M18 17V3M21 17V4M24 17V6M8 21v6M24 21v6"/>`,
  shardana: `<path ${R} d="M8 22c0-7 3-11 8-11s8 4 8 11Z"/><path ${T} d="M8 15c-4-2-5-7-3-11M24 15c4-2 5-7 3-11M6 22h20"/><circle ${R} cx="16" cy="8" r="2.5"/>`,
  hequetai: `<path ${R} d="M7 23c0-9 4-15 9-15s9 6 9 15Z"/><path ${T} d="M8 14h16M7 18h18M16 8V4M6 23h20"/><path ${T} d="M10 14v4M14 14v4M18 14v4M22 14v4"/>`,
  hoplitas_ciudadanos: `${lanza(4, 29, 27, 3)}<circle ${R} cx="15" cy="18" r="10"/><circle ${T} cx="15" cy="18" r="7"/>`,
  espartiatas: `<circle ${R} cx="16" cy="17" r="11"/><path ${T} d="M10 23L16 10l6 13"/>`,
  // Galería de Tiro: tiradores.
  honderos: honda,
  escaramuzadores_jabalina: `${lanza(5, 28, 22, 4)}${lanza(11, 29, 28, 7)}`,
  arqueros: arco,
  arqueros_compuesto: arcoCompuesto,
  honderos_rodios: `${honda}<circle ${R} cx="24" cy="8" r="1.8"/><circle ${R} cx="27" cy="13" r="1.8"/><circle ${R} cx="23" cy="14" r="1.8"/>`,
  peltastas: `${lanza(6, 29, 26, 3)}<path ${R} d="M5 12c3 2 7 2 9-1 2 3 6 3 9 1-1 8-5 13-9 13S6 20 5 12Z"/>`,
  arqueros_escitas: `${arcoCompuesto}<path ${R} d="M23 20l5-2 1 9-5 2Z"/>`,
  // Caballerizas: montados.
  exploradores_caballo: `${caballo}<circle ${T} cx="25" cy="7" r="3.5"/><circle cx="25" cy="7" r="1" fill="currentColor"/>`,
  carros_guerra: `<path ${R} d="M4 15h15l2 6H4Z"/><circle ${R} cx="12" cy="23" r="5"/><path ${T} d="M12 18v10M7 23h10M8.5 19.5l7 7M15.5 19.5l-7 7M19 18h10M4 15V9"/>`,
  jinetes_asirios: `${caballo}<path ${T} d="M25 3c5 3 5 11 0 14M25 3v14"/>`,
  jinetes_escitas: `${caballo}<path ${R} d="M22 9c0-4 2-7 6-8-1 3 0 6 1 8Z"/>`,
  caballeria_asiria: `${caballo}${lanza(15, 30, 30, 2)}`,
};

/** El icono SVG de una tropa (una lanza y un escudo genéricos si no tiene dibujo). */
export function iconoTropa(id: string, lado = 32): string {
  const d = DIBUJOS[id] ?? `${lanza(9, 29, 24, 3)}${escudo(10, 20, 6)}`;
  return `<svg class="icono-tropa" width="${lado}" height="${lado}" viewBox="0 0 32 32" aria-hidden="true">${d}</svg>`;
}

export const TROPAS_CON_ICONO = Object.keys(DIBUJOS);
