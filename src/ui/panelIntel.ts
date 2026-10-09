// Panel INTEL (backend 2026-10-05, Doc 5.12.10): la taberna vende Miradas (un ojo prestado sobre un punto del mapa, 2 h) e Informes de
// plaza ajena (foto con fecha de su layout y su defensa). Se compra en la taberna de una plaza propia —estando dentro— o en la de un
// campamento de mercenarios —dentro, o con la columna a la puerta—. Aquí no se decide ninguna regla: el precio es una cotización con
// `tarifasIntel` y quien valida es el backend, cuyo rechazo sale tal cual en `#intel-error`.
import type { ProyeccionJugador } from '../apiCliente';
import { EDIFICIO_COLOR, EDIFICIO_NOMBRE } from '../paletas';
import type { InformePlaza, MiradaIntel, OrigenDeIntel, Point } from '../tiposDominio';
import { ayuda } from './ayuda';

export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;
type Escapar = (valor: string) => string;

/** Lo que el panel recuerda entre repintados: el punto elegido para la próxima Mirada y el Informe abierto. */
export const estadoIntel: { centro: Point | null; informeAbierto: string | null } = {
  centro: null,
  informeAbierto: null,
};

/** A qué distancia de su puerta se actúa en un campamento (`MOVIMIENTO.radioPuerta`). */
const RADIO_PUERTA = 10;

export interface TabernaDisponible {
  origen: OrigenDeIntel;
  etiqueta: string;
  posicion: Point;
  /** El oro con el que se paga: el del almacén de la plaza o el oro de botín del héroe. */
  oro: number;
  /** Cuántas Miradas admite a la vez (el nivel interno de la taberna de plaza). */
  cupo: number;
}

function miColumna(p: ProyeccionJugador) {
  return p.ejercitos.find((e) => e.participantes.some((x) => x.heroeId === p.heroeId));
}

/** Las tabernas donde puede comprar ahora mismo: la de la plaza que pisa y la del campamento donde está o a cuya puerta tiene la columna. */
export function tabernasDisponibles(p: ProyeccionJugador): TabernaDisponible[] {
  const lista: TabernaDisponible[] = [];
  const cupos = p.tarifasIntel.cupoMiradas;
  const plaza = p.asentamientos[0];
  const taberna = plaza?.edificios.find((e) => e.tipo === 'taberna' && e.estado === 'activo');
  if (plaza && taberna) {
    lista.push({
      origen: { tipo: 'asentamiento', id: plaza.id },
      etiqueta: `Taberna de ${plaza.nombre ?? plaza.id}`,
      posicion: plaza.posicion,
      oro: plaza.almacen?.['oro']?.cantidad ?? 0,
      cupo: cupos.porNivelDeTaberna[(taberna.nivelInterno ?? 1) - 1] ?? 0,
    });
  }
  const u = p.heroe.ubicacion;
  const columna = miColumna(p);
  const campamento =
    u.tipo === 'mercenarios'
      ? p.campamentosMercenarios.find((c) => c.id === u.campamentoId)
      : columna
        ? p.campamentosMercenarios.find((c) => Math.hypot(c.posicion.x - columna.posicionActual.x, c.posicion.y - columna.posicionActual.y) <= RADIO_PUERTA)
        : undefined;
  if (campamento && p.faccionId !== null) {
    lista.push({ origen: { tipo: 'campamento', id: campamento.id }, etiqueta: `Taberna del campamento ${campamento.id}`, posicion: campamento.posicion, oro: p.heroe.oroDeBotin ?? 0, cupo: cupos.campamento });
  }
  return lista;
}

interface PlazaAjena {
  id: string;
  nombre?: string;
  faccionId: string;
  nivel: number;
  posicion: Point;
}

/** Las plazas ajenas que conoce (la que se ve gana a la recordada): las que se pueden mirar o de las que se puede pedir un Informe. */
function plazasAjenas(p: ProyeccionJugador): PlazaAjena[] {
  const vistas = p.asentamientosAvistados.map((a) => ({ id: a.id, nombre: a.nombre, faccionId: a.faccionId, nivel: a.nivel, posicion: a.posicion }));
  const ids = new Set(vistas.map((a) => a.id));
  const recordadas = p.asentamientosConocidos.filter((a) => !ids.has(a.asentamientoId)).map((a) => ({ id: a.asentamientoId, nombre: a.nombre, faccionId: a.faccionId, nivel: a.nivel, posicion: a.posicion }));
  return [...vistas, ...recordadas].filter((a) => a.faccionId !== p.faccionId);
}

/** Lo que cuesta mirar `centro` desde `t`: la misma cuenta del backend (`precioMirada`, `engine/intel.ts`). */
function precioMirada(p: ProyeccionJugador, t: TabernaDisponible, centro: Point): number {
  const ojos: Point[] = [
    t.posicion,
    ...p.asentamientos.map((a) => a.posicion),
    ...[...p.asentamientosAvistados, ...p.asentamientosConocidos].filter((a) => a.faccionId === p.faccionId).map((a) => a.posicion),
    ...p.ejercitos.map((e) => e.posicionActual),
  ];
  const lejos = Math.min(...ojos.map((o) => Math.hypot(o.x - centro.x, o.y - centro.y)));
  const { oroBase, oroPorUnidad } = p.tarifasIntel.mirada;
  return Math.ceil(oroBase + oroPorUnidad * lejos);
}

function hace(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min < 90 ? `${min} min` : min < 60 * 36 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`;
}

function listaMiradas(p: ProyeccionJugador): string {
  if (p.miradasIntel.length === 0) return '<p class="mapa-lista-vacia">Ninguna.</p>';
  return `<div class="mapa-lista">${p.miradasIntel
    .map((m: MiradaIntel) => {
      const abierta = m.expiraEn > p.instante;
      return `<button class="mapa-lista-item" type="button" data-centrar-x="${m.centro.x}" data-centrar-y="${m.centro.y}">${abierta ? '👁 Abierta' : '⏳ Enfriándose'}<span>(${Math.round(m.centro.x)}, ${Math.round(m.centro.y)}) · ${abierta ? `${hace(m.expiraEn - p.instante)} restantes` : `repetible en ${hace(m.libreEn - p.instante)}`}</span></button>`;
    })
    .join('')}</div>`;
}

/** Mini plano del layout de un Informe: un cuadrado por edificio, del color de su tipo, sobre una cuadrícula local al asentamiento. */
function planoDeInforme(inf: InformePlaza): string {
  const internos = inf.edificios.filter((e) => e.ambito !== 'mapa');
  if (internos.length === 0) return '';
  const xs = internos.map((e) => e.posicion.x);
  const ys = internos.map((e) => e.posicion.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const ancho = Math.max(...xs) - minX || 1;
  const alto = Math.max(...ys) - minY || 1;
  const lado = 220;
  const escala = Math.min((lado - 16) / ancho, (lado - 16) / alto, 12);
  const celdas = internos
    .map((e) => `<rect x="${(8 + (e.posicion.x - minX) * escala).toFixed(1)}" y="${(8 + (e.posicion.y - minY) * escala).toFixed(1)}" width="${Math.max(4, escala * 2).toFixed(1)}" height="${Math.max(4, escala * 2).toFixed(1)}" fill="${EDIFICIO_COLOR[e.tipo] ?? '#888'}" opacity="${e.estado === 'activo' ? 1 : 0.45}"><title>${EDIFICIO_NOMBRE[e.tipo] ?? e.tipo}</title></rect>`)
    .join('');
  return `<svg class="intel-plano" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}" role="img" aria-label="Plano de la plaza">${celdas}</svg>`;
}

function detalleInforme(inf: InformePlaza, p: ProyeccionJugador, e: Escapar): string {
  const porTipo = new Map<string, number>();
  for (const ed of inf.edificios) porTipo.set(ed.tipo, (porTipo.get(ed.tipo) ?? 0) + 1);
  const tropas = new Map<string, number>();
  for (const g of inf.guarnicion) tropas.set(g.tropaId, (tropas.get(g.tropaId) ?? 0) + g.cantidad);
  const faccion = p.facciones.find((f) => f.id === inf.faccionId);
  return `
    <section class="intel-informe">
      <span class="faction-kicker">Informe · foto de hace ${hace(p.instante - inf.conocidoEn)} ${ayuda('plaza:intel-foto', 'Es una foto: no se actualiza. Su almacén no viene en el informe.')}</span>
      <h3>${e(inf.nombre ?? inf.asentamientoId)}</h3>
      <div class="mapa-seleccion-datos"><div><span>Facción</span><strong>${e(faccion?.nombre ?? inf.faccionId)}</strong></div><div><span>Nivel</span><strong>${inf.nivel}</strong></div><div><span>Héroes dentro</span><strong>${inf.heroesIds.length}</strong></div></div>
      ${planoDeInforme(inf)}
      <strong>Edificios</strong>
      <div class="mapa-seleccion-datos">${[...porTipo].map(([t, n]) => `<div><span>${e(EDIFICIO_NOMBRE[t] ?? t)}</span><strong>${n}</strong></div>`).join('')}</div>
      <strong>Guarnición</strong>
      ${tropas.size > 0 ? `<div class="mapa-seleccion-datos">${[...tropas].map(([t, n]) => `<div><span>${e(t)}</span><strong>${n}</strong></div>`).join('')}</div>` : '<p class="mapa-lista-vacia">Sin guarnición.</p>'}
      <strong>Murallas</strong>
      ${inf.recintos.length > 0 ? inf.recintos.map((r) => `<p class="mapa-lista-vacia">Recinto de nivel ${r.nivel}: ${Math.max(0, r.avance + 1)} de ${r.celdas.length} celdas levantadas, ${r.celdas.filter((c) => c.clase === 'puerta').length} puertas.</p>`).join('') : '<p class="mapa-lista-vacia">Sin recinto.</p>'}    </section>`;
}

/**
 * El HTML del panel. La intel solo se compra desde dentro de una taberna (la de una plaza propia o la de un campamento de mercenarios):
 * el punto de una Mirada se elige de la lista de plazas conocidas o con coordenadas, no con un clic en el mapa.
 */
export function renderPanelIntel(p: ProyeccionJugador, e: Escapar, origenId?: string): string {
  const tabernas = tabernasDisponibles(p);
  const t = tabernas.find((x) => x.origen.id === origenId) ?? tabernas[0];
  const ajenas = plazasAjenas(p);
  const informePrevio = (id: string) => p.informesPlaza.find((i) => i.asentamientoId === id);
  const enfriandose = (id: string) => {
    const i = informePrevio(id);
    return i !== undefined && i.conocidoEn + p.tarifasIntel.informe.cooldownMinutos * 60_000 > p.instante;
  };
  const libres = ajenas.filter((a) => !enfriandose(a.id));
  const centro = estadoIntel.centro;
  const abiertas = t ? p.miradasIntel.filter((m) => m.origenId === t.origen.id && m.expiraEn > p.instante).length : 0;
  const precio = t && centro ? precioMirada(p, t, centro) : null;
  const m = p.tarifasIntel.mirada;

  const compra = !t
    ? `<p>No tienes ninguna taberna a mano. ${ayuda('plaza:intel-taberna', 'La intel se compra en una <strong>taberna</strong>: la de una plaza tuya (nivel 2, la construye el Gobernador; entra en ella) o la de un campamento de mercenarios (dentro, o con tu columna a la puerta).')}</p>`
    : `
      <label class="campamento-fila"><span>Taberna</span><select class="form-input" id="intel-origen">${tabernas.map((x) => `<option value="${e(x.origen.id)}"${x === t ? ' selected' : ''}>${e(x.etiqueta)}</option>`).join('')}</select></label>
      <div class="mapa-seleccion-datos"><div><span>Oro</span><strong>${Math.floor(t.oro)}</strong></div><div><span>Miradas abiertas</span><strong>${abiertas} / ${t.cupo}</strong></div></div>

      <section class="campamento-seccion">
        <span class="faction-kicker">Mirada ${ayuda('plaza:intel-mirada', `Un ojo de ${m.radio} de radio durante ${m.duracionMinutos / 60} h sobre cualquier punto: ves en vivo lo que verías con una columna ahí, sin interiores. Lo ven también tus aliados.`)}</span>
        <div class="campamento-fila"><select class="form-input" id="intel-cerca"><option value="">Mirar alrededor de…</option>${ajenas.map((a) => `<option value="${a.posicion.x},${a.posicion.y}">${e(a.nombre ?? a.id)}</option>`).join('')}${p.campamentosMercenarios.map((c) => `<option value="${c.posicion.x},${c.posicion.y}">Campamento ${e(c.id)}</option>`).join('')}</select></div>
        <div class="campamento-fila"><input class="form-input" id="intel-x" type="number" min="0" placeholder="x" value="${centro ? Math.round(centro.x) : ''}" /><input class="form-input" id="intel-y" type="number" min="0" placeholder="y" value="${centro ? Math.round(centro.y) : ''}" /></div>
        <button class="btn-primary" type="button" id="intel-comprar-mirada"${centro && abiertas < t.cupo ? '' : ' disabled'}>${abiertas >= t.cupo ? 'Taberna al límite de Miradas' : precio !== null ? `Comprar Mirada · ${precio} de oro` : 'Elige un punto'}</button>
      </section>

      <section class="campamento-seccion">
        <span class="faction-kicker">Informe de plaza ${ayuda('plaza:intel-informe', 'La foto, con fecha, del layout y la defensa de una plaza ajena que conoces. Avisa, sin firma, a su Facción.')}</span>
        ${ajenas.length === 0
          ? '<p class="mapa-lista-vacia">No conoces ninguna plaza ajena: mira una zona o explora.</p>'
          : libres.length === 0
            ? '<p class="mapa-lista-vacia">Ya tienes un informe reciente de todas las plazas que conoces.</p>'
            : `<div class="campamento-fila"><select class="form-input" id="intel-plaza">${libres.map((a) => `<option value="${e(a.id)}">${e(a.nombre ?? a.id)} · nivel ${a.nivel} · ${p.tarifasIntel.informe.oroPorNivel * a.nivel} oro</option>`).join('')}</select></div>
          <button class="btn-primary" type="button" id="intel-comprar-informe">Comprar Informe</button>`}
      </section>`;

  const informes = p.informesPlaza;
  const abierto = informes.find((i) => i.asentamientoId === estadoIntel.informeAbierto);
  return `
    <div class="intel-panel" data-origen="${t ? e(t.origen.id) : ''}">
      <span class="faction-kicker">Taberna e intel</span>
      ${compra}
      <section class="campamento-seccion"><span class="faction-kicker">Tus Miradas</span>${listaMiradas(p)}</section>
      <section class="campamento-seccion"><span class="faction-kicker">Tus Informes</span>
        ${informes.length === 0 ? '<p class="mapa-lista-vacia">Ninguno.</p>' : `<div class="mapa-lista">${informes.map((i) => `<button class="mapa-lista-item" type="button" data-informe="${e(i.asentamientoId)}">${e(i.nombre ?? i.asentamientoId)}<span>nivel ${i.nivel} · hace ${hace(p.instante - i.conocidoEn)}</span></button>`).join('')}</div>`}
      </section>
      ${abierto ? detalleInforme(abierto, p, e) : ''}
      <p id="intel-error" class="faction-error" role="alert"></p>
    </div>`;
}

/** Cablea el panel tras pintarlo. `repintar` vuelve a pintarlo (cambió el punto o el Informe abierto). */
export function cablearPanelIntel(root: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar, repintar: () => void): void {
  const error = root.querySelector<HTMLElement>('#intel-error');
  const origenDe = (): OrigenDeIntel | undefined => {
    const id = root.querySelector<HTMLSelectElement>('#intel-origen')?.value ?? root.querySelector<HTMLElement>('.intel-panel')?.dataset.origen;
    return tabernasDisponibles(p).find((t) => t.origen.id === id)?.origen;
  };
  const fijarCentro = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    estadoIntel.centro = { x, y };
    repintar();
  };

  root.querySelector('#intel-origen')?.addEventListener('change', repintar);
  root.querySelector<HTMLSelectElement>('#intel-cerca')?.addEventListener('change', (ev) => {
    const [x, y] = (ev.currentTarget as HTMLSelectElement).value.split(',').map(Number);
    if (x !== undefined && y !== undefined && (ev.currentTarget as HTMLSelectElement).value !== '') fijarCentro(x, y);
  });
  for (const id of ['#intel-x', '#intel-y']) {
    root.querySelector(id)?.addEventListener('change', () => {
      const x = root.querySelector<HTMLInputElement>('#intel-x')?.value;
      const y = root.querySelector<HTMLInputElement>('#intel-y')?.value;
      if (x !== undefined && y !== undefined && x !== '' && y !== '') fijarCentro(Number(x), Number(y));
    });
  }
  const comprar = (selector: string, tipo: string, params: () => object | null): void => {
    root.querySelector<HTMLButtonElement>(selector)?.addEventListener('click', async (ev) => {
      const boton = ev.currentTarget as HTMLButtonElement;
      const cuerpo = params();
      if (!cuerpo) return;
      boton.disabled = true;
      const mensaje = await ejecutar(tipo, cuerpo);
      boton.disabled = false;
      if (error) error.textContent = mensaje ?? '';
    });
  };
  comprar('#intel-comprar-mirada', 'comprarMirada', () => {
    const origen = origenDe();
    return origen && estadoIntel.centro ? { origen, centro: estadoIntel.centro } : null;
  });
  comprar('#intel-comprar-informe', 'comprarInformePlaza', () => {
    const origen = origenDe();
    const asentamientoId = root.querySelector<HTMLSelectElement>('#intel-plaza')?.value;
    if (!origen || !asentamientoId) return null;
    estadoIntel.informeAbierto = asentamientoId; // al llegar, se abre el informe recién comprado
    return { origen, asentamientoId };
  });
  root.querySelectorAll<HTMLButtonElement>('[data-informe]').forEach((boton) =>
    boton.addEventListener('click', () => {
      estadoIntel.informeAbierto = estadoIntel.informeAbierto === boton.dataset.informe ? null : boton.dataset.informe!;
      repintar();
    })
  );
}
