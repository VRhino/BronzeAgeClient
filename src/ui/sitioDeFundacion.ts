// FUNDAR SIN ADIVINAR (Víctor, 2026-11-22): antes de pulsar «Fundar aquí», el cliente mira lo mismo que el motor (`territorio::fundacion::validar` y
// `Nucleo::validar_fundacion`, Fundacion_Y_Refundacion §5) y en el mismo orden, para decir por qué no se puede y pintar en rojo los círculos donde no se
// funda (los campamentos de mercenarios y las plazas que se conocen). Quien decide sigue siendo el motor: esto solo evita adivinar. Lo que el cliente
// no sabe (una plaza que nunca vio) lo rechaza el motor con su motivo, que el panel enseña igual.
import { bloqueDeDatos, distanciasDeFundar, type ProyeccionJugador } from '../apiCliente';
import type { MapaGenerado } from '../terreno';
import { densidadBosqueEn, pendienteEn } from '../mundo/pintarArtefacto';

type Punto = { x: number; y: number };

/** Un círculo donde no se funda: el de un campamento de mercenarios (`exclusion_campamento`) o el de una plaza (`separacion_plazas`). */
export interface Prohibido { centro: Punto; radio: number; de: 'campamento' | 'plaza' }

export interface SitioDeFundacion {
  /** Por qué no se puede fundar aquí, dicho para el jugador; `null` si nada lo impide. */
  motivo: string | null;
  /** Los círculos prohibidos cerca del punto, para pintarlos. */
  prohibidos: Prohibido[];
}

/** Hasta dónde se pintan los círculos prohibidos alrededor del punto. */
const ALCANCE_PROHIBIDOS = 80;

interface OrillaRio { mediaAnchura?: number; mediaAnchuraNavegable?: number; radio?: { plaza?: number } }

const distancia = (a: Punto, b: Punto): number => Math.hypot(a.x - b.x, a.y - b.y);

function aSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function dentroDe(p: Punto, poligono: readonly Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!, b = poligono[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/** La clase de terreno de la celda (`rasters.terreno`: 1 agua…), o `null` sin la capa. */
function terrenoEn(mapa: MapaGenerado, p: Punto): number | null {
  const r = mapa.rasters?.terreno;
  if (!r) return null;
  const c = Math.min(r.columnas - 1, Math.max(0, Math.floor(p.x / r.celda)));
  const f = Math.min(r.filas - 1, Math.max(0, Math.floor(p.y / r.celda)));
  return r.datos[f * r.columnas + c]!;
}

/** Las plazas que se conocen, propias y ajenas, con su posición. */
function plazasConocidas(p: ProyeccionJugador): Punto[] {
  return [...p.asentamientos, ...p.asentamientosAvistados, ...p.asentamientosConocidos].map((a) => a.posicion);
}

/** Los campamentos de mercenarios: los del artefacto (todos) y, por si acaso, los de la proyección. */
function campamentos(p: ProyeccionJugador, mapa: MapaGenerado): Punto[] {
  return [...(mapa.campamentos ?? []).map((c) => c.posicion), ...(p.campamentosMercenarios ?? []).map((c) => c.posicion)];
}

export function sitioDeFundacion(p: ProyeccionJugador, mapa: MapaGenerado, punto: Punto): SitioDeFundacion {
  const d = distanciasDeFundar();
  const plazas = plazasConocidas(p);
  const camps = campamentos(p, mapa);
  const cerca = (lista: Punto[], radio: number, de: Prohibido['de']): Prohibido[] =>
    lista.filter((c) => distancia(c, punto) < ALCANCE_PROHIBIDOS + radio).map((centro) => ({ centro, radio, de }));
  const prohibidos = [...cerca(camps, d.campamentos, 'campamento'), ...cerca(plazas, d.plazas, 'plaza')]
    .filter((x, i, todos) => todos.findIndex((y) => y.de === x.de && distancia(y.centro, x.centro) < 0.5) === i);
  return { motivo: motivo(p, mapa, punto, plazas, camps, d), prohibidos };
}

function motivo(p: ProyeccionJugador, mapa: MapaGenerado, punto: Punto, plazas: Punto[], camps: Punto[], d: { plazas: number; campamentos: number }): string | null {
  const { ancho, alto } = mapa.config;
  if (punto.x < 0 || punto.y < 0 || punto.x > ancho || punto.y > alto) return 'Fuera del mapa.';
  if (terrenoEn(mapa, punto) === 1) return 'Sobre el agua no se funda: busca tierra firme.';
  const fundacion = bloqueDeDatos<{ pendienteMaximaParaFundar?: number; densidadBosqueMaximaParaFundar?: number; distanciaMinimaANodo?: number }>('FUNDACION');
  const pendiente = pendienteEn(mapa, punto);
  if (pendiente !== null && pendiente > Number(fundacion?.pendienteMaximaParaFundar ?? 0.3)) {
    return `Demasiada pendiente (${Math.round((Math.atan(pendiente) * 180) / Math.PI)}°): busca un sitio más llano.`;
  }
  const densidad = densidadBosqueEn(mapa, punto);
  if (densidad !== null && densidad >= Number(fundacion?.densidadBosqueMaximaParaFundar ?? 0.7)) return 'Bosque cerrado: busca la orilla o un claro.';
  // la ciudad más grande que puede tener la plaza no puede entrar en el cauce (`ORILLA_RIO`, 2026-11-18)
  const orilla = bloqueDeDatos<OrillaRio>('ORILLA_RIO');
  const radioPlaza = Number(orilla?.radio?.plaza ?? 8);
  for (const r of mapa.rios ?? []) {
    const limite = (r.navegable ? Number(orilla?.mediaAnchuraNavegable ?? 1.5) : Number(orilla?.mediaAnchura ?? 0.75)) + radioPlaza;
    for (let k = 1; k < r.puntos.length; k++) if (aSegmento(punto, r.puntos[k - 1]!, r.puntos[k]!) < limite) return 'Demasiado pegado al río: la ciudad no cabría. Apártate un poco de la orilla.';
  }
  if ((p.zonasFusionadas ?? []).some((z) => z.contornos.some((c) => c.length > 2 && dentroDe(punto, c)))) return 'Dentro del territorio de otra plaza: sal de su zona.';
  const plaza = plazas.map((c) => distancia(c, punto)).filter((x) => x < d.plazas).sort((a, b) => a - b)[0];
  if (plaza !== undefined) return `Muy cerca de otra plaza: aléjate ${Math.ceil(d.plazas - plaza)} más.`;
  const camp = camps.map((c) => distancia(c, punto)).filter((x) => x < d.campamentos).sort((a, b) => a - b)[0];
  if (camp !== undefined) return `Muy cerca de un campamento de mercenarios: aléjate ${Math.max(1, Math.ceil(d.campamentos - camp))} más (hace falta ${d.campamentos} o más).`;
  // Desde el 23-11 (Tamaños y distancias): a `FUNDACION.distanciaMinimaANodo` (10) o más de todo nodo de recurso.
  const minimaANodo = Number(fundacion?.distanciaMinimaANodo ?? 10);
  if (minimaANodo > 0) {
    let cercano = Infinity;
    for (const n of mapa.nodos ?? []) { const d = distancia(n.posicion, punto); if (d < cercano) cercano = d; }
    if (cercano < minimaANodo) return `Muy cerca de un yacimiento: aléjate ${Math.max(1, Math.ceil(minimaANodo - cercano))} más (hace falta ${minimaANodo} o más de todo nodo de recurso).`;
  }
  return null;
}
