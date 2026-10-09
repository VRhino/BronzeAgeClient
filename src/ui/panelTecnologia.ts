// Panel de TECNOLOGÍA Y AEDAS (backend Doc 6). Se abre desde la barra del jugador. Comandos:
//   adoptarTecnologia     { faccionId, tecnologiaId }                  el Rey, estando en la capital; la paga el almacén de la capital
//   comprarTecnologiaAeda { asentamientoId, tecnologiaId }             el Rey o el Gobernador de la plaza, presente, a un Aeda itinerante detenido en ella
//   empezarEpica          { asentamientoId, aedaId, tecnologiaId }     el Rey, el Gobernador o el Sacerdote de la plaza, presente
//   abandonarEpica        { asentamientoId, aedaId }                   ídem; se pierde lo avanzado
// El catálogo `TECNOLOGIAS` (nombres, Era, coste, hito) y las tarifas NO están en el balance público: de cada tecnología solo llega su id (se muestra
// legible) y, si está revelada, su hito. Las cifras de abajo son las del canon (Doc 6.5, 6.7), copiadas a mano hasta que el backend las publique.
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, CondicionHito, TecnologiaId } from '../tiposDominio';
import { EDIFICIO_NOMBRE, RECURSO_NOMBRE } from '../paletas';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** Lo que cuesta adoptar según la Era de la tecnología (Doc 6.5, placeholder del backend); la Era de cada tecnología no viaja, así que se muestran todas. */
const TARIFA_ADOPCION: [era: string, coste: string][] = [
  ['reinos_palaciales', '100 oro + 200 madera'],
  ['crisis_adaptacion', '300 oro + 30 lingotes de bronce'],
  ['polis_imperios', '600 oro + 30 lingotes de hierro'],
];
/** Un Aeda itinerante cobra el doble del oro de la tarifa de su Era (Doc 6.7), de las Eras I-III. */
const PRECIO_AEDA = '200 / 600 / 1.200 de oro según la Era (I / II / III), del almacén de la plaza';
/** Entre un hecho y el siguiente de una épica pasan 6 horas de mundo (`AEDAS.epica.enfriamientoMinutos`, no publicado). */
const ENFRIAMIENTO_EPICA_MS = 6 * 60 * 60 * 1000;

/** `leva_comunal` → «Leva comunal». Es solo el id, no el nombre oficial. */
const legible = (id: string): string => { const t = id.replace(/[._]/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };

function describir(c: CondicionHito): string {
  switch (c.tipo) {
    case 'edificio': return `${EDIFICIO_NOMBRE[c.edificio] ?? legible(c.edificio)}${c.nivelInterno ? ` de nivel ${c.nivelInterno}` : ''} activo`;
    case 'tecnologia': return `${legible(c.id)} adoptada`;
    case 'recursoEnCapital': return `${RECURSO_NOMBRE[c.recurso] ?? c.recurso} en el almacén de la capital`;
    case 'capitalEnNivel': return `capital en nivel ${c.nivel} con ${EDIFICIO_NOMBRE[c.conEdificio] ?? legible(c.conEdificio)} activo`;
    case 'yacimientoEnTerritorio': return `un yacimiento de ${RECURSO_NOMBRE[c.recurso] ?? c.recurso} en su territorio`;
  }
}

/** ¿Ya se cumple? Solo se sabe de lo que la proyección deja ver (edificios de tus plazas y tecnologías adoptadas); lo demás, `undefined`. */
function cumple(c: CondicionHito, plazas: Asentamiento[], adoptadas: TecnologiaId[]): boolean | undefined {
  if (c.tipo === 'tecnologia') return adoptadas.includes(c.id);
  if (c.tipo === 'edificio') return plazas.some((a) => a.edificios.some((e) => e.tipo === c.edificio && e.estado === 'activo' && (c.nivelInterno === undefined || ((e as { nivelInterno?: number }).nivelInterno ?? 1) >= c.nivelInterno)));
  return undefined;
}

function hitoHtml(hito: CondicionHito[], plazas: Asentamiento[], adoptadas: TecnologiaId[], e: Escapar): string {
  if (hito.length === 0) return '<small>Sin hito de la Facción.</small>';
  return `<ul class="tec-hito">${hito.map((c) => {
    const ok = cumple(c, plazas, adoptadas);
    return `<li class="${ok === true ? 'cumple' : ''}">${ok === true ? '✓' : ok === false ? '✗' : '·'} ${e(describir(c))}${ok === undefined ? ' <small>(no se puede comprobar desde aquí)</small>' : ''}</li>`;
  }).join('')}</ul>`;
}

export function htmlTecnologia(p: ProyeccionJugador, e: Escapar): string {
  const t = p.tecnologia;
  const cabecera = `<div class="mapa-panel-jugador">${e(p.heroe.displayName)} · tecnología y Aedas</div>`;
  if (!t) return `${cabecera}<p class="asent-lado-nota">Este servidor no envía el estado de la tecnología.</p>`;
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

  const logros = t.logros.length === 0
    ? '<p class="asent-lado-nota">Aún no se ha cumplido ningún logro del mundo.</p>'
    : `<ul class="tec-lista">${t.logros.map((l) => `<li>${e(legible(l.contador))} ≥ ${l.umbral.toLocaleString('es')} <small>· hace ${e(textoEnTiempoReal(p.instante - l.en))}</small></li>`).join('')}</ul>`;

  const motivoAdoptar = !propias ? 'Necesitas una Facción.' : !soyRey ? 'Solo la adopta el Rey de la Facción, estando en la capital.' : null;
  const filaAdoptable = (id: TecnologiaId): string => `<li class="tec-fila"><span><strong>${e(legible(id))}</strong> <small>aparecida: ya se puede adoptar</small></span>
    <button class="btn-primary" type="button" data-tec-adoptar="${e(id)}" data-faccion="${e(p.faccionId ?? '')}"${motivoAdoptar ? ` disabled title="${e(motivoAdoptar)}"` : ''}>Adoptar</button></li>`;
  const filaReveladaHtml = (r: (typeof reveladas)[number]): string => `<li class="tec-fila tec-revelada"><span><strong>${e(legible(r.tecnologiaId))}</strong>
    <small>desbloqueada por ${e(p.facciones.find((f) => f.id === r.descubridorFaccionId)?.nombre ?? r.descubridorFaccionId)}</small>${hitoHtml(r.hito, plazas, adoptadas, e)}</span></li>`;

  const residentes = p.aedasResidentes ?? [];
  const yaCantadas = new Set(residentes.flatMap((a) => (a.epica ? [a.epica.tecnologiaId] : [])));
  const filaResidente = (a: NonNullable<typeof p.aedasResidentes>[number]): string => {
    const plaza = plazas.find((x) => x.id === a.asentamientoId);
    const motivo = plaza ? motivoPlaza(plaza, false) : 'La plaza ya no es tuya.';
    const nombre = `<strong>${e(a.nombre)}</strong> <small>en ${e(plaza ? nombrePlaza(plaza) : a.asentamientoId)}</small>`;
    const ep = a.epica;
    if (ep) {
      const sinEnfriar = ep.ultimoHechoEn !== undefined ? ENFRIAMIENTO_EPICA_MS - (p.instante - ep.ultimoHechoEn) : 0;
      return `<li class="tec-fila"><span>${nombre}<br>${e(ep.nombre)} <small>(${e(legible(ep.tecnologiaId))})</small>
        <br><small>Capítulo ${ep.capitulo + 1} de ${ep.capitulos}: ${e(ep.tituloCapitulo)} · ${ep.hechos} / ${ep.hechosNecesarios} hechos${ep.ultimoHechoEn === undefined ? '' : sinEnfriar > 0 ? ` · otro hecho cuenta en ${e(textoEnTiempoReal(sinEnfriar))}` : ' · ya puede contar otro hecho'}</small></span>
        <button class="btn-secondary" type="button" data-tec-abandonar="${e(a.id)}" data-plaza="${e(a.asentamientoId)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Abandonar</button></li>`;
    }
    const libres = reveladas.filter((r) => !yaCantadas.has(r.tecnologiaId));
    const opciones = libres.map((r) => `<option value="${e(r.tecnologiaId)}">${e(legible(r.tecnologiaId))}</option>`).join('');
    return `<li class="tec-fila"><span>${nombre}<br><small>Sin épica en curso.${libres.length === 0 ? ' No hay tecnologías reveladas para cantar.' : ''}</small></span>
      ${libres.length === 0 ? '' : `<select class="form-input" data-tec-epica-de="${e(a.id)}" aria-label="Tecnología de la épica">${opciones}</select>
      <button class="btn-primary" type="button" data-tec-empezar="${e(a.id)}" data-plaza="${e(a.asentamientoId)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Empezar épica</button>`}</li>`;
  };

  // Aedas itinerantes detenidos en una plaza mía: se les compra una tecnología revelada (la conocen, por eso se reveló).
  const detenidos = (p.aedasAvistados ?? []).filter((a) => a.enAsentamientoId && plazas.some((x) => x.id === a.enAsentamientoId));
  const filaItinerante = (id: string): string => {
    const plaza = plazas.find((x) => x.id === id)!;
    const motivo = motivoPlaza(plaza, true);
    const oro = Math.floor(plaza.almacen?.['oro']?.cantidad ?? 0);
    return `<li class="tec-fila"><span><strong>Aeda itinerante</strong> <small>detenido en ${e(nombrePlaza(plaza))} · almacén: ${oro} de oro</small></span>
      ${reveladas.length === 0 ? '<small>No tienes tecnologías reveladas que comprar.</small>' : `<select class="form-input" data-tec-compra-en="${e(id)}" aria-label="Tecnología a comprar">${reveladas.map((r) => `<option value="${e(r.tecnologiaId)}">${e(legible(r.tecnologiaId))}</option>`).join('')}</select>
      <button class="btn-primary" type="button" data-tec-comprar="${e(id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Comprar</button>`}</li>`;
  };
  const itinerantes = [...new Set(detenidos.map((a) => a.enAsentamientoId!))];

  return `${cabecera}<div class="tec-panel">
    <strong class="heroe-sub">Era del mundo: ${e(legible(t.era))} <small>(desde hace ${e(textoEnTiempoReal(p.instante - t.eraDesde))})</small>${ayuda('jugador:tec-era', 'Logros del mundo cumplidos (lo que ha pasado entre todas las Facciones; no dicen qué tecnología abren).')}</strong>
    ${logros}

    <strong class="heroe-sub">Tus tecnologías${ayuda('jugador:tec-adoptar', `${motivoAdoptar ? e(motivoAdoptar) : 'Eres el Rey: puedes adoptar, estando en la capital.'} La adopción es instantánea y la paga el almacén de la capital. Cuesta según la Era de la tecnología (no se sabe la de cada una desde aquí):<ul class="tec-lista">${TARIFA_ADOPCION.map(([era, coste]) => `<li>${e(legible(era))}: ${e(coste)}</li>`).join('')}</ul>`)}</strong>
    ${propias ? '' : '<p class="asent-lado-nota">Sin Facción no hay tecnología propia.</p>'}
    ${adoptables.length ? `<ul class="tec-lista">${adoptables.map(filaAdoptable).join('')}</ul>` : propias ? '<p class="asent-lado-nota">Ninguna tecnología aparecida a la espera de adoptarse.</p>' : ''}
    ${adoptadas.length ? `<p class="asent-lado-nota">Adoptadas: ${adoptadas.map((id) => `<span class="tec-chip">${e(legible(id))}</span>`).join(' ')}</p>` : ''}
    ${reveladas.length ? `<strong class="heroe-sub">Reveladas por los Aedas (te falta el hito)</strong><ul class="tec-lista">${reveladas.map(filaReveladaHtml).join('')}</ul>` : ''}
    <p class="faction-error" data-campo="error-tecnologia" role="alert"></p>

    <strong class="heroe-sub">Aedas residentes de tus plazas${ayuda('jugador:tec-residentes', 'Una épica sustituye al hito de la Facción (no al logro del mundo), no cuesta oro y avanza con hechos de la plaza o de la Facción, uno cada 6 horas como mucho. Al cumplirla la tecnología aparece, y se adopta como siempre.')}</strong>
    ${residentes.length ? `<ul class="tec-lista">${residentes.map(filaResidente).join('')}</ul>` : '<p class="asent-lado-nota">Ninguna plaza tuya tiene un Aeda residente (piden Palacio y nobleza).</p>'}

    <strong class="heroe-sub">Aedas itinerantes en tus plazas${ayuda('jugador:tec-itinerantes', `Compra de una tecnología revelada: ${e(PRECIO_AEDA)}. Te salta el hito, no el logro; luego hay que adoptarla.`)}</strong>
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
