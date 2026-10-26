// Matemática pura de la cámara del mapa del mundo. Sin DOM: se testea con
//   node --experimental-strip-types src/ui/geometriaVista.ts
//
// Modelo (el mismo que el cliente de administración): la cámara es `{ escala, cx, cy }`, con `escala` en px de pantalla (CSS) por unidad
// estratégica y `(cx, cy)` el punto del mundo que cae en el centro del lienzo. Plano: x a la derecha, y hacia abajo.
//   pantalla = (mundo − origen) · escala,   origen = centro − (mitad del lienzo) / escala
//
// Los dos topes del zoom:
//  * de lejos, el mundo entero llenando el lienzo (`escalaMinima`);
//  * de cerca, la ESCALA DE VISIÓN: el diámetro de lo que ve un héroe (`VISION.jugadorSolo` de los datos de juego) ocupa el lado corto
//    del lienzo (`escalaDeVision`). Es el zoom con el que arranca el jugador, centrado en su héroe.

export interface Camara {
  /** px de pantalla (CSS) por unidad estratégica. */
  escala: number;
  /** El punto del mundo en el centro del lienzo, en unidades. */
  cx: number;
  cy: number;
}

export interface Tamano {
  ancho: number;
  alto: number;
}

/** El mundo entero llenando el lienzo (el lado que más pide manda: no queda fuera del mundo a la vista). */
export function escalaMinima(lienzo: Tamano, mundo: Tamano): number {
  return Math.max(lienzo.ancho / mundo.ancho, lienzo.alto / mundo.alto);
}

/** El diámetro de visión (`2 · radio`) ocupando el lado corto del lienzo. */
export function escalaDeVision(lienzo: Tamano, radioVision: number): number {
  return Math.min(lienzo.ancho, lienzo.alto) / (2 * radioVision);
}

/** La cámara dentro de sus topes: el zoom entre `min` y `max`, y la vista sin salirse del mundo (centrada si lo cubre entero). */
export function acotar(c: Camara, lienzo: Tamano, mundo: Tamano, min: number, max: number): Camara {
  const escala = Math.max(min, Math.min(Math.max(min, max), c.escala));
  const eje = (centro: number, ladoPx: number, ladoMundo: number): number => {
    const mitad = ladoPx / 2 / escala;
    if (mitad * 2 >= ladoMundo) return ladoMundo / 2;
    return Math.max(mitad, Math.min(ladoMundo - mitad, centro));
  };
  return { escala, cx: eje(c.cx, lienzo.ancho, mundo.ancho), cy: eje(c.cy, lienzo.alto, mundo.alto) };
}

/** El punto del mundo bajo un punto del lienzo, en px medidos desde su CENTRO. */
export function aMundo(c: Camara, px: number, py: number): { x: number; y: number } {
  return { x: c.cx + px / c.escala, y: c.cy + py / c.escala };
}

/** La esquina superior izquierda del lienzo, en el mundo. */
export function origen(c: Camara, lienzo: Tamano): { x: number; y: number } {
  return aMundo(c, -lienzo.ancho / 2, -lienzo.alto / 2);
}

/** Zoom por `factor` manteniendo FIJO el punto del mundo bajo `foco` (px desde el centro del lienzo: el cursor, o 0,0 para los botones). */
export function zoomHacia(c: Camara, factor: number, focoX: number, focoY: number): Camara {
  const p = aMundo(c, focoX, focoY);
  const escala = c.escala * factor;
  return { escala, cx: p.x - focoX / escala, cy: p.y - focoY / escala };
}

/** Mover la vista `dx, dy` px de pantalla (arrastre: el mundo sigue al puntero). */
export function arrastrar(c: Camara, dx: number, dy: number): Camara {
  return { escala: c.escala, cx: c.cx - dx / c.escala, cy: c.cy - dy / c.escala };
}

function demo(): void {
  const assert = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(`FALLO: ${msg}`);
  };
  const cerca = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
  const lienzo = { ancho: 1200, alto: 800 };
  const mundo = { ancho: 2667, alto: 2000 };

  const min = escalaMinima(lienzo, mundo);
  assert(cerca(min, 1200 / 2667), 'el mundo llena el lienzo: manda el lado que más pide (aquí el ancho)');
  assert(cerca(escalaDeVision(lienzo, 15), 800 / 30), 'el diámetro de visión ocupa el lado corto');

  const c = acotar({ escala: 0.1, cx: 0, cy: 0 }, lienzo, mundo, min, 26);
  assert(c.escala === min, 'zoom acotado por abajo');
  assert(cerca(c.cx, 2667 / 2), 'si la vista cubre el ancho del mundo, centrada en él');
  assert(cerca(c.cy, 400 / min), 'y en y pegada al borde de arriba (media pantalla en unidades)');

  const z = zoomHacia({ escala: 1, cx: 1000, cy: 1000 }, 2, 100, 0);
  assert(cerca(aMundo(z, 100, 0).x, 1100), 'el punto bajo el cursor no se mueve al hacer zoom');
  const vuelta = zoomHacia(z, 0.5, 100, 0);
  assert(cerca(vuelta.cx, 1000) && cerca(vuelta.escala, 1), 'zoom in y out al mismo foco es reversible');

  const a = arrastrar({ escala: 2, cx: 500, cy: 500 }, 20, -10);
  assert(cerca(a.cx, 490) && cerca(a.cy, 505), 'arrastrar a la derecha lleva la vista a la izquierda');
  const o = origen({ escala: 2, cx: 500, cy: 500 }, lienzo);
  assert(cerca(o.x, 200) && cerca(o.y, 300), 'origen = centro − mitad del lienzo / escala');

  console.log('geometriaVista demo OK');
}

// Auto-verificación bajo Node; en el navegador `process` no existe y esto se salta.
declare const process: { argv: string[] } | undefined;
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('geometriaVista.ts')) demo();
