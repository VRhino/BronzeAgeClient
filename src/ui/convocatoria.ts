// EJÉRCITO EN PREPARACIÓN (backend 2026-10-08, Doc 5.14.5): una convocatoria DENTRO de una plaza o de un campamento. Un héroe con Facción convoca; los de su
// Facción que están en ese mismo lugar se unen eligiendo su tropa «como siempre» al salir; espera INDEFINIDAMENTE a que el Líder pulse «Salir con el ejército»
// (`partirConvocatoria`: salen todos juntos como un único ejército, quieto en la puerta) o «Cancelar» (`cancelarConvocatoria`: nadie se mueve). Un integrante
// puede separarse mientras tanto (`separarseDeConvocatoria`). Con política «decide el Líder» el Líder contesta las peticiones
// (`responderPeticionDeConvocatoria`). Aquí no se decide ninguna regla: el backend valida todo y su motivo se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Convocatoria } from '../tiposDominio';
import { esPeticionNueva, POLITICA } from './ejercitos';
import { textoEnTiempoReal } from './estadoCliente';
import { nombreDeHeroe } from './nombres';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

/** La convocatoria en la que estás, si estás en una. */
export function miConvocatoria(p: ProyeccionJugador): Convocatoria | undefined {
  return p.miConvocatoriaId ? (p.convocatorias ?? []).find((c) => c.id === p.miConvocatoriaId) : undefined;
}

const hombres = (c: Convocatoria['integrantes'][number]): number => c.tropas.reduce((s, t) => s + t.cantidad, 0);

/** El panel de TU convocatoria (vacío si no estás en ninguna): quiénes van, las peticiones y los botones que le tocan a tu papel. */
export function htmlPreparacion(p: ProyeccionJugador, e: Escapar): string {
  const c = miConvocatoria(p);
  if (!c) return '';
  const peticiones = c.soyLider ? c.peticiones.filter((x) => x.expiraEn > p.instante) : [];
  return `<span class="faction-kicker">Ejército en preparación</span>
    <p class="asent-lado-nota">${c.soyLider ? 'Tú lo diriges.' : `Lo dirige ${e(nombreDeHeroe(p, c.liderId))}.`} ${e(POLITICA[c.politicaDeUnion])}. Seguís dentro: nada se mueve hasta que el Líder pulse «Salir con el ejército» o cancele. Espera sin límite de tiempo.</p>
    <ul class="ejercito-lista">${c.integrantes.map((x) => `<li>${e(nombreDeHeroe(p, x.heroeId))}${x.heroeId === c.liderId ? ' <em>(Líder)</em>' : ''}${x.heroeId === p.heroeId ? ' · tú' : ''} — ${x.tropas.length} escuadra(s), ${hombres(x)} hombres</li>`).join('')}</ul>
    ${peticiones.length > 0 ? `<strong class="heroe-sub">Piden unirse</strong>${peticiones.map((x) => `<div class="ejercito-fila"><div><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong><span>${e(textoEnTiempoReal(x.expiraEn - p.instante))} para contestar · ${x.escuadronIds.length} escuadra(s)</span></div>
        <button class="btn-primary" type="button" data-conv-peticion="${e(x.heroeId)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-conv-peticion="${e(x.heroeId)}" data-aceptar="no">Rechazar</button></div>`).join('')}` : ''}
    <div class="mapa-seleccion-acciones">${c.soyLider
      ? '<button class="btn-primary" type="button" data-conv="partir">Salir con el ejército</button><button class="btn-secondary" type="button" data-conv="cancelar">Cancelar la salida</button>'
      : '<button class="btn-secondary" type="button" data-conv="separarme">Separarme (sigues dentro)</button>'}</div>
    <p class="faction-error" data-campo="error-conv" role="alert"></p>`;
}

export function cablearPreparacion(raiz: ParentNode, p: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const c = miConvocatoria(p);
  if (!c) return;
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-conv"]');
  const enviar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    if (mensaje) { boton.disabled = false; if (error) error.textContent = mensaje; else avisar(mensaje); }
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-conv]').forEach((b) => b.addEventListener('click', () => {
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
