// Panel INTEL (backend 2026-10-05, Doc 5.12.10): la taberna vende Miradas (un ojo prestado sobre un punto del mapa, 2 h) e Informes de
// plaza ajena (foto con fecha de su layout y su defensa). Se compra en la taberna de una plaza propia —estando dentro— o en la de un
// campamento de mercenarios —dentro, o con la columna a la puerta—. Aquí no se decide ninguna regla: el precio es una cotización con
// `tarifasIntel` y quien valida es el backend, cuyo rechazo sale flotando (`mostrarAviso`).
import { radioDePuerta, tropasReclutables, type ProyeccionJugador } from '../apiCliente';
import { ayuda } from './ayuda';
import { EDIFICIO_COLOR, EDIFICIO_NOMBRE, RECURSO_ICONO } from '../paletas';
import type { Asentamiento, InformePlaza, MiradaIntel, OrigenDeIntel, Point } from '../tiposDominio';
import { mostrar as mostrarAviso } from './avisos';
import { iconoEdificio } from './iconosEdificio';
import { iconoTropa } from './iconosTropa';
import { medallonNivel } from './juegoVisual';
import { cablearServicioRegion, compraIntelEn, htmlInformesRegion, htmlServicioRegion } from './tabernaRegion';

export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;
type Escapar = (valor: string) => string;

/** Lo que el panel recuerda entre repintados: el punto elegido para la próxima Mirada y el Informe abierto. */
export const estadoIntel: { centro: Point | null; informeAbierto: string | null } = {
  centro: null,
  informeAbierto: null,
};

export interface TabernaDisponible {
  origen: OrigenDeIntel;
  etiqueta: string;
  posicion: Point;
  /** El oro con el que se paga: el del almacén de la plaza, o en un campamento el del héroe (su almacén si reside, su carro si no). */
  oro: number;
  /** Cuántas Miradas admite a la vez (el nivel interno de la taberna de plaza). */
  cupo: number;
}

function miColumna(p: ProyeccionJugador) {
  return p.ejercitos.find((e) => e.participantes.some((x) => x.heroeId === p.heroeId));
}

/** Las tabernas donde puede comprar ahora mismo: la de la plaza que pisa y la del campamento donde está o a cuya puerta tiene la columna. */
/** La plaza de tu Facción, con Taberna activa, a cuya puerta está tu columna y en la que compras intel (Rey, Embajador o su Gobernador). */
export function plazaPropiaALaPuerta(p: ProyeccionJugador): Asentamiento | undefined {
  const columna = miColumna(p);
  if (!columna || !p.faccionId) return undefined;
  return (p.plazasPropias ?? []).find((a) => a.faccionId === p.faccionId && compraIntelEn(p, a, true)
    && a.edificios.some((e) => e.tipo === 'taberna' && e.estado === 'activo')
    && Math.hypot(a.posicion.x - columna.posicionActual.x, a.posicion.y - columna.posicionActual.y) <= radioDePuerta());
}

export function tabernasDisponibles(p: ProyeccionJugador): TabernaDisponible[] {
  const lista: TabernaDisponible[] = [];
  const cupos = p.tarifasIntel.cupoMiradas;
  // La de la plaza donde estás o, con tu columna a su puerta, la de una plaza de tu Facción en la que compras (0.193.0: la puerta basta,
  // `resolver_compra` del motor; compra el Rey, el Embajador o el Gobernador, como dentro).
  const plaza = p.asentamientos[0] ?? plazaPropiaALaPuerta(p);
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
        ? p.campamentosMercenarios.find((c) => Math.hypot(c.posicion.x - columna.posicionActual.x, c.posicion.y - columna.posicionActual.y) <= radioDePuerta())
        : undefined;
  if (campamento && p.faccionId !== null) {
    // En el campamento paga el héroe: el residente con el oro de su almacén, el visitante con el de su carro.
    const oro = campamento.residentesIds.includes(p.heroeId) ? p.heroe.almacenPersonal?.oro ?? 0 : columna?.suministro?.oro ?? 0;
    lista.push({ origen: { tipo: 'campamento', id: campamento.id }, etiqueta: `Taberna del campamento ${campamento.id}`, posicion: campamento.posicion, oro, cupo: cupos.campamento });
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

export function hace(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min < 90 ? `${min} min` : min < 60 * 36 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`;
}

/** Tus Miradas en casillas: 👁 abierta (con la barra del tiempo que le queda) o ⏳ enfriándose (con la de lo que falta para repetirla). */
function listaMiradas(p: ProyeccionJugador): string {
  if (p.miradasIntel.length === 0) return '<p class="mapa-lista-vacia">Ninguna.</p>';
  return `<div class="intel-miradas">${p.miradasIntel
    .map((m: MiradaIntel) => {
      const abierta = m.expiraEn > p.instante;
      const [desde, hasta] = abierta ? [m.compradaEn, m.expiraEn] : [m.expiraEn, m.libreEn];
      const queda = hasta > desde ? Math.max(0, Math.min(1, (hasta - p.instante) / (hasta - desde))) : 0;
      const texto = abierta ? `${hace(m.expiraEn - p.instante)} restantes` : `repetible en ${hace(m.libreEn - p.instante)}`;
      return `<button class="intel-mirada${abierta ? ' abierta' : ''}" type="button" data-centrar-x="${m.centro.x}" data-centrar-y="${m.centro.y}" title="${abierta ? 'Abierta' : 'Enfriándose'} · (${Math.round(m.centro.x)}, ${Math.round(m.centro.y)}) · ${texto}">
        <span class="intel-mirada-icono" aria-hidden="true">${abierta ? '👁' : '⏳'}</span><span class="intel-mirada-cuerpo"><b>(${Math.round(m.centro.x)}, ${Math.round(m.centro.y)})</b><small>${texto}</small></span>
        <span class="obra-barra"><i style="width:${(queda * 100).toFixed(1)}%"></i></span></button>`;
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

/** El Informe abierto: cabecera con el nivel en escudo, la Facción y los héroes dentro; el plano; los edificios y la guarnición como iconos con su
 * cuenta, y cada recinto de muralla con una barra de lo levantado. */
export function detalleInforme(inf: InformePlaza, p: ProyeccionJugador, e: Escapar): string {
  const porTipo = new Map<string, number>();
  for (const ed of inf.edificios) porTipo.set(ed.tipo, (porTipo.get(ed.tipo) ?? 0) + 1);
  const tropas = new Map<string, number>();
  for (const g of inf.guarnicion) tropas.set(g.tropaId, (tropas.get(g.tropaId) ?? 0) + g.cantidad);
  const hombres = [...tropas.values()].reduce((t, n) => t + n, 0);
  const faccion = p.facciones.find((f) => f.id === inf.faccionId) ?? p.directorioFacciones?.find((f) => f.id === inf.faccionId);
  const nombreTropa = (t: string): string => tropasReclutables()?.find((x) => x.id === t)?.nombre ?? t.replace(/_/g, ' ');
  return `
    <section class="intel-informe">
      <div class="intel-informe-cab">${medallonNivel(inf.nivel)}<span><strong>${e(inf.nombre ?? inf.asentamientoId)}</strong><small>${e(faccion?.nombre ?? inf.faccionId)}</small></span>
        <span class="obra-chip" title="Foto de hace ${hace(p.instante - inf.conocidoEn)}: no se actualiza">📜 hace ${hace(p.instante - inf.conocidoEn)}</span>${ayuda('plaza:intel-foto', 'Es una foto: no se actualiza. Su almacén no viene en el informe.')}</div>
      <div class="intel-informe-chips"><span class="obra-chip" title="Héroes dentro">🧔 ${inf.heroesIds.length}</span><span class="obra-chip${hombres ? ' baja' : ''}" title="Hombres de guarnición">🛡️ ${hombres}</span><span class="obra-chip" title="Edificios">🏛️ ${inf.edificios.length}</span></div>
      ${planoDeInforme(inf)}
      <div class="obra-titulo"><span class="faction-kicker">Edificios</span></div>
      <div class="intel-iconos">${[...porTipo].map(([t, n]) => `<span class="intel-icono" title="${e(EDIFICIO_NOMBRE[t] ?? t)}: ${n}" style="--swatch:${EDIFICIO_COLOR[t] ?? '#888'}">${iconoEdificio(t, 24)}<b>${n}</b></span>`).join('')}</div>
      <div class="obra-titulo"><span class="faction-kicker">Guarnición</span></div>
      ${tropas.size > 0 ? `<div class="intel-iconos">${[...tropas].map(([t, n]) => `<span class="intel-icono tropa" title="${e(nombreTropa(t))}: ${n}">${iconoTropa(t, 24)}<b>${n}</b></span>`).join('')}</div>` : '<p class="mapa-lista-vacia">Sin guarnición.</p>'}
      <div class="obra-titulo"><span class="faction-kicker">Murallas</span></div>
      ${inf.recintos.length > 0 ? inf.recintos.map((r) => {
        const hechas = Math.max(0, Math.min(r.celdas.length, r.avance + 1));
        return `<div class="intel-recinto" title="Recinto de nivel ${r.nivel}: ${hechas} de ${r.celdas.length} celdas levantadas"><span aria-hidden="true">🧱</span><small>Nivel ${r.nivel}</small>
          <span class="obra-barra"><i style="width:${((hechas / Math.max(1, r.celdas.length)) * 100).toFixed(1)}%"></i></span><b>${hechas}/${r.celdas.length}</b><span class="obra-chip" title="Puertas">🚪 ${r.celdas.filter((c) => c.clase === 'puerta').length}</span></div>`;
      }).join('') : '<p class="mapa-lista-vacia">Sin recinto.</p>'}
    </section>`;
}

/**
 * El HTML del panel. La intel solo se compra desde dentro de una taberna (la de una plaza propia o la de un campamento de mercenarios):
 * el punto de una Mirada se elige de la lista de plazas conocidas o con coordenadas, no con un clic en el mapa. Con aire de juego (2026-11-02):
 * la taberna en una cabecera con su oro y sus Miradas en ojos, dos tarjetas de servicio (Mirada e Informe) con el precio en un chip, y lo comprado
 * en casillas.
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
  const oro = RECURSO_ICONO['oro'] ?? '🪙';
  const caro = (n: number | null): boolean => t !== undefined && n !== null && n > t.oro;
  // El informe de región (tanda 69): solo en la taberna de una plaza propia, y solo para quien lo puede comprar.
  const plaza = t?.origen.tipo === 'asentamiento' ? [...p.asentamientos, ...(p.plazasPropias ?? [])].find((a) => a.id === t.origen.id) : undefined;
  const region = plaza && t ? htmlServicioRegion(p, plaza, t.oro, e) : '';

  const compra = !t
    ? `<div class="intel-sin-taberna"><span aria-hidden="true">🍺</span><p>No tienes ninguna taberna a mano. ${ayuda('plaza:intel-taberna', 'La intel se compra en una <strong>taberna</strong>: la de una plaza tuya (nivel 2, la construye el Gobernador; entra en ella) o la de un campamento de mercenarios (dentro, o con tu columna a la puerta).')}</p></div>`
    : `
      <div class="intel-cab">
        <span class="intel-cab-icono">${iconoEdificio('taberna', 34)}</span>
        <span class="intel-cab-cuerpo">${tabernas.length > 1
          ? `<select class="form-input" id="intel-origen" aria-label="Taberna">${tabernas.map((x) => `<option value="${e(x.origen.id)}"${x === t ? ' selected' : ''}>${e(x.etiqueta)}</option>`).join('')}</select>`
          : `<strong>${e(t.etiqueta)}</strong>`}
          <span class="intel-cab-chips"><span class="obra-chip" title="El oro con el que se paga">${oro} ${Math.floor(t.oro)}</span>
          <span class="intel-ojos" title="Miradas abiertas: ${abiertas} de ${t.cupo}">${Array.from({ length: Math.max(t.cupo, abiertas) }, (_, i) => `<i class="${i < abiertas ? 'abierto' : ''}">👁</i>`).join('')}<small>${abiertas}/${t.cupo}</small></span></span>
        </span>
      </div>
      <div class="intel-servicios">
        <section class="intel-servicio">
          <div class="intel-servicio-cab"><span class="intel-servicio-icono" aria-hidden="true">👁</span><span><strong>Mirada</strong><small>radio ${m.radio} · ${m.duracionMinutos / 60} h</small></span>${ayuda('plaza:intel-mirada', `Un ojo de ${m.radio} de radio durante ${m.duracionMinutos / 60} h sobre cualquier punto: ves en vivo lo que verías con una columna ahí, sin interiores. Lo ven también tus aliados. Cuanto más lejos de lo que ya ves, más cuesta.`)}</div>
          <select class="form-input" id="intel-cerca" aria-label="Mirar alrededor de"><option value="">Mirar alrededor de…</option>${ajenas.map((a) => `<option value="${a.posicion.x},${a.posicion.y}">${e(a.nombre ?? a.id)}</option>`).join('')}${p.campamentosMercenarios.map((c) => `<option value="${c.posicion.x},${c.posicion.y}">Campamento ${e(c.id)}</option>`).join('')}</select>
          <div class="intel-coords"><span>📍</span><input class="form-input" id="intel-x" type="number" min="0" placeholder="x" aria-label="x" value="${centro ? Math.round(centro.x) : ''}" /><input class="form-input" id="intel-y" type="number" min="0" placeholder="y" aria-label="y" value="${centro ? Math.round(centro.y) : ''}" /></div>
          <button class="intel-comprar" type="button" id="intel-comprar-mirada"${centro && abiertas < t.cupo ? '' : ' disabled'}>${abiertas >= t.cupo ? 'Taberna al límite' : precio !== null ? `Comprar <span class="intel-precio${caro(precio) ? ' falta' : ''}">${oro} ${precio}</span>` : 'Elige un punto'}</button>
        </section>
        <section class="intel-servicio">
          <div class="intel-servicio-cab"><span class="intel-servicio-icono" aria-hidden="true">📜</span><span><strong>Informe de plaza</strong><small>${oro} ${p.tarifasIntel.informe.oroPorNivel} por nivel</small></span>${ayuda('plaza:intel-informe', 'La foto, con fecha, del layout y la defensa de una plaza ajena que conoces. Avisa, sin firma, a su Facción.')}</div>
          ${ajenas.length === 0
            ? '<p class="mapa-lista-vacia">No conoces ninguna plaza ajena: mira una zona o explora.</p>'
            : libres.length === 0
              ? '<p class="mapa-lista-vacia">Ya tienes un informe reciente de todas las plazas que conoces.</p>'
              : `<select class="form-input" id="intel-plaza" aria-label="Plaza">${libres.map((a) => `<option value="${e(a.id)}">${e(a.nombre ?? a.id)} · nivel ${a.nivel} · ${p.tarifasIntel.informe.oroPorNivel * a.nivel} oro</option>`).join('')}</select>
            <button class="intel-comprar" type="button" id="intel-comprar-informe">Comprar informe</button>`}
        </section>
        ${region}
      </div>`;

  const informes = p.informesPlaza;
  const abierto = informes.find((i) => i.asentamientoId === estadoIntel.informeAbierto);
  return `
    <div class="intel-panel" data-origen="${t ? e(t.origen.id) : ''}">
      <div class="cols-completa"><div class="col-completa">${compra}</div><div class="col-completa">
      <div class="obra-titulo"><span class="faction-kicker">Tus Miradas</span><span class="obra-chip">${p.miradasIntel.length}</span></div>${listaMiradas(p)}
      <div class="obra-titulo"><span class="faction-kicker">Tus Informes</span><span class="obra-chip">${informes.length}</span></div>
      ${informes.length === 0 ? '<p class="mapa-lista-vacia">Ninguno.</p>' : `<div class="intel-informes">${informes.map((i) => `<button class="intel-informe-btn${i === abierto ? ' abierto' : ''}" type="button" data-informe="${e(i.asentamientoId)}" title="${e(`${i.nombre ?? i.asentamientoId} · nivel ${i.nivel} · hace ${hace(p.instante - i.conocidoEn)}`)}">${medallonNivel(i.nivel)}<span><b>${e(i.nombre ?? i.asentamientoId)}</b><small>hace ${hace(p.instante - i.conocidoEn)}</small></span></button>`).join('')}</div>`}
      ${abierto ? detalleInforme(abierto, p, e) : ''}
      ${htmlInformesRegion(p, e)}</div></div>
    </div>`;
}

/** Cablea el panel tras pintarlo. `repintar` vuelve a pintarlo (cambió el punto o el Informe abierto). */
export function cablearPanelIntel(root: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar, repintar: () => void): void {
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
      if (mensaje) mostrarAviso(mensaje, true);
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
  const origen = origenDe();
  const plaza = origen?.tipo === 'asentamiento' ? p.asentamientos.find((a) => a.id === origen.id) : undefined;
  if (plaza) cablearServicioRegion(root, plaza, ejecutar);
  root.querySelectorAll<HTMLButtonElement>('[data-informe]').forEach((boton) =>
    boton.addEventListener('click', () => {
      estadoIntel.informeAbierto = estadoIntel.informeAbierto === boton.dataset.informe ? null : boton.dataset.informe!;
      repintar();
    })
  );
}
