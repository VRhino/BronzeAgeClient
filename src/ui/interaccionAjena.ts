// Interactuar en el mapa con lo AJENO que se ve (Doc 5.12.3, «la geometría ofrece, el jugador decide»): columnas (ejércitos y columnas personales) y
// caravanas avistadas, con la ficha pública de los héroes que van. Aquí no se decide ninguna regla: el backend valida y su rechazo se enseña tal cual.
// Esta ficha solo APAGA con su motivo lo que el canon no permite, para que el jugador no pulse a ciegas:
//   Inspeccionar   desde 40; el observado se entera. Vale entre cualquier clase de columna.
//   Atacar         a 15 (`radioEncuentro`); un ejército y una columna personal nunca combaten entre sí; ni a los tuyos ni a un aliado; sin herida.
//                  De una caravana se llama «Interceptar» y es el mismo comando `atacar`; si va adjunta a un ejército se ataca al ejército.
//   Perseguir      un ejército solo persigue a otro ejército; una columna personal, a otra o a una caravana suelta.
//   Dejar de perseguir   si ya vas tras esa presa.
// Lo que da `inspeccionar` (composición de la columna, carga de la caravana o defensa de la plaza) se lee SIEMPRE de `informesDeInspeccion` de la
// proyección (10 min de mundo): así sobrevive a recargar y a cerrar la ficha.
import type { ProyeccionJugador } from '../apiCliente';
import { radioDeEncuentro, tropasReclutables } from '../apiCliente';
import { RADIO_PROTECCION_MERCENARIOS } from '../render';
import { RECURSO_NOMBRE } from '../paletas';
import type { CaravanaAvistada, EjercitoAvistado, InformeDeInspeccion } from '../tiposDominio';
import { ayuda } from './ayuda';
import { textoEnTiempoReal } from './estadoCliente';
import { ejercitosDeLaFaccion, miColumna } from './ejercitos';
import type { FichaMapaExtra, ObjetoBajoElClic } from './ganchos';
import { nombreDeHeroe } from './nombres';
import { minutosHerido } from './panelHeroe';

type Escapar = (valor: string) => string;
type Punto = { x: number; y: number };

/** A cuánto se inspecciona (`MOVIMIENTO.radioInspeccion` del backend, que no lo publica en el balance). El que decide es el backend. */
export const RADIO_INSPECCION = 40;

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
  /** Solo caravanas: lleva escolta (adjunta a un ejército o con escuadras cedidas). */
  escoltada?: boolean;
  /** Solo caravanas: va pegada a un ejército avistado, o sea adjunta (entonces se ataca/persigue al ejército). */
  adjunta?: boolean;
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
        : esCaravana && o.adjunta ? 'Va adjunta a un ejército: se persigue al ejército.' : '');

  const sinSoldados = mi !== undefined && mi.participantes.length === 1
    && !p.heroe.escuadrones.some((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === mi.id && s.cantidad > 0);
  const protegido = mi && (p.campamentosMercenarios ?? []).find((c) => distancia(c.posicion, mi.posicionActual) <= RADIO_PROTECCION_MERCENARIOS || distancia(c.posicion, o.posicion) <= RADIO_PROTECCION_MERCENARIOS);
  const ataca = hostil
    || (esCaravana && o.adjunta ? 'Va adjunta a un ejército: solo otro ejército la ataca, y lo hace atacando al ejército.'
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

function htmlHeroe(p: ProyeccionJugador, id: string, e: Escapar): string {
  const h = p.heroesVisibles.find((x) => x.heroeId === id);
  if (!h) return `<div class="mapa-lista-item"><div><strong>${e(nombreDeHeroe(p, id))}</strong>${linea('sin ficha a la vista')}</div></div>`;
  const herido = heridoAhora(p, id) ? ` · herido ${Math.ceil((h.heridoHasta! - p.instante) / 60_000)} min` : '';
  const tropa = h.escuadrasQueLleva.length > 0 ? h.escuadrasQueLleva.map((s) => `${e(nombreTropa(s.tropaId))} ×${s.cantidad} (nv ${s.nivel})`).join(', ') : 'sin tropa';
  const puesto = Object.values(h.equipamiento ?? {}).filter((x): x is string => Boolean(x));
  return `<div class="mapa-lista-item"><div><strong>${e(h.displayName)}</strong>${linea(`${e(h.classDefinitionId)} · nivel ${h.nivel}${herido}`)}${linea(tropa)}${puesto.length > 0 ? linea(`Equipo: ${puesto.map((x) => e(x.replace(/_/g, ' '))).join(', ')}`) : ''}</div></div>`;
}

/** El informe vigente de lo que ese héroe tuyo inspeccionó (lo anota el servidor y viaja en la proyección). */
function informeDe(p: ProyeccionJugador, tipo: InformeDeInspeccion['objetivo']['tipo'], id: string): InformeDeInspeccion | undefined {
  return (p.informesDeInspeccion ?? []).find((i) => i.heroeId === p.heroeId && i.objetivo.tipo === tipo && i.objetivo.id === id && i.expiraEn > p.instante);
}

const filasDeTropa = (p: ProyeccionJugador, lista: { tropaId: string; cantidad: number; heroeId: string }[], vacio: string, e: Escapar): string =>
  lista.length > 0
    ? `<div class="mapa-lista">${lista.map((s) => `<div class="mapa-lista-item"><div><strong>${e(nombreTropa(s.tropaId))} ×${s.cantidad}</strong>${linea(`de ${e(nombreDeHeroe(p, s.heroeId))}`)}</div></div>`).join('')}</div>`
    : `<p class="mapa-lista-vacia">${vacio}</p>`;

/** Lo que dio `inspeccionar` de una columna, caravana o plaza ajena, con «visto hace X»; vacío si no hay informe vigente. También lo usa la ficha de plaza del mapa. */
export function htmlInformeDeInspeccion(p: ProyeccionJugador, tipo: InformeDeInspeccion['objetivo']['tipo'], id: string, e: Escapar): string {
  const informe = informeDe(p, tipo, id);
  if (!informe) return '';
  const hace = `visto hace ${textoEnTiempoReal(Math.max(0, p.instante - informe.vistoEn))}`;
  const c = informe.contenido;
  if ('escuadrones' in c) return `<strong class="heroe-sub">Composición (${hace})</strong>${filasDeTropa(p, c.escuadrones, 'Sin tropa: solo héroes.', e)}`;
  if ('guarnicion' in c) {
    const dentro = c.heroesIds.length > 0 ? `<p class="mapa-lista-vacia">Héroes dentro: ${c.heroesIds.map((h) => e(nombreDeHeroe(p, h))).join(', ')}.</p>` : '';
    return `<strong class="heroe-sub">Defensa (${hace})</strong>${filasDeTropa(p, c.guarnicion, 'Sin guarnición.', e)}${dentro}`;
  }
  const lleva = c.recursos.map((r) => e(RECURSO_NOMBRE[r] ?? r)).join(', ');
  return `<strong class="heroe-sub">Carga (${hace})</strong><p class="mapa-lista-vacia">${c.escoltada ? 'Con escolta' : 'Sin escolta'} · lleva ${lleva || 'nada'} (nunca se ve cuánto).</p>`;
}

function htmlFicha(p: ProyeccionJugador, o: Objetivo, kicker: string, e: Escapar): string {
  const mi = miColumna(p);
  const d = mi ? Math.round(distancia(mi.posicionActual, o.posicion)) : null;
  const faccion = o.faccionId ? p.facciones.find((f) => f.id === o.faccionId)?.nombre ?? o.faccionId : 'Sin Facción';
  const acciones = estados(p, o);
  const botones = acciones.map((a) => `<button class="btn-primary" type="button" data-ajeno="${a.accion}"${a.motivo ? ` disabled title="${e(a.motivo)}"` : ''}>${a.etiqueta}</button>`).join('');
  // Los motivos de una línea se quedan a la vista; todos (también los largos) están en la ayuda y en el `title` de su botón.
  const apagadas = acciones.filter((a) => a.motivo);
  const agrupados = (lista: Estado[]): [string, string][] => [...new Set(lista.map((a) => a.motivo))].map((m) => [lista.filter((a) => a.motivo === m).map((a) => a.etiqueta).join(' y '), m]);
  const motivos = agrupados(apagadas.filter((a) => a.motivo.length <= 70)).map(([etiquetas, m]) => `<p class="mapa-lista-vacia">${etiquetas}: ${e(m)}</p>`).join('')
    + (apagadas.length > 0 ? `<p class="mapa-lista-vacia">Por qué no se puede${ayuda('ajeno:motivos',agrupados(apagadas).map(([etiquetas, m]) => `<strong>${etiquetas}</strong>: ${e(m)}`).join('<br>'), 'Por qué no se puede')}</p>` : '');
  const heroes = (o.heroeIds ?? []).length > 0 ? `<strong class="heroe-sub">Héroes que van</strong><div class="mapa-lista">${o.heroeIds!.map((id) => htmlHeroe(p, id, e)).join('')}</div>` : '';
  const datos = o.tipo === 'ejercito'
    ? `<div><span>Héroes</span><strong>${(o.heroeIds ?? []).length}</strong></div>`
    : `<div><span>Escolta</span><strong>${o.escoltada ? 'Sí' : 'No'}</strong></div><div><span>Lleva</span><strong>${o.recursos?.map((r) => e(RECURSO_NOMBRE[r] ?? r)).join(', ') || 'nada'}</strong></div>`;
  const persecucion = o.teSigue
    ? `<p class="faction-error">⚠ Va tras tu columna.${ayuda('ajeno:persecucion', `Puedes huir —marcha a otro sitio: si eres más rápido no te alcanza, y entrar en una plaza o campamento la suelta— o plantarle cara con «Plantar cara» cuando esté a ${radioDeEncuentro()}.`)}</p>`
    : '';
  return `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">${kicker}</span>
    <h3>${e(faccion)}</h3>
    <div class="mapa-seleccion-datos">${datos}<div><span>Distancia a tu columna</span><strong>${d ?? '—'}</strong></div></div>
    ${persecucion}
    ${heroes}
    ${htmlInformeDeInspeccion(p, o.tipo, o.id, e)}
    <div class="mapa-seleccion-acciones">${botones}</div>
    ${motivos}
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`;
}

const deColumna = (x: EjercitoAvistado): Objetivo => ({ tipo: 'ejercito', id: x.id, posicion: x.posicionActual, faccionId: x.faccionId, clase: x.tipo, heroeIds: x.heroeIds, teSigue: x.teSigue === true });
// Adjunta = viaja pegada a un ejército avistado (misma posición): `escoltada` también es true con escolta cedida, que sí se puede perseguir e interceptar.
const deCaravana = (p: ProyeccionJugador, c: CaravanaAvistada): Objetivo => ({ tipo: 'caravana', id: c.id, posicion: c.posicionActual, faccionId: c.faccionId, escoltada: c.escoltada, recursos: c.recursos,
  adjunta: c.escoltada && (p.ejercitosAvistados ?? []).some((x) => distancia(x.posicionActual, c.posicionActual) < 0.5) });

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
    if (accion === 'inspeccionar') ctx.aviso('Miras de cerca: el observado recibe un aviso.');
    else if (accion === 'perseguir') ctx.aviso('Sales tras ella: a 15 podrás atacar.');
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
  html: (p, x: CaravanaAvistada, c) => htmlFicha(p, deCaravana(p, x), 'Caravana ajena', c.escapar),
  cablear: (cont, p, x: CaravanaAvistada, c) => cablear(cont, deCaravana(p, x), p.heroeId, c),
};
