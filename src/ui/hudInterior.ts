// El HUD del campamento de mercenarios y del pueblo o la aldea, a pantalla completa como la plaza (Víctor, 2026-11-03: «como la plaza, la vista 3D
// ocupe toda la pantalla y los paneles se acomoden»). Es el mismo esqueleto que el de la plaza (`.plaza-3d`, `hudPlaza.ts`): arriba a la izquierda
// un blasón con lo que es el sitio; debajo, el riel con una ventana por cada parte (las pestañas de antes); abajo, el pie con lo que se lleva o se
// guarda; en la esquina, el minimapa. Aquí está el HTML; quien lo pinta y cablea es `main.ts`.
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { iconoEdificio } from './iconosEdificio';
import { miles } from './juegoVisual';

type Escapar = (valor: string) => string;

const T = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const R = 'fill="var(--relleno, rgba(205,160,90,0.25))" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"';
const svg = (lado: number, dibujo: string): string => `<svg class="icono-edificio" width="${lado}" height="${lado}" viewBox="0 0 32 32" aria-hidden="true">${dibujo}</svg>`;

/** Los iconos de las partes que no son un edificio (en el estilo de `iconosEdificio.ts`, 32 × 32). */
const DIBUJO = {
  // un rollo de papiro abierto, con sus renglones
  resumen: `<path ${R} d="M8 5h17v20a3 3 0 0 1-3 3H8Z"/><path ${T} d="M8 5a3 3 0 0 0 0 6h3M12 13h9M12 17h9M12 21h6"/>`,
  // un yelmo con su cimera, de frente
  mercenarios: `<path ${R} d="M8 26V15a8 8 0 0 1 16 0v11h-5v-7h-6v7Z"/><path ${T} d="M16 7V3M12 4c2-2 6-2 8 0M13 19v-3h6v3"/>`,
  // el carro con dos monedas encima
  fondo: `<path ${R} d="M4 18h20v5H4Z"/><circle ${R} cx="9" cy="25" r="3"/><circle ${R} cx="20" cy="25" r="3"/><path ${T} d="M24 20h5"/><circle ${R} cx="12" cy="11" r="4"/><circle ${R} cx="19" cy="9" r="4"/>`,
  // la tienda de lona con su mástil y la entrada abierta
  campamento: `<path ${R} d="M3 26 16 6l13 20Z"/><path ${T} d="M16 3v3M16 26l-4-8h8l-4 8M1 26h30"/>`,
  // el escudo con la lanza cruzada
  guarnicion: `<path ${R} d="M16 5l9 3v7c0 6-4 10-9 12-5-2-9-6-9-12V8Z"/><path ${T} d="M6 27 26 5M23 5h3v3"/>`,
  // el carro de bueyes, de lado
  acarreo: `<path ${R} d="M3 14h17v7H3Z"/><circle ${R} cx="8" cy="24" r="3"/><circle ${R} cx="16" cy="24" r="3"/><path ${T} d="M20 18h4l4-4M26 12l3 2"/>`,
  // un saco atado
  carga: `<path ${R} d="M10 11h12l3 13a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3Z"/><path ${T} d="M10 11c0-3 2-5 6-5s6 2 6 5M13 6l3 3 3-3"/>`,
};

/** El icono de una parte: el de su edificio si lo tiene, si no uno propio. */
export function iconoDeParte(parte: string, lado = 28): string {
  const edificio: Record<string, string> = { tropa: 'barracon', mercado: 'mercado', taberna: 'taberna' };
  if (edificio[parte]) return iconoEdificio(edificio[parte]!, lado);
  const d = DIBUJO[parte as keyof typeof DIBUJO];
  return d ? svg(lado, d) : iconoEdificio(parte, lado);
}

/** El icono de lo que es un pueblo (su mina, su cantera o, en una aldea, la granja). */
export function iconoDePueblo(tipo: string, lado = 46): string {
  return iconoEdificio(tipo === 'aldeaAgricola' ? 'granja' : tipo, lado);
}

/** El icono del campamento, para su blasón. */
export const ICONO_CAMPAMENTO = svg(46, DIBUJO.campamento);

/** El blasón de un campamento o un pueblo: su icono en vez de escudo, el nombre y una o dos líneas de lo que es para ti. */
export function htmlBlasonInterior(b: { icono: string; nombre: string; lineas: string[] }, esc: Escapar): string {
  return `<span class="asent-blason-escudo blason-interior-icono">${b.icono}</span>
    <span class="asent-blason-texto"><span class="asent-blason-nombre"><strong class="asent-nombre">${esc(b.nombre)}</strong></span>${b.lineas.map((l) => `<small>${esc(l)}</small>`).join('')}</span>`;
}

/** Una parte del riel: su id, su nombre y si está abierta. */
export interface ParteDelRiel { id: string; titulo: string }

/** El riel de iconos, uno por parte; la abierta, encendida. Al pasar, su nombre a la derecha (como en la plaza). */
export function htmlRielInterior(partes: readonly ParteDelRiel[], abierta: string | null, esc: Escapar): string {
  return partes.map((x) => `<button type="button" class="asent-riel-boton${x.id === abierta ? ' activo' : ''}" data-parte="${esc(x.id)}" data-etiqueta="${esc(x.titulo)}" aria-label="${esc(x.titulo)}" aria-pressed="${x.id === abierta}">${iconoDeParte(x.id)}</button>`).join('');
}

/** El título de la ventana de una parte: su icono y su nombre. */
export function htmlTituloDeParte(parte: string, titulo: string, esc: Escapar): string {
  return `<span class="asent-ventana-icono">${iconoDeParte(parte, 26)}</span><h2>${esc(titulo)}</h2>`;
}

/** Una placa del pie con su letrero, como las de la plaza: cada recurso con su icono y su cifra (solo los que pasan de 0). */
export function htmlPlacaDeRecursos(clase: string, titulo: string, recursos: Record<string, number>, esc: Escapar, capacidad?: number): string {
  const filas = Object.entries(recursos).filter(([r, n]) => r && Math.floor(n) >= 1).sort(([a], [b]) => a.localeCompare(b));
  const pieza = (icono: string, nombre: string, n: number, detalle: string): string => {
    const llenado = capacidad ? Math.min(100, (n / capacidad) * 100) : 0;
    return `<span class="asent-recurso${capacidad && llenado >= 90 ? ' lleno' : ''}" data-nombre="${esc(nombre)}" data-detalle="${esc(detalle)}"><span class="asent-recurso-icono" aria-hidden="true">${icono}</span>${miles(n)}${capacidad ? `<span class="asent-recurso-barra" style="--llenado:${llenado.toFixed(1)}%"></span>` : ''}</span>`;
  };
  const total = filas.reduce((t, [, n]) => t + n, 0);
  const piezas = filas.length === 0 ? [] : [
    ...(capacidad ? [pieza('🏚️', titulo, total, `${miles(total)} de ${miles(capacidad)} entre todo`)] : []),
    ...filas.map(([r, n]) => pieza(RECURSO_ICONO[r] ?? '📦', RECURSO_NOMBRE[r] ?? r, n, capacidad ? `${miles(n)} de ${miles(capacidad)} entre todo` : miles(n))),
  ];
  return `<section class="asent-pie-grupo asent-pie-${clase}" aria-label="${esc(titulo)}"><span class="asent-pie-titulo">${esc(titulo)}</span><div class="asent-pie-piezas">${piezas.join('') || '<span class="asent-recurso-vacio">Vacío</span>'}</div></section>`;
}
