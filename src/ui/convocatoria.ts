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

type Escapar = (valor: string) => string;

/** La convocatoria en la que estás, si estás en una. */
export function miConvocatoria(p: ProyeccionJugador): Convocatoria | undefined {
  return p.miConvocatoriaId ? (p.convocatorias ?? []).find((c) => c.id === p.miConvocatoriaId) : undefined;
}

const hombres = (c: Convocatoria['integrantes'][number]): number => c.tropas.reduce((s, t) => s + t.cantidad, 0);

/** Los cambios que llevas hechos en TU selección y aún no has guardado (ids en orden de combate), de esa convocatoria; `null` = lo guardado. Vive entre repintados. */
let borrador: { convocatoriaId: string; ids: string[] } | null = null;

const filaDeTropa = (t: Convocatoria['integrantes'][number]['tropas'][number], e: Escapar): string =>
  `<li>${e(t.nombre)} · nivel ${t.nivel} · moral ${Math.round(t.moral)} · ${t.cantidad} hombres</li>`;

/** ¿Resides en el lugar de la convocatoria? Solo entonces eliges tropa; quien visita sale con su columna aparcada y su selección no cuenta. */
function resideEnElLugar(p: ProyeccionJugador, c: Convocatoria): boolean {
  if (c.lugar.tipo === 'campamento') return p.campamentosMercenarios.find((x) => x.id === c.lugar.id)?.residentesIds.includes(p.heroeId) ?? false;
  const a = p.asentamientos.find((x) => x.id === c.lugar.id);
  return Boolean(a && [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId));
}

/** TU tropa: la que sale, en el orden en que entra en combate, con casillas y flechas para cambiarla (`cambiarSeleccionDeConvocatoria`). Solo la tuya. */
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
  const fila = (s: (typeof propias)[number], pos: number | null): string => `<div class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${pos === null ? 'no sale' : `va en el puesto ${pos + 1}`} · nivel ${s.nivel} · moral ${Math.round(s.moral)} · ${s.cantidad} hombres</span></div>
      <input type="checkbox" data-conv-sel="${e(s.id)}"${pos === null ? '' : ' checked'} aria-label="Sale con el ejército" />
      ${pos === null ? '' : `<button class="btn-secondary" type="button" data-conv-mover="${e(s.id)}" data-dir="-1"${pos === 0 ? ' disabled' : ''} aria-label="Subir">↑</button><button class="btn-secondary" type="button" data-conv-mover="${e(s.id)}" data-dir="1"${pos === elegidas.length - 1 ? ' disabled' : ''} aria-label="Bajar">↓</button>`}</div>`;
  return `<strong class="heroe-sub">Tu tropa${ayuda('convocatoria:tropa', 'La primera entra primero en combate. Marca las escuadras que salen y reordénalas con las flechas; los cambios se aplican al guardar.')}</strong>
    <div class="mapa-lista">${elegidas.map((s, i) => fila(s, i)).join('')}${libres.map((s) => fila(s, null)).join('')}</div>
    ${elegidas.length === 0 ? '<p class="asent-lado-nota">Sin ninguna escuadra no sales. Marca al menos una.</p>' : ''}
    <div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-conv="guardar-tropa"${cambiado && elegidas.length > 0 ? '' : ' disabled'}>Guardar cambios</button><button class="btn-secondary" type="button" data-conv="descartar-tropa"${cambiado ? '' : ' disabled'}>Descartar</button></div>`;
}

/** El panel de TU convocatoria (vacío si no estás en ninguna): quiénes van, las peticiones y los botones que le tocan a tu papel. */
export function htmlPreparacion(p: ProyeccionJugador, e: Escapar): string {
  const c = miConvocatoria(p);
  if (!c) return '';
  const peticiones = c.soyLider ? c.peticiones.filter((x) => x.expiraEn > p.instante) : [];
  return `<span class="faction-kicker">Ejército en preparación</span>
    <p class="asent-lado-nota">${c.soyLider ? 'Tú lo diriges.' : `Lo dirige ${e(nombreDeHeroe(p, c.liderId))}.`} ${e(POLITICA[c.politicaDeUnion])}.${ayuda('convocatoria:espera', 'Seguís dentro: nada se mueve hasta que el Líder pulse «Salir con el ejército» o cancele. Espera sin límite de tiempo.')}</p>
    <ul class="ejercito-lista">${c.integrantes.map((x) => `<li><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong>${x.heroeId === c.liderId ? ' <em>(Líder)</em>' : ''}${x.heroeId === p.heroeId ? ' · tú' : ''} — ${x.tropas.length} escuadra(s), ${hombres(x)} hombres${x.heroeId === p.heroeId ? '' : `<ul>${x.tropas.map((t) => filaDeTropa(t, e)).join('')}</ul>`}</li>`).join('')}</ul>
    ${htmlMiTropa(p, c, e)}
    ${peticiones.length > 0 ? `<strong class="heroe-sub">Piden unirse</strong>${peticiones.map((x) => `<div class="ejercito-fila"><div><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong><span>${e(textoEnTiempoReal(x.expiraEn - p.instante))} para contestar · ${x.escuadronIds.length} escuadra(s)</span></div>
        <button class="btn-primary" type="button" data-conv-peticion="${e(x.heroeId)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-conv-peticion="${e(x.heroeId)}" data-aceptar="no">Rechazar</button></div>`).join('')}` : ''}
    <div class="mapa-seleccion-acciones">${c.soyLider
      ? '<button class="btn-primary" type="button" data-conv="partir">Salir con el ejército</button><button class="btn-secondary" type="button" data-conv="cancelar">Cancelar la salida</button>'
      : '<button class="btn-secondary" type="button" data-conv="separarme">Separarme (sigues dentro)</button>'}</div>
    <p class="faction-error" data-campo="error-conv" role="alert"></p>`;
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
  raiz.querySelectorAll<HTMLInputElement>('[data-conv-sel]').forEach((i) => i.addEventListener('change', () => {
    const id = i.dataset.convSel!;
    cambiarBorrador(i.checked ? [...idsActuales(), id] : idsActuales().filter((x) => x !== id));
  }));
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
    const tipo = { partir: 'partirConvocatoria', cancelar: 'cancelarConvocatoria', separarme: 'separarseDeConvocatoria' }[b.dataset.conv!];
    if (tipo) void enviar(b, tipo, { heroeId: p.heroeId });
  }));
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
