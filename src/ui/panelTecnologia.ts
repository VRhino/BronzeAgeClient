// Panel de TECNOLOGÍA Y AEDAS (backend Doc 6). Se abre desde la barra del jugador. Comandos:
//   adoptarTecnologia     { faccionId, tecnologiaId }                  el Rey, estando en la capital; la paga el almacén de la capital
//   comprarTecnologiaAeda { asentamientoId, tecnologiaId }             el Rey o el Gobernador de la plaza, presente, a un Aeda itinerante detenido en ella
//   empezarEpica          { asentamientoId, aedaId, tecnologiaId }     el Rey, el Gobernador o el Sacerdote de la plaza, presente
//   abandonarEpica        { asentamientoId, aedaId }                   ídem; se pierde lo avanzado
// Nombres, Eras, tarifas, venta de Aedas, épicas y enfriamiento salen del balance (`catalogoDeTecnologia`); mientras no llegue, se muestra el id legible.
import { catalogoDeTecnologia, type ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, CondicionHito, TecnologiaId } from '../tiposDominio';
import { EDIFICIO_NOMBRE, RECURSO_NOMBRE } from '../paletas';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** `leva_comunal` → «Leva comunal». Solo para cuando el balance aún no ha llegado. */
const legible = (id: string): string => { const t = id.replace(/[._]/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const cifra = (n: number): string => n.toLocaleString('es');

export function htmlTecnologia(p: ProyeccionJugador, e: Escapar): string {
  const t = p.tecnologia;
  const cabecera = `<div class="mapa-panel-jugador">${e(p.heroe.displayName)} · tecnología y Aedas</div>`;
  if (!t) return `${cabecera}<p class="asent-lado-nota">Este servidor no envía el estado de la tecnología.</p>`;
  // El panel se repinta con el sondeo, así que no hace falta avisar cuando llegue el balance.
  const cat = catalogoDeTecnologia(() => {});
  const nombreTec = (id: string): string => cat?.TECNOLOGIAS[id]?.nombre ?? legible(id);
  const nombreEra = (id: string): string => cat?.ERAS[id]?.nombre ?? legible(id);
  const eraDeTec = (id: string): string | undefined => t.eraDe?.[id] ?? cat?.TECNOLOGIAS[id]?.era;
  const recursos = (r: Record<string, number>): string => Object.entries(r).map(([k, n]) => `${cifra(n)} ${(RECURSO_NOMBRE[k] ?? k).toLowerCase()}`).join(' + ');
  const costeAdopcion = (id: string): string | null => { const era = eraDeTec(id); const tarifa = era ? cat?.TARIFA_ADOPCION[era] : undefined; return tarifa ? recursos(tarifa) : null; };
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
  const plazas = p.asentamientos;
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

  function describir(c: CondicionHito): string {
    switch (c.tipo) {
      case 'edificio': return `${EDIFICIO_NOMBRE[c.edificio] ?? legible(c.edificio)}${c.nivelInterno ? ` de nivel ${c.nivelInterno}` : ''} activo`;
      case 'tecnologia': return `${nombreTec(c.id)} adoptada`;
      case 'recursoEnCapital': return `${RECURSO_NOMBRE[c.recurso] ?? c.recurso} en el almacén de la capital`;
      case 'capitalEnNivel': return `capital en nivel ${c.nivel} con ${EDIFICIO_NOMBRE[c.conEdificio] ?? legible(c.conEdificio)} activo`;
      case 'yacimientoEnTerritorio': return `un yacimiento de ${RECURSO_NOMBRE[c.recurso] ?? c.recurso} en su territorio`;
    }
  }
  const hitoHtml = (hito: CondicionHito[], cumplidas: boolean[] | undefined): string => hito.length === 0
    ? '<small>Sin hito de la Facción.</small>'
    : `<ul class="tec-hito">${hito.map((c, i) => { const ok = cumplidas?.[i]; return `<li class="${ok ? 'cumple' : ''}">${ok === undefined ? '·' : ok ? '✓' : '✗'} ${e(describir(c))}</li>`; }).join('')}</ul>`;

  /** ⓘ de una tecnología: su Era, el bonus que da y lo que cuesta adoptarla. */
  const ayudaTec = (id: string): string => {
    const d = cat?.TECNOLOGIAS[id];
    const era = eraDeTec(id);
    const coste = costeAdopcion(id);
    const partes = [
      era ? `Era: ${e(nombreEra(era))}.` : '',
      d?.bonusProduccion ? `Bonus: producción de ${e((RECURSO_NOMBRE[d.bonusProduccion.recurso] ?? d.bonusProduccion.recurso).toLowerCase())} ×${e(String(d.bonusProduccion.factor).replace('.', ','))}.` : '',
      coste ? `Adoptarla cuesta ${e(coste)}, del almacén de la capital.` : '',
    ].filter(Boolean);
    return partes.length ? ayuda(`jugador:tec:${id}`, partes.join(' ')) : '';
  };
  const eraChip = (id: string): string => { const era = eraDeTec(id); return era ? ` <small>· ${e(nombreEra(era))}</small>` : ''; };

  const logros = t.logros.length === 0
    ? '<p class="asent-lado-nota">Aún no se ha cumplido ningún logro del mundo.</p>'
    : `<ul class="tec-lista">${t.logros.map((l) => `<li>${e(legible(l.contador))} ≥ ${cifra(l.umbral)} <small>· hace ${e(textoEnTiempoReal(p.instante - l.en))}</small></li>`).join('')}</ul>`;

  const capital = plazas.find((a) => a.id === t.capitalId);
  const motivoAdoptar = !propias ? 'Necesitas una Facción.' : !soyRey ? 'Solo la adopta el Rey de la Facción, estando en la capital.'
    : !t.capitalId ? 'Tu Facción aún no tiene capital.' : dondeEstoy !== t.capitalId ? `Tienes que estar en la capital${capital ? `, ${nombrePlaza(capital)}` : ''}.` : null;
  const filaAdoptable = (id: TecnologiaId): string => {
    const coste = costeAdopcion(id);
    return `<li class="tec-fila"><span><strong>${e(nombreTec(id))}</strong>${eraChip(id)}${ayudaTec(id)}${coste ? ` <small>· cuesta ${e(coste)}</small>` : ''}</span>
    <button class="btn-primary" type="button" data-tec-adoptar="${e(id)}" data-faccion="${e(p.faccionId ?? '')}"${motivoAdoptar ? ` disabled title="${e(motivoAdoptar)}"` : ''}>Adoptar</button></li>`;
  };
  const filaReveladaHtml = (r: (typeof reveladas)[number]): string => `<li class="tec-fila tec-revelada"><span><strong>${e(nombreTec(r.tecnologiaId))}</strong>${eraChip(r.tecnologiaId)}${ayudaTec(r.tecnologiaId)}
    <small>desbloqueada por ${e(p.facciones.find((f) => f.id === r.descubridorFaccionId)?.nombre ?? r.descubridorFaccionId)}</small>${hitoHtml(r.hito, r.cumplidas)}</span></li>`;

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

  return `${cabecera}<div class="tec-panel">
    <strong class="heroe-sub">Era del mundo: ${e(nombreEra(t.era))} <small>(desde hace ${e(textoEnTiempoReal(p.instante - t.eraDesde))})</small>${ayuda('jugador:tec-era', 'Logros del mundo cumplidos (lo que ha pasado entre todas las Facciones; no dicen qué tecnología abren).')}</strong>
    ${logros}

    <strong class="heroe-sub">Tus tecnologías${ayuda('jugador:tec-adoptar', `${motivoAdoptar ? e(motivoAdoptar) : 'Eres el Rey y estás en la capital: puedes adoptar.'} La adopción es instantánea y la paga el almacén de la capital, según la Era de la tecnología.`)}</strong>
    ${propias ? '' : '<p class="asent-lado-nota">Sin Facción no hay tecnología propia.</p>'}
    ${adoptables.length ? `<ul class="tec-lista">${adoptables.map(filaAdoptable).join('')}</ul>` : propias ? '<p class="asent-lado-nota">Ninguna tecnología aparecida a la espera de adoptarse.</p>' : ''}
    ${adoptadas.length ? `<p class="asent-lado-nota">Adoptadas: ${adoptadas.map((id) => `<span class="tec-chip">${e(nombreTec(id))}</span>${ayudaTec(id)}`).join(' ')}</p>` : ''}
    ${reveladas.length ? `<strong class="heroe-sub">Reveladas por los Aedas (te falta el hito)</strong><ul class="tec-lista">${reveladas.map(filaReveladaHtml).join('')}</ul>` : ''}
    <p class="faction-error" data-campo="error-tecnologia" role="alert"></p>

    <strong class="heroe-sub">Aedas residentes de tus plazas${ayuda('jugador:tec-residentes', `Una épica sustituye al hito de la Facción (no al logro del mundo), no cuesta oro y avanza con hechos de la plaza o de la Facción, ${enfriamientoTexto}. Al cumplirla la tecnología aparece, y se adopta como siempre. Solo se ofrecen las tecnologías con logro cumplido, Era alcanzada y que ningún Aeda tuyo canta ya.`)}</strong>
    ${residentes.length ? `<ul class="tec-lista">${residentes.map(filaResidente).join('')}</ul>` : '<p class="asent-lado-nota">Ninguna plaza tuya tiene un Aeda residente (piden Palacio y nobleza).</p>'}

    <strong class="heroe-sub">Aedas itinerantes en tus plazas${ayuda('jugador:tec-itinerantes', `Compra de una tecnología revelada: ${e(ventaTexto)}. Te salta el hito, no el logro; luego hay que adoptarla.`)}</strong>
    ${itinerantes.length ? `<ul class="tec-lista">${itinerantes.map(filaItinerante).join('')}</ul>` : '<p class="asent-lado-nota">Ningún Aeda itinerante detenido en una plaza tuya ahora mismo.</p>'}
    <p class="faction-error" data-campo="error-tecnologia-aedas" role="alert"></p>
  </div>`;
}

export function cablearTecnologia(raiz: HTMLElement, ejecutar: Ejecutar): void {
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
