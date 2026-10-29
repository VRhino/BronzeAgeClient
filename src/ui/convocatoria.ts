// EJÉRCITO EN PREPARACIÓN (backend 2026-10-08, Doc 5.14.5): una convocatoria DENTRO de una plaza o de un campamento. Un héroe con Facción convoca; los de su
// Facción que están en ese mismo lugar se unen eligiendo su tropa «como siempre» al salir; espera INDEFINIDAMENTE a que el Líder pulse «Salir con el ejército»
// (`partirConvocatoria`: salen todos juntos como un único ejército, quieto en la puerta) o «Cancelar» (`cancelarConvocatoria`: nadie se mueve). Un integrante
// puede separarse mientras tanto (`separarseDeConvocatoria`). Con política «decide el Líder» el Líder contesta las peticiones
// (`responderPeticionDeConvocatoria`). Aquí no se decide ninguna regla: el backend valida todo y su motivo se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Convocatoria } from '../tiposDominio';
import { ayuda } from './ayuda';
import { esPeticionNueva, POLITICA } from './ejercitos';
import { chipLiderazgo } from './liderazgo';
import { textoEnTiempoReal } from './estadoCliente';
import { nombreDeHeroe } from './nombres';
import type { Ejecutar } from './panelCarro';
import { cablearCargaDeSalida, htmlCargaDeSalida, leerCarga } from './cargaDeSalida';
import { iconoTropa } from './iconosTropa';

type Escapar = (valor: string) => string;

/** La convocatoria en la que estás, si estás en una. */
export function miConvocatoria(p: ProyeccionJugador): Convocatoria | undefined {
  return p.miConvocatoriaId ? (p.convocatorias ?? []).find((c) => c.id === p.miConvocatoriaId) : undefined;
}

const hombres = (c: Convocatoria['integrantes'][number]): number => c.tropas.reduce((s, t) => s + t.cantidad, 0);

/** Los cambios que llevas hechos en TU selección y aún no has guardado (ids en orden de combate), de esa convocatoria; `null` = lo guardado. Vive entre repintados. */
let borrador: { convocatoriaId: string; ids: string[] } | null = null;


/** ¿Resides en el lugar de la convocatoria? Solo entonces eliges tropa; quien visita sale con su columna aparcada y su selección no cuenta. */
function resideEnElLugar(p: ProyeccionJugador, c: Convocatoria): boolean {
  if (c.lugar.tipo === 'campamento') return p.campamentosMercenarios.find((x) => x.id === c.lugar.id)?.residentesIds.includes(p.heroeId) ?? false;
  const a = p.asentamientos.find((x) => x.id === c.lugar.id);
  return Boolean(a && [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId));
}

/** La carga que llevas sin guardar aún, de esa convocatoria; `null` = la guardada. Vive entre repintados (el almacén cambia con el sondeo). */
let borradorCarga: { convocatoriaId: string; carga: Record<string, number> } | null = null;

/** De dónde sale la carga: el almacén de la plaza o, en un campamento, tu almacén personal (como al salir solo). */
function almacenDelLugar(p: ProyeccionJugador, c: Convocatoria): { disponible: Record<string, number>; de: string } {
  if (c.lugar.tipo === 'campamento') return { disponible: p.heroe.almacenPersonal ?? {}, de: 'tu almacén personal' };
  const a = p.asentamientos.find((x) => x.id === c.lugar.id);
  return { disponible: Object.fromEntries(Object.entries(a?.almacen ?? {}).map(([r, v]) => [r, v.cantidad])), de: 'el almacén de la plaza' };
}

/** TU carga: qué metes en el carro al partir (`cambiarSeleccionDeConvocatoria.carga`), con su botón de guardar. */
function htmlMiCarga(p: ProyeccionJugador, c: Convocatoria, e: Escapar): string {
  const mio = c.integrantes.find((x) => x.heroeId === p.heroeId);
  if (!mio || !resideEnElLugar(p, c)) return '';
  const { disponible, de } = almacenDelLugar(p, c);
  const valores = borradorCarga?.convocatoriaId === c.id ? borradorCarga.carga : mio.carga;
  const cambiado = borradorCarga?.convocatoriaId === c.id && !mismaCarga(borradorCarga.carga, mio.carga);
  return `<div data-conv-carga>${htmlCargaDeSalida(disponible, de, e, p.heroe.carro, valores)}</div>
    <div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-conv="guardar-carga"${cambiado ? '' : ' disabled'}>Guardar carga</button><button class="btn-secondary" type="button" data-conv="descartar-carga"${cambiado ? '' : ' disabled'}>Descartar</button></div>`;
}

function mismaCarga(a: Record<string, number>, b: Record<string, number>): boolean {
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...claves].every((r) => Math.floor(a[r] ?? 0) === Math.floor(b[r] ?? 0));
}

/** Si la lista para añadir escuadras (el «+») está abierta. Vive entre repintados. */
let eligiendo = false;

/**
 * TU tropa, en los espacios de la ventana de salida: la que sale, en el orden en que entra en combate (‹ › la mueven), con ✕ para quitar y «+» para
 * añadir (`cambiarSeleccionDeConvocatoria`). Los cambios se aplican al guardar.
 */
function htmlMiTropa(p: ProyeccionJugador, c: Convocatoria, e: Escapar): string {
  const mio = c.integrantes.find((x) => x.heroeId === p.heroeId);
  if (!mio) return '';
  if (!resideEnElLugar(p, c)) return `<p class="asent-lado-nota">No resides aquí.${ayuda('convocatoria:visita', 'Sales de visita, con tu columna aparcada en la puerta, y tu selección no cuenta.')}</p>`;
  const guardados = mio.escuadronIds;
  const ids = borrador?.convocatoriaId === c.id ? borrador.ids : guardados;
  const propias = p.heroe.escuadrones;
  const candidatas = propias.filter((s) => ids.includes(s.id) || (s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0));
  const elegidas = ids.map((id) => candidatas.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => s !== undefined);
  const libres = candidatas.filter((s) => !ids.includes(s.id));
  const cambiado = ids.length !== guardados.length || ids.some((id, i) => id !== guardados[i]);
  const usado = elegidas.reduce((t, s) => t + s.costeLiderazgo, 0);
  const libre = p.heroe.liderazgoBase - usado;
  const caben = libres.filter((s) => s.costeLiderazgo <= libre);
  const espacios = Math.max(ESPACIOS, elegidas.length + (caben.length > 0 ? 1 : 0));
  const hueco = (s: (typeof propias)[number], pos: number): string => `<div class="salida-hueco lleno" title="${e(`Puesto ${pos + 1} · ${s.nombre} · ${s.cantidad} hombres · nivel ${s.nivel} · moral ${Math.round(s.moral)}`)}">
      <span class="salida-hueco-icono">${iconoTropa(s.tropaId, 34)}</span>
      <span class="salida-hueco-nombre">${pos + 1}. ${e(s.nombre)}</span>
      <small>${s.cantidad} hombres ${chipLiderazgo(s)}</small>
      <span class="salida-hueco-mover"><button type="button" data-conv-mover="${e(s.id)}" data-dir="-1"${pos === 0 ? ' disabled' : ''} aria-label="Antes">‹</button><button type="button" data-conv-mover="${e(s.id)}" data-dir="1"${pos === elegidas.length - 1 ? ' disabled' : ''} aria-label="Después">›</button></span>
      <button class="salida-hueco-quitar" type="button" data-conv-quitar="${e(s.id)}" title="Quitar" aria-label="Quitar ${e(s.nombre)}">✕</button>
    </div>`;
  const huecos = Array.from({ length: espacios }, (_, i) => {
    const s = elegidas[i];
    if (s) return hueco(s, i);
    if (i === elegidas.length && libres.length > 0) return `<button class="salida-hueco mas${eligiendo ? ' activo' : ''}" type="button" data-conv-mas title="Añadir una escuadra" aria-label="Añadir una escuadra">+</button>`;
    return '<div class="salida-hueco vacio"></div>';
  }).join('');
  const lista = eligiendo && libres.length > 0
    ? `<div class="salida-elegir">${libres.map((s) => {
      const cabe = s.costeLiderazgo <= libre;
      return `<button class="salida-candidata" type="button" data-conv-anadir="${e(s.id)}"${cabe ? '' : ` disabled title="No cabe: te quedan ${Math.max(0, libre)} de Liderazgo"`}>${iconoTropa(s.tropaId, 26)}<span><strong>${e(s.nombre)}</strong><small>${s.cantidad} hombres · ${s.costeLiderazgo} de Liderazgo</small></span></button>`;
    }).join('')}</div>`
    : '';
  return `<div class="salida-tropa-cab">
      <strong class="heroe-sub">Tu tropa${ayuda('convocatoria:tropa', 'La primera entra primero en combate: muévela con ‹ ›. Quita con ✕ o añade con «+»; los cambios se aplican al pulsar «Guardar cambios».')}</strong>
      <span class="salida-liderazgo${libre < 0 ? ' excedido' : ''}">Liderazgo ${usado} / ${p.heroe.liderazgoBase}</span>
      <span class="salida-loadout"><button class="btn-secondary salida-guardar" type="button" data-conv="guardar-tropa"${cambiado && elegidas.length > 0 ? '' : ' disabled'}>Guardar cambios</button><button class="btn-secondary salida-guardar" type="button" data-conv="descartar-tropa"${cambiado ? '' : ' disabled'}>Descartar</button></span>
    </div>
    <div class="salida-huecos">${huecos}</div>
    ${lista}
    ${elegidas.length === 0 ? '<p class="asent-lado-nota">Sin ninguna escuadra no sales. Añade al menos una.</p>' : ''}`;
}

/** Las Caravanas de Fundación de tu Facción que esperan dentro del lugar de la convocatoria (motor d8ef09c): el Líder puede llevársela al partir. */
function caravanasQueEsperan(p: ProyeccionJugador, c: Convocatoria): { id: string; contenido: string }[] {
  return (p.caravanas ?? [])
    .filter((x) => x.tipo === 'construccion' && x.estado === 'disponible' && (c.lugar.tipo === 'campamento' ? x.origenCampamentoId === c.lugar.id : x.origenAsentamientoId === c.lugar.id))
    .map((x) => ({ id: x.id, contenido: Object.entries(x.contenido ?? {}).filter(([, n]) => n > 0).map(([r, n]) => `${Math.floor(n)} ${r}`).join(', ') }));
}

/** Qué Caravana de Fundación eligió llevarse el Líder ('' = ninguna), por convocatoria. Vive entre repintados. */
const caravanaElegida = new Map<string, string>();

/** La pregunta al Líder: si hay una Caravana de Fundación esperando aquí, ¿se la lleva el ejército? */
function htmlPreguntaCaravana(p: ProyeccionJugador, c: Convocatoria, e: Escapar): string {
  const esperan = caravanasQueEsperan(p, c);
  if (!c.soyLider || esperan.length === 0) return '';
  const elegida = caravanaElegida.get(c.id) ?? '';
  const opcion = (id: string, texto: string): string => `<label class="conv-caravana"><input type="radio" name="conv-caravana" value="${e(id)}"${id === elegida ? ' checked' : ''} /> ${texto}</label>`;
  return `<strong class="heroe-sub">¿Os lleváis la Caravana de Fundación?${ayuda('convocatoria:caravana', 'Espera aquí dentro. Si el ejército se la lleva, va enganchada detrás y, si su titular no sale con vosotros, pasas a serlo tú.')}</strong>
    <div class="conv-caravanas">${opcion('', 'No, se queda aquí')}${esperan.map((x) => opcion(x.id, `Sí, llevar ${e(x.id)}${x.contenido ? ` <small>(${e(x.contenido)})</small>` : ''}`)).join('')}</div>`;
}

/** Espacios de tropa a la vista, como en la ventana de salida. */
const ESPACIOS = 5;

/** Un integrante: su nombre y, debajo, los iconos de la tropa que lleva. */
function htmlIntegrante(p: ProyeccionJugador, c: Convocatoria, x: Convocatoria['integrantes'][number], e: Escapar): string {
  const papel = [x.heroeId === c.liderId ? 'Líder' : '', x.heroeId === p.heroeId ? 'tú' : ''].filter(Boolean).join(' · ');
  const iconos = x.tropas.map((t) => `<span class="conv-integrante-tropa" title="${e(`${t.nombre} · nivel ${t.nivel} · moral ${Math.round(t.moral)} · ${t.cantidad} hombres`)}">${iconoTropa(t.tropaId, 26)}</span>`).join('');
  // De las escuadras ajenas el motor solo manda el id: un hueco sin icono por cada una que no se conoce.
  const desconocidas = '<span class="conv-integrante-tropa desconocida" title="Escuadra de otro héroe: el motor no dice de qué tropa es"></span>'.repeat(Math.max(0, x.escuadronIds.length - x.tropas.length));
  return `<li class="conv-integrante"><div class="conv-integrante-cab"><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong>${papel ? ` <em>${papel}</em>` : ''}<span>${x.escuadronIds.length} escuadra(s)${x.tropas.length > 0 ? ` · ${hombres(x)} hombres` : ''}</span></div>
    <div class="conv-integrante-tropas">${iconos + desconocidas || '<small>Sin tropa</small>'}</div></li>`;
}

/**
 * Tu convocatoria repartida como la ventana de salida (vacía si no estás en ninguna): a la izquierda quiénes van (nombre e iconos de su tropa), las
 * peticiones y la Caravana; a la derecha tu carro; abajo tu tropa en espacios y los botones que le tocan a tu papel.
 */
export function htmlPreparacion(p: ProyeccionJugador, e: Escapar): { izquierda: string; derecha: string; pie: string } | null {
  const c = miConvocatoria(p);
  if (!c) return null;
  const peticiones = c.soyLider ? c.peticiones.filter((x) => x.expiraEn > p.instante) : [];
  const izquierda = `<span class="faction-kicker">Ejército en preparación</span>
    <p class="asent-lado-nota">${c.soyLider ? 'Tú lo diriges.' : `Lo dirige ${e(nombreDeHeroe(p, c.liderId))}.`} ${e(POLITICA[c.politicaDeUnion])}.${ayuda('convocatoria:espera', 'Seguís dentro: nada se mueve hasta que el Líder pulse «Salir con el ejército» o cancele. Espera sin límite de tiempo.')}</p>
    <strong class="heroe-sub">Integrantes</strong>
    <ul class="conv-integrantes">${c.integrantes.map((x) => htmlIntegrante(p, c, x, e)).join('')}</ul>
    ${peticiones.length > 0 ? `<strong class="heroe-sub">Piden unirse</strong>${peticiones.map((x) => `<div class="ejercito-fila"><div><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong><span>${e(textoEnTiempoReal(x.expiraEn - p.instante))} para contestar · ${x.escuadronIds.length} escuadra(s)</span></div>
        <button class="btn-primary" type="button" data-conv-peticion="${e(x.heroeId)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-conv-peticion="${e(x.heroeId)}" data-aceptar="no">Rechazar</button></div>`).join('')}` : ''}
    ${htmlPreguntaCaravana(p, c, e)}`;
  const derecha = htmlMiCarga(p, c, e) || '<p class="asent-lado-nota">No resides aquí: sales con el carro de tu columna, tal cual.</p>';
  const pie = `${htmlMiTropa(p, c, e)}
    <div class="salida-acciones"><p class="faction-error" data-campo="error-conv" role="alert"></p>${c.soyLider
      ? '<button class="btn-secondary" type="button" data-conv="cancelar">Cancelar la salida</button><button class="btn-primary" type="button" data-conv="partir">Salir con el ejército</button>'
      : '<button class="btn-primary" type="button" data-conv="separarme">Separarme (sigues dentro)</button>'}</div>`;
  return { izquierda, derecha, pie };
}

export function cablearPreparacion(raiz: ParentNode, p: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void, repintar: () => void): void {
  const c = miConvocatoria(p);
  if (!c) return;
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-conv"]');
  const enviar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    if (mensaje) { boton.disabled = false; if (error) error.textContent = mensaje; else avisar(mensaje); }
  };
  const mio = c.integrantes.find((x) => x.heroeId === p.heroeId);
  const idsActuales = (): string[] => (borrador?.convocatoriaId === c.id ? borrador.ids : mio?.escuadronIds ?? []);
  const cambiarBorrador = (ids: string[]): void => { borrador = { convocatoriaId: c.id, ids }; repintar(); };
  raiz.querySelectorAll<HTMLButtonElement>('[data-conv-quitar]').forEach((b) => b.addEventListener('click', () => cambiarBorrador(idsActuales().filter((x) => x !== b.dataset.convQuitar))));
  raiz.querySelector<HTMLButtonElement>('[data-conv-mas]')?.addEventListener('click', () => { eligiendo = !eligiendo; repintar(); });
  raiz.querySelectorAll<HTMLButtonElement>('[data-conv-anadir]').forEach((b) => b.addEventListener('click', () => { eligiendo = false; cambiarBorrador([...idsActuales(), b.dataset.convAnadir!]); }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-conv-mover]').forEach((b) => b.addEventListener('click', () => {
    const ids = [...idsActuales()];
    const i = ids.indexOf(b.dataset.convMover!);
    const j = i + Number(b.dataset.dir);
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    cambiarBorrador(ids);
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-conv]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.conv === 'descartar-tropa') { borrador = null; repintar(); return; }
    if (b.dataset.conv === 'guardar-tropa') {
      b.disabled = true;
      const mensaje = await ejecutar('cambiarSeleccionDeConvocatoria', { heroeId: p.heroeId, escuadronIds: idsActuales(), carga: mio?.carga ?? {} });
      if (mensaje) { b.disabled = false; if (error) error.textContent = mensaje; else avisar(mensaje); } else borrador = null;
      return;
    }
    if (b.dataset.conv === 'descartar-carga') { borradorCarga = null; repintar(); return; }
    if (b.dataset.conv === 'guardar-carga') {
      // La tropa que se manda es la guardada: la carga se guarda aparte de los cambios de tropa sin guardar.
      b.disabled = true;
      const carga = borradorCarga?.convocatoriaId === c.id ? borradorCarga.carga : mio?.carga ?? {};
      const mensaje = await ejecutar('cambiarSeleccionDeConvocatoria', { heroeId: p.heroeId, escuadronIds: mio?.escuadronIds ?? [], carga });
      if (mensaje) { b.disabled = false; if (error) error.textContent = mensaje; else avisar(mensaje); } else borradorCarga = null;
      return;
    }
    const tipo = { partir: 'partirConvocatoria', cancelar: 'cancelarConvocatoria', separarme: 'separarseDeConvocatoria' }[b.dataset.conv!];
    // Al partir, la Caravana de Fundación elegida (si aún espera aquí) se engancha al ejército.
    const caravana = caravanaElegida.get(c.id);
    const conCaravana = b.dataset.conv === 'partir' && caravana && caravanasQueEsperan(p, c).some((x) => x.id === caravana) ? { caravanaFundacionId: caravana } : {};
    if (tipo) void enviar(b, tipo, { heroeId: p.heroeId, ...conCaravana });
  }));
  const bloqueCarga = raiz.querySelector<HTMLElement>('[data-conv-carga]');
  if (bloqueCarga) {
    cablearCargaDeSalida(bloqueCarga);
    // Cada cambio va al borrador; se repinta al soltar (change) para que se activen «Guardar carga» y «Descartar».
    const alCambiar = (): void => { borradorCarga = { convocatoriaId: c.id, carga: leerCarga(bloqueCarga) }; repintar(); };
    bloqueCarga.querySelectorAll<HTMLInputElement>('input[data-carga]').forEach((i) => i.addEventListener('change', alCambiar));
    bloqueCarga.querySelectorAll<HTMLButtonElement>('[data-carga-todo]').forEach((b) => b.addEventListener('click', alCambiar));
  }
  raiz.querySelectorAll<HTMLInputElement>('input[name="conv-caravana"]').forEach((i) => i.addEventListener('change', () => { caravanaElegida.set(c.id, i.value); repintar(); }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-conv-peticion]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'responderPeticionDeConvocatoria', { heroeId: p.heroeId, convocatoriaId: c.id, solicitanteId: b.dataset.convPeticion, aceptar: b.dataset.aceptar === 'si' })));
}

/** Las convocatorias abiertas de este lugar a las que puedes unirte (todas menos la tuya), con su botón. La tropa y la carga las pone el formulario de salida. */
export function htmlConvocatoriasAbiertas(p: ProyeccionJugador, e: Escapar): string {
  const abiertas = (p.convocatorias ?? []).filter((c) => c.id !== p.miConvocatoriaId);
  if (abiertas.length === 0) return '<p class="asent-lado-nota">Nadie de tu Facción está preparando un ejército aquí. Puedes convocar uno tú.</p>';
  return abiertas.map((c) => {
    const mia = c.peticiones.find((x) => x.heroeId === p.heroeId && x.expiraEn > p.instante);
    return `<div class="ejercito-fila"><div><strong>Ejército de ${e(nombreDeHeroe(p, c.liderId))}</strong>
        <span>${c.integrantes.length} héroe(s) · ${e(POLITICA[c.politicaDeUnion])}</span></div>
      <button class="btn-primary" type="button" data-unirse-conv="${e(c.id)}"${mia ? ' disabled' : ''}>${mia ? 'Petición enviada' : c.politicaDeUnion === 'preguntar' ? 'Pedir unirme' : 'Unirme'}</button></div>`;
  }).join('');
}

/** Las peticiones vivas a TU convocatoria que aún no avisaste, por sondeo (respaldo del evento `convocatoria.union_pedida`). */
export function peticionesNuevasConv(p: ProyeccionJugador): { heroeId: string; expiraEn: number }[] {
  const c = miConvocatoria(p);
  if (!c?.soyLider) return [];
  return c.peticiones.filter((x) => x.expiraEn > p.instante && esPeticionNueva(x.heroeId, x.expiraEn));
}
