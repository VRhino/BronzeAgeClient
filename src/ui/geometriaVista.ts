// Matemática pura del zoom/pan de la pantalla Mapa (T3). Sin DOM: se testea con
//   node --experimental-strip-types src/ui/geometriaVista.ts
//
// Modelo: el lienzo del mapa es un cuadrado de `ladoBase` px (el mundo entero encajado en el viewport),
// centrado, y encima lleva `transform: translate(Tx, Ty) scale(zoom)` con `transform-origin: center`. Así Tx
// y Ty son el desplazamiento en px de pantalla del CENTRO del mapa respecto al centro del viewport.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

/** Lado en px del lienzo a zoom 1: el mundo (cuadrado) encajado enterito en el viewport. */
export function ladoBase(anchoViewport: number, altoViewport: number): number {
  return Math.min(anchoViewport, altoViewport);
}

export function clampZoom(zoom: number, min = ZOOM_MIN, max = ZOOM_MAX): number {
  return Math.max(min, Math.min(max, zoom));
}

/**
 * Clampa el pan de un eje: si a ese zoom el mapa escalado cubre el viewport en ese eje, no se le deja
 * despegar de los bordes (queda pegado como mucho a `±margen`); si NO lo cubre, se fuerza centrado (0).
 */
export function clampPan(pan: number, ladoEscalado: number, ladoViewport: number): number {
  if (ladoEscalado <= ladoViewport) return 0;
  const margen = (ladoEscalado - ladoViewport) / 2;
  return Math.max(-margen, Math.min(margen, pan));
}

/**
 * Nuevo pan de un eje tras cambiar el zoom manteniendo FIJO el punto del mapa que está bajo `foco` (px de
 * pantalla medidos desde el centro del viewport — p.ej. el cursor de la rueda, o 0 para los botones +/−).
 */
export function panTrasZoom(panViejo: number, zoomViejo: number, zoomNuevo: number, foco: number): number {
  const puntoMapa = (foco - panViejo) / zoomViejo;
  return foco - puntoMapa * zoomNuevo;
}

/**
 * Pan que centra en el viewport un punto del mapa dado en coordenadas de mundo. `anchoMundo`/`altoMundo` son
 * `mapa.config.ancho`/`alto`; a zoom 1 el lienzo mide `lado` px y contiene el mundo entero.
 */
export function panParaCentrar(
  puntoMundo: { x: number; y: number },
  anchoMundo: number,
  altoMundo: number,
  lado: number,
  zoom: number
): { x: number; y: number } {
  const localX = (puntoMundo.x / anchoMundo - 0.5) * lado;
  const localY = (puntoMundo.y / altoMundo - 0.5) * lado;
  return { x: -localX * zoom, y: -localY * zoom };
}

function demo(): void {
  const assert = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(`FALLO: ${msg}`);
  };

  assert(ladoBase(1200, 800) === 800, 'ladoBase = min de los dos');
  assert(clampZoom(0.3) === 1 && clampZoom(9) === 4, 'zoom acotado a [1,4]');

  assert(clampPan(50, 400, 800) === 0, 'mapa sin cubrir el eje -> centrado');
  assert(clampPan(999, 1200, 800) === 200, 'clamp a +margen');
  assert(clampPan(-999, 1200, 800) === -200, 'clamp a -margen');

  assert(panTrasZoom(0, 1, 2, 0) === 0, 'zoom hacia el centro no desplaza');
  assert(panTrasZoom(0, 1, 2, 100) === -100, 'zoom hacia el cursor mantiene el punto bajo el cursor');
  // ida y vuelta: zoom in y luego out al mismo foco vuelve al pan original
  const ida = panTrasZoom(0, 1, 2.5, 137);
  assert(Math.abs(panTrasZoom(ida, 2.5, 1, 137)) < 1e-9, 'zoom in+out al mismo foco es reversible');

  // centrar la esquina (0,0) del mundo a zoom 1 empuja el mapa media pantalla abajo-derecha
  const p = panParaCentrar({ x: 0, y: 0 }, 2000, 2000, 800, 1);
  assert(p.x === 400 && p.y === 400, 'centrar esquina (0,0) -> pan (+lado/2, +lado/2)');
  const c = panParaCentrar({ x: 1000, y: 1000 }, 2000, 2000, 800, 3);
  assert(c.x === 0 && c.y === 0, 'centrar el centro del mundo -> pan 0 a cualquier zoom');

  console.log('geometriaVista demo OK');
}

// Auto-verificación bajo Node; en el navegador `process` no existe y esto se salta.
declare const process: { argv: string[] } | undefined;
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('geometriaVista.ts')) demo();
