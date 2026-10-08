// Panel «LO QUE LLEVAS» del riel del mapa: la tropa y el carro de tu columna, ahora mismo. Las escuadras salen en el orden en que entran en
// combate (`ejercito.escuadronIds`; la batalla de Unity usa el mismo orden en `heroe.escuadrones`) y se reordenan con las flechas: el comando
// `ordenarEscuadras` (backend 2026-10-07) pone las tuyas en el orden pedido. En un ejército con más héroes solo se ordenan las tuyas.
import type { ProyeccionJugador } from '../apiCliente';
import type { Escuadron } from '../tiposDominio';
import { chipLiderazgo } from './liderazgo';
import { cablearCarro, htmlCarro, type Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

function miColumna(p: ProyeccionJugador) {
  return p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
}

/** Tus escuadras de la columna, en su orden de combate. */
function escuadrasEnOrden(p: ProyeccionJugador): Escuadron[] {
  const columna = miColumna(p);
  if (!columna) return [];
  const porId = new Map(p.heroe.escuadrones.map((s) => [s.id, s]));
  return columna.escuadronIds.flatMap((id) => porId.get(id) ?? []);
}

export function htmlColumna(p: ProyeccionJugador, e: Escapar): string {
  const columna = miColumna(p);
  if (!columna) return '<span class="faction-kicker">Lo que llevas</span><p class="mapa-lista-vacia">No estás en el mapa con una columna.</p>';
  const mias = escuadrasEnOrden(p);
  const deOtros = columna.escuadronIds.length - mias.length;
  const total = mias.reduce((s, x) => s + x.cantidad, 0);
  return `
    <span class="faction-kicker">Lo que llevas</span>
    <div class="asent-ficha-grid">
      <div><span>Hombres</span><strong>${total}</strong></div>
      <div><span>Columna</span><strong>${columna.tipo === 'ejercito' ? `ejército · ${columna.participantes.length}` : 'personal'}</strong></div>
    </div>
    <strong class="heroe-sub">Tropa, en orden de combate</strong>
    ${mias.length === 0
      ? '<p class="mapa-lista-vacia">Tu columna no lleva tropa tuya.</p>'
      : `<ol class="columna-orden">${mias
          .map((s, i) => `<li><span class="columna-pos">${i + 1}</span><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres · moral ${Math.round(s.moral)}${s.prestada ? ' · prestada' : ''}</span></div>
            <button class="btn-secondary" type="button" data-mover="${i}" data-dir="-1" aria-label="Subir ${e(s.nombre)}"${i === 0 ? ' disabled' : ''}>↑</button>
            <button class="btn-secondary" type="button" data-mover="${i}" data-dir="1" aria-label="Bajar ${e(s.nombre)}"${i === mias.length - 1 ? ' disabled' : ''}>↓</button></li>`)
          .join('')}</ol>`}
    ${deOtros > 0 ? `<p class="asent-lado-nota">Además van ${deOtros} escuadras de los otros héroes del ejército: su orden lo pone cada uno.</p>` : ''}
    <p class="asent-lado-nota">La primera entra primero en combate.</p>
    <p class="faction-error" data-campo="error-orden" role="alert"></p>
    ${htmlCarro(p, e, false)}`;
}

export function cablearColumna(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-orden"]');
  raiz.querySelectorAll<HTMLButtonElement>('[data-mover]').forEach((boton) =>
    boton.addEventListener('click', async () => {
      const ids = escuadrasEnOrden(p).map((s) => s.id);
      const i = Number(boton.dataset.mover);
      const j = i + Number(boton.dataset.dir);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      const flechas = Array.from(raiz.querySelectorAll<HTMLButtonElement>('[data-mover]'));
      const antes = flechas.map((b) => b.disabled);
      flechas.forEach((b) => { b.disabled = true; });
      const mensaje = await ejecutar('ordenarEscuadras', { escuadronIds: ids });
      // Si va bien, el refresco repinta el panel con el orden nuevo; si no, se devuelven las flechas como estaban.
      if (mensaje) flechas.forEach((b, k) => { b.disabled = antes[k]!; });
      if (error) error.textContent = mensaje ?? '';
    })
  );
  cablearCarro(raiz, ejecutar);
}
