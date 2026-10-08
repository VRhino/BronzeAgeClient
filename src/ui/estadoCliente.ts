import type { MapaGenerado } from '../terreno';
import type { ProyeccionJugador } from '../apiCliente';

export interface EstadoClienteJugador {
  usuarioActivo: string;
  gameIdActivo: string;
  mapaCache: { id: string; mapa: MapaGenerado } | null;
  modoVista: 'mundo' | 'asentamiento';
  proyeccionUltima: ProyeccionJugador | null;
  /** La última proyección vino `sinHeroe`: la membresía aún no tiene héroe (`proyeccionUltima` queda `null`). */
  sinHeroe: boolean;
  modoPanelFaccion: 'inicio' | 'crear' | 'unirse';
  pestanaInteraccion: 'faccion' | 'asentamientos' | 'informacion';
  modoFundacionActivo: boolean;
  posicionFundacion: { x: number; y: number } | null;
  puntoFundacionFijado: boolean;
  indiceTip: number;
  asentamientoDetalleTab: 'general' | 'edificios' | 'almacen' | 'produccion' | 'militar' | 'muralla';
}

/** Cuánto tiempo de MUNDO pasa por cada ms real (1 = el mundo va a ritmo real). Lo mide cada sondeo; el backend puede acelerar el mundo (`INTERVALO_TICK_MS`),
 * y entonces un plazo «de 10 min de mundo» dura segundos de verdad. */
let ritmoMundo = 1;
let medida: { instante: number; real: number } | null = null;

/** Anota la medida de cada proyección (`instante` de mundo) y actualiza el ritmo con al menos 2 s reales entre medidas. */
export function medirRitmoDeMundo(instante: number, real = Date.now()): void {
  if (medida && real - medida.real >= 2000) {
    if (instante > medida.instante) ritmoMundo = (instante - medida.instante) / (real - medida.real);
    medida = { instante, real };
  } else if (!medida) medida = { instante, real };
}

/** Un plazo de mundo (ms) dicho en tiempo REAL: «5 s», «2 min». */
export function textoEnTiempoReal(msDeMundo: number): string {
  const s = Math.max(0, Math.ceil(msDeMundo / ritmoMundo / 1000));
  return s < 90 ? `${s} s` : `${Math.ceil(s / 60)} min`;
}

export const estadoCliente: EstadoClienteJugador = {
  usuarioActivo: '',
  gameIdActivo: 'local',
  mapaCache: null,
  modoVista: 'mundo',
  proyeccionUltima: null,
  sinHeroe: false,
  modoPanelFaccion: 'inicio',
  pestanaInteraccion: 'faccion',
  modoFundacionActivo: false,
  posicionFundacion: null,
  puntoFundacionFijado: false,
  indiceTip: 0,
  asentamientoDetalleTab: 'general',
};

export const TIPS_FUNDACION = [
  'Usa el cursor para elegir el lugar de fundación y comprobar visualmente la zona de influencia.',
  'Es recomendable fundar donde tengas acceso a madera y piedra.',
  'Evita las zonas de influencia de otros asentamientos para encontrar una posición válida.',
] as const;

export const CAP_FUNDACION_POR_NIVEL = [1, 2, 3, 3, 4, 5, 5, 6, 6, 7] as const;
