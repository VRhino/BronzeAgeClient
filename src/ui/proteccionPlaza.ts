// La protección de una plaza (Combate §6 y §8; Fundacion_Y_Refundacion §5): toda plaza nace inatacable un día (`OCUPACION.proteccionMinutos`,
// 1440) y lo vuelve a ser tras cada conquista; atacarla se rechaza con `combate.plaza_protegida`. Víctor, 2026-11-10: la ficha de la plaza en el
// mapa dice si está protegida y cuánto le queda.
//   de dónde   `protegida_hasta_ms` del contrato, que desde el motor 3d05872 llega en toda ficha de plaza, también tras una conquista; si no
//              llega (un motor de antes), el día de la fundación: `fundado_en_ms` + `proteccionMinutos`.
import { bloqueDeDatos } from '../apiCliente';
import { textoEnTiempoReal } from './estadoCliente';

type Escapar = (valor: string) => string;

/** Lo que se sabe de la protección de una plaza: su fin, si llega, o su fundación. */
export interface ConProteccion { protegidaHasta?: number; fundadoEn?: number }

/** Los minutos de protección de una plaza recién fundada o conquistada (`OCUPACION.proteccionMinutos`); 1440 mientras no lleguen los datos. */
export function minutosDeProteccion(alCargar?: () => void): number {
  return bloqueDeDatos<{ proteccionMinutos?: number }>('OCUPACION', alCargar)?.proteccionMinutos ?? 1440;
}

/** Hasta cuándo está protegida (instante de mundo), o nada si no se sabe. */
export function protegidaHasta(a: ConProteccion, alCargar?: () => void): number | undefined {
  if (a.protegidaHasta !== undefined) return a.protegidaHasta;
  return a.fundadoEn !== undefined ? a.fundadoEn + minutosDeProteccion(alCargar) * 60_000 : undefined;
}

/** Lo que le queda de protección ahora (ms de mundo), o nada si no está protegida. */
export function proteccionRestante(a: ConProteccion, ahora: number, alCargar?: () => void): number | undefined {
  const hasta = protegidaHasta(a, alCargar);
  return hasta !== undefined && hasta > ahora ? hasta - ahora : undefined;
}

/** La fila «Protegida · 18 h» de la ficha de la plaza, o nada si no lo está. */
export function htmlFilaProteccion(a: ConProteccion, ahora: number, e: Escapar, alCargar?: () => void): string {
  const queda = proteccionRestante(a, ahora, alCargar);
  if (queda === undefined) return '';
  return `<div class="ficha-proteccion" title="Nadie puede atacarla mientras dure: toda plaza nace protegida y lo vuelve a estar tras una conquista."><span>🛡 Protegida</span><strong>${e(`le queda ${textoEnTiempoReal(queda)}`)}</strong></div>`;
}

/** El motivo del botón Atacar apagado mientras está protegida. */
export function motivoProtegida(a: ConProteccion, ahora: number, alCargar?: () => void): string {
  const queda = proteccionRestante(a, ahora, alCargar);
  return queda === undefined ? '' : `Está protegida: se podrá atacar dentro de ${textoEnTiempoReal(queda)}.`;
}
