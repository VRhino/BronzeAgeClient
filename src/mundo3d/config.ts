// Los valores del mundo 3D, decididos con la mesa de escalas 3D del motor (docs/Mundo_3D.md). Todo en unidades del mapa (u) salvo donde se dice.
import { NIEBLA } from '../paletas';

export const MUNDO3D = {
  /** Metros de Unity por unidad del mapa: la altura del relieve (en metros) se pasa a unidades con esto, sin exagerar (la exageración vive en
   * el generador, así las pendientes que se ven son las que usa el servidor). */
  metrosPorUnidad: 12,
  /** Apertura vertical de la cámara, en grados. */
  apertura: 35,
  /** Inclinación de la cámara sobre el horizonte, en grados: libre entre `min` y `max`. */
  inclinacion: { inicial: 30, min: 10, max: 90 },
  /** Copa de los árboles (diámetro). */
  copa: 0.3,
  /** Escala de las maquetas de plazas, pueblos, avanzadas y campamentos: ×1 = la del juego. */
  maqueta: 1,
  /** Escala de héroes y tropa (soldado de 0,136 u a ×1). */
  tropa: 2,
  /** Lado de las teselas de terreno, el de las del paquete de relieve. */
  ladoTesela: 64,
  /** Umbrales de clase del generador, en metros (`ELEVACION` × 1.000): agua, costa, colina, montaña y cima. */
  umbrales: { agua: 375, costa: 420, colina: 545, montana: 600, cima: 685 },
  niebla: NIEBLA,
} as const;

/** Lo que cabe en pantalla, normal y alejado, según el radio de visión de la columna (`VISION` del servidor): el diámetro del círculo
 * alrededor del héroe que cabe en la pantalla. Héroe solo (15 u): 15 y 22; con soldados (30 u): 30 y 45. Otro radio: el radio y 1,5 veces. */
export function encuadres(radioVision: number): readonly [number, number] {
  if (radioVision === 15) return [15, 22];
  if (radioVision === 30) return [30, 45];
  return [radioVision, Math.floor(radioVision * 1.5)];
}
