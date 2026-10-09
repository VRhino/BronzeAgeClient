// Interactuar en el mapa con lo AJENO que se ve (Doc 5.12.3, «la geometría ofrece, el jugador decide»): columnas (ejércitos y columnas personales) y
// caravanas avistadas, con la ficha pública de los héroes que van. Aquí no se decide ninguna regla: el backend valida y su rechazo se enseña tal cual.
// Esta ficha solo APAGA con su motivo lo que el canon no permite, para que el jugador no pulse a ciegas:
//   Inspeccionar   desde 40; el observado se entera. Vale entre cualquier clase de columna.
//   Atacar         a 15 (`radioEncuentro`); un ejército y una columna personal nunca combaten entre sí; ni a los tuyos ni a un aliado; sin herida.
//                  De una caravana se llama «Interceptar» y es el mismo comando `atacar`; si va adjunta a un ejército se ataca al ejército.
//   Perseguir      un ejército solo persigue a otro ejército; una columna personal, a otra o a una caravana suelta.
//   Dejar de perseguir   si ya vas tras esa presa.
// Lo que da `inspeccionar` (composición de la columna, o carga de la caravana) llega en los `datos` de la respuesta, no en la proyección: se guarda
// aquí, con su instante, mientras la ficha siga abierta.
import type { ProyeccionJugador } from '../apiCliente';
import { radioDeEncuentro, tropasReclutables } from '../apiCliente';
import { RADIO_PROTECCION_MERCENARIOS } from '../render';
import { RECURSO_NOMBRE } from '../paletas';
import type { CaravanaAvistada, EjercitoAvistado } from '../tiposDominio';
import { estadoCliente, textoEnTiempoReal } from './estadoCliente';
import { ejercitosDeLaFaccion, miColumna } from './ejercitos';
import type { FichaMapaExtra, ObjetoBajoElClic } from './ganchos';
import { nombreDeHeroe } from './nombres';
import { minutosHerido } from './panelHeroe';

type Escapar = (valor: string) => string;
type Punto = { x: number; y: number };

/** A cuánto se inspecciona (`MOVIMIENTO.radioInspeccion` del backend, que no lo publica en el balance). El que decide es el backend. */
const RADIO_INSPECCION = 40;

const distancia = (a: Punto, b: Punto): number => Math.hypot(a.x - b.x, a.y - b.y);
const clase = (tipo?: 'personal' | 'ejercito'): 'personal' | 'ejercito' => tipo ?? 'personal';
/** Una línea propia dentro de una fila de lista (los `span` de `.mapa-lista-item` van en línea). */
const linea = (texto: string): string => `<span style="display:block">${texto}</span>`;
const nombreTropa = (id: string): string => tropasReclutables()?.find((t) => t.id === id)?.nombre ?? id.replace(/_/g, ' ');

// --- Selector de clic ------------------------------------------------------------------------------------------------------------------------

/** Qué columna o caravana ajena hay bajo el clic. No manda marchar (sin `ir`): un clic para mirar no debe mover tu columna. Cede ante lo que ya
 * tiene prioridad (batallas, tus ejércitos); las formaciones siguen por su propia ficha. */
export function seleccionarAjeno(p: ProyeccionJugador, punto: Punto): ObjetoBajoElClic | null {
  if ((p.batallas ?? []).some((b) => distancia(b.punto, punto) < 20)) return null;
  if (ejercitosDeLaFaccion(p).some((x) => !x.formacion && distancia(x.posicionActual, punto) < 20)) return null;
  const candidatos = [
    ...(p.ejercitosAvistados ?? []).filter((x) => !x.enFormacion).map((x) => ({ tipo: 'ejercitoAjeno', id: x.id, d: distancia(x.posicionActual, punto), radio: 20 })),
    ...(p.caravanasAvistadas ?? []).map((c) => ({ tipo: 'caravanaAjena', id: c.id, d: distancia(c.posicionActual, punto), radio: 15 })),
  ].filter((c) => c.d < c.radio).sort((a, b) => a.d - b.d);
  return candidatos[0] ? { tipo: candidatos[0].tipo, id: candidatos[0].id } : null;
}

// --- Qué se puede hacer ----------------------------------------------------------------------------------------------------------------------

type Accion = 'inspeccionar' | 'perseguir' | 'atacar' | 'soltar';
interface Estado { accion: Accion; etiqueta: string; motivo: string }

interface Objetivo {
  tipo: 'ejercito' | 'caravana';
  id: string;
  posicion: Punto;
  faccionId?: string;
  /** Solo columnas. */
  clase?: 'personal' | 'ejercito';
  heroeIds?: string[];
  /** Solo caravanas: va adjunta a un ejército. */
  escoltada?: boolean;
  recursos?: string[];
  teSigue?: boolean;
}

function aliada(p: ProyeccionJugador, faccionId?: string): boolean {
  return faccionId !== undefined && (p.relaciones ?? []).some((r) => r.estado === 'activa' && r.tipo === 'alianza'
    && ((r.faccionAId === faccionId && r.faccionBId === p.faccionId) || (r.faccionBId === faccionId && r.faccionAId === p.faccionId)));
}

/** Un héroe ajeno herido no se persigue ni se ataca; una columna con todos sus héroes (a la vista) heridos es intocable (Doc 5.16.4). */
const heridoAhora = (p: ProyeccionJugador, id: string): boolean => {
  const h = p.heroesVisibles.find((x) => x.heroeId === id);
  return h?.heridoHasta !== undefined && h.heridoHasta > p.instante;
};

function estados(p: ProyeccionJugador, o: Objetivo): Estado[] {
  const mi = miColumna(p);
  const d = mi ? distancia(mi.posicionActual, o.posicion) : null;
  const encuentro = radioDeEncuentro();
  const herido = minutosHerido(p);
  const esCaravana = o.tipo === 'caravana';

  const inspeccionar = !mi ? 'Sal al mundo con tu columna para mirar de cerca.'
    : d! > RADIO_INSPECCION ? `Acércate: estás a ${Math.round(d!)} y se inspecciona a ${RADIO_INSPECCION}. El observado recibe un aviso.` : '';

  // Lo común a perseguir y atacar.
  const hostil = !mi ? 'Sal al mundo con tu columna.'
    : herido !== null ? `Estás herido (${herido} min): no atacas ni persigues.`
      : o.faccionId === p.faccionId && p.faccionId ? 'No se ataca a los tuyos.'
        : aliada(p, o.faccionId) ? 'No se ataca a un aliado.'
          : !esCaravana && clase(mi.tipo) !== clase(o.clase) ? 'Un ejército y una columna personal no combaten entre sí: solo se pueden inspeccionar.'
            : !esCaravana && (o.heroeIds ?? []).length > 0 && (o.heroeIds ?? []).every((id) => heridoAhora(p, id)) ? 'Solo lleva héroes heridos: no se la puede tocar.'
              : '';

  const persigue = hostil
    || (mi!.formacion ? 'Tu formación espera a ser ejército: no se mueve.'
      : esCaravana && clase(mi!.tipo) === 'ejercito' ? 'Un ejército solo persigue a otro ejército.'
        : esCaravana && o.escoltada ? 'Va adjunta a un ejército: se persigue al ejército.' : '');

  const sinSoldados = mi !== undefined && mi.participantes.length === 1
    && !p.heroe.escuadrones.some((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === mi.id && s.cantidad > 0);
  const protegido = mi && (p.campamentosMercenarios ?? []).find((c) => distancia(c.posicion, mi.posicionActual) <= RADIO_PROTECCION_MERCENARIOS || distancia(c.posicion, o.posicion) <= RADIO_PROTECCION_MERCENARIOS);
  const ataca = hostil
    || (esCaravana && o.escoltada ? 'Va adjunta a un ejército: solo otro ejército la ataca, y lo hace atacando al ejército.'
      : d! > encuentro ? `Acércate: estás a ${Math.round(d!)} y se ataca a ${encuentro}.`
        : sinSoldados ? 'Tu columna no lleva soldados vivos.'
          : protegido ? `A menos de ${RADIO_PROTECCION_MERCENARIOS} del campamento de mercenarios ${protegido.id} nadie inicia un combate.` : '');

  const siguiendo = mi?.persiguiendo?.tipo === o.tipo && mi.persiguiendo.id === o.id;
  return [
    { accion: 'inspeccionar', etiqueta: 'Inspeccionar', motivo: inspeccionar },
    siguiendo ? { accion: 'soltar', etiqueta: 'Dejar de perseguir', motivo: '' } : { accion: 'perseguir', etiqueta: 'Perseguir', motivo: persigue },
    { accion: 'atacar', etiqueta: esCaravana ? 'Interceptar' : o.teSigue ? 'Plantar cara' : 'Atacar', motivo: ataca },
  ];
}

// --- Fichas ----------------------------------------------------------------------------------------------------------------------------------

/** Lo que dio `inspeccionar` de cada objetivo, con el instante: se muestra mientras la ficha siga abierta. */
const inspecciones = new Map<string, { en: number; datos: unknown }>();

function htmlHeroe(p: ProyeccionJugador, id: string, e: Escapar): string {
  const h = p.heroesVisibles.find((x) => x.heroeId === id);
  if (!h) return `<div class="mapa-lista-item"><div><strong>${e(nombreDeHeroe(p, id))}</strong>${linea('sin ficha a la vista')}</div></div>`;
  const herido = heridoAhora(p, id) ? ` · herido ${Math.ceil((h.heridoHasta! - p.instante) / 60_000)} min` : '';
  const tropa = h.escuadrasQueLleva.length > 0 ? h.escuadrasQueLleva.map((s) => `${e(nombreTropa(s.tropaId))} ×${s.cantidad} (nv ${s.nivel})`).join(', ') : 'sin tropa';
  const puesto = Object.values(h.equipamiento ?? {}).filter((x): x is string => Boolean(x));
  return `<div class="mapa-lista-item"><div><strong>${e(h.displayName)}</strong>${linea(`${e(h.classDefinitionId)} · nivel ${h.nivel}${herido}`)}${linea(tropa)}${puesto.length > 0 ? linea(`Equipo: ${puesto.map((x) => e(x.replace(/_/g, ' '))).join(', ')}`) : ''}</div></div>`;
}

function htmlInspeccion(p: ProyeccionJugador, o: Objetivo, e: Escapar): string {
  const hecha = inspecciones.get(`${o.tipo}:${o.id}`);
  if (!hecha) return '';
  const hace = `inspeccionada hace ${textoEnTiempoReal(Math.max(0, p.instante - hecha.en))}`;
  const d = hecha.datos as { escuadrones?: { tropaId: string; cantidad: number; heroeId: string }[]; recursos?: string[]; escoltada?: boolean };
  if (o.tipo === 'ejercito') {
    const filas = (d.escuadrones ?? []).map((s) => `<div class="mapa-lista-item"><div><strong>${e(nombreTropa(s.tropaId))} ×${s.cantidad}</strong>${linea(`de ${e(nombreDeHeroe(p, s.heroeId))}`)}</div></div>`).join('');
    return `<strong class="heroe-sub">Composición (${hace})</strong>${filas ? `<div class="mapa-lista">${filas}</div>` : '<p class="mapa-lista-vacia">Sin tropa: solo héroes.</p>'}`;
  }
  const lleva = (d.recursos ?? []).map((r) => e(RECURSO_NOMBRE[r] ?? r)).join(', ');
  return `<strong class="heroe-sub">Carga (${hace})</strong><p class="mapa-lista-vacia">${d.escoltada ? 'Con escolta' : 'Sin escolta'} · lleva ${lleva || 'nada'} (nunca se ve cuánto).</p>`;
}

function htmlFicha(p: ProyeccionJugador, o: Objetivo, kicker: string, e: Escapar): string {
  const mi = miColumna(p);
  const d = mi ? Math.round(distancia(mi.posicionActual, o.posicion)) : null;
  const faccion = o.faccionId ? p.facciones.find((f) => f.id === o.faccionId)?.nombre ?? o.faccionId : 'Sin Facción';
  const acciones = estados(p, o);
  const botones = acciones.map((a) => `<button class="btn-primary" type="button" data-ajeno="${a.accion}"${a.motivo ? ' disabled' : ''}>${a.etiqueta}</button>`).join('');
  const motivos = acciones.filter((a) => a.motivo).map((a) => `<p class="mapa-lista-vacia">${a.etiqueta}: ${e(a.motivo)}</p>`).join('');
  const heroes = (o.heroeIds ?? []).length > 0 ? `<strong class="heroe-sub">Héroes que van</strong><div class="mapa-lista">${o.heroeIds!.map((id) => htmlHeroe(p, id, e)).join('')}</div>` : '';
  const datos = o.tipo === 'ejercito'
    ? `<div><span>Héroes</span><strong>${(o.heroeIds ?? []).length}</strong></div>`
    : `<div><span>Escolta</span><strong>${o.escoltada ? 'Sí' : 'No'}</strong></div><div><span>Lleva</span><strong>${o.recursos?.map((r) => e(RECURSO_NOMBRE[r] ?? r)).join(', ') || 'nada'}</strong></div>`;
  const persecucion = o.teSigue
    ? `<p class="faction-error">⚠ Va tras tu columna.</p><p class="mapa-lista-vacia">Puedes huir —marcha a otro sitio: si eres más rápido no te alcanza, y entrar en una plaza o campamento la suelta— o plantarle cara con «Plantar cara» cuando esté a ${radioDeEncuentro()}.</p>`
    : '';
  return `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">${kicker}</span>
    <h3>${e(faccion)}</h3>
    <div class="mapa-seleccion-datos">${datos}<div><span>Distancia a tu columna</span><strong>${d ?? '—'}</strong></div></div>
    ${persecucion}
    ${heroes}
    ${htmlInspeccion(p, o, e)}
    <div class="mapa-seleccion-acciones">${botones}</div>
    ${motivos}
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`;
}

const deColumna = (x: EjercitoAvistado): Objetivo => ({ tipo: 'ejercito', id: x.id, posicion: x.posicionActual, faccionId: x.faccionId, clase: x.tipo, heroeIds: x.heroeIds, teSigue: x.teSigue === true });
const deCaravana = (c: CaravanaAvistada): Objetivo => ({ tipo: 'caravana', id: c.id, posicion: c.posicionActual, faccionId: c.faccionId, escoltada: c.escoltada, recursos: c.recursos });

function cablear(cont: HTMLElement, o: Objetivo, heroeId: string, ctx: Parameters<NonNullable<FichaMapaExtra['cablear']>>[3]): void {
  cont.querySelectorAll<HTMLButtonElement>('[data-ajeno]').forEach((boton) => boton.addEventListener('click', async () => {
    const accion = boton.dataset.ajeno as Accion;
    const objetivo = { tipo: o.tipo, id: o.id };
    boton.disabled = true;
    const { error, datos } = await ctx.ejecutarConDatos(accion === 'soltar' ? 'dejarDePerseguir' : accion, accion === 'soltar' ? { heroeId } : { heroeId, objetivo });
    if (error) {
      boton.disabled = false;
      const el = cont.querySelector<HTMLElement>('#mapa-seleccion-error');
      if (el) el.textContent = error;
      ctx.aviso(error);
      return;
    }
    if (accion === 'inspeccionar') {
      inspecciones.set(`${o.tipo}:${o.id}`, { en: estadoCliente.proyeccionUltima?.instante ?? 0, datos });
      ctx.aviso('Miras de cerca: el observado recibe un aviso.');
      ctx.repintar();
    } else if (accion === 'perseguir') ctx.aviso('Sales tras ella: a 15 podrás atacar.');
    else if (accion === 'soltar') ctx.aviso('Sueltas a tu presa.');
    else ctx.aviso((datos as { battleId?: string } | undefined)?.battleId ? 'Se abre una batalla: te unes desde Avisos.' : 'Combate resuelto: el informe llega en Avisos.');
  }));
}

export const FICHA_COLUMNA_AJENA: FichaMapaExtra = {
  tipo: 'ejercitoAjeno',
  buscar: (p, id) => (p.ejercitosAvistados ?? []).find((x) => x.id === id),
  html: (p, x: EjercitoAvistado, c) => htmlFicha(p, deColumna(x), clase(x.tipo) === 'ejercito' ? 'Ejército ajeno' : 'Columna personal ajena', c.escapar),
  cablear: (cont, p, x: EjercitoAvistado, c) => cablear(cont, deColumna(x), p.heroeId, c),
};

export const FICHA_CARAVANA_AJENA: FichaMapaExtra = {
  tipo: 'caravanaAjena',
  buscar: (p, id) => (p.caravanasAvistadas ?? []).find((x) => x.id === id),
  html: (p, x: CaravanaAvistada, c) => htmlFicha(p, deCaravana(x), 'Caravana ajena', c.escapar),
  cablear: (cont, p, x: CaravanaAvistada, c) => cablear(cont, deCaravana(x), p.heroeId, c),
};
