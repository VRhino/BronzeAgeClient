// El radio de agarre de un clic en el mapa. Los radios se pensaron en unidades del mundo para el mapa de antes, que enseñaba el mundo entero
// (a ~0,6 px por unidad); con la cámara a escala de visión (~30 px por unidad) un radio de 20 unidades cubre media pantalla y cualquier clic
// caía sobre tu propia columna. Así que el radio se mantiene en lo que medía en pantalla: nunca más que antes, menos cuanto más cerca.

/** px de pantalla por unidad a los que se pensaron los radios. */
const ESCALA_DE_REFERENCIA = 0.6;
let escala = ESCALA_DE_REFERENCIA;

/** La escala de la cámara del mapa (`ui/pantallaMapa.ts` la fija en cada cambio). */
export function fijarEscalaDeAgarre(e: number): void {
  if (e > 0) escala = e;
}

/** Un radio de agarre pensado en unidades del mundo, a la escala actual. */
export function agarre(radioMundo: number): number {
  return radioMundo * Math.min(1, ESCALA_DE_REFERENCIA / escala);
}
