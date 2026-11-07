// Una avanzada en la vista 3D de dentro (atalaya, fuerte o ciudadela). El motor no manda planta de una avanzada: el recinto y lo que hay dentro
// salen de su etapa, siempre iguales para la misma etapa, y ocupan lo mismo que la maqueta del mapa (`mundo3d/maquetas.ts`):
//   atalaya    empalizada cuadrada de 6 × 6 celdas, la torre de vigía en medio y un pozo;
//   fuerte     muro de adobe de 10 × 10 celdas con torres en las esquinas: torre del homenaje, barracón, almacén, leñera y pozo;
//   ciudadela  muro ciclópeo redondo de radio 9 celdas con torres: torre del homenaje grande, barracón, almacén, granero, patio de armas y pozo.
// En ruinas, los edificios son escombro y la muralla queda en pie solo en parte.
import type { AvanzadaDeMapa, CeldaMuro, Edificio, Recinto, RectanguloLocal } from '../tiposDominio';
import { rellenoDeCampamento } from './campamento';
import { ciudadEnVista, type CiudadEnVista, type OpcionesCiudad } from './estado';

const T = 3;

type Pieza = [tipo: string, x: number, y: number, ancho: number, alto: number];

/** Lo que hay dentro de cada etapa, en ul (x a la derecha, y hacia abajo; la puerta, abajo). */
const PIEZAS: Record<number, Pieza[]> = {
  1: [['torreVigia', -3, -6, 6, 6], ['pozo', 3, 0, 3, 3], ['lenera', -6, 0, 3, 3]],
  2: [['torreHomenaje', -3, -12, 6, 6], ['barracon', -12, -3, 9, 6], ['almacen', 3, -3, 9, 6], ['lenera', 6, -12, 6, 6], ['pozo', -12, -12, 3, 3]],
  3: [['torreHomenaje', -6, -21, 12, 12], ['barracon', -21, -6, 12, 9], ['almacen', 9, -6, 12, 9], ['granero', 9, 6, 9, 9], ['plazaDeArmas', -18, 6, 12, 9], ['pozo', 3, 15, 3, 3]],
};

/** Nivel de plaza con que se dibujan los edificios (su estilo) y nivel de la muralla, por etapa. */
const NIVEL: Record<number, { plaza: number; muro: number }> = { 1: { plaza: 1, muro: 1 }, 2: { plaza: 3, muro: 2 }, 3: { plaza: 4, muro: 3 } };

/** Un anillo cuadrado de celdas, de `c0` a `c1` (columnas y filas), en orden; torres en las esquinas y la puerta en las dos celdas del medio de abajo. */
function anilloCuadrado(c0: number, c1: number): CeldaMuro[] {
  const celdas: CeldaMuro[] = [];
  const clase = (col: number, row: number): CeldaMuro['clase'] =>
    (col === c0 || col === c1) && (row === c0 || row === c1) ? 'torre' : row === c1 && (col === -1 || col === 0) ? 'puerta' : 'muro';
  for (let col = c0; col < c1; col++) celdas.push({ col, row: c0, clase: clase(col, c0) });
  for (let row = c0; row < c1; row++) celdas.push({ col: c1, row, clase: clase(c1, row) });
  for (let col = c1; col > c0; col--) celdas.push({ col, row: c1, clase: clase(col, c1) });
  for (let row = c1; row > c0; row--) celdas.push({ col: c0, row, clase: clase(c0, row) });
  return celdas;
}

/** Un anillo redondo de radio `r` celdas, en orden y sin huecos (cada celda toca la siguiente); una torre cada seis celdas y la puerta abajo. */
function anilloRedondo(r: number): CeldaMuro[] {
  const celdas: CeldaMuro[] = [];
  const vistas = new Set<string>();
  const pasos = Math.ceil(2 * Math.PI * r * 4);
  for (let i = 0; i < pasos; i++) {
    const a = (i / pasos) * Math.PI * 2;
    const col = Math.round(Math.cos(a) * r - 0.5), row = Math.round(Math.sin(a) * r - 0.5);
    const k = `${col},${row}`;
    if (vistas.has(k)) continue;
    vistas.add(k);
    celdas.push({ col, row, clase: 'muro' });
  }
  const abajo = Math.max(...celdas.map((c) => c.row));
  celdas.forEach((c, i) => {
    if (c.row === abajo && (c.col === -1 || c.col === 0)) c.clase = 'puerta';
    else if (i % 6 === 3) c.clase = 'torre';
  });
  return celdas;
}

/** La avanzada que se dibuja por dentro. */
export function avanzadaEnVista(x: Pick<AvanzadaDeMapa, 'id' | 'etapa' | 'enRuinas'>, o: OpcionesCiudad): CiudadEnVista | null {
  const etapa = Math.max(1, Math.min(3, x.etapa));
  const piezas = PIEZAS[etapa]!;
  const huellas: Record<string, RectanguloLocal> = {};
  const edificios: Edificio[] = piezas.map(([tipo, px, py, ancho, alto], i) => {
    const id = `${x.id}-${tipo}-${i}`;
    huellas[id] = { x: px, y: py, ancho, alto };
    return { id, tipo, estado: x.enRuinas ? 'en_cola' : 'activo', danado: x.enRuinas || undefined, posicion: { x: px + ancho / 2, y: py + alto / 2 } };
  });
  const celdas = etapa === 1 ? anilloCuadrado(-3, 2) : etapa === 2 ? anilloCuadrado(-5, 4) : anilloRedondo(9);
  const recinto: Recinto = { id: `${x.id}-recinto`, nivel: NIVEL[etapa]!.muro, celdas, avance: x.enRuinas ? Math.floor(celdas.length * 0.45) : celdas.length };
  const abajo = Math.max(...celdas.map((c) => c.row));
  const ancla = huellas[edificios[0]!.id]!;
  const fondo = ancla.y + ancla.alto;
  // la calle: de la puerta al edificio de dentro, del ancho de la puerta (dos celdas); el camino, de la puerta hacia fuera
  const calles: RectanguloLocal[] = [{ x: -T, y: fondo, ancho: 2 * T, alto: abajo * T - fondo }];
  const caminos: RectanguloLocal[] = [{ x: -T, y: (abajo + 1) * T, ancho: 2 * T, alto: 8 * T }];
  const c = ciudadEnVista(
    { id: x.id, nivel: NIVEL[etapa]!.plaza, edificios, recintos: [recinto] },
    { calles, caminos, huellas, murallas: [], radio: (abajo + 2) * T, celda: T },
    { ...o, centroId: edificios[0]!.id },
  );
  if (c) c.libres = rellenoDeCampamento(c, T);
  return c;
}

/** La planta de la avanzada en SVG, para el minimapa y para cuando no hay 3D: el recinto celda a celda, las calles y los edificios. */
export function svgPlanoAvanzada(c: CiudadEnVista, nombre: (tipo: string) => string): string {
  const L = c.extension + 6;
  const rect = (r: RectanguloLocal, clase: string, titulo = ''): string =>
    `<rect class="${clase}" x="${r.x}" y="${r.y}" width="${r.ancho}" height="${r.alto}">${titulo ? `<title>${titulo}</title>` : ''}</rect>`;
  const muro = c.recintos.flatMap((r) => r.celdas.map((k) =>
    `<rect class="plano-muro ${k.clase}${k.enPie ? '' : ' caido'}" x="${k.x - c.celda / 2}" y="${k.y - c.celda / 2}" width="${c.celda}" height="${c.celda}"/>`)).join('');
  return `<svg class="plano-avanzada" viewBox="${-L} ${-L} ${2 * L} ${2 * L}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Planta de la avanzada">
    ${c.caminos.map((r) => rect(r, 'plano-camino')).join('')}${c.calles.map((r) => rect(r, 'plano-calle')).join('')}
    ${muro}${c.edificios.map((e) => rect(e, `plano-edificio${e.danado ? ' caido' : ''}`, nombre(e.tipo))).join('')}</svg>`;
}
