// Copia local de los tipos de dominio devueltos por la proyección JSON.
// Mantiene a `cliente-jugador` desacoplado del motor de backend.

export interface Point {
  x: number;
  y: number;
}

export interface Faccion {
  id: string;
  nombre: string;
  reyId?: string | null;
  embajadorId?: string | null;
  nivel: number;
  experiencia?: number;
  ciudadanosIds?: string[];
  reputacion?: number;
  // ... ignoramos otros campos que no impactan el render ...
}

export interface Edificio {
  id: string;
  tipo: string; // EdificioTipo string
  estado: 'en_cola' | 'en_construccion' | 'activo';
  ambito?: 'asentamiento' | 'mapa';
  posicion: Point;
}

/** Celda del anillo de un `Recinto` — copia local de `CeldaMuro` (motor). Sirve solo para contar puertas en
 * el cliente (`celdas.filter(c => c.clase === 'puerta').length`); el DIBUJO del anillo no usa esto, llega ya
 * resuelto a rectángulos de pantalla en `TrazadoMuralla` (ver más abajo). */
export interface CeldaMuro {
  col: number;
  row: number;
  clase: 'muro' | 'puerta' | 'torre';
}

/** Copia local de `Recinto` (motor) — `Consideraciones/Murallas_Definicion.md`. Congelado al comprometerse:
 * `celdas`/`nivel` no cambian nunca salvo por una mejora terminada (§7 del doc). */
export interface Recinto {
  id: string;
  nivel: number;
  celdas: CeldaMuro[];
  /** -1 = comprometido pero sin nada en pie; `celdas.length - 1` = anillo cerrado del todo. */
  avance: number;
  /** Nivel al que se está mejorando, si hay una mejora en obra (§7). */
  mejorandoA?: number;
}

export interface Asentamiento {
  id: string;
  nombre?: string;
  faccionId: string;
  posicion: Point;
  nivel: number;
  nivelActual?: number;
  mantenimiento?: number;
  poblacion?: { pesants: number; artesanos: number; nobleza: number };
  almacen?: Record<string, { cantidad: number; capacidad: number }>;
  edificios: Edificio[];
  /** Gobernador/Maestro de Obras/Tesorero/General asignados (Doc 2.5) — quién puede ordenar qué. */
  cargos?: { gobernadorId?: string | null; maestroObrasId?: string | null; tesoreroId?: string | null; generalId?: string | null };
  /** Recintos de muralla, del más interior al más exterior (Paso 2a en adelante). Vacío/ausente = sin muro. */
  recintos?: Recinto[];
}

export interface Caravana {
  id: string;
  origenAsentamientoId: string;
  destinoAsentamientoId?: string;
  posicionActual: Point;
  ruta?: Point[];
}

export interface ZonaFaccion {
  faccionId: string;
  contornos: Point[][];
}

export interface CampamentoBandido {
  id: string;
  posicion: Point;
}

export interface CaminoComercial {
  id: string;
  puntos: Point[];
}

/** Tirada rectangular de celdas, en coordenadas locales — la calle/camino/muro OCUPA suelo (área), no es una
 * línea sin grosor (Etapa 6 del trazado urbano). Corrige el tipo `SegmentoTrazado` (`{desde,hasta}`) que
 * tenía este archivo: esa forma es de ANTES de Etapa 6, cuando las calles vivían en aristas, no en celdas —
 * quedó desincronizada del contrato real (`RectanguloLocal`, `engine/trazado.ts`) y nunca se notó porque
 * hasta ahora ningún asentamiento real con calles se había llegado a pintar aquí.
 */
export interface RectanguloLocal {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Un recinto ya resuelto para dibujar — copia local de `TrazadoMuralla` (motor). Solo las celdas YA
 * LEVANTADAS van en `muro`/`puertas`/`torres`; `planificado` son las que ya ocupan suelo pero aún no están en
 * pie (se dibujan como obra pendiente, no como césped vacío — ver Paso 2b del doc de murallas). */
export interface TrazadoMuralla {
  nivel: number;
  /** 0..1 — qué fracción del anillo está levantada. */
  integridad: number;
  muro: RectanguloLocal[];
  puertas: RectanguloLocal[];
  torres: RectanguloLocal[];
  planificado: RectanguloLocal[];
}

export interface TrazadoAsentamiento {
  calles: RectanguloLocal[];
  caminos: RectanguloLocal[];
  huellas: Record<string, RectanguloLocal>;
  murallas: TrazadoMuralla[];
}
