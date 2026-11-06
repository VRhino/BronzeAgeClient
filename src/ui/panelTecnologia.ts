// Panel de TECNOLOGÍA Y AEDAS (backend Doc 6). Se abre desde la barra del jugador. Comandos:
//   adoptarTecnologia     { faccionId, tecnologiaId }                  el Rey, estando en la capital; la paga el almacén de la capital
//   comprarTecnologiaAeda { asentamientoId, tecnologiaId }             el Rey o el Gobernador de la plaza, presente, a un Aeda itinerante detenido en ella
//   empezarEpica          { asentamientoId, aedaId, tecnologiaId }     el Rey, el Gobernador o el Sacerdote de la plaza, presente
//   abandonarEpica        { asentamientoId, aedaId }                   ídem; se pierde lo avanzado
// Nombres, Eras, tarifas, venta de Aedas, épicas y enfriamiento salen del balance (`catalogoDeTecnologia`); mientras no llegue, se muestra el id legible.
// Desde la 0.158.0 (Víctor, 2026-11-06) la pestaña Tecnología de Facción es el árbol de tecnologías (`arbolTecnologias.ts`): arriba el árbol, y al
// hacer clic en una carta su ficha con las acciones que puede usar quien mira (Adoptar, Comprar a un Aeda, Empezar épica); abajo, los logros del
// mundo y los Aedas residentes e itinerantes de tus plazas, como antes.
import { catalogoDeTecnologia, type ProyeccionJugador } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';
import { htmlArbol, montarArbol, textoContador } from './arbolTecnologias';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** `leva_comunal` → «Leva comunal». Solo para cuando el balance aún no ha llegado. */
const legible = (id: string): string => { const t = id.replace(/[._]/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const cifra = (n: number): string => n.toLocaleString('es');

export function htmlTecnologia(p: ProyeccionJugador, e: Escapar, conCabecera = true): string {
  const t = p.tecnologia;
  // en la pestaña de la Facción, sin cabecera: ya está la de la ventana
  const cabecera = conCabecera ? `<div class="mapa-panel-jugador">${e(p.heroe.displayName)} · tecnología y Aedas</div>` : '';
  if (!t) return `${cabecera}<p class="asent-lado-nota">Este servidor no envía el estado de la tecnología.</p>`;
  // El panel se repinta con el sondeo, así que no hace falta avisar cuando llegue el balance.
  const cat = catalogoDeTecnologia(() => {});
  const nombreTec = (id: string): string => cat?.TECNOLOGIAS[id]?.nombre ?? legible(id);
  const nombreEra = (id: string): string => cat?.ERAS[id]?.nombre ?? legible(id);
  const eraDeTec = (id: string): string | undefined => t.eraDe?.[id] ?? cat?.TECNOLOGIAS[id]?.era;
  /** Lo que cobraría un Aeda itinerante por la tecnología (el doble del oro de la tarifa de su Era), o `null` si no las vende (Era demasiado alta) o no se sabe. */
  const precioAeda = (id: string): number | null => {
    const era = eraDeTec(id);
    if (!cat || !era || (cat.ERAS[era]?.orden ?? 99) > cat.AEDAS.venta.ordenEraMaximo) return null;
    return (cat.TARIFA_ADOPCION[era]?.['oro'] ?? 0) * cat.AEDAS.venta.factorOro;
  };
  const enfriamientoMs = cat ? cat.AEDAS.epica.enfriamientoMinutos * 60_000 : null;
  const faccion = p.facciones.find((f) => f.id === p.faccionId);
  const soyRey = faccion?.reyId === p.heroeId;
  const propias = t.propias;
  const adoptadas = propias?.adoptadas ?? [];
  const adoptables = (propias?.aparecidas ?? []).filter((id) => !adoptadas.includes(id));
  // Tus plazas: la que pisas, con todo, y las demás de tu Facción por su ficha (para nombrarlas y saber dónde hay que estar).
  const plazas: Asentamiento[] = [...p.asentamientos, ...(p.asentamientosAvistados as Asentamiento[]).filter((a) => a.faccionId === p.faccionId && !p.asentamientos.some((x) => x.id === a.id))];
  const ubic = p.heroe.ubicacion;
  const dondeEstoy = ubic.tipo === 'asentamiento' ? ubic.asentamientoId : null;
  const nombrePlaza = (a: Asentamiento): string => a.nombre ?? a.id;
  /** Por qué no puedo dirigir a los Aedas de una plaza (Rey, Gobernador o Sacerdote, presente), o `null` si puedo. `compra`: solo Rey o Gobernador. */
  const motivoPlaza = (a: Asentamiento, compra: boolean): string | null => {
    const cargo = soyRey || a.cargos?.gobernadorId === p.heroeId || (!compra && a.cargos?.sacerdoteId === p.heroeId);
    if (!cargo) return compra ? 'Solo el Rey o el Gobernador de la plaza.' : 'Solo el Rey, el Gobernador o el Sacerdote de la plaza.';
    return dondeEstoy === a.id ? null : `Tienes que estar en ${nombrePlaza(a)}.`;
  };
  const reveladas = t.reveladas;

  const logros = t.logros.length === 0
    ? '<p class="asent-lado-nota">Aún no se ha cumplido ningún logro del mundo.</p>'
    : `<ul class="tec-lista">${t.logros.map((l) => `<li>${cifra(l.umbral)} ${e(textoContador(l.contador))}</li>`).join('')}</ul>`;

  const capital = plazas.find((a) => a.id === t.capitalId);
  const motivoAdoptar = !propias ? 'Necesitas una Facción.' : !soyRey ? 'Solo la adopta el Rey de la Facción, estando en la capital.'
    : !t.capitalId ? 'Tu Facción aún no tiene capital.' : dondeEstoy !== t.capitalId ? `Tienes que estar en la capital${capital ? `, ${nombrePlaza(capital)}` : ''}.` : null;
  const residentes = p.aedasResidentes ?? [];
  const posibles = t.epicasPosibles ?? [];
  const filaResidente = (a: NonNullable<typeof p.aedasResidentes>[number]): string => {
    const plaza = plazas.find((x) => x.id === a.asentamientoId);
    const motivo = plaza ? motivoPlaza(plaza, false) : 'La plaza ya no es tuya.';
    const nombre = `<strong>${e(a.nombre)}</strong> <small>en ${e(plaza ? nombrePlaza(plaza) : a.asentamientoId)}</small>`;
    const ep = a.epica;
    if (ep) {
      const sinEnfriar = ep.ultimoHechoEn !== undefined && enfriamientoMs !== null ? enfriamientoMs - (p.instante - ep.ultimoHechoEn) : 0;
      const hecho = cat?.EPICAS[ep.tecnologiaId]?.capitulos[ep.capitulo]?.hecho;
      const titulo = (hecho && cat?.TITULO_CAPITULO[hecho]) || ep.tituloCapitulo;
      return `<li class="tec-fila"><span>${nombre}<br>${e(cat?.EPICAS[ep.tecnologiaId]?.nombre ?? ep.nombre)} <small>(${e(nombreTec(ep.tecnologiaId))})</small>
        <br><small>Capítulo ${ep.capitulo + 1} de ${ep.capitulos}: ${e(titulo)} · ${ep.hechos} / ${ep.hechosNecesarios} hechos${sinEnfriar > 0 ? ` · otro hecho cuenta en ${e(textoEnTiempoReal(sinEnfriar))}` : ep.ultimoHechoEn === undefined ? '' : ' · ya puede contar otro hecho'}</small></span>
        <button class="btn-secondary" type="button" data-tec-abandonar="${e(a.id)}" data-plaza="${e(a.asentamientoId)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Abandonar</button></li>`;
    }
    const opciones = posibles.map((id) => `<option value="${e(id)}">${e(cat?.EPICAS[id]?.nombre ? `${cat.EPICAS[id]!.nombre} (${nombreTec(id)})` : nombreTec(id))}</option>`).join('');
    return `<li class="tec-fila"><span>${nombre}<br><small>Sin épica en curso.${posibles.length === 0 ? ' Ninguna tecnología tiene ahora una épica posible.' : ''}</small></span>
      ${posibles.length === 0 ? '' : `<select class="form-input" data-tec-epica-de="${e(a.id)}" aria-label="Tecnología de la épica">${opciones}</select>
      <button class="btn-primary" type="button" data-tec-empezar="${e(a.id)}" data-plaza="${e(a.asentamientoId)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Empezar épica</button>`}</li>`;
  };

  // Aedas itinerantes detenidos en una plaza mía: se les compra una tecnología revelada (la conocen, por eso se reveló).
  const detenidos = (p.aedasAvistados ?? []).filter((a) => a.enAsentamientoId && plazas.some((x) => x.id === a.enAsentamientoId));
  const filaItinerante = (id: string): string => {
    const plaza = plazas.find((x) => x.id === id)!;
    const motivo = motivoPlaza(plaza, true);
    const oro = Math.floor(plaza.almacen?.['oro']?.cantidad ?? 0);
    const venta = reveladas.filter((r) => precioAeda(r.tecnologiaId) !== null);
    return `<li class="tec-fila"><span><strong>Aeda itinerante</strong> <small>detenido en ${e(nombrePlaza(plaza))} · almacén: ${oro} de oro</small></span>
      ${venta.length === 0 ? '<small>No tienes tecnologías reveladas que comprar.</small>' : `<select class="form-input" data-tec-compra-en="${e(id)}" aria-label="Tecnología a comprar">${venta.map((r) => `<option value="${e(r.tecnologiaId)}">${e(`${nombreTec(r.tecnologiaId)} · ${cifra(precioAeda(r.tecnologiaId)!)} de oro`)}</option>`).join('')}</select>
      <button class="btn-primary" type="button" data-tec-comprar="${e(id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Comprar</button>`}</li>`;
  };
  const itinerantes = [...new Set(detenidos.map((a) => a.enAsentamientoId!))];
  const enfriamientoTexto = enfriamientoMs !== null ? `uno cada ${e(textoEnTiempoReal(enfriamientoMs))} de mundo como mucho` : 'con un enfriamiento entre uno y otro';
  const ventaTexto = cat ? `un Aeda cobra ${cat.AEDAS.venta.factorOro} veces el oro de la tarifa de la Era (hasta la Era ${cat.AEDAS.venta.ordenEraMaximo}), del almacén de la plaza` : 'cobra oro del almacén de la plaza';

  // La ficha de una carta del árbol: lo que quien mira puede hacer con esa tecnología ahora. Lo que no puede hacer no sale; lo que no puede pagar,
  // en rojo y sin pulsar.
  const fichaAcciones = (id: string): string => {
    const partes: string[] = [];
    const chips = (coste: Record<string, number>, almacen: Asentamiento['almacen'] | undefined): string => Object.entries(coste)
      .map(([r, n]) => `<span class="ta-rec${(almacen?.[r]?.cantidad ?? 0) < n ? ' falta' : ''}"><i aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</i><b>${cifra(n)}</b><span class="ta-sr">${e(RECURSO_NOMBRE[r] ?? r)}</span></span>`).join(' ');
    const falta = (coste: Record<string, number>, almacen: Asentamiento['almacen'] | undefined): boolean => Object.entries(coste).some(([r, n]) => (almacen?.[r]?.cantidad ?? 0) < n);
    if (adoptables.includes(id) && soyRey) {
      const era = eraDeTec(id);
      const tarifa = era ? cat?.TARIFA_ADOPCION[era] : undefined;
      if (motivoAdoptar) partes.push(`<p class="ta-ficha-nota">Para adoptarla: ${e(motivoAdoptar.replace(/^Tienes/, 'tienes'))}</p>`);
      else if (tarifa) {
        const alm = p.asentamientos.find((a) => a.id === t.capitalId)?.almacen;
        const sinPagar = falta(tarifa, alm);
        partes.push(`<button class="btn-primary ta-ficha-boton" type="button" data-ficha-adoptar="${e(id)}" data-faccion="${e(p.faccionId ?? '')}"${sinPagar ? ' disabled title="El almacén de la capital no tiene bastante"' : ''}>Adoptar ${chips(tarifa, alm)}</button>`);
      }
    }
    const precio = precioAeda(id);
    if (precio !== null && reveladas.some((r) => r.tecnologiaId === id)) {
      for (const plazaId of itinerantes) {
        const plaza = plazas.find((x) => x.id === plazaId)!;
        if (motivoPlaza(plaza, true)) continue;
        const coste = { oro: precio };
        partes.push(`<button class="btn-primary ta-ficha-boton" type="button" data-ficha-comprar="${e(plazaId)}" data-tec-id="${e(id)}"${falta(coste, plaza.almacen) ? ` disabled title="El almacén de ${e(nombrePlaza(plaza))} no tiene bastante oro"` : ''}>Comprar al Aeda en ${e(nombrePlaza(plaza))} ${chips(coste, plaza.almacen)}</button>`);
      }
    }
    if (posibles.includes(id)) {
      for (const a of residentes) {
        if (a.epica) continue;
        const plaza = plazas.find((x) => x.id === a.asentamientoId);
        if (!plaza || motivoPlaza(plaza, false)) continue;
        partes.push(`<button class="btn-secondary ta-ficha-boton" type="button" data-ficha-epica="${e(a.id)}" data-plaza="${e(a.asentamientoId)}" data-tec-id="${e(id)}">Que ${e(a.nombre)} cante su épica${cat?.EPICAS[id]?.nombre ? ` · ${e(cat.EPICAS[id]!.nombre)}` : ''}</button>`);
      }
    }
    return partes.join('');
  };
  ficha = { acciones: fichaAcciones, precio: precioAeda };

  return `${cabecera}<div class="tec-panel tec-con-arbol">
    <div class="tec-arbol">${htmlArbol(p, e, precioAeda)}</div>
    <p class="faction-error" data-campo="error-tecnologia" role="alert"></p>
    <div class="tec-extras">
      <section class="tec-extra">
        <strong class="heroe-sub">Logros del mundo cumplidos${ayuda('jugador:tec-era', `Lo que ha pasado entre todas las Facciones; no dicen qué tecnología abren. Era del mundo: ${e(nombreEra(t.era))}.`)}</strong>
        ${logros}
      </section>
      <section class="tec-extra">
        <strong class="heroe-sub">Aedas residentes de tus plazas${ayuda('jugador:tec-residentes', `Una épica sustituye al hito de la Facción (no al logro del mundo), no cuesta oro y avanza con hechos de la plaza o de la Facción, ${enfriamientoTexto}. Al cumplirla la tecnología aparece, y se adopta como siempre. Solo se ofrecen las tecnologías con logro cumplido, Era alcanzada y que ningún Aeda tuyo canta ya.`)}</strong>
        ${residentes.length ? `<ul class="tec-lista">${residentes.map(filaResidente).join('')}</ul>` : '<p class="asent-lado-nota">Ninguna plaza tuya tiene un Aeda residente (piden Palacio y nobleza).</p>'}
      </section>
      <section class="tec-extra">
        <strong class="heroe-sub">Aedas itinerantes en tus plazas${ayuda('jugador:tec-itinerantes', `Compra de una tecnología revelada: ${e(ventaTexto)}. Te salta el hito, no el logro; luego hay que adoptarla.`)}</strong>
        ${itinerantes.length ? `<ul class="tec-lista">${itinerantes.map(filaItinerante).join('')}</ul>` : '<p class="asent-lado-nota">Ningún Aeda itinerante detenido en una plaza tuya ahora mismo.</p>'}
      </section>
    </div>
    <p class="faction-error" data-campo="error-tecnologia-aedas" role="alert"></p>
  </div>`;
}

/** Las acciones de la ficha del árbol, de la última vez que se pintó el panel. */
let ficha: { acciones: (id: string) => string; precio: (id: string) => number | null } | null = null;

export function cablearTecnologia(raiz: HTMLElement, ejecutar: Ejecutar): void {
  const arbol = raiz.querySelector<HTMLElement>('.tec-arbol');
  if (arbol && ficha) {
    const f = ficha;
    montarArbol(arbol, {
      acciones: f.acciones,
      cablearAcciones: (caja) => {
        const accion = (selector: string, tipo: string, params: (b: HTMLButtonElement) => object): void => caja.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          b.disabled = true;
          const mensaje = await ejecutar(tipo, params(b));
          b.disabled = false;
          const campo = caja.querySelector<HTMLElement>('[data-campo="error-ficha-tecnologia"]');
          if (campo) campo.textContent = mensaje ?? '';
        }));
        accion('[data-ficha-adoptar]', 'adoptarTecnologia', (b) => ({ faccionId: b.dataset.faccion, tecnologiaId: b.dataset.fichaAdoptar }));
        accion('[data-ficha-comprar]', 'comprarTecnologiaAeda', (b) => ({ asentamientoId: b.dataset.fichaComprar, tecnologiaId: b.dataset.tecId }));
        accion('[data-ficha-epica]', 'empezarEpica', (b) => ({ asentamientoId: b.dataset.plaza, aedaId: b.dataset.fichaEpica, tecnologiaId: b.dataset.tecId }));
      },
    }, f.precio);
  }
  const elegida = (selector: string): string => raiz.querySelector<HTMLSelectElement>(selector)?.value ?? '';
  const enlazar = (atributo: string, error: string, tipo: string, params: (b: HTMLButtonElement) => object): void =>
    raiz.querySelectorAll<HTMLButtonElement>(`[${atributo}]`).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const mensaje = await ejecutar(tipo, params(b));
      b.disabled = false;
      const campo = raiz.querySelector<HTMLElement>(`[data-campo="${error}"]`);
      if (campo) campo.textContent = mensaje ?? '';
    }));
  enlazar('data-tec-adoptar', 'error-tecnologia', 'adoptarTecnologia', (b) => ({ faccionId: b.dataset.faccion, tecnologiaId: b.dataset.tecAdoptar }));
  enlazar('data-tec-abandonar', 'error-tecnologia-aedas', 'abandonarEpica', (b) => ({ asentamientoId: b.dataset.plaza, aedaId: b.dataset.tecAbandonar }));
  enlazar('data-tec-empezar', 'error-tecnologia-aedas', 'empezarEpica', (b) => ({ asentamientoId: b.dataset.plaza, aedaId: b.dataset.tecEmpezar, tecnologiaId: elegida(`[data-tec-epica-de="${b.dataset.tecEmpezar}"]`) }));
  enlazar('data-tec-comprar', 'error-tecnologia-aedas', 'comprarTecnologiaAeda', (b) => ({ asentamientoId: b.dataset.tecComprar, tecnologiaId: elegida(`[data-tec-compra-en="${b.dataset.tecComprar}"]`) }));
}
