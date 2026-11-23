// LA PUERTA ES TODO EL CONTORNO (motor 23-11-2026, «Tamaños y distancias del mapa», tanda 2): estar «a la puerta» de una plaza, un pueblo, una aldea,
// una avanzada o un campamento es estar a `MOVIMIENTO.radioPuerta` (1 u) o menos de su BORDE, por cualquier lado: a `radio + radioPuerta` del centro,
// con el radio de `TAMANOS_MAPA.radio` (la plaza por nivel y muralla, la aldea por nivel, la avanzada por etapa). Atacar y unirse a una batalla se
// miden igual desde el borde (`radioEncuentro`). Los sitios del cliente que decidían esto con la distancia al centro llaman aquí.
import { bloqueDeDatos, radioDePuerta, type ProyeccionJugador } from '../apiCliente';

type Punto = { x: number; y: number };

interface RadiosDelMapa {
  plaza?: { sinMuralla?: Record<string, number>; conMuralla?: Record<string, number> };
  pueblo?: number;
  aldea?: Record<string, number>;
  avanzada?: Record<string, number>;
  campamentoMercenarios?: number;
  campamentoBandidos?: number;
}

/** Las cifras de hoy (23-11) para cuando aún no llegan los datos del motor. */
const RADIOS_DE_SERIE: Required<RadiosDelMapa> = {
  plaza: { sinMuralla: { 1: 1.49, 2: 3.2, 3: 5.6, 4: 6.4, 5: 7.2 }, conMuralla: { 1: 1.49, 2: 3.42, 3: 6.27, 4: 7.09, 5: 8.05 } },
  pueblo: 2.04,
  aldea: { 1: 2.3, 2: 3.0, 3: 3.58 },
  avanzada: { atalaya: 0.68, fuerte: 1.28, ciudadela: 1.44 },
  campamentoMercenarios: 2.2,
  campamentoBandidos: 0.1,
};

function radios(): RadiosDelMapa {
  return bloqueDeDatos<{ radio?: RadiosDelMapa }>('TAMANOS_MAPA')?.radio ?? RADIOS_DE_SERIE;
}

const tabla = (t: Record<string, number> | undefined, clave: string | number, serie: Record<string, number>): number => t?.[String(clave)] ?? serie[String(clave)] ?? Object.values(serie).at(-1) ?? 0;

/** Lo que mide una plaza: por nivel, y más con muralla. */
export function radioDePlaza(nivel: number, conMuralla: boolean): number {
  const r = radios().plaza;
  const n = Math.min(5, Math.max(1, Math.floor(nivel) || 1));
  return tabla(conMuralla ? r?.conMuralla : r?.sinMuralla, n, (conMuralla ? RADIOS_DE_SERIE.plaza.conMuralla : RADIOS_DE_SERIE.plaza.sinMuralla)!);
}

const ETAPA = ['atalaya', 'fuerte', 'ciudadela'];
const cerca = (a: Punto, b: Punto): boolean => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/**
 * El radio del lugar que está en `punto` (su borde, desde su centro): una plaza (propia, avistada o recordada), un campamento de mercenarios o de
 * bandidos, un pueblo o una aldea, una avanzada o una obra de mapa. Se busca por posición, que es lo que sabe quien pregunta; 0 si no hay nada
 * (la puerta vuelve a ser la de siempre, medida desde el punto).
 */
export function radioDelLugarEn(p: ProyeccionJugador, punto: Punto): number {
  const R = radios();
  const plaza = (p.asentamientos ?? []).find((a) => cerca(a.posicion, punto));
  if (plaza) return radioDePlaza(plaza.nivel, (plaza.recintos?.length ?? 0) > 0);
  const ajena = (p.asentamientosAvistados ?? []).find((a) => cerca(a.posicion, punto));
  if (ajena) return radioDePlaza(ajena.nivel, ajena.tieneMuralla === true);
  const recordada = (p.asentamientosConocidos ?? []).find((a) => cerca(a.posicion, punto));
  if (recordada) return radioDePlaza(recordada.nivel, false);
  if ((p.campamentosMercenarios ?? []).some((c) => cerca(c.posicion, punto))) return R.campamentoMercenarios ?? RADIOS_DE_SERIE.campamentoMercenarios;
  const pueblo = (p.pueblos ?? []).find((x) => cerca(x.posicion, punto));
  if (pueblo) return pueblo.tipo.startsWith('aldea') ? tabla(R.aldea, pueblo.nivelAldea ?? 1, RADIOS_DE_SERIE.aldea) : (R.pueblo ?? RADIOS_DE_SERIE.pueblo);
  const avanzada = (p.avanzadas ?? []).find((x) => cerca(x.posicion, punto));
  if (avanzada) return tabla(R.avanzada, ETAPA[Math.min(3, Math.max(1, avanzada.etapa)) - 1]!, RADIOS_DE_SERIE.avanzada);
  const obra = (p.obrasDeMapa ?? []).find((o) => cerca(o.posicion, punto));
  if (obra) return obra.tipo === 'avanzada' ? tabla(R.avanzada, 'atalaya', RADIOS_DE_SERIE.avanzada) : obra.tipo === 'aldea' ? tabla(R.aldea, 1, RADIOS_DE_SERIE.aldea) : (R.pueblo ?? RADIOS_DE_SERIE.pueblo);
  if ((p.campamentosBandidos ?? []).some((c) => cerca(c.posicion, punto))) return R.campamentoBandidos ?? RADIOS_DE_SERIE.campamentoBandidos;
  return 0;
}

/** Cuánto falta, desde `desde`, para tocar el borde del lugar que está en `punto` (0 si ya está dentro del contorno). */
export function distanciaAlBorde(p: ProyeccionJugador, desde: Punto, punto: Punto): number {
  return Math.max(0, Math.hypot(desde.x - punto.x, desde.y - punto.y) - radioDelLugarEn(p, punto));
}

/** ¿Está `desde` a la puerta del lugar de `punto`: a `radioPuerta` o menos de su borde, por el lado que sea? */
export function aLaPuerta(p: ProyeccionJugador, desde: Punto, punto: Punto): boolean {
  return distanciaAlBorde(p, desde, punto) <= radioDePuerta() + 1e-9;
}
