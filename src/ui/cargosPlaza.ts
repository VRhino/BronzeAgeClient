// Los cargos que tiene el jugador en una plaza (0.199.0): el del interior (`Asentamiento.cargos`) o, desde fuera, los de su ficha de miembro
// de la Facción (`gobernador@as-3`). Lo usan los interruptores que dan esos cargos: cerrar el reclutamiento a los ciudadanos (Gobernador o
// General) y pausar el consumo (Gobernador o Tesorero).
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';

export type CargoDePlaza = 'gobernador' | 'maestroObras' | 'tesorero' | 'maestroCaravanas' | 'general' | 'sacerdote';

/** ¿Tiene el jugador ese cargo en `a`? */
export function tieneCargoEnPlaza(p: ProyeccionJugador, a: Asentamiento, cargo: CargoDePlaza): boolean {
  if (a.cargos?.[`${cargo}Id`] === p.heroeId) return true;
  const yo = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === p.heroeId);
  return Boolean(yo?.cargos.includes(`${cargo}@${a.id}`));
}

/** ¿Reside el jugador en `a`? (fundador o con casa comprada, como `resideEnLaPlaza` de la plaza). */
export function resideEnPlaza(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/** ¿Está el jugador dentro de `a`? */
export function dentroDePlaza(p: ProyeccionJugador, a: Asentamiento): boolean {
  const u = p.heroe.ubicacion;
  return u.tipo === 'asentamiento' && u.asentamientoId === a.id;
}
