// El cambio parcial de un `Asentamiento` (contrato 05 §5, decisión 2 de 4H): la plaza vista desde dentro viaja con máscara de campos, solo lo
// que cambió. Puerto de `crates/contrato/src/plaza.rs`: copia de `datos` los campos de la máscara (un campo con su valor por defecto se pone
// a él, un `optional` ausente se borra). En vez de la lista a mano del motor, los nombres de la máscara (snake_case del .proto) se resuelven
// con el descriptor generado, así que un campo nuevo del contrato entra solo al regenerar.
import { AsentamientoSchema, type Asentamiento } from './gen/bronzeage/v1/entities_pb';

const LOCAL: ReadonlyMap<string, string> = new Map(AsentamientoSchema.fields.map((f) => [f.name, f.localName]));

export function aplicarPlaza(destino: Asentamiento, datos: Asentamiento, campos: readonly string[]): void {
  const d = destino as unknown as Record<string, unknown>;
  const o = datos as unknown as Record<string, unknown>;
  for (const c of campos) {
    if (c === 'id') continue;
    const local = LOCAL.get(c);
    if (local) d[local] = o[local];
  }
}
