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
  /** Suavizado de la cámara (1/s: cuanto más, más pegada). `seguir`: el punto al que mira tras la columna; `zoom`: la distancia al cambiar
   * de encuadre; `subir`/`bajar`: lo que se levanta sobre las laderas. `corte`: a partir de cuántas u de salto no se sigue, se corta. */
  camaraSuave: { seguir: 9, zoom: 7, subir: 14, bajar: 3, corte: 60 },
  /** Copa de los árboles (diámetro). */
  copa: 0.5,
  /** Escala de las maquetas de plazas, pueblos, avanzadas y campamentos: ×1 = la del juego. */
  maqueta: 1,
  /** Los campamentos (de mercenarios y de bandidos), al doble de la maqueta: a ×1 casi no se veían (Víctor, 2026-10-31). */
  campamento: 2,
  /** Los alijos, al doble de la maqueta (Víctor, 2026-10-31). */
  alijo: 2,
  /** Escala de héroes y tropa (soldado de 0,136 u a ×1). */
  tropa: 2,
  /** Lado de las teselas de terreno, el de las del paquete de relieve. */
  ladoTesela: 64,
  /** Umbrales de clase del generador, en metros (`ELEVACION` × 1.000): agua, costa, colina, montaña y cima. */
  umbrales: { agua: 375, costa: 420, colina: 545, montana: 600, cima: 685 },
  /** La niebla de guerra del 3D: la del 2D, salvo lo nunca visto, que aquí deja ver el mapa a media luz, entre el recordado (158) y el opaco
   * (255) (Víctor, 2026-11-02). */
  niebla: { ...NIEBLA, alfaSinVer: 206 },
  /** El cielo (sRGB): cénit, horizonte (también el de la bruma lejana) y lo que asoma bajo el horizonte. */
  cielo: { cenit: 0x3d72b0, horizonte: 0xb7c6cf, bajoHorizonte: 0x8e9a98 },
} as const;

/** Hasta dónde se carga el mundo alrededor del héroe (u), un ajuste del jugador (botón de capas; Víctor, 2026-11-03). Más allá no se construye
 * suelo, árboles, maquetas, columnas ni nombres, y la bruma acaba justo ahí. 320 es lo que se cargaba antes de haber ajuste. */
export const DISTANCIA_CARGA = { min: 100, max: 480, paso: 20, porDefecto: 320 } as const;

/** El zoom de cerca (Víctor, 2026-11-02): además del normal y el alejado, uno que enseña 0,6 veces lo del normal. */
export const ACERCADO = 0.6;

/** Lo que cabe en pantalla, normal y alejado, según el radio de visión de la columna (`VISION` del servidor): el diámetro del círculo
 * alrededor del héroe que cabe en la pantalla. Héroe solo (15 u): 15 y 22; con soldados (30 u): 30 y 45. Otro radio: el radio y 1,5 veces. */
export function encuadres(radioVision: number): readonly [number, number] {
  if (radioVision === 15) return [15, 22];
  if (radioVision === 30) return [30, 45];
  return [radioVision, Math.floor(radioVision * 1.5)];
}
