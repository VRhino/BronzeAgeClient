// La ventana AEDAS de la plaza (Víctor, 2026-11-07: «los Aedas son de plaza, no de Facción»): un icono más en el riel de la ciudad, que solo sale
// cuando en la plaza donde estás hay un Aeda, itinerante parado en ella o residente. Antes todo esto estaba abajo de Facción → Tecnología.
//   itinerante   quién es, qué hace y lo que os vende (las tecnologías reveladas que aún no tenéis); el Rey o el Gobernador le compran:
//                `comprarTecnologiaAeda { asentamientoId, tecnologiaId }`, paga el almacén de la plaza
//   residente    qué da a la plaza y su épica: en curso, con su capítulo y Abandonar; sin épica, las que puede cantar. El Rey, el Gobernador o el
//                Sacerdote de la plaza: `empezarEpica { asentamientoId, aedaId, tecnologiaId }`, `abandonarEpica { asentamientoId, aedaId }`
// Solo en una plaza de tu Facción: los residentes llegan en FACCION y a un itinerante solo le compra tu Rey o tu Gobernador.
import { catalogoDeTecnologia, type ProyeccionJugador } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { nombreDeAeda } from '../mundo/aedas';
import { nombreDeTecnologia, precioDeAeda } from './aedas';
import { ayuda } from './ayuda';
import { textoEnTiempoReal } from './estadoCliente';
import { barraAvance } from './juegoVisual';
import { confirmar } from './dialogo';

type Escapar = (valor: string) => string;
type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

const cifra = (n: number): string => n.toLocaleString('es');

/** Los itinerantes parados en la plaza y sus residentes. */
export function aedasDePlaza(p: ProyeccionJugador, a: Asentamiento): { itinerantes: string[]; residentes: NonNullable<ProyeccionJugador['aedasResidentes']> } {
  return {
    itinerantes: (p.aedasAvistados ?? []).filter((x) => x.enAsentamientoId === a.id).map((x) => x.id),
    residentes: (p.aedasResidentes ?? []).filter((x) => x.asentamientoId === a.id),
  };
}

/** ¿Sale el icono de los Aedas en el riel? Plaza de tu Facción con algún Aeda dentro. */
export function hayAedasEnPlaza(p: ProyeccionJugador, a: Asentamiento): boolean {
  if (!p.faccionId || a.faccionId !== p.faccionId) return false;
  const { itinerantes, residentes } = aedasDePlaza(p, a);
  return itinerantes.length + residentes.length > 0;
}

/** Quién manda aquí sobre los Aedas: el Rey de la Facción o el Gobernador de la plaza compran; con ellos, el Sacerdote dirige las épicas. */
function cargos(p: ProyeccionJugador, a: Asentamiento): { compra: boolean; epica: boolean } {
  const rey = p.facciones.find((f) => f.id === p.faccionId)?.reyId === p.heroeId;
  const gob = a.cargos?.gobernadorId === p.heroeId;
  const u = p.heroe.ubicacion;
  const aqui = u.tipo === 'asentamiento' && u.asentamientoId === a.id;
  return { compra: aqui && (rey || gob), epica: aqui && (rey || gob || a.cargos?.sacerdoteId === p.heroeId) };
}

export function htmlVentanaAedas(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const cat = catalogoDeTecnologia(() => {});
  const tec = (id: string): string => nombreDeTecnologia(cat, id);
  const { itinerantes, residentes } = aedasDePlaza(p, a);
  const puede = cargos(p, a);
  const oro = Math.floor(a.almacen?.['oro']?.cantidad ?? 0);
  const partes: string[] = [];

  if (itinerantes.length) {
    const estancia = cat?.AEDAS.itinerantes?.estanciaMinutos;
    const venta = (p.tecnologia?.reveladas ?? []).filter((r) => precioDeAeda(p, cat, r.tecnologiaId) !== null);
    const ventaTexto = cat ? `Cobra ${cat.AEDAS.venta.factorOro} veces el oro de la tarifa de la Era de la tecnología (hasta la Era ${cat.AEDAS.venta.ordenEraMaximo}), del almacén de la plaza.` : 'Cobra en oro, del almacén de la plaza.';
    const lista = venta.length === 0
      ? '<p class="asent-lado-nota">Ha revelado a tu Facción todo lo que sabe que os falta: no tiene nada más que venderos.</p>'
      : `<ul class="aedas-lista">${venta.map((r) => {
        const precio = precioDeAeda(p, cat, r.tecnologiaId)!;
        const boton = puede.compra
          ? `<button class="btn-primary" type="button" data-aeda-comprar="${e(r.tecnologiaId)}"${oro < precio ? ' disabled title="El almacén de la plaza no tiene bastante oro"' : ''}>Comprar</button>` : '';
        return `<li class="aedas-fila"><span><strong>${e(tec(r.tecnologiaId))}</strong><small>Revelada: la descubrió otra Facción</small></span><span class="ta-rec${oro < precio ? ' falta' : ''}"><i aria-hidden="true">🪙</i><b>${cifra(precio)}</b></span>${boton}</li>`;
      }).join('')}</ul>${puede.compra ? `<p class="asent-lado-nota">Almacén de la plaza: ${cifra(oro)} de oro.</p>` : '<p class="asent-lado-nota">Solo le compran el Rey o el Gobernador de la plaza.</p>'}`;
    partes.push(`<section class="aedas-seccion">
      <h3 class="heroe-sub">📜 ${e(itinerantes.map(nombreDeAeda).join(' y '))} <small>${itinerantes.length > 1 ? 'Aedas itinerantes' : 'Aeda itinerante'}</small>${ayuda('plaza:aeda-itinerante', `Va de plaza en plaza cantando lo que se descubre en el mundo${estancia ? ` y se queda ${textoEnTiempoReal(estancia * 60_000)} en cada una` : ''}. Al pararse revela a tu Facción las tecnologías que conoce y os faltan. Comprarle una os salta el hito de la Facción, no el logro del mundo; luego hay que adoptarla en Facción → Tecnología. ${ventaTexto}`)}</h3>
      <p class="asent-lado-nota">Parado en la plaza${estancia ? ` (se queda ${e(textoEnTiempoReal(estancia * 60_000))} en cada plaza)` : ''}. Lo que os vende:</p>
      ${lista}
    </section>`);
  }

  if (residentes.length) {
    const res = cat?.AEDAS.residentes;
    const pct = (x: number | undefined): string => (x === undefined ? '' : `${Math.round(x * 100)} %`);
    const cupos = res?.cupoPorNivel ? Object.entries(res.cupoPorNivel).sort(([x], [y]) => Number(x) - Number(y)).map(([n, c]) => `${c} en nivel ${n}`).join(', ') : '';
    const da = res
      ? `Cada Aeda residente da +${pct(res.bonoFelicidad)} de felicidad a la plaza (crece más su población) y +${pct(res.bonoNobleza)} al crecimiento de la nobleza.`
      : 'Un Aeda residente da felicidad y crecimiento de nobleza a la plaza.';
    const ayudaRes = `${res ? `Viven en plazas con Palacio activo y algo de nobleza: caben ${cupos}. Con sitio libre llega uno cada ${textoEnTiempoReal((res.llegadaMinutos ?? 0) * 60_000)}${res.factorLlegadaReputacionBaja && res.umbralReputacionBaja !== undefined ? ` (${res.factorLlegadaReputacionBaja} veces más lento si la reputación de tu Facción está en ${res.umbralReputacionBaja} o menos)` : ''}. ` : ''}Cuentan para el título «Mecenas de los Aedas»: épicas cumplidas × 10 más residentes.`;
    const enfriamiento = cat ? cat.AEDAS.epica.enfriamientoMinutos * 60_000 : null;
    const posibles = p.tecnologia?.epicasPosibles ?? [];
    const filas = residentes.map((r) => {
      const ep = r.epica;
      if (ep) {
        const espera = ep.ultimoHechoEn !== undefined && enfriamiento !== null ? enfriamiento - (p.instante - ep.ultimoHechoEn) : 0;
        const hecho = cat?.EPICAS[ep.tecnologiaId]?.capitulos[ep.capitulo]?.hecho;
        const titulo = (hecho && cat?.TITULO_CAPITULO[hecho]) || ep.tituloCapitulo;
        const avance = (ep.capitulo + (ep.hechosNecesarios ? ep.hechos / ep.hechosNecesarios : 0)) / Math.max(1, ep.capitulos);
        return `<li class="aedas-residente"><div class="aedas-fila"><span><strong>${e(r.nombre)}</strong><small>Canta «${e(cat?.EPICAS[ep.tecnologiaId]?.nombre ?? ep.nombre)}», la épica de ${e(tec(ep.tecnologiaId))}</small></span>
          ${puede.epica ? `<button class="btn-secondary" type="button" data-aeda-abandonar="${e(r.id)}">Abandonar</button>` : ''}</div>
          ${barraAvance(avance)}
          <small>Capítulo ${ep.capitulo + 1} de ${ep.capitulos}: ${e(titulo)} · ${ep.hechos} / ${ep.hechosNecesarios} hechos${espera > 0 ? ` · otro hecho cuenta en ${e(textoEnTiempoReal(espera))}` : ep.ultimoHechoEn === undefined ? '' : ' · ya puede contar otro hecho'}</small></li>`;
      }
      const opciones = puede.epica && posibles.length
        ? `<ul class="aedas-lista">${posibles.map((id) => `<li class="aedas-fila"><span><strong>${e(cat?.EPICAS[id]?.nombre ?? tec(id))}</strong><small>Épica de ${e(tec(id))}${cat?.EPICAS[id] ? ` · ${cat.EPICAS[id]!.capitulos.length} capítulos` : ''}</small></span><button class="btn-primary" type="button" data-aeda-epica="${e(r.id)}" data-tec-id="${e(id)}">Que la cante</button></li>`).join('')}</ul>`
        : `<small>${posibles.length ? 'Le encargan una épica el Rey, el Gobernador o el Sacerdote de la plaza.' : 'Ahora no hay ninguna tecnología con épica posible.'}</small>`;
      return `<li class="aedas-residente"><div class="aedas-fila"><span><strong>${e(r.nombre)}</strong><small>Sin épica en curso</small></span></div>${opciones}</li>`;
    }).join('');
    const ayudaEpica = `Una épica sustituye al hito de la Facción (no al logro del mundo), no cuesta oro y avanza con hechos de la plaza o de la Facción, ${enfriamiento !== null ? `uno cada ${textoEnTiempoReal(enfriamiento)} de mundo como mucho` : 'con un enfriamiento entre uno y otro'}. Al cumplirla la tecnología aparece y se adopta como siempre. Solo se ofrecen las tecnologías con logro cumplido, Era alcanzada y que ningún Aeda vuestro canta ya.`;
    partes.push(`<section class="aedas-seccion">
      <h3 class="heroe-sub">${residentes.length > 1 ? 'Aedas residentes' : 'Aeda residente'}${ayuda('plaza:aeda-residente', ayudaRes)}</h3>
      <p class="asent-lado-nota">${e(da)}</p>
      <strong class="heroe-sub">Épicas${ayuda('plaza:aeda-epica', ayudaEpica)}</strong>
      <ul class="aedas-lista">${filas}</ul>
    </section>`);
  }

  return `<div class="aedas-ventana">${partes.join('')}<p class="faction-error" data-campo="error-aedas" role="alert"></p></div>`;
}

export function cablearVentanaAedas(cuerpo: HTMLElement, a: Asentamiento, ejecutar: Ejecutar, aviso: (m: string) => void): void {
  const accion = (selector: string, tipo: string, params: (b: HTMLButtonElement) => object, hecho?: string, antes?: () => Promise<boolean>): void => cuerpo.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async () => {
    if (antes && !(await antes())) return;
    b.disabled = true;
    const error = await ejecutar(tipo, params(b));
    b.disabled = false;
    const campo = cuerpo.querySelector<HTMLElement>('[data-campo="error-aedas"]');
    if (campo) campo.textContent = error ?? '';
    if (!error && hecho) aviso(hecho);
  }));
  accion('[data-aeda-comprar]', 'comprarTecnologiaAeda', (b) => ({ asentamientoId: a.id, tecnologiaId: b.dataset.aedaComprar }), 'Compra hecha: la tecnología ya es de tu Facción. Adóptala en Facción → Tecnología.');
  accion('[data-aeda-epica]', 'empezarEpica', (b) => ({ asentamientoId: a.id, aedaId: b.dataset.aedaEpica, tecnologiaId: b.dataset.tecId }));
  accion('[data-aeda-abandonar]', 'abandonarEpica', (b) => ({ asentamientoId: a.id, aedaId: b.dataset.aedaAbandonar }), undefined,
    () => confirmar('Se pierde todo lo que lleva cantado de la épica. Podrá empezar otra después.', { titulo: '¿Abandonar la épica?', aceptar: 'Abandonar' }));
}
