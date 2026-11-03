// Ruido fijo para el mundo 3D: el mismo número para el mismo sitio, sin guardar nada. `azar` da un número suelto por punto de una rejilla; `manchas`,
// un valor que cambia suave de un sitio a otro (ruido de valor), para que el color del suelo, los bosques de cada especie o las flores vayan por
// manchas y no salpicados.

/** Un número fijo entre 0 y 1 por (i, j, k). */
export function azar(i: number, j: number, k: number): number {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor (0..1) en (x, y) con manchas de unas `escala` u: los vértices de la rejilla llevan un azar y en medio se interpola suave. */
export function manchas(x: number, y: number, escala: number, semilla: number): number {
  const fx = x / escala, fy = y / escala, i = Math.floor(fx), j = Math.floor(fy);
  const a = fx - i, b = fy - j, sa = a * a * (3 - 2 * a), sb = b * b * (3 - 2 * b);
  const v00 = azar(i, j, semilla), v10 = azar(i + 1, j, semilla), v01 = azar(i, j + 1, semilla), v11 = azar(i + 1, j + 1, semilla);
  return (v00 * (1 - sa) + v10 * sa) * (1 - sb) + (v01 * (1 - sa) + v11 * sa) * sb;
}
