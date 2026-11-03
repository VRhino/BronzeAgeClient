// De qué carro sale el oro de un contrato de mercenario. Aparte de `mercenarios.ts` para que las pruebas lo lean sin cargar el cliente de red.
import type { ProyeccionJugador } from '../apiCliente';
import type { Ejercito } from '../tiposDominio';

/**
 * La columna con cuyo carro se paga un contrato o una prórroga, como el motor (`columna_que_lleva`, heroes.rs): la columna en la que vas, sea a la
 * puerta o de visita dentro de un sitio donde no resides. Dentro de tu residencia no vas en ninguna y el motor responde `heroe.sin_columna`: `null`.
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
