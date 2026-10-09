// GANCHOS de extensión de la interfaz: puntos donde un bloque de trabajo añade una pieza nueva SIN editar el resto de `main.ts`.
// Cada bloque tiene su «hueco» (separado por líneas en blanco) para que dos ramas que añaden a la vez no se pisen al fusionar.
// Para añadir una pieza: crea su módulo en `src/ui/`, impórtalo aquí y añade UNA entrada en TU hueco.
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import type { Ejecutar } from './panelCarro';
import { SUBPESTANA_APARCADAS } from './panelAparcadas';
import { SUBPESTANA_TRUEQUES } from './panelTrueques';

type Escapar = (valor: string) => string;

// ---------------------------------------------------------------- Plaza (columna derecha, por edificio)

/** Lo que recibe una subpestaña de la plaza al pintarse y cablearse. `cuerpo` es el contenedor donde se pinta; los listeners se cablean sobre él. */
export interface ContextoPlaza {
  proyeccion: ProyeccionJugador;
  asentamiento: Asentamiento;
  cuerpo: HTMLElement;
  /** Manda un comando y refresca; devuelve `null` si salió bien o el mensaje de error (mismo contrato que `Ejecutar`). */
  ejecutar: Ejecutar;
  /** Repinta la columna (p. ej. al cambiar un borrador). */
  refrescar: () => void;
  /** Tu cargo de construcción en esta plaza, si lo tienes. */
  cargo: 'gobernador' | 'maestroObras' | null;
  /** ¿Resides en esta plaza? (lo que exige el backend a casi todo lo que se hace dentro). */
  resideAqui: boolean;
  escapar: Escapar;
}

/** Una subpestaña de «Centro urbano» o de «Mercado». El HTML se repinta con el sondeo solo si cambió (`ui/repintado.ts`): que sea determinista. */
export interface SubpestanaPlaza {
  id: string;
  etiqueta: string;
  html: (c: ContextoPlaza) => string;
  cablear?: (c: ContextoPlaza) => void;
}

/** Subpestañas EXTRA de Centro urbano, después de Resumen · Edificios · Producción · Cola · Cargos. */
export const SUBPESTANAS_CENTRO_EXTRA: SubpestanaPlaza[] = [
  // --- hueco bloque A1 (plaza › Centro urbano: muralla, puerta y veto, residencia y capital)

  // --- hueco bloque A2 (plaza › Centro urbano: tesorero y caravana de fundación)

  // --- hueco bloque F (vista de la ciudad: recetas)
];

/** Subpestañas EXTRA de Mercado, después de Órdenes · Caravanas · Escolta. */
export const SUBPESTANAS_MERCADO_EXTRA: SubpestanaPlaza[] = [
  // --- hueco bloque D1 (trueques, caravanas aparcadas)
  SUBPESTANA_TRUEQUES,
  SUBPESTANA_APARCADAS,

];

// ---------------------------------------------------------------- Mapa (panel de Selección)

/** Lo que recibe una ficha extra del mapa. */
export interface ContextoFicha {
  ejecutar: Ejecutar;
  /** Un aviso breve sobre el mapa. */
  aviso: (texto: string) => void;
  /** Cierra la selección y repinta. */
  cerrar: () => void;
  escapar: Escapar;
}

/** Una ficha de selección del mapa para un tipo de cosa nuevo (columna ajena, caravana ajena…). `buscar` la resuelve de la proyección (`undefined` = ya no existe: se cierra). */
export interface FichaMapaExtra {
  tipo: string;
  buscar: (p: ProyeccionJugador, id: string) => unknown;
  html: (p: ProyeccionJugador, objeto: never, c: ContextoFicha) => string;
  cablear?: (cont: HTMLElement, p: ProyeccionJugador, objeto: never, c: ContextoFicha) => void;
}

export const FICHAS_MAPA_EXTRA: FichaMapaExtra[] = [
  // --- hueco bloque C1 (columnas y caravanas ajenas, héroes ajenos)

];

/** Qué hay bajo un clic del mapa: se prueban antes que los selectores propios de `main.ts`; el primero que devuelva algo gana. `ir` = adónde marchar (opcional). */
export interface ObjetoBajoElClic {
  tipo: string;
  id: string;
  ir?: { tipo: 'punto'; punto: { x: number; y: number } } | { tipo: 'asentamiento'; id: string };
}
export const SELECTORES_MAPA_EXTRA: ((p: ProyeccionJugador, punto: { x: number; y: number }) => ObjetoBajoElClic | null)[] = [
  // --- hueco bloque C1

];
