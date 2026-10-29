// Iconos de los edificios de la plaza, dibujados a mano para el cliente (provisionales hasta tener arte): trazos de bronce sobre un lienzo de
// 32×32, con `currentColor` para el trazo y `--relleno` para las superficies, así el botón los tiñe según su estado (activo, apagado, construido).

const T = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const R = 'fill="var(--relleno, rgba(205,160,90,0.25))" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"';

/** Una casa de adobe: tejado a dos aguas y puerta. */
const casa = (x: number, y: number, w: number, h: number): string =>
  `<path ${R} d="M${x} ${y + h}V${y + h * 0.45}L${x + w / 2} ${y}L${x + w} ${y + h * 0.45}V${y + h}Z"/><path ${T} d="M${x + w / 2 - 1.6} ${y + h}v-${h * 0.32}h3.2v${h * 0.32}"/>`;

const DIBUJOS: Record<string, string> = {
  centroUrbano: `<path ${R} d="M5 27V13l11-7 11 7v14Z"/><path ${T} d="M3 14L16 5l13 9M10 27v-8h12v8M16 9v3"/><path ${T} d="M13 19v8M19 19v8"/>`,
  vivienda: casa(7, 7, 18, 20),
  granja: `<path ${T} d="M4 26h24"/><path ${T} d="M8 26c0-6 1-11 2-15M8 18l-3-3M8 15l3-3M16 26c0-7 1-12 2-17M16 17l-3-3M16 13l3-3M24 26c0-6 1-11 2-15M24 18l-3-3M24 15l3-3"/>`,
  cantera: `<path ${R} d="M4 27l5-11 5 4 4-9 10 16Z"/><path ${T} d="M20 6l6 6M24 4l-6 6"/>`,
  lenera: `<path ${R} d="M6 22h20v4H6z"/><path ${R} d="M8 18h16v4H8z"/><circle ${T} cx="8" cy="24" r="1.3"/><circle ${T} cx="10" cy="20" r="1.3"/><path ${T} d="M20 5l7 7M22 13l4-4"/>`,
  almacen: `<path ${R} d="M4 27V12l12-6 12 6v15Z"/><path ${T} d="M10 27V17h12v10M10 22h12M16 17v10"/>`,
  granero: `<path ${R} d="M8 27V13a8 8 0 0 1 16 0v14Z"/><path ${T} d="M8 18h16M8 23h16M16 5v-2"/>`,
  mina: `<path ${R} d="M4 27c0-8 5-14 12-14s12 6 12 14Z"/><path ${T} d="M11 27v-6a5 5 0 0 1 10 0v6"/><path ${T} d="M8 9l6 6M14 9l-6 6"/>`,
  minaCobre: `<path ${R} d="M4 27c0-8 5-14 12-14s12 6 12 14Z"/><path ${T} d="M11 27v-6a5 5 0 0 1 10 0v6"/><circle ${T} cx="24" cy="8" r="3"/>`,
  minaEstano: `<path ${R} d="M4 27c0-8 5-14 12-14s12 6 12 14Z"/><path ${T} d="M11 27v-6a5 5 0 0 1 10 0v6"/><path ${T} d="M22 5l4 3-4 3-4-3Z"/>`,
  minaHierro: `<path ${R} d="M4 27c0-8 5-14 12-14s12 6 12 14Z"/><path ${T} d="M11 27v-6a5 5 0 0 1 10 0v6"/><path ${T} d="M20 5h7v5h-7Z"/>`,
  corral: `<path ${T} d="M4 14v12M12 14v12M20 14v12M28 14v12M3 17h26M3 23h26"/>`,
  fundicion: `<path ${R} d="M9 27V12h14v15Z"/><path ${T} d="M13 27v-5a3 3 0 0 1 6 0v5M12 12V6h4v6"/><path ${T} d="M14 4c1-1 1-2 0-3"/>`,
  granFundicion: `<path ${R} d="M5 27V12h22v15Z"/><path ${T} d="M10 27v-5a3 3 0 0 1 6 0v5M18 27v-5a3 3 0 0 1 6 0v5M8 12V5h4v7M20 12V5h4v7"/>`,
  curtiduria: `<path ${R} d="M9 6h14l-2 6 3 4-3 4 2 6H9l2-6-3-4 3-4Z"/><path ${T} d="M5 4v24M27 4v24"/>`,
  armeria: `<path ${T} d="M7 25L23 9M23 9l3-3M20 6l6 6M25 25L9 9M9 9L6 6M6 12l6-6"/><path ${R} d="M13 21l-2 4h10l-2-4Z"/>`,
  carpinteria: `<path ${R} d="M4 20h24v3H4z"/><path ${T} d="M7 23v4M25 23v4M10 20l4-12h4l-2 12M20 8l6-3"/>`,
  tallerCarpinteria: `<path ${R} d="M4 20h24v3H4z"/><path ${T} d="M7 23v4M25 23v4M10 20l4-12h4l-2 12M20 8l6-3"/>`,
  barracon: `<path ${R} d="M3 27V15l13-7 13 7v12Z"/><path ${T} d="M10 27v-6h12v6M16 4v4M16 4h5l-2 1.5 2 1.5h-5"/>`,
  galeriaDeTiro: `<circle ${R} cx="12" cy="16" r="8"/><circle ${T} cx="12" cy="16" r="4"/><path ${T} d="M12 16L28 8M24 7l4 1-1 4"/>`,
  caballerizas: `<path ${R} d="M4 27V14l12-6 12 6v13Z"/><path ${T} d="M12 27v-6h8v6M20 15c-2-3-6-3-7 0l-2 3h3"/>`,
  salaConsejo: `<path ${R} d="M4 12h24l-12-7Z"/><path ${T} d="M7 13v12M12 13v12M20 13v12M25 13v12M4 26h24M3 28h26"/>`,
  taberna: `<path ${R} d="M9 10h11v15a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2Z"/><path ${T} d="M20 13h3a3 3 0 0 1 0 6h-3M9 10c0-3 11-3 11 0M13 15v8M17 15v8"/>`,
  palacio: `<path ${R} d="M4 27V14h24v13Z"/><path ${T} d="M4 14l4-6 4 6M12 14l4-8 4 8M20 14l4-6 4 6M13 27v-6h6v6M8 18v3M24 18v3"/>`,
  mercado: `<path ${R} d="M4 13h24l-3-6H7Z"/><path ${T} d="M6 13v14M26 13v14M4 27h24M10 18h12v5H10z"/>`,
  puestoMercado: `<path ${R} d="M6 13h20l-2-5H8Z"/><path ${T} d="M8 13v12M24 13v12M8 19h16"/>`,
  maravilla: `<path ${R} d="M4 27L16 4l12 23Z"/><path ${T} d="M9 18h14M12 12h8M2 27h28"/>`,
  muralla: `<path ${R} d="M3 27V12h4v3h4v-3h4v3h4v-3h4v3h4v-3h2v15Z"/><path ${T} d="M3 20h26M10 15v12M22 15v12"/>`,
  plaza: `<circle ${R} cx="16" cy="16" r="10"/><circle ${T} cx="16" cy="16" r="3"/>`,
  plazaDeArmas: `<circle ${R} cx="16" cy="18" r="9"/><path ${T} d="M16 4v14M16 4h7l-2 2 2 2h-7"/>`,
  patioDeGremios: `<path ${R} d="M6 6h20v20H6z"/><path ${T} d="M11 11h10v10H11zM16 6v5M16 21v5M6 16h5M21 16h5"/>`,
  pozo: `<path ${R} d="M8 18h16v9H8z"/><path ${T} d="M8 18c0-2 16-2 16 0M10 18V7M22 18V7M8 7h16M16 7v6"/>`,
  parque: `<circle ${R} cx="11" cy="12" r="6"/><circle ${R} cx="21" cy="14" r="5"/><path ${T} d="M11 18v9M21 19v8M4 27h24"/>`,
};

/** El icono SVG de un tipo de edificio (uno genérico si no tiene dibujo). */
export function iconoEdificio(tipo: string, lado = 32): string {
  const d = DIBUJOS[tipo] ?? casa(8, 8, 16, 18);
  return `<svg class="icono-edificio" width="${lado}" height="${lado}" viewBox="0 0 32 32" aria-hidden="true">${d}</svg>`;
}
