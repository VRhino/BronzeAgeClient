// Los AEDAS en el mundo (Tecnologia_Aedas §6-7), fuera del panel de Tecnología de la Facción (`panelTecnologia.ts`):
//   mapa     los itinerantes que se ven (`aedasAvistados`, de la VISTA como una columna ajena: posición y tramo de su plan) se pintan en el modo
//            mapa con una lira (`dibujarAedasEnMapa`) y en el mundo 3D con su figura (`mundo3d/figuras.ts`); uno parado en una plaza no anda
//            por ella: se ve en el cartel de la plaza. Un clic los selecciona (`aedasBajoElClic`) y abre su ficha (`FICHA_AEDA`).
//   ficha    quién es, si va de camino o dónde está parado y, parado en una plaza de tu Facción en la que puedes comprarle (Rey o Gobernador,
//            presente), lo que te vende.
//   avisos   los hechos de los Aedas que tocan a tu Facción (`textoDeHechoAeda`, en `avisos.ts`).
// El contrato no da nombre a los itinerantes (`aeda-N`): el suyo lo pone el cliente, siempre el mismo para el mismo N (`nombreDeAeda`).
import { catalogoDeTecnologia, type CatalogoTecnologia, type ProyeccionJugador } from '../apiCliente';
import type { AedaAvistado, Asentamiento, EventoDominio } from '../tiposDominio';
import type { FichaMapaExtra, ObjetoBajoElClic } from './ganchos';
import { agarre } from './agarre';
import { miColumna } from './ejercitos';
import { textoTiempoHasta } from '../mundo/tiempoDeMarcha';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';
import { COLOR_AEDA, nombreDeAeda } from '../mundo/aedas';

export { nombreDeAeda };

type Punto = { x: number; y: number };
type Escapar = (valor: string) => string;

/** El nombre de una tecnología (del catálogo) o su id legible. */
export function nombreDeTecnologia(cat: CatalogoTecnologia | null, id: string): string {
  return cat?.TECNOLOGIAS[id]?.nombre ?? (id.charAt(0).toUpperCase() + id.slice(1)).replace(/[._]/g, ' ');
}

function nombrePlaza(p: ProyeccionJugador, id: string | undefined): string {
  if (!id) return 'una plaza';
  return p.asentamientos.find((a) => a.id === id)?.nombre ?? p.asentamientosAvistados?.find((a) => a.id === id)?.nombre
    ?? p.asentamientosConocidos?.find((a) => a.asentamientoId === id)?.nombre ?? 'una plaza';
}

function nombreFaccion(p: ProyeccionJugador, id: string | undefined): string {
  if (!id) return 'otra Facción';
  if (id === p.faccionId) return 'tu Facción';
  return p.facciones.find((f) => f.id === id)?.nombre ?? p.directorioFacciones?.find((f) => f.id === id)?.nombre ?? 'otra Facción';
}

/** La plaza en que está parado, si es de tu Facción. */
function plazaPropia(p: ProyeccionJugador, a: AedaAvistado): { id: string; dentro?: Asentamiento } | null {
  if (!a.enAsentamientoId || !p.faccionId) return null;
  const dentro = p.asentamientos.find((x) => x.id === a.enAsentamientoId && x.faccionId === p.faccionId);
  if (dentro) return { id: dentro.id, dentro };
  const vista = p.asentamientosAvistados?.find((x) => x.id === a.enAsentamientoId);
  return vista?.faccionId === p.faccionId ? { id: vista.id } : null;
}

/** Lo que cobra un Aeda por una tecnología (el oro de la tarifa de su Era × `factorOro`), o `null` si no la vende o no se sabe. */
export function precioDeAeda(p: ProyeccionJugador, cat: CatalogoTecnologia | null, id: string): number | null {
  const era = p.tecnologia?.eraDe?.[id] ?? cat?.TECNOLOGIAS[id]?.era;
  if (!cat || !era || (cat.ERAS[era]?.orden ?? 99) > cat.AEDAS.venta.ordenEraMaximo) return null;
  return (cat.TARIFA_ADOPCION[era]?.['oro'] ?? 0) * cat.AEDAS.venta.factorOro;
}

// --- Clic y ficha ---------------------------------------------------------------------------------------------------------------------------

/** Los Aedas bajo el clic, del más cercano al más lejano. Sin `ir`: mirar a un Aeda no mueve tu columna. Uno parado en una plaza está en su
 * centro: un clic en la plaza deja elegir entre ella y él. */
export function aedasBajoElClic(p: ProyeccionJugador, punto: Punto): ObjetoBajoElClic[] {
  return (p.aedasAvistados ?? [])
    .map((a) => ({ a, d: Math.hypot(a.posicion.x - punto.x, a.posicion.y - punto.y) }))
    .filter(({ a, d }) => d < agarre(a.enAsentamientoId ? 30 : 15))
    .sort((x, y) => x.d - y.d)
    .map(({ a }) => ({ tipo: 'aeda', id: a.id }));
}

/** Por qué no puedes comprarle (Rey o Gobernador de la plaza, presente), o `null` si puedes. */
function motivoCompra(p: ProyeccionJugador, plaza: { id: string; dentro?: Asentamiento }): string | null {
  const rey = p.facciones.find((f) => f.id === p.faccionId)?.reyId === p.heroeId;
  const gobernador = plaza.dentro?.cargos?.gobernadorId === p.heroeId;
  if (!rey && !gobernador) return 'Solo le compran el Rey o el Gobernador de la plaza.';
  const u = p.heroe.ubicacion;
  return u.tipo === 'asentamiento' && u.asentamientoId === plaza.id && plaza.dentro ? null : `Para comprarle, el Rey o el Gobernador tiene que estar en ${nombrePlaza(p, plaza.id)}.`;
}

function htmlFichaAeda(p: ProyeccionJugador, a: AedaAvistado, e: Escapar): string {
  const cat = catalogoDeTecnologia(() => {});
  const mi = miColumna(p);
  const d = mi && !a.enAsentamientoId ? Math.round(Math.hypot(mi.posicionActual.x - a.posicion.x, mi.posicionActual.y - a.posicion.y)) : null;
  const estancia = cat?.AEDAS.itinerantes?.estanciaMinutos;
  const donde = a.enAsentamientoId ? `Parado en ${nombrePlaza(p, a.enAsentamientoId)}` : 'De camino a otra plaza';
  const propia = plazaPropia(p, a);
  let venta = '';
  if (propia) {
    const motivo = motivoCompra(p, propia);
    const reveladas = (p.tecnologia?.reveladas ?? []).filter((r) => precioDeAeda(p, cat, r.tecnologiaId) !== null);
    const oro = Math.floor(propia.dentro?.almacen?.['oro']?.cantidad ?? 0);
    if (reveladas.length === 0) venta = '<p class="asent-lado-nota">Ha revelado a tu Facción todo lo que sabe que os falta; no tiene nada más que venderos.</p>';
    else if (motivo) venta = `<p class="asent-lado-nota">Os vende ${reveladas.length === 1 ? 'una tecnología revelada' : `${reveladas.length} tecnologías reveladas`}. ${e(motivo)}</p>`;
    else venta = `<strong class="heroe-sub">Lo que te vende${ayuda('aeda:venta', 'Comprarla te salta el hito de tu Facción, no el logro del mundo; luego hay que adoptarla como cualquier otra. Paga el almacén de la plaza.')}</strong>
      <div class="mapa-lista">${reveladas.map((r) => {
        const precio = precioDeAeda(p, cat, r.tecnologiaId)!;
        return `<div class="aeda-venta"><span>${e(nombreDeTecnologia(cat, r.tecnologiaId))}</span><button class="btn-primary" type="button" data-comprar-aeda="${e(r.tecnologiaId)}" data-plaza="${e(propia.id)}"${oro < precio ? ' disabled title="El almacén de la plaza no tiene bastante oro"' : ''}>Comprar · ${precio.toLocaleString('es')} de oro</button></div>`;
      }).join('')}</div>
      <p class="asent-lado-nota">Almacén de la plaza: ${oro.toLocaleString('es')} de oro.</p>`;
  }
  const tiempo = !a.enAsentamientoId ? textoTiempoHasta(p, a.posicion) : null;
  return `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">Aeda itinerante</span>
    <h3>📜 ${e(nombreDeAeda(a.id))}</h3>
    <div class="mapa-seleccion-datos"><div><span>Dónde</span><strong>${e(donde)}</strong></div>${d !== null ? `<div><span>Distancia a tu columna</span><strong>${d}</strong></div>` : ''}${tiempo ? `<div><span>Tiempo hasta allí</span><strong>${e(tiempo)}</strong></div>` : ''}</div>
    <p class="asent-lado-nota">Va de plaza en plaza cantando lo que se descubre en el mundo${estancia ? ` y se queda ${e(textoEnTiempoReal(estancia * 60_000))} en cada una` : ''}. Al pararse en una plaza le revela a su Facción las tecnologías que conoce y le faltan, y se las vende. No se le puede atacar ni capturar.${ayuda('aeda:itinerante', 'Una plaza puede cerrarle la puerta (Centro urbano → Puerta, grupo «Aedas»): entonces no se para en ella. Lo que ya reveló queda revelado.')}</p>
    ${venta}
    <p class="faction-error" id="mapa-seleccion-error" role="alert"></p>`;
}

export const FICHA_AEDA: FichaMapaExtra = {
  tipo: 'aeda',
  buscar: (p, id) => (p.aedasAvistados ?? []).find((x) => x.id === id),
  html: (p, a: AedaAvistado, c) => htmlFichaAeda(p, a, c.escapar),
  cablear: (cont, _p, _a: AedaAvistado, c) => {
    cont.querySelectorAll<HTMLButtonElement>('[data-comprar-aeda]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const error = await c.ejecutar('comprarTecnologiaAeda', { asentamientoId: b.dataset.plaza, tecnologiaId: b.dataset.comprarAeda });
      b.disabled = false;
      const campo = cont.querySelector<HTMLElement>('#mapa-seleccion-error');
      if (campo) campo.textContent = error ?? '';
      if (!error) c.aviso('Compra hecha: la tecnología ya es de tu Facción. Adóptala en Facción → Tecnología.');
    }));
  },
};

// --- Avisos ---------------------------------------------------------------------------------------------------------------------------------

/** El texto de un hecho de los Aedas para tu Facción, o `null` si no le toca. `importante`: hace toast y sale arriba (una tecnología que
 * aparece, una épica perdida). `aedas.canta_descubrimiento` no es aviso: es de la crónica. */
export function textoDeHechoAeda(e: EventoDominio, p: ProyeccionJugador | null): { texto: string; titulo: string; importante: boolean } | null {
  if (!p?.faccionId) return null;
  const d = (e.payload ?? {}) as { faccionId?: string; descubridoraId?: string; tecnologia?: string; aedaId?: string; aedaResidenteId?: string; precio?: number; cupo?: number; capitulo?: number; capitulos?: number; motivo?: string; plazaId?: string };
  if (d.faccionId !== p.faccionId) return null;
  const cat = catalogoDeTecnologia();
  const tec = d.tecnologia ? `«${nombreDeTecnologia(cat, d.tecnologia)}»` : 'una tecnología';
  const plaza = nombrePlaza(p, e.asentamientoId ?? d.plazaId);
  const residente = (p.aedasResidentes ?? []).find((a) => a.id === d.aedaResidenteId)?.nombre ?? 'Un Aeda';
  switch (e.codigo) {
    case 'aedas.revela':
      return { titulo: 'Aedas', importante: false, texto: `${d.aedaId ? nombreDeAeda(d.aedaId) : 'Un Aeda itinerante'} canta en ${plaza} ${tec}, que descubrió ${nombreFaccion(p, d.descubridoraId)}. Os falta su hito; mientras siga allí os la vende.` };
    case 'aedas.venta':
      return { titulo: 'Aedas', importante: true, texto: `${plaza} le compra ${tec} a ${d.aedaId ? nombreDeAeda(d.aedaId) : 'un Aeda'}${d.precio ? ` por ${d.precio.toLocaleString('es')} de oro` : ''}: ya es de tu Facción, falta adoptarla.` };
    case 'aedas.residente_llega':
      return { titulo: 'Aedas', importante: false, texto: `${residente} se queda a vivir en ${plaza}: un Aeda residente que puede cantar una épica.` };
    case 'aedas.residente_se_va':
      return { titulo: 'Aedas', importante: true, texto: `Un Aeda residente se va de ${plaza}: ya no hay sitio para él${d.cupo !== undefined ? ` (caben ${d.cupo})` : ''}.` };
    case 'aedas.epica_empieza':
      return { titulo: 'Épica', importante: false, texto: `${residente} empieza en ${plaza} la épica de ${tec}${d.capitulos ? ` (${d.capitulos} capítulos)` : ''}.` };
    case 'aedas.epica_capitulo':
      return { titulo: 'Épica', importante: false, texto: `${residente} cierra en ${plaza} el capítulo ${d.capitulo ?? '?'}${d.capitulos ? ` de ${d.capitulos}` : ''} de la épica de ${tec}.` };
    case 'aedas.epica_tecnologia':
      return { titulo: 'Épica cumplida', importante: true, texto: `${residente} termina en ${plaza} la épica de ${tec}: la tecnología ya es de tu Facción, falta adoptarla.` };
    case 'aedas.epica_abandonada': {
      const por = d.motivo === 'conquista' ? `porque ${plaza} cayó en otras manos` : d.motivo === 'aparecida' ? 'porque la tecnología os llegó por otra vía'
        : d.motivo === 'unificada' ? 'porque otro Aeda de tu Facción ya la canta' : 'por orden de la plaza';
      return { titulo: 'Épica', importante: d.motivo === 'conquista', texto: `Se abandona la épica de ${tec} ${por}; lo avanzado se pierde.` };
    }
  }
  return null;
}

// --- Modo mapa ------------------------------------------------------------------------------------------------------------------------------

/** Una lira de `lado` px centrada en (x, y): dos brazos curvos, el yugo y tres cuerdas, con halo oscuro. */
function lira(ctx: CanvasRenderingContext2D, x: number, y: number, lado: number, color: string): void {
  const s = lado / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  const trazo = (): void => {
    ctx.beginPath();
    // los brazos se abren desde la caja y se curvan hacia fuera arriba, como cuernos
    ctx.moveTo(-0.3 * s, 0.75 * s); ctx.bezierCurveTo(-1.0 * s, 0.4 * s, -0.25 * s, -0.4 * s, -0.75 * s, -0.95 * s);
    ctx.moveTo(0.3 * s, 0.75 * s); ctx.bezierCurveTo(1.0 * s, 0.4 * s, 0.25 * s, -0.4 * s, 0.75 * s, -0.95 * s);
    ctx.moveTo(-0.62 * s, -0.6 * s); ctx.lineTo(0.62 * s, -0.6 * s);
    ctx.moveTo(-0.42 * s, 0.85 * s); ctx.lineTo(0.42 * s, 0.85 * s);
    for (const cx of [-0.2, 0, 0.2]) { ctx.moveTo(cx * s, -0.6 * s); ctx.lineTo(cx * s, 0.8 * s); }
  };
  trazo(); ctx.strokeStyle = '#1b1a17'; ctx.lineWidth = Math.max(2.5, s * 0.45); ctx.stroke();
  trazo(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.2, s * 0.2); ctx.stroke();
  ctx.restore();
}

/** Los Aedas que se ven, en el modo mapa: el que va de camino, una lira donde está; el parado en una plaza, una lira pequeña a su lado. */
export function dibujarAedasEnMapa(ctx: CanvasRenderingContext2D, p: ProyeccionJugador, escala: number, k: number): void {
  for (const a of p.aedasAvistados ?? []) {
    const x = a.posicion.x * escala, y = a.posicion.y * escala;
    if (a.enAsentamientoId) lira(ctx, x + 15 * k, y - 15 * k, 13 * k, COLOR_AEDA);
    else lira(ctx, x, y, 17 * k, COLOR_AEDA);
  }
}
