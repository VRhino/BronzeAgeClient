// Qué caravanas propias están en el mundo. Una caravana solo se ve fuera cuando va de camino (`en_transito`, `retornando`) o está aparcada en el
// campo (`aparcada`). Las que esperan dentro de su plaza, de su pueblo o de una parada (`disponible`, `preparando`, `esperando`) no están en el
// mapa: el carro de acarreo de un pueblo se queda dentro cargando hasta que sale lleno (Víctor, 2026-11-03: «las miniaturas de acarreo se ven en
// el mundo abierto, cuando al estar dentro no deberían verse hasta que salen llenas»). Las enganchadas (`adjunta`) van con su columna.
import type { Caravana } from '../tiposDominio';

const FUERA = new Set<NonNullable<Caravana['estado']>>(['en_transito', 'retornando', 'aparcada']);

/** ¿Se ve esta caravana propia en el mapa, suelta? Sin estado (un motor que no lo manda), sí, salvo la de fundación, que espera dentro. */
export function caravanaEnElMapa(c: Pick<Caravana, 'estado' | 'tipo'>): boolean {
  return c.estado === undefined ? c.tipo !== 'construccion' : FUERA.has(c.estado);
}
