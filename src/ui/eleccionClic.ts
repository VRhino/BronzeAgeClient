// Varias cosas bajo un mismo clic del mapa (Víctor, 2026-11-02): antes de hacer nada sale una lista arriba, en el sitio de los avisos
// (`.aviso-global`), para elegir con cuál. Elegir una hace lo mismo que un clic sobre ella sola (se selecciona y, si toca, la columna marcha);
// Esc, un clic fuera o volver a clicar en el mapa la cierran sin hacer nada. Aquí, cómo se llama cada cosa y la lista; qué hay bajo el clic lo
// busca `main.ts` (`objetosBajoElClic`).
import type { ProyeccionJugador } from '../apiCliente';
import { nombreDeHeroe } from './nombres';
import { nombreDeAeda } from '../mundo/aedas';
import { nombreDeAvanzada, nombreDeObra, nombreDePueblo } from './pueblos';

/** Lo que hay bajo el clic: qué se selecciona y adónde se marcha (opcional). */
export interface ObjetoDelClic<O = unknown> { seleccion: { tipo: string; id: string }; ir?: O }

/** Cómo se presenta una cosa en la lista: su símbolo, qué es y un detalle (de quién es, su nivel…). */
export interface Rotulo { icono: string; titulo: string; detalle: string }

/** El nombre de una Facción: de las que llegan enteras o del directorio. */
function faccion(p: ProyeccionJugador, id: string | null | undefined): string {
  if (!id) return '';
  if (id === p.faccionId) return 'Tu Facción';
  return p.facciones.find((f) => f.id === id)?.nombre ?? p.directorioFacciones?.find((f) => f.id === id)?.nombre ?? '';
}

function nombreDePlaza(p: ProyeccionJugador, id: string): string {
  return p.asentamientos.find((a) => a.id === id)?.nombre ?? p.asentamientosAvistados?.find((a) => a.id === id)?.nombre
    ?? p.asentamientosConocidos?.find((a) => a.asentamientoId === id)?.nombre ?? 'una plaza';
}

const junta = (...partes: (string | false | undefined)[]): string => partes.filter(Boolean).join(' · ');

/** Cómo se llama en la lista lo que se seleccionaría (`seleccionMapa`), sacado de la proyección. */
export function rotuloDe(p: ProyeccionJugador, sel: { tipo: string; id: string }): Rotulo {
  switch (sel.tipo) {
    case 'batalla': {
      const b = (p.batallas ?? []).find((x) => x.battleId === sel.id);
      return { icono: '⚔', titulo: 'Batalla', detalle: b?.ladoPropio ? 'Combates en ella' : 'En curso' };
    }
    case 'formacion': {
      const f = [...p.ejercitos.filter((e) => e.id === sel.id).map((e) => ({ faccionId: e.faccionId, participantes: e.participantes.length })),
        ...(p.ejercitosAvistados ?? []).filter((e) => e.id === sel.id)][0];
      return { icono: '⧗', titulo: 'Formación', detalle: junta(faccion(p, f?.faccionId), f && `${f.participantes} de 3 héroes`) };
    }
    case 'ejercito': {
      const e = p.ejercitos.find((x) => x.id === sel.id), lider = e?.liderId ?? e?.participantes[0]?.heroeId;
      return { icono: '⚑', titulo: e?.tipo === 'ejercito' ? 'Ejército de tu Facción' : 'Columna de tu Facción', detalle: lider ? `Con ${nombreDeHeroe(p, lider)}` : '' };
    }
    case 'ejercitoAjeno': {
      const e = (p.ejercitosAvistados ?? []).find((x) => x.id === sel.id);
      return { icono: '⚑', titulo: e?.tipo === 'ejercito' ? 'Ejército ajeno' : 'Columna ajena', detalle: junta(faccion(p, e?.faccionId), e && `${e.participantes} ${e.participantes === 1 ? 'héroe' : 'héroes'}`) };
    }
    case 'caravanaAjena': {
      const c = (p.caravanasAvistadas ?? []).find((x) => x.id === sel.id);
      return { icono: '⛟', titulo: 'Caravana ajena', detalle: junta(faccion(p, c?.faccionId), c?.escoltada && 'escoltada') };
    }
    case 'puebloMapa': {
      const x = (p.pueblos ?? []).find((y) => y.id === sel.id);
      return { icono: '⌂', titulo: x ? nombreDePueblo(x) : 'Pueblo', detalle: x ? `De ${nombreDePlaza(p, x.madreId)}` : '' };
    }
    case 'avanzadaMapa': {
      const x = (p.avanzadas ?? []).find((y) => y.id === sel.id);
      return { icono: '♜', titulo: nombreDeAvanzada(x?.etapa ?? 0), detalle: x ? junta(`De ${nombreDePlaza(p, x.madreId)}`, x.enRuinas && 'en ruinas') : '' };
    }
    case 'obraMapa': {
      const o = (p.obrasDeMapa ?? []).find((y) => y.id === sel.id);
      return { icono: '⚒', titulo: o ? nombreDeObra(o, p) : 'Obra', detalle: o ? junta(`De ${nombreDePlaza(p, o.madreId)}`, o.terminaEn !== undefined ? 'en marcha' : 'esperando materiales') : '' };
    }
    case 'aeda': {
      const a = (p.aedasAvistados ?? []).find((x) => x.id === sel.id);
      return { icono: '📜', titulo: `Aeda ${nombreDeAeda(sel.id)}`, detalle: a?.enAsentamientoId ? `Parado en ${nombreDePlaza(p, a.enAsentamientoId)}` : 'De camino' };
    }
    case 'alijo': return { icono: '✦', titulo: 'Alijo', detalle: 'Recursos sueltos en el suelo' };
    case 'mercenarios': return { icono: '⛺', titulo: 'Campamento de mercenarios', detalle: '' };
    case 'campamento': {
      const c = (p.campamentosBandidos ?? []).find((x) => x.id === sel.id);
      return { icono: '☠', titulo: 'Campamento de bandidos', detalle: c ? `Nivel ${c.nivel}` : '' };
    }
    case 'asentamiento': {
      const a = p.asentamientos.find((x) => x.id === sel.id), v = p.asentamientosAvistados?.find((x) => x.id === sel.id), c = p.asentamientosConocidos?.find((x) => x.asentamientoId === sel.id);
      const nivel = a?.nivel ?? v?.nivel ?? c?.nivel, duena = a ? p.faccionId : v?.faccionId ?? c?.faccionId;
      return { icono: '♛', titulo: a?.nombre ?? v?.nombre ?? c?.nombre ?? 'Plaza', detalle: junta(nivel !== undefined && `Nivel ${nivel}`, faccion(p, duena)) };
    }
  }
  return { icono: '•', titulo: sel.tipo, detalle: '' };
}

/** Quita lo repetido (la misma cosa encontrada desde dos centros), dejando el primero. */
export function sinRepetir<T extends ObjetoDelClic>(lista: readonly T[]): T[] {
  const vistos = new Set<string>();
  return lista.filter((o) => {
    const clave = `${o.seleccion.tipo}:${o.seleccion.id}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

let abierta: { el: HTMLElement; quitar: () => void } | null = null;

/** Cierra la lista, si está abierta, sin elegir nada. */
export function cerrarEleccionClic(): void {
  abierta?.quitar();
  abierta = null;
}

/** ¿Está abierta? (un clic en el mapa con la lista abierta solo la cierra). */
export const eleccionClicAbierta = (): boolean => abierta !== null;

/** Saca la lista con `opciones` arriba al centro. `alElegir` recibe la elegida. */
export function abrirEleccionClic<T extends ObjetoDelClic>(p: ProyeccionJugador, opciones: readonly T[], alElegir: (o: T) => void, escapar: (v: string) => string): void {
  cerrarEleccionClic();
  const el = document.createElement('div');
  el.className = 'eleccion-clic';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '¿Con qué quieres interactuar?');
  el.innerHTML = `<span class="eleccion-clic-cab">Aquí hay ${opciones.length} cosas</span>
    <ul>${opciones.map((o, i) => {
      const r = rotuloDe(p, o.seleccion);
      return `<li><button type="button" data-eleccion="${i}"><span class="eleccion-clic-icono" aria-hidden="true">${escapar(r.icono)}</span><span class="eleccion-clic-texto"><strong>${escapar(r.titulo)}</strong>${r.detalle ? `<small>${escapar(r.detalle)}</small>` : ''}</span></button></li>`;
    }).join('')}</ul>`;
  // un clic en el mapa (el lienzo) la cierra en su sitio, sin hacer nada más (lo mira quien recibe el clic: `eleccionClicAbierta`)
  const fuera = (e: PointerEvent): void => { if (!el.contains(e.target as Node) && !(e.target instanceof HTMLCanvasElement)) cerrarEleccionClic(); };
  const tecla = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); cerrarEleccionClic(); } };
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-eleccion]');
    if (!b) return;
    const o = opciones[Number(b.dataset.eleccion)];
    cerrarEleccionClic();
    if (o) alElegir(o);
  });
  // el clic que la abrió aún no ha terminado de propagarse: los oyentes de fuera se ponen en el siguiente turno
  const t = setTimeout(() => { document.addEventListener('pointerdown', fuera, true); document.addEventListener('keydown', tecla, true); }, 0);
  document.body.appendChild(el);
  el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  abierta = {
    el,
    quitar: () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', tecla, true);
      el.remove();
    },
  };
}
