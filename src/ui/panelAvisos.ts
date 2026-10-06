// Panel de AVISOS: el historial consultable de lo que te ha pasado (informes de combate, que te han mirado), con lo más reciente arriba. Un informe de
// combate se abre como briefing al pulsarlo. Qué te persigue ahora mismo no es histórico: sale en la barra superior (`jugador-alerta`).
import type { EntradaAviso } from './avisos';

const ETIQUETA = { peligro: 'Te atacaron', combate: 'Combate', baja: 'Bajas', mirada: 'Te observaron' } as const;

export function htmlAvisos(entradas: readonly EntradaAviso[], e: (s: string) => string): string {
  if (entradas.length === 0) return '<p class="mapa-lista-vacia">Nada que contar todavía: aquí quedan tus combates y quién te ha mirado.</p>';
  return `<div class="mapa-lista">${entradas
    .map((a, i) => `<button class="mapa-lista-item aviso-${a.clase}" type="button" data-aviso="${i}"${a.informe ? '' : ' disabled'}>
      <strong>${ETIQUETA[a.clase]}${a.informe ? ` · ${a.informe.resultado}` : ''}</strong>
      <span>${e(a.texto)}</span>
      <span>${a.momento ? e(new Date(a.momento).toLocaleString()) : `evento ${a.version}`}${a.informe ? ' · ver informe' : ''}</span></button>`)
    .join('')}</div>`;
}
