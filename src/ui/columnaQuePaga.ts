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

/** Con qué se paga un contrato (tanda 69, motor d0326fd): además del oro, las monedas del héroe que firma y, desde la taberna de una plaza, el
 * oro de su almacén (`almacenPlaza`) o las monedas de su fondo (`fondoPlaza`, motor 457c278: lo que cobró su forja). */
export type PagarContratoCon = PagarCon | 'monedas' | 'almacenPlaza' | 'fondoPlaza';

export interface FuenteDeContrato {
  pagarCon: PagarContratoCon;
  /** Para leerse tras «con» o «en», como en `FuenteDePago`; las monedas, «tus monedas». */
  nombre: string;
  /** Lo que hay: oro en unidades o, con `enMonedas`, monedas. */
  saldo: number;
  /** Se paga la tarifa en monedas (`TarifaMercenario.monedas`) y no la de oro. */
  enMonedas: boolean;
}

/**
 * Con qué puedes pagar un contrato o una prórroga en el campamento `c`, como el motor (tanda 69, Mercenarios_Por_Contrato §5.1): el oro de
 * `fuentesDePago` y, al final (no es lo de por defecto), tus monedas, que valen en cualquier sitio donde puedas firmar. Las monedas solo se
 * ofrecen si tienes alguna y estás en el campamento (dentro, o con tu columna, que es cuando hay oro con que pagar).
 */
export function fuentesDeContrato(p: ProyeccionJugador, c: Pick<CampamentoMercenarios, 'id' | 'residentesIds'> | undefined): FuenteDeContrato[] {
  const oro = fuentesDePago(p, c).map((f): FuenteDeContrato => ({ pagarCon: f.pagarCon, nombre: f.nombre, saldo: f.oro, enMonedas: false }));
  const u = p.heroe.ubicacion;
  const dentro = !!c && u.tipo === 'mercenarios' && u.campamentoId === c.id;
  const monedas = p.heroe.monedas ?? 0;
  return (oro.length > 0 || dentro) && monedas > 0 ? [...oro, { pagarCon: 'monedas', nombre: 'tus monedas', saldo: monedas, enMonedas: true }] : oro;
}
