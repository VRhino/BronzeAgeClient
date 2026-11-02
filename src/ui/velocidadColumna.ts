// VELOCIDAD DE LA COLUMNA a la vista (petición de Víctor, 2026-11-02): en la ventana «Salir al mundo» (también con un ejército en preparación) y en
// la barra de víveres del mundo. Sale de las mismas reglas que usa el motor (`velocidad_de_columna`): el mínimo de la velocidad de cada escuadra con
// soldados (`TROPAS_RECLUTABLES.velocidad`) y de cada caravana enganchada (la del animal más lento, o la de su tipo en `CARAVANA_CATALOGO`; la de
// Fundación, `CARAVANA_CATALOGO.construccion`); sin ninguna, la del héroe solo (`MOVIMIENTO.velocidadJugador`); con marcha forzada,
// × `MOVIMIENTO.factorVelocidadMarchaForzada`. Nada de eso se copia aquí: llega en `GET /v1/datos`.
// El color compara con la infantería ligera: rojo por debajo, blanco igual, azul por encima. La «ligera» es la velocidad más común del catálogo de
// tropas (hoy 30: milicia, leva, honderos, peltastas…), así que si el motor la cambia, cambia aquí sola.
import { bloqueDeDatos, tropasReclutables } from '../apiCliente';
import { ayuda } from './ayuda';

type Escapar = (valor: string) => string;

/** Lo que va en la columna y puede frenarla: su nombre (para decir quién la frena) y su velocidad en u/min (`undefined` si aún no llegó el catálogo). */
export interface PiezaDeColumna { nombre: string; velocidad: number | undefined }

export type Ritmo = 'lenta' | 'ligera' | 'rapida';

export interface VelocidadEstimada {
  /** u/min antes del terreno. */
  valor: number;
  /** Comparada con la infantería ligera; `null` si no llegó el catálogo. */
  ritmo: Ritmo | null;
  /** Quién marca el paso (la pieza más lenta), o «el héroe solo». */
  limita: string;
  /** La velocidad de la infantería ligera, o `null`. */
  ligera: number | null;
  forzada: boolean;
}

type Movimiento = { velocidadJugador?: number; factorVelocidadMarchaForzada?: number };
type CatalogoCaravanas = Record<string, { velocidad?: number }>;

/** La velocidad de la infantería ligera: la más repetida del catálogo de tropas (a igualdad, la más alta). `null` sin catálogo. */
export function velocidadLigera(): number | null {
  const cuenta = new Map<number, number>();
  for (const t of tropasReclutables() ?? []) if (typeof t.velocidad === 'number' && t.velocidad > 0) cuenta.set(t.velocidad, (cuenta.get(t.velocidad) ?? 0) + 1);
  let mejor: [number, number] | null = null;
  for (const [v, n] of cuenta) if (!mejor || n > mejor[1] || (n === mejor[1] && v > mejor[0])) mejor = [v, n];
  return mejor?.[0] ?? null;
}

/** La pieza de una escuadra de esa tropa. */
export function piezaDeTropa(tropaId: string): PiezaDeColumna {
  const t = (tropasReclutables() ?? []).find((x) => x.id === tropaId);
  return { nombre: t?.nombre ?? tropaId, velocidad: t?.velocidad };
}

/** La pieza de la Caravana de Fundación (`CARAVANA_CATALOGO.construccion.velocidad`). */
export function piezaDeFundacion(): PiezaDeColumna {
  return { nombre: 'la Caravana de Fundación', velocidad: bloqueDeDatos<CatalogoCaravanas>('CARAVANA_CATALOGO')?.['construccion']?.velocidad };
}

/** La pieza de una caravana enganchada: la del animal más lento de sus carros con animal o, sin ninguno, la de su tipo. */
export function piezaDeCaravana(c: { tipo?: string; carros?: { animal?: string | null }[] }): PiezaDeColumna {
  const animales = bloqueDeDatos<Record<string, { velocidad?: number }>>('ANIMAL_CATALOGO');
  const conAnimal = (c.carros ?? []).filter((x) => x.animal).map((x) => animales?.[x.animal!]?.velocidad ?? Infinity);
  const velocidad = conAnimal.length ? Math.min(...conAnimal) : bloqueDeDatos<CatalogoCaravanas>('CARAVANA_CATALOGO')?.[c.tipo ?? '']?.velocidad;
  return { nombre: c.tipo === 'construccion' ? 'la Caravana de Fundación' : 'una caravana enganchada', velocidad: Number.isFinite(velocidad) ? velocidad : undefined };
}

/** La velocidad de una columna con esas piezas, como `velocidad_de_columna` del motor. */
export function velocidadDePiezas(piezas: PiezaDeColumna[], forzada = false): VelocidadEstimada {
  const mov = bloqueDeDatos<Movimiento>('MOVIMIENTO');
  const conocidas = piezas.filter((x): x is { nombre: string; velocidad: number } => typeof x.velocidad === 'number' && x.velocidad > 0);
  const lenta = conocidas.reduce<{ nombre: string; velocidad: number } | null>((m, x) => (!m || x.velocidad < m.velocidad ? x : m), null);
  const base = lenta?.velocidad ?? mov?.velocidadJugador ?? 66;
  const valor = base * (forzada ? mov?.factorVelocidadMarchaForzada ?? 1.5 : 1);
  const ligera = velocidadLigera();
  const ritmo: Ritmo | null = ligera === null ? null : Math.abs(valor - ligera) < 1e-6 ? 'ligera' : valor < ligera ? 'lenta' : 'rapida';
  return { valor, ritmo, limita: lenta?.nombre ?? 'el héroe solo', ligera, forzada };
}

const TEXTO_RITMO: Record<Ritmo, string> = { lenta: 'más lenta que la infantería ligera', ligera: 'al paso de la infantería ligera', rapida: 'más rápida que la infantería ligera' };

/** Cuántas de las 4 flechas se encienden: por debajo de la ligera 1 (lo más lento) o 2 (la tropa media), la ligera 3 y por encima 4. */
function flechasEncendidas(v: VelocidadEstimada): number {
  if (v.ritmo === null || v.ligera === null) return 0;
  if (v.ritmo === 'ligera') return 3;
  if (v.ritmo === 'rapida') return 4;
  // Entre las velocidades del catálogo por debajo de la ligera, la más alta (la media) da 2; lo que vaya más lento que ella, 1.
  const debajo = [...new Set((tropasReclutables() ?? []).map((t) => t.velocidad ?? 0).filter((x) => x > 0 && x < v.ligera!))].sort((a, b) => b - a);
  return debajo.length > 0 && v.valor >= debajo[0]! ? 2 : 1;
}

/** El icono: cuatro flechas de marcha, encendidas según el ritmo y del color del ritmo. */
export function iconoRitmo(v: VelocidadEstimada, alto = 16): string {
  const n = flechasEncendidas(v);
  const flecha = (i: number): string => `<path d="M${2 + i * 6} 3 l5 5 -5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="${i < n ? 1 : 0.22}"/>`;
  return `<svg class="ritmo-icono" viewBox="0 0 29 16" width="${Math.round((alto * 29) / 16)}" height="${alto}" aria-hidden="true">${[0, 1, 2, 3].map(flecha).join('')}</svg>`;
}

export const cifraVelocidad = (n: number): string => (Math.round(n * 10) / 10).toLocaleString('es-ES');

/** La explicación (para el `title` y la ayuda). */
export function textoVelocidad(v: VelocidadEstimada): string {
  const ritmo = v.ritmo ? `, ${TEXTO_RITMO[v.ritmo]}${v.ligera !== null ? ` (${cifraVelocidad(v.ligera)})` : ''}` : '';
  return `${cifraVelocidad(v.valor)} u/min${ritmo}. Marca el paso ${v.limita}${v.forzada ? ', con marcha forzada' : ''}.`;
}

const AYUDA = 'La columna va al paso de lo más lento que lleva: la escuadra más lenta (con soldados) o la caravana enganchada más lenta; sin tropa ni caravanas, al del héroe solo. La marcha forzada la acelera. El terreno y los caminos cambian luego el tiempo de cada tramo.<br><span class="ritmo-lenta">Rojo</span>: más lenta que la infantería ligera. <span class="ritmo-ligera">Blanco</span>: igual. <span class="ritmo-rapida">Azul</span>: más rápida.';

/** La línea de la ventana de salida: icono, cifra y quién marca el paso, con su color. */
export function htmlLineaVelocidad(v: VelocidadEstimada, e: Escapar): string {
  return `<div class="salida-velocidad ritmo-${v.ritmo ?? 'ligera'}" title="${e(textoVelocidad(v))}">
    <span class="salida-velocidad-etq">Velocidad de la columna${ayuda('salida:velocidad', AYUDA)}</span>
    ${iconoRitmo(v, 18)}<strong>${cifraVelocidad(v.valor)}</strong><small>u/min</small>
    <span class="salida-velocidad-texto">${e(v.ritmo ? TEXTO_RITMO[v.ritmo] : '')}${v.limita !== 'el héroe solo' || !v.ritmo ? ` · marca el paso ${e(v.limita)}` : ' · vas solo'}${v.forzada ? ' · marcha forzada' : ''}</span>
  </div>`;
}

/** El indicador de la barra de víveres: solo el icono, del color del ritmo; la cifra va en el `title`. */
export function htmlIndicadorVelocidad(v: VelocidadEstimada, e: Escapar): string {
  return `<span class="mapa-velocidad ritmo-${v.ritmo ?? 'ligera'}" title="${e(`Velocidad: ${textoVelocidad(v)}`)}" aria-label="${e(`Velocidad: ${textoVelocidad(v)}`)}">${iconoRitmo(v, 16)}</span>`;
}
