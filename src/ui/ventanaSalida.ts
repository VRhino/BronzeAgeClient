// VENTANA «SALIR AL MUNDO»: una sola para todos los sitios de los que se sale (decisión de Víctor, 2026-10-29). Va centrada como el diario de misiones,
// con lo que se elige repartido: a la izquierda cómo sales (columna personal o ejército), a la derecha la carga del carro y, abajo, la tropa en espacios
// con un «+» para añadir escuadras.
//   residencia   tu plaza: `salirAlMundo`, tropa de tu campamento (sin la de guarnición) y carga del almacén de la plaza
//   campamento   el de mercenarios: `salirDelCampamento`; si resides, tropa y carga de tu almacén personal; si no, sales con tu columna
//   plazaAjena   `salirDeAsentamiento`: retomas la columna aparcada tal cual
//   pueblo       `salirDePueblo`: vuelves a la puerta con la columna con la que entraste
// Donde se elige tropa, sale cargado el loadout activo (o todo, si ese loadout no tiene escuadras); se puede cambiar de loadout, quitar y añadir escuadras y,
// con «Guardar loadout», dejar el cambio en el loadout elegido. Sin guardarlo vale solo para esta salida. De visita no hay nada que elegir: los espacios
// enseñan lo que lleva la columna. Con un ejército en preparación se reparte igual: integrantes a la izquierda, tu carro a la derecha y tu tropa abajo.
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, CampamentoMercenarios, Escuadron, PuebloDeMapa } from '../tiposDominio';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';
import { chipLiderazgo } from './liderazgo';
import { iconoTropa } from './iconosTropa';
import { miColumna } from './ejercitos';
import { pintar } from './repintado';
import { cablearCargaDeSalida, htmlCargaDeSalida, leerCarga } from './cargaDeSalida';
import { cablearPreparacion, htmlPreparacion } from './convocatoria';
import { actualizarConvocatorias, cablearSalidaComoEjercito, htmlSalidaComoEjercito } from './salidaComoEjercito';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

export type LugarDeSalida =
  | { tipo: 'residencia'; asentamiento: Asentamiento }
  | { tipo: 'plazaAjena'; asentamiento: Asentamiento }
  | { tipo: 'campamento'; campamento: CampamentoMercenarios }
  | { tipo: 'pueblo'; pueblo: PuebloDeMapa };

/** Espacios de tropa a la vista; crecen si el Liderazgo da para más. */
const ESPACIOS = 5;

/** Lo elegido, fuera del HTML para que el sondeo no se lo lleve. `clave` es el sitio: al cambiar de sitio se empieza de nuevo. */
let eleccion: { clave: string; ids: string[]; loadoutId: string | null; eligiendo: boolean } | null = null;

const claveDe = (l: LugarDeSalida): string =>
  `${l.tipo}:${l.tipo === 'campamento' ? l.campamento.id : l.tipo === 'pueblo' ? l.pueblo.id : l.asentamiento.id}`;
const nombreDe = (l: LugarDeSalida): string =>
  l.tipo === 'campamento' ? `campamento ${l.campamento.id}` : l.tipo === 'pueblo' ? 'el pueblo' : l.asentamiento.nombre ?? l.asentamiento.id;
const resideEnCampamento = (p: ProyeccionJugador, l: LugarDeSalida): boolean => l.tipo === 'campamento' && l.campamento.residentesIds.includes(p.heroeId);
/** Donde se elige la tropa (tu residencia o tu campamento); en el resto se sale con la columna tal cual. */
const seElige = (p: ProyeccionJugador, l: LugarDeSalida): boolean => l.tipo === 'residencia' || resideEnCampamento(p, l);
/** Solo se convoca un ejército desde una plaza o un campamento. */
const admiteEjercito = (l: LugarDeSalida): boolean => l.tipo === 'residencia' || l.tipo === 'campamento';

/** Las escuadras que puedes sacar (donde se elige) o las que lleva tu columna (de visita). */
function tropaDe(p: ProyeccionJugador, l: LugarDeSalida): Escuadron[] {
  const h = p.heroe;
  if (l.tipo === 'residencia') return h.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0);
  if (resideEnCampamento(p, l)) return h.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && s.cantidad > 0);
  const columna = miColumna(p);
  return h.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && (!columna || s.contenedor.ejercitoId === columna.id));
}

/** Las escuadras de un loadout que están aquí; si el loadout no tiene ninguna, todas. */
function idsDelLoadout(p: ProyeccionJugador, loadoutId: string | null, disponibles: Escuadron[]): string[] {
  const l = p.heroe.loadouts.find((x) => x.id === loadoutId);
  if (!l || l.squadIds.length === 0) return disponibles.map((s) => s.id);
  return disponibles.filter((s) => l.squadIds.includes(s.id)).map((s) => s.id);
}

function prepararEleccion(p: ProyeccionJugador, l: LugarDeSalida): NonNullable<typeof eleccion> {
  const clave = claveDe(l);
  const disponibles = tropaDe(p, l);
  if (eleccion?.clave !== clave) {
    const activo = p.heroe.loadouts.find((x) => x.activo)?.id ?? p.heroe.loadouts[0]?.id ?? null;
    eleccion = { clave, ids: idsDelLoadout(p, activo, disponibles), loadoutId: activo, eligiendo: false };
  }
  // Lo que ya no está (se fue a la guarnición, se perdió) sale de la elección.
  eleccion.ids = eleccion.ids.filter((id) => disponibles.some((s) => s.id === id));
  return eleccion;
}

/** Se llama al abrir la ventana: vuelve a cargar el loadout activo. */
export function reiniciarVentanaSalida(): void {
  eleccion = null;
}

const liderazgoDe = (lista: Escuadron[]): number => lista.reduce((t, s) => t + s.costeLiderazgo, 0);

/** El Liderazgo de la tropa elegida, si pasa del tope del héroe (si no, `null`). Pasado el tope no se sale, ni se convoca, ni se une, ni se guarda el loadout. */
function excesoDeLiderazgo(p: ProyeccionJugador, l: LugarDeSalida): number | null {
  if (!seElige(p, l)) return null;
  const disponibles = tropaDe(p, l);
  const usado = liderazgoDe(prepararEleccion(p, l).ids.flatMap((id) => disponibles.filter((s) => s.id === id)));
  return usado > p.heroe.liderazgoBase ? usado : null;
}
const avisoExceso = (usado: number, tope: number): string => `Te pasas de Liderazgo (${usado} / ${tope}): quita escuadras para poder salir.`;

function htmlHueco(s: Escuadron, quitar: boolean, e: Escapar): string {
  return `<div class="salida-hueco lleno" title="${e(`${s.nombre} · ${s.cantidad} hombres · nivel ${s.nivel}`)}">
    <span class="salida-hueco-icono">${iconoTropa(s.tropaId, 34)}</span>
    <span class="salida-hueco-nombre">${e(s.nombre)}</span>
    <small>${s.cantidad} hombres ${chipLiderazgo(s)}</small>
    ${quitar ? `<button class="salida-hueco-quitar" type="button" data-salida-quitar="${e(s.id)}" title="Quitar de esta salida" aria-label="Quitar ${e(s.nombre)}">✕</button>` : ''}
  </div>`;
}

/** Los espacios de tropa, el «+» y la lista para elegir qué añadir. */
function htmlTropa(p: ProyeccionJugador, l: LugarDeSalida, e: Escapar): string {
  const h = p.heroe;
  const disponibles = tropaDe(p, l);
  const editable = seElige(p, l);
  const sel = editable ? prepararEleccion(p, l) : null;
  const elegidas = sel ? sel.ids.map((id) => disponibles.find((s) => s.id === id)!).filter(Boolean) : disponibles;
  const usado = liderazgoDe(elegidas);
  const libre = h.liderazgoBase - usado;
  const candidatas = editable ? disponibles.filter((s) => !sel!.ids.includes(s.id)) : [];
  const caben = candidatas.filter((s) => s.costeLiderazgo <= libre);
  const espacios = Math.max(ESPACIOS, elegidas.length + (caben.length > 0 ? 1 : 0));
  const huecos = Array.from({ length: espacios }, (_, i) => {
    const s = elegidas[i];
    if (s) return htmlHueco(s, editable, e);
    if (editable && i === elegidas.length && candidatas.length > 0) {
      return `<button class="salida-hueco mas${sel!.eligiendo ? ' activo' : ''}" type="button" data-salida-mas title="Añadir una escuadra" aria-label="Añadir una escuadra">+</button>`;
    }
    return '<div class="salida-hueco vacio"></div>';
  }).join('');
  const lista = editable && sel!.eligiendo && candidatas.length > 0
    ? `<div class="salida-elegir">${candidatas.map((s) => {
      const cabe = s.costeLiderazgo <= libre;
      return `<button class="salida-candidata" type="button" data-salida-anadir="${e(s.id)}"${cabe ? '' : ` disabled title="No cabe: te quedan ${Math.max(0, libre)} de Liderazgo"`}>${iconoTropa(s.tropaId, 26)}<span><strong>${e(s.nombre)}</strong><small>${s.cantidad} hombres · ${s.costeLiderazgo} de Liderazgo</small></span></button>`;
    }).join('')}</div>`
    : '';
  const loadouts = editable && h.loadouts.length > 0
    ? `<label class="salida-loadout">Loadout <select class="form-input" data-salida-loadout>${h.loadouts.map((x) => `<option value="${e(x.id)}"${x.id === sel!.loadoutId ? ' selected' : ''}>${e(x.displayName)}${x.activo ? ' (activo)' : ''}</option>`).join('')}</select></label>
      <button class="btn-secondary salida-guardar" type="button" data-salida-guardar${libre < 0 ? ' disabled title="Te pasas de Liderazgo"' : cambiado(p, l) ? '' : ' disabled title="La tropa elegida ya es la del loadout"'}>Guardar loadout</button>`
    : '';
  const nota = editable
    ? (disponibles.length === 0 ? `<p class="asent-lado-nota">${l.tipo === 'residencia' ? 'No tienes tropa libre en la plaza (la de guarnición no sale). Puedes salir solo.' : 'No tienes tropa en el campamento. Puedes salir solo.'}</p>` : '')
    : `<p class="asent-lado-nota">${elegidas.length ? 'Sales con la columna con la que entraste, tal cual.' : 'Tu columna no lleva escuadras.'}</p>`;
  return `<div class="salida-tropa-cab">
      <strong class="heroe-sub">Tropa${ayuda('salida:tropa', editable ? 'Sale cargado tu loadout activo. Quita escuadras con ✕ o añade con «+»: vale solo para esta salida, salvo que pulses «Guardar loadout», que lo guarda en el loadout elegido.' : 'De visita sales con la columna con la que entraste: no se cambia nada.')}</strong>
      <span class="salida-liderazgo${libre < 0 ? ' excedido' : ''}">Liderazgo ${usado} / ${h.liderazgoBase}</span>
      ${loadouts}
    </div>
    <div class="salida-huecos">${huecos}</div>
    ${lista}${nota}${editable && libre < 0 ? `<p class="faction-error">${e(avisoExceso(usado, h.liderazgoBase))}</p>` : ''}`;
}

/** Si la tropa elegida no es la del loadout elegido (las escuadras de ese loadout que están aquí). */
function cambiado(p: ProyeccionJugador, l: LugarDeSalida): boolean {
  if (!eleccion) return false;
  const loadout = p.heroe.loadouts.find((x) => x.id === eleccion!.loadoutId);
  if (!loadout) return false;
  const aqui = new Set(tropaDe(p, l).map((s) => s.id));
  const delLoadout = loadout.squadIds.filter((id) => aqui.has(id)).sort();
  const ahora = [...eleccion.ids].sort();
  return delLoadout.length !== ahora.length || delLoadout.some((id, i) => id !== ahora[i]);
}

/** El carro: lo que cargas (donde se elige) o lo que lleva la columna (de visita). */
function htmlCarga(p: ProyeccionJugador, l: LugarDeSalida, valores: Record<string, number>, e: Escapar): string {
  if (l.tipo === 'residencia') {
    const almacen = Object.fromEntries(Object.entries(l.asentamiento.almacen ?? {}).map(([r, v]) => [r, v.cantidad]));
    return htmlCargaDeSalida(almacen, 'el almacén de la plaza', e, p.heroe.carro, valores);
  }
  if (resideEnCampamento(p, l)) return htmlCargaDeSalida(p.heroe.almacenPersonal ?? {}, 'tu almacén personal', e, p.heroe.carro, valores);
  const columna = miColumna(p);
  const carga = Object.entries(columna?.suministro ?? {}).filter(([, n]) => n >= 1);
  const total = Math.floor(carga.reduce((t, [, n]) => t + n, 0));
  return `<strong class="heroe-sub">Carro de tu columna${columna?.capacidadCarga ? ` <span>${total} / ${Math.floor(columna.capacidadCarga)}</span>` : ''}</strong>
    ${carga.length ? carga.map(([r, n]) => `<div class="carro-fila"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><strong>${Math.floor(n)}</strong></div>`).join('') : '<p class="asent-lado-nota">Vacío.</p>'}`;
}

function htmlModo(p: ProyeccionJugador, l: LugarDeSalida, e: Escapar): string {
  const viveres = Math.floor(p.heroe.viveres ?? 0);
  const donde = l.tipo === 'pueblo'
    ? 'Vuelves a la puerta del pueblo con todo lo que trajiste; tu guarnición se queda.'
    : l.tipo === 'plazaAjena' ? 'No resides aquí: retomas tu columna, aparcada a la puerta, con su tropa y su carro.'
    : l.tipo === 'campamento' && !resideEnCampamento(p, l) ? 'No resides aquí: sales con la columna con la que entraste.'
    : 'Sales al mapa por la puerta. Tus víveres van siempre contigo.';
  return `<p class="diario-texto">${e(donde)}</p>
    <p class="asent-lado-nota">Víveres: ${viveres} de trigo.</p>
    ${admiteEjercito(l) ? htmlSalidaComoEjercito(p, e) : ''}`;
}

/** El botón principal según el sitio. */
const textoSalir = (l: LugarDeSalida): string => (l.tipo === 'pueblo' ? 'Salir al mapa' : l.tipo === 'plazaAjena' ? 'Salir y retomar mi columna' : 'Salir');

/**
 * Pinta la ventana en `raiz` (el contenedor `.salida-ventana`). `cerrar` la quita; `repintar` la vuelve a pintar con la proyección de ese momento.
 */
export function pintarVentanaSalida(raiz: HTMLElement, p: ProyeccionJugador, l: LugarDeSalida, ejecutar: Ejecutar, cerrar: () => void, repintar: () => void, e: Escapar): void {
  const avisar = (mensaje: string): void => { const error = raiz.querySelector<HTMLElement>('[data-salida-error]'); if (error) error.textContent = mensaje; };
  const cabecera = `<header class="diario-cab"><span class="diario-cab-titulo">Salir de ${e(nombreDe(l))}</span><button class="diario-cerrar" type="button" data-salida-cerrar aria-label="Cerrar">✕</button></header>`;
  const preparacion = admiteEjercito(l) ? htmlPreparacion(p, e) : null;
  if (preparacion) {
    // Ejército en preparación: el mismo reparto, con los integrantes a la izquierda, tu carro a la derecha y tu tropa abajo.
    pintar(raiz, `<div class="diario salida">${cabecera}
      <div class="salida-cuerpo"><section class="salida-col">${preparacion.izquierda}</section><section class="salida-col">${preparacion.derecha}</section></div>
      <footer class="salida-pie">${preparacion.pie}</footer></div>`, () => {
      raiz.querySelector('[data-salida-cerrar]')?.addEventListener('click', cerrar);
      cablearPreparacion(raiz, p, ejecutar, avisar, repintar);
    }, `salida-prep:${claveDe(l)}`);
    return;
  }
  const valores = raiz.querySelector('input[data-carga]') ? leerCarga(raiz) : {};
  const html = `<div class="diario salida">${cabecera}
    <div class="salida-cuerpo">
      <section class="salida-col">${htmlModo(p, l, e)}</section>
      <section class="salida-col">${htmlCarga(p, l, valores, e)}</section>
    </div>
    <footer class="salida-pie">
      ${htmlTropa(p, l, e)}
      <div class="salida-acciones"><p class="faction-error" data-salida-error role="alert"></p><button class="btn-primary" type="button" data-salida-ir${excesoDeLiderazgo(p, l) !== null ? ' disabled' : ''}>${textoSalir(l)}</button></div>
    </footer>
  </div>`;
  const elegidas = (): string[] => (seElige(p, l) ? prepararEleccion(p, l).ids : []);
  const leerSeleccion = () => ({ escuadronIds: elegidas(), carga: seElige(p, l) ? leerCarga(raiz) : {} });
  const bloqueo = (): string | null => { const usado = excesoDeLiderazgo(p, l); return usado === null ? null : avisoExceso(usado, p.heroe.liderazgoBase); };
  pintar(raiz, html, () => {
    raiz.querySelector('[data-salida-cerrar]')?.addEventListener('click', cerrar);
    if (seElige(p, l)) cablearCargaDeSalida(raiz);
    const sel = seElige(p, l) ? prepararEleccion(p, l) : null;
    raiz.querySelector('[data-salida-mas]')?.addEventListener('click', () => { if (sel) { sel.eligiendo = !sel.eligiendo; repintar(); } });
    raiz.querySelectorAll<HTMLButtonElement>('[data-salida-anadir]').forEach((b) => b.addEventListener('click', () => {
      if (!sel) return;
      sel.ids = [...sel.ids, b.dataset.salidaAnadir!];
      sel.eligiendo = tropaDe(p, l).some((s) => !sel.ids.includes(s.id));
      repintar();
    }));
    raiz.querySelectorAll<HTMLButtonElement>('[data-salida-quitar]').forEach((b) => b.addEventListener('click', () => {
      if (!sel) return;
      sel.ids = sel.ids.filter((id) => id !== b.dataset.salidaQuitar);
      repintar();
    }));
    raiz.querySelector<HTMLSelectElement>('[data-salida-loadout]')?.addEventListener('change', (ev) => {
      if (!sel) return;
      sel.loadoutId = (ev.target as HTMLSelectElement).value;
      sel.ids = idsDelLoadout(p, sel.loadoutId, tropaDe(p, l));
      sel.eligiendo = false;
      repintar();
    });
    raiz.querySelector<HTMLButtonElement>('[data-salida-guardar]')?.addEventListener('click', async (ev) => {
      const boton = ev.currentTarget as HTMLButtonElement;
      const loadout = p.heroe.loadouts.find((x) => x.id === sel?.loadoutId);
      if (!sel || !loadout) return;
      const motivo = bloqueo();
      if (motivo) { avisar(motivo); return; }
      // Las escuadras del loadout que no están aquí (en guarnición, escoltando…) se quedan en él.
      const aqui = new Set(tropaDe(p, l).map((s) => s.id));
      const squadIds = [...loadout.squadIds.filter((id) => !aqui.has(id)), ...sel.ids];
      boton.disabled = true;
      const mensaje = await ejecutar('guardarLoadout', { loadoutId: loadout.id, displayName: loadout.displayName, squadIds, perksSeleccionados: loadout.perksSeleccionados });
      if (mensaje) { boton.disabled = false; avisar(mensaje); }
    });
    const ir = raiz.querySelector<HTMLButtonElement>('[data-salida-ir]');
    ir?.addEventListener('click', async () => {
      if (!ir) return;
      const motivo = bloqueo();
      if (motivo) { avisar(motivo); return; }
      const { escuadronIds, carga } = leerSeleccion();
      const [tipo, params]: [string, object] =
        l.tipo === 'residencia' ? ['salirAlMundo', { asentamientoId: l.asentamiento.id, heroeId: p.heroeId, escuadronIds, carga }]
        : l.tipo === 'campamento' ? ['salirDelCampamento', { campamentoId: l.campamento.id, heroeId: p.heroeId, escuadronIds, carga }]
        : l.tipo === 'plazaAjena' ? ['salirDeAsentamiento', { asentamientoId: l.asentamiento.id, heroeId: p.heroeId }]
        : ['salirDePueblo', { heroeId: p.heroeId, puebloId: l.pueblo.id }];
      ir.disabled = true;
      const mensaje = await ejecutar(tipo, params);
      if (mensaje) { ir.disabled = false; avisar(mensaje); return; }
      eleccion = null;
      cerrar(); // el router lleva al mapa
    });
    if (admiteEjercito(l)) cablearSalidaComoEjercito(raiz, p, ir, textoSalir(l), leerSeleccion, ejecutar, avisar, bloqueo);
  }, `salida:${claveDe(l)}`);
  if (admiteEjercito(l)) actualizarConvocatorias(raiz, p, leerSeleccion, ejecutar, avisar, e, bloqueo);
}
