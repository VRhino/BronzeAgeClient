// Panel de TECNOLOGÍA (backend Doc 6). Comando:
//   adoptarTecnologia     { faccionId, tecnologiaId }                  el Rey, estando en la capital; la paga el almacén de la capital
// Nombres, Eras y tarifas salen del balance (`catalogoDeTecnologia`); mientras no llegue, se muestra el id legible.
// Desde la 0.158.0 (Víctor, 2026-11-06) la pestaña Tecnología de Facción es el árbol de tecnologías (`arbolTecnologias.ts`): arriba el árbol, y al
// hacer clic en una carta su ficha con lo que puede hacer quien mira (Adoptar); abajo, los logros del mundo. Desde la 0.170.0 (Víctor,
// 2026-11-07: «los Aedas son de plaza, no de Facción») lo de los Aedas (comprar a un itinerante, las épicas de los residentes) está en la
// ventana Aedas del riel de la plaza (`ventanaAedas.ts`); el árbol sigue diciendo qué tecnologías reveló un Aeda y lo que cobra por ellas.
import { catalogoDeTecnologia, type ProyeccionJugador } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';
import { htmlArbol, montarArbol, textoContador } from './arbolTecnologias';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** `leva_comunal` → «Leva comunal». Solo para cuando el balance aún no ha llegado. */
const legible = (id: string): string => { const t = id.replace(/[._]/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const cifra = (n: number): string => n.toLocaleString('es');

export function htmlTecnologia(p: ProyeccionJugador, e: Escapar, conCabecera = true): string {
  const t = p.tecnologia;
  // en la pestaña de la Facción, sin cabecera: ya está la de la ventana
  const cabecera = conCabecera ? `<div class="mapa-panel-jugador">${e(p.heroe.displayName)} · tecnología</div>` : '';
  if (!t) return `${cabecera}<p class="asent-lado-nota">Este servidor no envía el estado de la tecnología.</p>`;
  // El panel se repinta con el sondeo, así que no hace falta avisar cuando llegue el balance.
  const cat = catalogoDeTecnologia(() => {});
  const nombreEra = (id: string): string => cat?.ERAS[id]?.nombre ?? legible(id);
  const eraDeTec = (id: string): string | undefined => t.eraDe?.[id] ?? cat?.TECNOLOGIAS[id]?.era;
  /** Lo que cobraría un Aeda itinerante por la tecnología (el doble del oro de la tarifa de su Era), o `null` si no las vende (Era demasiado alta) o no se sabe. */
  const precioAeda = (id: string): number | null => {
    const era = eraDeTec(id);
    if (!cat || !era || (cat.ERAS[era]?.orden ?? 99) > cat.AEDAS.venta.ordenEraMaximo) return null;
    return (cat.TARIFA_ADOPCION[era]?.['oro'] ?? 0) * cat.AEDAS.venta.factorOro;
  };
  const faccion = p.facciones.find((f) => f.id === p.faccionId);
  const soyRey = faccion?.reyId === p.heroeId;
  const propias = t.propias;
  const adoptadas = propias?.adoptadas ?? [];
  const adoptables = (propias?.aparecidas ?? []).filter((id) => !adoptadas.includes(id));
  // Tus plazas: la que pisas, con todo, y las demás de tu Facción por su ficha (para nombrarlas y saber dónde hay que estar).
  const plazas: Asentamiento[] = [...p.asentamientos, ...(p.asentamientosAvistados as Asentamiento[]).filter((a) => a.faccionId === p.faccionId && !p.asentamientos.some((x) => x.id === a.id))];
  const ubic = p.heroe.ubicacion;
  const dondeEstoy = ubic.tipo === 'asentamiento' ? ubic.asentamientoId : null;
  const nombrePlaza = (a: Asentamiento): string => a.nombre ?? a.id;

  const logros = t.logros.length === 0
    ? '<p class="asent-lado-nota">Aún no se ha cumplido ningún logro del mundo.</p>'
    : `<ul class="tec-lista">${t.logros.map((l) => `<li>${cifra(l.umbral)} ${e(textoContador(l.contador))}</li>`).join('')}</ul>`;

  const capital = plazas.find((a) => a.id === t.capitalId);
  const motivoAdoptar = !propias ? 'Necesitas una Facción.' : !soyRey ? 'Solo la adopta el Rey de la Facción, estando en la capital.'
    : !t.capitalId ? 'Tu Facción aún no tiene capital.' : dondeEstoy !== t.capitalId ? `Tienes que estar en la capital${capital ? `, ${nombrePlaza(capital)}` : ''}.` : null;
  // La ficha de una carta del árbol: lo que quien mira puede hacer con esa tecnología ahora. Lo que no puede hacer no sale; lo que no puede pagar,
  // en rojo y sin pulsar.
  const fichaAcciones = (id: string): string => {
    const partes: string[] = [];
    const chips = (coste: Record<string, number>, almacen: Asentamiento['almacen'] | undefined): string => Object.entries(coste)
      .map(([r, n]) => `<span class="ta-rec${(almacen?.[r]?.cantidad ?? 0) < n ? ' falta' : ''}"><i aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</i><b>${cifra(n)}</b><span class="ta-sr">${e(RECURSO_NOMBRE[r] ?? r)}</span></span>`).join(' ');
    const falta = (coste: Record<string, number>, almacen: Asentamiento['almacen'] | undefined): boolean => Object.entries(coste).some(([r, n]) => (almacen?.[r]?.cantidad ?? 0) < n);
    if (adoptables.includes(id) && soyRey) {
      const era = eraDeTec(id);
      const tarifa = era ? cat?.TARIFA_ADOPCION[era] : undefined;
      if (motivoAdoptar) partes.push(`<p class="ta-ficha-nota">Para adoptarla: ${e(motivoAdoptar.replace(/^Tienes/, 'tienes'))}</p>`);
      else if (tarifa) {
        const alm = p.asentamientos.find((a) => a.id === t.capitalId)?.almacen;
        const sinPagar = falta(tarifa, alm);
        partes.push(`<button class="btn-primary ta-ficha-boton" type="button" data-ficha-adoptar="${e(id)}" data-faccion="${e(p.faccionId ?? '')}"${sinPagar ? ' disabled title="El almacén de la capital no tiene bastante"' : ''}>Adoptar ${chips(tarifa, alm)}</button>`);
      }
    }
    return partes.join('');
  };
  ficha = { acciones: fichaAcciones };

  return `${cabecera}<div class="tec-panel tec-con-arbol">
    <div class="tec-arbol">${htmlArbol(p, e, precioAeda)}</div>
    <p class="faction-error" data-campo="error-tecnologia" role="alert"></p>
    <div class="tec-extras">
      <section class="tec-extra">
        <strong class="heroe-sub">Logros del mundo cumplidos${ayuda('jugador:tec-era', `Lo que ha pasado entre todas las Facciones; no dicen qué tecnología abren. Era del mundo: ${e(nombreEra(t.era))}.`)}</strong>
        ${logros}
      </section>
    </div>
  </div>`;
}

/** Las acciones de la ficha del árbol, de la última vez que se pintó el panel. */
let ficha: { acciones: (id: string) => string } | null = null;

export function cablearTecnologia(raiz: HTMLElement, ejecutar: Ejecutar): void {
  const arbol = raiz.querySelector<HTMLElement>('.tec-arbol');
  if (arbol && ficha) {
    const f = ficha;
    montarArbol(arbol, {
      acciones: f.acciones,
      cablearAcciones: (caja) => {
        const accion = (selector: string, tipo: string, params: (b: HTMLButtonElement) => object): void => caja.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          b.disabled = true;
          const mensaje = await ejecutar(tipo, params(b));
          b.disabled = false;
          const campo = caja.querySelector<HTMLElement>('[data-campo="error-ficha-tecnologia"]');
          if (campo) campo.textContent = mensaje ?? '';
        }));
        accion('[data-ficha-adoptar]', 'adoptarTecnologia', (b) => ({ faccionId: b.dataset.faccion, tecnologiaId: b.dataset.fichaAdoptar }));
      },
    });
  }
  const enlazar = (atributo: string, error: string, tipo: string, params: (b: HTMLButtonElement) => object): void =>
    raiz.querySelectorAll<HTMLButtonElement>(`[${atributo}]`).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const mensaje = await ejecutar(tipo, params(b));
      b.disabled = false;
      const campo = raiz.querySelector<HTMLElement>(`[data-campo="${error}"]`);
      if (campo) campo.textContent = mensaje ?? '';
    }));
  enlazar('data-tec-adoptar', 'error-tecnologia', 'adoptarTecnologia', (b) => ({ faccionId: b.dataset.faccion, tecnologiaId: b.dataset.tecAdoptar }));
}
