// Los valores de la vista 3D de la plaza (docs/Ciudad_3D.md). Todo en unidades locales del trazado (ul) salvo donde se dice.
// Escala: 1 ul = 3 m (Víctor, 2026-11-02); una celda del trazado son 3 ul (9 m) y una planta, 1 ul.

export const CIUDAD3D = {
  /** Metros por unidad local (solo para leer cifras: el modelo va en ul). */
  metrosPorUl: 3,
  /** Alto de una planta. */
  planta: 1,
  /** Apertura vertical de la cámara, en grados. */
  apertura: 40,
  /** Inclinación sobre el horizonte, en grados. */
  inclinacion: { inicial: 42, min: 12, max: 88 },
  /** Distancia de la cámara a lo que mira: la más cercana (a pie de calle), la más lejana (en veces el radio de la plaza) y la de entrada (en veces el radio de lo construido). */
  distancia: { min: 6, maxPorRadio: 3.2, inicialPorNucleo: 1.7 },
  /** Suavizado de la cámara (1/s): cuanto más, más pegada a lo que se pide. */
  suave: 10,
  /** Holgura alrededor de la plaza que se ve (suelo, árboles), en ul. */
  holgura: 45,
  /** Píxeles por ul de la textura del suelo, y el lado máximo de la textura. */
  sueloPx: 6,
  sueloMax: 4096,
  /** Cuántos milisegundos de mundo pasan entre dos rehechos de una obra que avanza (el armazón crece a saltos del 5 %). */
  pasoObra: 0.05,
} as const;

/** Los colores de los materiales (sRGB). Los de cada nivel de plaza salen de aquí. */
export const COLOR = {
  paja: 0xb8955a, pajaVieja: 0x9a7a49, zarzo: 0xb09574, barro: 0x9d8160, madera: 0x7a5636, maderaOscura: 0x54402c,
  adobe: 0xc9ad84, adobeClaro: 0xd8c29b, adobeFresco: 0xbfa27a, enlucido: 0xe9dfc9, enlucidoSombra: 0xd9ccb0,
  piedra: 0xa69d8d, piedraOscura: 0x7f776b, piedraClara: 0xbdb4a2, losa: 0xc2b8a3,
  rojo: 0x9e3b2a, ocre: 0xc8963e, azul: 0x3f6f8f, negro: 0x2b2622, hueco: 0x3a2e24,
  toldo: [0xd9cfb6, 0xb5553a, 0x6e7f4f, 0xc79a3c, 0x8a5a3c],
  tierra: 0x8b6e4e, tierraOscura: 0x5e4a36, foso: 0x4c3d2c, talud: 0x8a7556, agua: 0x3e6a7a,
  hoja: 0x5f7a3c, olivo: 0x7d8a58, cipres: 0x3b5634, roble: 0x56783a, tronco: 0x5a4430, seto: 0x6a7f45, heno: 0xc9a85a,
  cultivo: 0x7d9443, trigo: 0xc4a24d, rastrojo: 0xa38a58,
  fuego: 0xc8501c, carbon: 0x2f2a26, bronce: 0xa8783a, cuero: 0x8a5a36,
  lona: 0xd6cbb0, lonaVieja: 0xb9a888, piel: 0x987350, pielOscura: 0x6f5238,
  /** Lo que sale de cada mina: la escombrera (la roca de caja) y el mineral apartado. Oro en cuarzo, malaquita, casiterita y hematites. */
  mina: {
    mina: { escombrera: 0xb3a47e, mineral: 0xd6b544 },
    minaCobre: { escombrera: 0x7c766a, mineral: 0x4f8f6f },
    minaEstano: { escombrera: 0x6c655b, mineral: 0x34302d },
    minaHierro: { escombrera: 0x7f5b45, mineral: 0x8e3f2a },
  } as Record<string, { escombrera: number; mineral: number }>,
  roca: 0x9b9384, rocaClara: 0xc9c1ad,
  estaca: 0xd8c08a, cuerda: 0xe8d8a8, ruina: 0x6f655a, quemado: 0x3f3730,
  seleccion: 0xffd24a,
};
