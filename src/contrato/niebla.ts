// La niebla parcial (contrato 05 §5, 4H T6): a quien ya tiene la `NieblaProyectada` le llegan solo los tramos de bytes que cambiaron de cada
// máscara. Puerto de `aplicar_niebla` de `crates/contrato/src/niebla.rs`: la entera sustituye a la que hay; la parcial sobrescribe los bytes
// de sus tramos.
import type { NieblaProyectada } from './gen/bronzeage/v1/entities_pb';

export function aplicarNiebla(destino: NieblaProyectada | undefined, llega: NieblaProyectada): NieblaProyectada {
  if (!llega.parcial) return llega;
  if (!destino) throw new Error('una niebla parcial llega sobre la que el cliente ya tiene');
  for (const [mascara, tramos] of [[destino.celdas, llega.tramosCeldas], [destino.visibles, llega.tramosVisibles]] as const) {
    for (const t of tramos) mascara.set(t.datos, t.desde);
  }
  return destino;
}

/** Estado de una celda de la niebla: 0 nunca vista, 1 vista alguna vez, 2 a la vista ahora. */
export function estadoCelda(n: NieblaProyectada, columna: number, fila: number): 0 | 1 | 2 {
  const i = fila * n.columnas + columna;
  const bit = (m: Uint8Array) => ((m[i >> 3] ?? 0) >> (i & 7)) & 1;
  if (bit(n.visibles)) return 2;
  return bit(n.celdas) ? 1 : 0;
}
