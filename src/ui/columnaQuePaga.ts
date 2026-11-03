// De dónde sale el oro de un contrato de mercenario. Aparte de `mercenarios.ts` para que las pruebas lo lean sin cargar el cliente de red.
import type { ProyeccionJugador } from '../apiCliente';
import type { CampamentoMercenarios, Ejercito } from '../tiposDominio';

/**
 * La columna en la que vas, como el motor (`columna_que_lleva`, heroes.rs): a la puerta, o de visita dentro de un sitio donde no resides. Con
 * ella, un contrato o una prórroga se paga por defecto con su carro. Dentro de tu residencia no vas en ninguna: `null` (ahí se paga con el
 * almacén personal o con el carro que trajiste, `fuentesDePago`).
 * El oro está en la carga de la columna (`Ejercito.suministro`), no en `heroe.carro`, que es el carro que te traes dentro de tu residencia.
 */
export function columnaQuePaga(p: ProyeccionJugador): Ejercito | null {
  const u = p.heroe.ubicacion;
  if (u.tipo === 'columna') return p.ejercitos.find((x) => x.id === u.ejercitoId) ?? null;
  if (u.tipo === 'desconectado') return null;
  if (u.tipo === 'mercenarios' && p.campamentosMercenarios.find((c) => c.id === u.campamentoId)?.residentesIds.includes(p.heroeId)) return null;
  if (u.tipo === 'asentamiento') {
    const a = p.asentamientos.find((x) => x.id === u.asentamientoId);
    if (a && [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId)) return null;
  }
  return p.ejercitos.find((x) => x.liderId === p.heroeId || x.participantes.some((h) => h.heroeId === p.heroeId)) ?? null;
}

/** De dónde sale el oro de un contrato (`pagar_con` de la firma y la prórroga, motor 2b2c2a58): como en el mercado del campamento. */
export type PagarCon = 'almacenPersonal' | 'carro';

export interface FuenteDePago {
  pagarCon: PagarCon;
  /** Para leerse tras «con» o «en»: «tu almacén personal», «el carro de tu columna», «tu carro». */
  nombre: string;
  oro: number;
}

/**
 * Con qué puedes pagar un contrato en el campamento `c`, como el motor (motor 2b2c2a58):
 *  - tu almacén personal, solo si resides en `c` (dentro o con tu columna a la puerta);
 *  - el carro que llevas allí: el de tu columna (a la puerta, o dentro de visita) o, dentro de tu residencia sin columna, el que trajiste al entrar.
 * La primera es la que el motor usa si no se le dice nada: con columna, su carro; dentro de tu residencia sin ella, el almacén personal.
 * Vacía si no resides aquí ni llevas columna (el motor diría `heroe.sin_columna`).
 */
export function fuentesDePago(p: ProyeccionJugador, c: Pick<CampamentoMercenarios, 'id' | 'residentesIds'> | undefined): FuenteDePago[] {
  const resides = !!c && c.residentesIds.includes(p.heroeId);
  const u = p.heroe.ubicacion;
  const dentro = !!c && u.tipo === 'mercenarios' && u.campamentoId === c.id;
  const almacen: FuenteDePago = { pagarCon: 'almacenPersonal', nombre: 'tu almacén personal', oro: p.heroe.almacenPersonal?.['oro'] ?? 0 };
  const columna = columnaQuePaga(p);
  if (columna) return [{ pagarCon: 'carro', nombre: 'el carro de tu columna', oro: columna.suministro?.['oro'] ?? 0 }, ...(resides ? [almacen] : [])];
  if (resides && dentro) return [almacen, { pagarCon: 'carro', nombre: 'tu carro', oro: p.heroe.carro?.['oro'] ?? 0 }];
  return [];
}
