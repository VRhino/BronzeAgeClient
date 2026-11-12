// EL NIVEL DEL HÉROE (motor c82d6ed, Heroe_Y_Tropa §4.3 y §5). Subir del nivel n al n + 1 pide `experienciaBase + experienciaPorNivel × (n − 1)`
// (100, 120… 660 para pasar al 30) y, desde el `nivelDeTope`, siempre lo del último (680), todo de `PROGRESION_HEROE`. La experiencia sale del
// combate y de la medalla del héroe. `Heroe.experiencia_hacia_siguiente_nivel` es lo que le FALTA para el siguiente (en la proyección, ya en
// unidades). Cada nivel hasta el tope da un punto de atributo y 3 de Liderazgo; el héroe nace con 14 y llega a 100 en el 30 (`liderazgo_base`).
import { bloqueDeDatos } from '../apiCliente';
import type { HeroeProyectado } from '../tiposDominio';

interface ProgresionHeroe { experienciaBase?: number; experienciaPorNivel?: number; nivelDeTope?: number }

/** La experiencia que pide pasar del nivel `nivel` al siguiente; `undefined` sin los datos. */
export function experienciaParaSubir(nivel: number, alCargar?: () => void): number | undefined {
  const p = bloqueDeDatos<ProgresionHeroe>('PROGRESION_HEROE', alCargar);
  if (!p || p.experienciaBase === undefined) return undefined;
  const tope = p.nivelDeTope ?? Infinity;
  return p.experienciaBase + (p.experienciaPorNivel ?? 0) * (Math.min(Math.max(1, nivel), tope) - 1);
}

/** Lo que lleva hacia el nivel siguiente, lo que pide y el porcentaje; `null` sin los datos. */
export function progresoDeNivel(h: Pick<HeroeProyectado, 'nivel' | 'experienciaHaciaSiguienteNivel'>, alCargar?: () => void): { lleva: number; pide: number; pct: number } | null {
  const pide = experienciaParaSubir(h.nivel, alCargar);
  if (!pide) return null;
  const lleva = Math.min(pide, Math.max(0, pide - h.experienciaHaciaSiguienteNivel));
  return { lleva, pide, pct: Math.round((lleva / pide) * 100) };
}

/** ¿Da algo todavía subir de nivel? (hasta el tope: un punto de atributo y Liderazgo). */
export function nivelQueDaAlgo(nivel: number, alCargar?: () => void): boolean {
  const tope = bloqueDeDatos<ProgresionHeroe>('PROGRESION_HEROE', alCargar)?.nivelDeTope;
  return tope === undefined || nivel <= tope;
}

/** El aviso de `heroe.nivel_subio { heroe, nivel }`: el nivel nuevo y lo que trae. */
export function textoDeNivelSubido(nivel: number): string {
  return nivelQueDaAlgo(nivel)
    ? `Tu héroe sube al nivel ${nivel}: más Liderazgo y un punto de atributo para repartir.`
    : `Tu héroe sube al nivel ${nivel}.`;
}
