// Pantalla «PARTIDAS» (tras el login): las partidas abiertas del servidor y, en cada una, el héroe del jugador (nombre, Facción con su emblema y nivel) si lo tiene.
// Se elige una tarjeta y el botón de abajo entra: si aún no eres miembro de esa partida, entrar es unirte. Los datos vienen de `GET /v1/jugador/partidas`.
import { listarPartidas, type PartidaListada } from '../apiCliente';
import { svgEmblema } from '../sigilo/emblemas';
import { colorHex, svgSigilo } from '../sigilo/sigilo';

type Escapar = (valor: string) => string;

export interface DepsPartidas {
  usuario: string;
  /** La partida en la que se estaba, para dejarla preseleccionada. */
  previa: string;
  entrar: (partida: PartidaListada) => Promise<void>;
  cerrarSesion: () => void;
  mensajeError: (err: unknown) => string;
  escapar: Escapar;
}

function tarjeta(p: PartidaListada, elegida: boolean, e: Escapar): string {
  const h = p.heroe;
  // El sigilo completo si el servidor lo manda; si no, solo el símbolo (la respuesta antigua traía únicamente el emblema y su color).
  const emblema = h?.faccion
    ? (h.faccion.sigilo ? `<span class="partida-emblema">${svgSigilo(h.faccion.sigilo, 30)}</span>` : `<svg class="partida-emblema" viewBox="0 0 100 100" aria-hidden="true">${svgEmblema(h.faccion.emblemaId, colorHex(h.faccion.colorEmblemaId))}</svg>`)
    : '';
  const cuerpo = h
    ? `${emblema}<div><strong>${e(h.nombre)}</strong><span>${h.faccion ? e(h.faccion.nombre) : 'Sin Facción'} · Nivel ${h.nivel}</span></div>`
    : `<div><span>${p.membresia ? 'Eres miembro, aún sin héroe.' : 'Aún no has entrado en esta partida.'}</span></div>`;
  return `<button type="button" class="partida${elegida ? ' elegida' : ''}" data-partida="${e(p.gameId)}" aria-pressed="${elegida}">
    <span class="partida-id">${e(p.nombre ?? p.gameId)}</span>${p.nombre ? `<small class="partida-clave">${e(p.gameId)}</small>` : ''}<div class="partida-heroe">${cuerpo}</div></button>`;
}

export async function montarPartidas(app: HTMLElement, d: DepsPartidas): Promise<void> {
  const e = d.escapar;
  let lista: PartidaListada[] | null = null;
  let elegida = '';
  let error = '';
  let entrando = false;

  const pintar = (): void => {
    const sel = lista?.find((p) => p.gameId === elegida);
    app.innerHTML = `<div class="login-container"><div class="login-card partidas-card">
      <div class="login-header"><h1 class="login-title">Partidas</h1><p class="login-subtitle">Sesión de ${e(d.usuario)}</p></div>
      <div class="partidas-lista">${lista === null ? '<p class="mapa-lista-vacia">Cargando partidas…</p>' : lista.length === 0 ? '<p class="mapa-lista-vacia">No hay partidas abiertas en el servidor.</p>' : lista.map((p) => tarjeta(p, p.gameId === elegida, e)).join('')}</div>
      ${error ? `<div class="error-banner">⚠️ ${e(error)}</div>` : ''}
      <div class="partidas-pie">
        <button type="button" id="btn-entrar-partida" class="btn-primary"${sel && !entrando ? '' : ' disabled'}>${entrando ? 'Entrando…' : sel && !sel.membresia ? 'Unirme y entrar' : 'Entrar'}</button>
        <button type="button" id="btn-partidas-logout" class="text-link">Cerrar sesión</button>
      </div></div></div>`;
    app.querySelectorAll<HTMLButtonElement>('[data-partida]').forEach((b) => b.addEventListener('click', () => { elegida = b.dataset.partida!; error = ''; pintar(); }));
    app.querySelector('#btn-partidas-logout')?.addEventListener('click', d.cerrarSesion);
    app.querySelector('#btn-entrar-partida')?.addEventListener('click', async () => {
      if (!sel) return;
      entrando = true; error = ''; pintar();
      try { await d.entrar(sel); } catch (err) { entrando = false; error = d.mensajeError(err); pintar(); }
    });
  };

  pintar();
  try {
    lista = await listarPartidas();
    if (!app.querySelector('.partidas-card')) return; // se cambió de pantalla mientras cargaba
    elegida = lista.find((p) => p.gameId === d.previa)?.gameId ?? (lista.length === 1 ? lista[0]!.gameId : '');
  } catch (err) {
    lista = [];
    error = d.mensajeError(err);
  }
  pintar();
}
