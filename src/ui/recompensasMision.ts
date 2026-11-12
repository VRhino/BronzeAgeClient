// La recompensa de una misión (recompensas flexibles, motor 168a3be; Misiones §4-§8, Misiones_Recurrentes §5): la FIJA de su tipo (plaza →
// participación, Facción → XP de Facción, héroe → ninguna) y la LISTA libre (recurso, oro, xp, tropa y, desde el motor 457c278, objeto). Aquí se convierte en premios con su
// icono, su cifra y adónde va cada cosa al reclamar; Misiones (cadenas) y el Tablón (recurrentes) los pintan con sus etiquetas.
import type { RecompensaMision } from '../tiposDominio';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { bloqueDeDatos, tropasReclutables } from '../apiCliente';
import { iconoTropa } from './iconosTropa';
import { premioDeObjeto } from './objetosHeroe';

/** Quién cobra: el héroe (cadena de héroe, recurrente individual), la plaza o la Facción (cadenas y grupales de su tablón). */
export type CobroMision = 'personal' | 'plaza' | 'faccion';

export interface Premio {
  tipo: 'participacion' | 'xp' | 'oro' | 'recurso' | 'tropa' | 'objeto';
  /** HTML del icono (un emoji o un SVG). */
  icono: string;
  cifra: string;
  /** Lo que es, en minúscula: «madera», «XP de Facción»… */
  nombre: string;
  /** Adónde va al reclamar, para el `title`. */
  destino: string;
  /** La recompensa fija de su tipo de misión. */
  fija: boolean;
}

const cifra = (n: number): string => (Number.isInteger(n) ? String(n) : n.toLocaleString('es-ES', { maximumFractionDigits: 2 }));

function nombreDeTropa(id: string): string {
  return tropasReclutables()?.find((t) => t.id === id)?.nombre ?? id.replace(/_/g, ' ');
}

const ALMACEN: Record<CobroMision, string> = { personal: 'a tu almacén personal', plaza: 'al almacén de la plaza', faccion: 'al almacén de la capital de la Facción' };

/**
 * Los premios de una misión, la fija primero. `participacion` y `xp` son las fijas (solo una vale según el tipo); `grupal` dice cómo se reparte
 * la participación de una recurrente de plaza.
 */
export function premiosDeMision(fija: { participacion?: number; xp?: number }, lista: readonly RecompensaMision[], cobro: CobroMision, grupal = false): Premio[] {
  const premios: Premio[] = [];
  if (fija.participacion && fija.participacion > 0) {
    const destino = grupal ? 'Participación en la plaza, a partes iguales entre los que aportaron (sin mercenarios contratados)'
      : cobro === 'personal' ? 'Participación en la plaza del tablón, para ti' : 'Participación en la plaza, para quien la reclama';
    premios.push({ tipo: 'participacion', icono: '🏛️', cifra: cifra(fija.participacion), nombre: 'de participación', destino, fija: true });
  }
  if (fija.xp && fija.xp > 0) premios.push({ tipo: 'xp', icono: '⭐', cifra: cifra(fija.xp), nombre: 'XP de Facción', destino: 'Experiencia para la Facción', fija: true });
  for (const r of lista) {
    if (r.cantidad <= 0) continue;
    if (r.tipo === 'xp') premios.push({ tipo: 'xp', icono: '⭐', cifra: cifra(r.cantidad), nombre: 'XP de Facción', destino: cobro === 'personal' ? 'Experiencia para tu Facción (sin Facción no suma)' : 'Experiencia para la Facción de la plaza', fija: false });
    else if (r.tipo === 'oro') premios.push({ tipo: 'oro', icono: RECURSO_ICONO.oro ?? '🪙', cifra: cifra(r.cantidad), nombre: 'oro', destino: `Oro ${ALMACEN[cobro]}`, fija: false });
    else if (r.tipo === 'recurso' && r.clave) premios.push({ tipo: 'recurso', icono: RECURSO_ICONO[r.clave] ?? '📦', cifra: cifra(r.cantidad), nombre: (RECURSO_NOMBRE[r.clave] ?? r.clave).toLowerCase(), destino: `${RECURSO_NOMBRE[r.clave] ?? r.clave} ${ALMACEN[cobro]}`, fija: false });
    else if (r.tipo === 'tropa' && r.clave) premios.push({ tipo: 'tropa', icono: iconoTropa(r.clave, 16), cifra: cifra(r.cantidad), nombre: nombreDeTropa(r.clave), destino: 'Soldados que nacen en el campamento donde resides: completan tu escuadra de esa tropa hasta su tope y lo que sobra se pierde', fija: false });
    else if (r.tipo === 'objeto' && r.clave) { const o = premioDeObjeto(r.clave); premios.push({ tipo: 'objeto', icono: o.icono, cifra: cifra(r.cantidad), nombre: o.nombre, destino: DESTINO_OBJETO, fija: false }); }
  }
  return premios;
}

const DESTINO_OBJETO = 'A tu mochila; si no cabe, a tu almacén de objetos, y si tampoco, se pierde';

/** Los objetos que da además una diaria individual (`BOTIN_OBJETOS.misionDiaria`, D5): los seguros, con su cifra; los de suerte, con su %. */
export function premiosDeDiaria(): Premio[] {
  const tabla = bloqueDeDatos<{ misionDiaria?: { objeto: string; cantidad: number; probabilidad: number }[] }>('BOTIN_OBJETOS')?.misionDiaria ?? [];
  return tabla.map((x) => {
    const o = premioDeObjeto(x.objeto);
    const suerte = x.probabilidad < 1 ? ` (${Math.round(x.probabilidad * 100)} %)` : '';
    return { tipo: 'objeto', icono: o.icono, cifra: cifra(x.cantidad), nombre: `${o.nombre}${suerte}`, destino: `${DESTINO_OBJETO}${suerte ? '. Sale con esa probabilidad' : ''}`, fija: false };
  });
}

/** Los premios en una línea de texto: «10 de participación, 300 madera, 10 Exploradores a caballo». */
export function textoDePremios(premios: readonly Premio[]): string {
  return premios.map((p) => `${p.cifra} ${p.nombre}`).join(', ') || 'sin recompensa';
}
