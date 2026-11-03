// PANEL DE OBRAS de la plaza (ventana Construcción): construir, los edificios y la cola de obras. La producción, que iba en medio, está en la
// ventana del Almacén desde 0.107.0 (`htmlProduccionYRecetas`, ui/vistaCiudad.ts). Rediseñado el 2026-11-02 a petición de Víctor para que se lea como un juego de estrategia: menos
// texto y más iconos, estados y barras. Aquí no se decide ninguna regla: el motor valida y su rechazo sale flotando.
//   Construir   rejilla de iconos con su coste debajo (en rojo lo que falta en el almacén) y candado si no se puede
//   Edificios   una tarjeta por tipo: icono, cuántos, nivel en marcas, insignias de obra / mejora / parado y el botón de mejorar
//   Cola        lo que está en obra con su barra de avance y lo que espera en casillas numeradas que se mueven con ◀ ▶
// La barra de avance es una estimación: el motor manda solo cuándo acaba la obra; la duración sale del catálogo (`tiempoConstruccionMinutos`, la
// `obraMinutos` del nivel o `× MEJORA_EDIFICIO.multiplicadorPorNivel`), con las políticas de hoy (`factorTiempoConstruccion`) y, si se reconstruye,
// `OCUPACION.fraccionCosteReconstruccion`.
import { bloqueDeDatos } from '../apiCliente';
import { EDIFICIO_COLOR, EDIFICIO_NOMBRE, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, Edificio } from '../tiposDominio';
import { ayuda } from './ayuda';
import { estadoCliente } from './estadoCliente';
import type { ContextoPlaza } from './ganchos';
import { iconoEdificio } from './iconosEdificio';
import { ahora, barraAvance, chipsDeCoste, cuentaAtras, duracion, marcasNivel } from './juegoVisual';
import { plegable } from './plegable';
import { tipoSeleccionado } from './vistaCiudad';

type Escapar = (valor: string) => string;
type Cargo = 'gobernador' | 'maestroObras' | null;

const nombreDe = (tipo: string): string => EDIFICIO_NOMBRE[tipo] ?? tipo;

/** Edificios que un Gobernador / Maestro de Obras puede añadir a mano (el backend gatea nivel, únicos y
 * topes; aquí solo se ofrece el catálogo). Fuera: centroUrbano, puestoMercado, los extractores de `mapa` y la Granja (motor e4923d4d: la ciudad
 * solo tiene la de la fundación, que se mejora; el trigo de más sale de las aldeas agrícolas). */
const EDIFICIOS_MANUALES = [
  'vivienda', 'almacen', 'granero', 'lenera',
  'barracon', 'galeriaDeTiro', 'palacio', 'mercado', 'taberna',
  'fundicion', 'granFundicion', 'curtiduria', 'armeria', 'carpinteria', 'maravilla',
] as const;

interface DefEdificio {
  costo?: Record<string, number>;
  requisitoNivelAsentamientoConstruccion?: number;
  requiereTecnologia?: string;
  nivelFaccionMinimo?: number;
  tiempoConstruccionMinutos?: number;
  niveles?: Record<string, { obraMinutos?: number }>;
}

/** Por qué no se puede añadir ahora un edificio a la cola, como el motor (`anadir_manual`), o `''` si se puede. Lo que el cliente no sabe (sitio,
 * topes de almacenes y viviendas, cola llena, recursos) lo dice el motor al pedirlo. */
function motivoParaConstruir(a: Asentamiento, tipo: string, def: DefEdificio, cargo: 'gobernador' | 'maestroObras' | null): string {
  const p = estadoCliente.proyeccionUltima;
  if (!cargo) return 'Solo el Gobernador o el Maestro de Obras.';
  const hay = (a.edificios ?? []).some((e) => e.tipo === tipo);
  const unicos = bloqueDeDatos<string[]>('EDIFICIOS_UNICOS') ?? [];
  if (unicos.includes(tipo) && hay) return 'Solo puede haber uno.';
  const nivel = a.nivelActual ?? a.nivel;
  const pide = def.requisitoNivelAsentamientoConstruccion ?? 0;
  if (nivel < pide) return `Pide la plaza en nivel ${pide}.`;
  if (def.requiereTecnologia && !(p?.tecnologiasAdoptadas ?? []).includes(def.requiereTecnologia)) return `Pide la tecnología ${def.requiereTecnologia.replace(/_/g, ' ')}.`;
  if (tipo === 'granFundicion') {
    const nivelFaccion = p?.facciones.find((f) => f.id === p.faccionId)?.nivel ?? 1;
    if (def.nivelFaccionMinimo && nivelFaccion < def.nivelFaccionMinimo) return `Pide la Facción en nivel ${def.nivelFaccionMinimo}.`;
    if (p?.tecnologia?.capitalId && p.tecnologia.capitalId !== a.id) return 'Solo en la capital.';
  }
  return '';
}


const catalogo = (): Record<string, DefEdificio> | null => bloqueDeDatos<Record<string, DefEdificio>>('EDIFICIO_CATALOGO');

/** El producto de los factores de las políticas activas de la plaza para ese campo (1 si no hay). */
function factorDePoliticas(a: Asentamiento, campo: string): number {
  const politicas = bloqueDeDatos<{ id: string; [k: string]: unknown }[]>('POLITICA_CATALOGO') ?? [];
  return (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.[campo]; return typeof v === 'number' ? t * v : t; }, 1);
}

/** Cuántos minutos dura la obra (o la mejora) de ese edificio, según el catálogo y las políticas de hoy; `null` sin catálogo. */
export function minutosDeObra(a: Asentamiento, e: Edificio): number | null {
  const def = catalogo()?.[e.tipo];
  if (!def) return null;
  const f = factorDePoliticas(a, 'factorTiempoConstruccion');
  const base = def.tiempoConstruccionMinutos ?? 0;
  if (e.mejora) {
    const n = e.mejora.nivelObjetivo;
    const mult = bloqueDeDatos<{ multiplicadorPorNivel?: number }>('MEJORA_EDIFICIO')?.multiplicadorPorNivel ?? 2;
    return Math.max(1, Math.round((def.niveles?.[String(n)]?.obraMinutos ?? base * mult ** (n - 1)) * f));
  }
  const reconstruir = e.danado ? bloqueDeDatos<{ fraccionCosteReconstruccion?: number }>('OCUPACION')?.fraccionCosteReconstruccion ?? 1 : 1;
  return Math.max(1, Math.round(base * f * reconstruir));
}

/** El avance de una obra que acaba en `fin` y dura `minutos` (0 a 1); `null` si no se sabe. */
function avance(fin: number | undefined, minutos: number | null): number | null {
  if (typeof fin !== 'number' || !minutos) return null;
  return Math.max(0, Math.min(1, 1 - (fin - ahora()) / (minutos * 60_000)));
}

/** Cuántos niveles tiene un tipo en el catálogo (para las marcas de nivel). */
const nivelesDe = (tipo: string): number => Math.max(1, Object.keys(catalogo()?.[tipo]?.niveles ?? {}).length);

/** Los tipos de edificio para las pestañas de «Construir» (petición de Víctor, 2026-11-02). El catálogo del motor no los agrupa: es solo cómo se
 * enseñan. Un edificio nuevo del catálogo que no esté en ninguno cae en «Otros». */
const GRUPOS_CONSTRUIR: { id: string; nombre: string; icono: string; tipos: string[] }[] = [
  { id: 'ciudad', nombre: 'Ciudad', icono: 'vivienda', tipos: ['vivienda', 'almacen', 'granero', 'pozo', 'parque', 'plaza'] },
  { id: 'recursos', nombre: 'Recursos', icono: 'granja', tipos: ['granja', 'lenera'] },
  { id: 'talleres', nombre: 'Talleres', icono: 'fundicion', tipos: ['fundicion', 'granFundicion', 'curtiduria', 'armeria', 'carpinteria', 'patioDeGremios'] },
  { id: 'militar', nombre: 'Militar', icono: 'barracon', tipos: ['barracon', 'galeriaDeTiro', 'caballerizas', 'plazaDeArmas'] },
  { id: 'gobierno', nombre: 'Gobierno', icono: 'palacio', tipos: ['salaConsejo', 'palacio', 'taberna', 'mercado', 'maravilla'] },
];
const grupoDe = (tipo: string): string => GRUPOS_CONSTRUIR.find((g) => g.tipos.includes(tipo))?.id ?? 'otros';

/** La pestaña de «Construir» elegida ('todos' = sin filtro). Vive entre repintados. */
let grupoConstruir = 'todos';

/** La Granja es única en la ciudad (motor e4923d4d, `EDIFICIOS_UNICOS`): con la de la fundación en pie no se ofrece otra. */
const hayGranja = (a: Asentamiento): boolean => (a.edificios ?? []).some((x) => x.tipo === 'granja');

/** Construir: pestañas por tipo (todos, ciudad, recursos, talleres, militar, gobierno) con cuántos se pueden levantar ya, y una casilla por edificio
 * con su icono y su coste. Las que no se pueden, con candado y el motivo en el título (al pulsarlas, sale flotando). */
function htmlBotonesConstruir(a: Asentamiento, cargo: Cargo, esc: Escapar): string {
  if (!cargo) return '';
  const cat = catalogo();
  const tipos = cat
    ? Object.keys(cat).filter((t) => Object.keys(cat[t]!.costo ?? {}).length > 0 && !t.startsWith('mina') && t !== 'cantera' && t !== 'corral' && !(t === 'granja' && hayGranja(a)))
    : [...EDIFICIOS_MANUALES];
  const info = tipos.map((t) => {
    const def = cat?.[t] ?? {};
    const motivo = cat ? motivoParaConstruir(a, t, def, cargo) : '';
    const coste = def.costo ?? {};
    const caro = Object.entries(coste).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n);
    return { t, def, motivo, coste, caro, grupo: grupoDe(t) };
  });
  const grupos = [...GRUPOS_CONSTRUIR, { id: 'otros', nombre: 'Otros', icono: 'centroUrbano', tipos: [] }].filter((g) => info.some((x) => x.grupo === g.id));
  if (grupoConstruir !== 'todos' && !grupos.some((g) => g.id === grupoConstruir)) grupoConstruir = 'todos';
  // En cada pestaña, cuántos se pueden poner ya en la cola (sin candado y con qué pagarlos).
  const listos = (id: string): number => info.filter((x) => (id === 'todos' || x.grupo === id) && !x.motivo && !x.caro).length;
  const pestana = (id: string, nombre: string, icono: string): string => {
    const n = listos(id);
    return `<button class="obra-grupo${grupoConstruir === id ? ' activo' : ''}" type="button" data-grupo-construir="${esc(id)}" title="${esc(`${nombre}: ${n} para construir ya`)}" aria-pressed="${grupoConstruir === id}">
      <span class="obra-grupo-icono">${icono}</span><span class="obra-grupo-nombre">${esc(nombre)}</span>${n ? `<span class="obra-grupo-n">${n}</span>` : ''}
    </button>`;
  };
  const pestanas = `<div class="obra-grupos" role="tablist">${pestana('todos', 'Todos', '<span class="obra-grupo-todos" aria-hidden="true">▦</span>')}${grupos.map((g) => pestana(g.id, g.nombre, iconoEdificio(g.icono, 20))).join('')}</div>`;
  const casillas = info.filter((x) => grupoConstruir === 'todos' || x.grupo === grupoConstruir).map(({ t, def, motivo, coste, caro }) => {
    const tiempo = def.tiempoConstruccionMinutos ? ` · ${duracion(Math.round(def.tiempoConstruccionMinutos * factorDePoliticas(a, 'factorTiempoConstruccion')))}` : '';
    const costeTexto = Object.entries(coste).map(([r, n]) => `${n} ${RECURSO_NOMBRE[r] ?? r}`).join(', ');
    const titulo = `${nombreDe(t)}${costeTexto ? ` · ${costeTexto}` : ''}${tiempo}${motivo ? ` · ${motivo}` : caro ? ' · No hay bastante en el almacén' : ''}`;
    return `<button class="obra-construir${motivo ? ' apagado' : caro ? ' caro' : ''}" type="button" data-construir="${esc(t)}"${motivo ? ' aria-disabled="true"' : ''} title="${esc(titulo)}" aria-label="${esc(titulo)}">
      <span class="obra-construir-icono">${iconoEdificio(t, 30)}</span>
      <span class="obra-construir-coste">${chipsDeCoste(a, coste, esc, 2)}</span>
      ${motivo ? '<span class="obra-candado" aria-hidden="true">🔒</span>' : ''}
    </button>`;
  });
  return `<div class="obra-titulo"><span class="faction-kicker">Construir</span>${ayuda('plaza:construir', 'Elige un tipo arriba (el número dice cuántos puedes poner ya en la cola) o «Todos». Pulsa un edificio para ponerlo en la cola: se paga al encolar. El coste va debajo, en rojo lo que no hay en el almacén. Con candado: no se puede todavía (el motivo, al pasar el ratón o al pulsarlo). Lo que el cliente no sabe (sitio, topes, cola llena) lo dice el servidor.')}</div>
    ${pestanas}
    <div class="obra-construir-rejilla">${casillas.join('')}</div>`;
}

/** Las pestañas de «Construir»: cambian el tipo que se ve y repintan. */
export function cablearPanelObras(raiz: ParentNode, repintar: () => void): void {
  raiz.querySelectorAll<HTMLButtonElement>('[data-grupo-construir]').forEach((b) => b.addEventListener('click', () => { grupoConstruir = b.dataset.grupoConstruir!; repintar(); }));
}

/** Edificios: una tarjeta por tipo. Pulsarla elige en el plano el primero de ese tipo (y, otra vez, el siguiente). */
export function seccionEdificios(a: Asentamiento, cargo: Cargo, esc: Escapar): string {
  // La cantera ya no es un edificio de la plaza: la piedra sale de los pueblos extractores, que se fundan desde el nivel 1 (Víctor, 2026-10-31).
  const deLaPlaza = (a.edificios ?? []).filter((e) => e.tipo !== 'cantera');
  const internos = deLaPlaza.filter((e) => (e.ambito ?? 'asentamiento') !== 'mapa');
  const enRegion = deLaPlaza.length - internos.length;

  const grupos = new Map<string, Edificio[]>();
  for (const e of internos) grupos.set(e.tipo, [...(grupos.get(e.tipo) ?? []), e]);

  const tarjetas = [...grupos.entries()]
    .sort(([x, lx], [y, ly]) =>
      (x === 'centroUrbano' ? -1 : 0) - (y === 'centroUrbano' ? -1 : 0) || ly.length - lx.length || x.localeCompare(y)
    )
    .map(([tipo, lista]) => {
      const activos = lista.filter((e) => e.estado === 'activo');
      const nivelMax = Math.max(...lista.map((e) => e.nivelInterno ?? 1));
      const enObra = lista.length - activos.length;
      const parados = lista.filter((e) => e.pausadoPorAlmacenLleno).length;
      const danados = lista.filter((e) => e.danado).length;
      const mejorandose = lista.filter((e) => e.mejora);
      // La mejora ataca la instancia ACTIVA de menor nivel interno que no se esté mejorando ya (todas las de un tipo son intercambiables).
      const objetivoMejora = activos.filter((e) => !e.mejora).sort((e1, e2) => (e1.nivelInterno ?? 1) - (e2.nivelInterno ?? 1))[0];
      const puedeMejorar = cargo && objetivoMejora && tipo !== 'centroUrbano' && (objetivoMejora.nivelInterno ?? 1) < nivelesDe(tipo);
      const insignias = [
        enObra ? `<span class="obra-insignia obra" title="${enObra} en obra o en cola">🔨${enObra > 1 ? enObra : ''}</span>` : '',
        mejorandose.length ? `<span class="obra-insignia mejora" title="${mejorandose.length} mejorándose">⬆${mejorandose.length > 1 ? mejorandose.length : ''}</span>` : '',
        parados ? `<span class="obra-insignia parado" title="${parados} parado${parados > 1 ? 's' : ''}: almacén lleno">⏸${parados > 1 ? parados : ''}</span>` : '',
        danados ? `<span class="obra-insignia danado" title="${danados} dañado${danados > 1 ? 's' : ''}">⚠${danados > 1 ? danados : ''}</span>` : '',
      ].join('');
      const niveles = lista.map((e) => e.nivelInterno ?? 1).sort((x, y) => y - x);
      const titulo = `${nombreDe(tipo)} · ${lista.length > 1 ? `${lista.length} (niveles ${niveles.join(', ')})` : `nivel ${nivelMax}`}${enObra ? ` · ${enObra} en obra` : ''}${parados ? ` · ${parados} parado(s): almacén lleno` : ''}`;
      // Con una mejora en marcha, su avance va al pie de la tarjeta (la que acabe antes).
      const mejora = mejorandose.sort((x, y) => x.mejora!.completaEn - y.mejora!.completaEn)[0];
      const estado = activos.length === 0 ? ' fantasma' : parados ? ' parada' : '';
      return `<div class="obra-edif${estado}${tipoSeleccionado() === tipo ? ' sel' : ''}" data-fila-tipo="${esc(tipo)}" style="--swatch:${EDIFICIO_COLOR[tipo] ?? '#888'}" title="${esc(titulo)}">
        <span class="obra-edif-icono">${iconoEdificio(tipo, 34)}</span>
        ${lista.length > 1 ? `<span class="obra-edif-cuenta">×${lista.length}</span>` : ''}
        <span class="obra-edif-nombre">${esc(nombreDe(tipo))}</span>
        ${marcasNivel(nivelMax, nivelesDe(tipo))}
        ${insignias ? `<span class="obra-insignias">${insignias}</span>` : ''}
        ${puedeMejorar ? `<button class="obra-mejorar" type="button" data-mejorar="${esc(objetivoMejora!.id)}" title="${esc(`Mejorar a nivel ${(objetivoMejora!.nivelInterno ?? 1) + 1} (el de menor nivel)`)}" aria-label="Mejorar ${esc(nombreDe(tipo))}">⬆</button>` : ''}
        ${mejora ? barraAvance(avance(mejora.mejora!.completaEn, minutosDeObra(a, mejora))) : ''}
      </div>`;
    })
    .join('');
  return `${htmlBotonesConstruir(a, cargo, esc)}
    <div class="obra-edif-rejilla">${tarjetas || '<p class="mapa-lista-vacia">Sin edificios.</p>'}</div>
    ${enRegion > 0 ? `<p class="asent-edif-region">+ ${enRegion} en la región (minas)</p>` : ''}`;
}

/** Una obra en marcha (construcción, reconstrucción o mejora): casilla con el icono, qué es, la barra de avance y lo que falta. */
function htmlObraActiva(a: Asentamiento, e: Edificio, cargo: Cargo, esc: Escapar): string {
  const fin = e.mejora ? e.mejora.completaEn : e.completaEn;
  const que = e.mejora ? `⬆ Nivel ${e.mejora.nivelObjetivo}` : e.danado ? '⚠ Reconstrucción' : '🔨 Construcción';
  const x = avance(fin, minutosDeObra(a, e));
  return `<div class="obra-activa" style="--swatch:${EDIFICIO_COLOR[e.tipo] ?? '#888'}">
    <span class="obra-slot">${iconoEdificio(e.tipo, 30)}</span>
    <span class="obra-activa-cuerpo">
      <span class="obra-activa-cab"><strong>${esc(nombreDe(e.tipo))}</strong><small>${que}</small><span class="obra-tiempo">⏳ ${esc(cuentaAtras(fin))}</span></span>
      ${barraAvance(x)}
    </span>
    ${cargo && !e.mejora ? `<span class="obra-activa-ctl"><button type="button" data-cola-mover="arriba" data-edificio="${esc(e.id)}" title="Antes en la cola">▲</button><button type="button" data-cola-mover="abajo" data-edificio="${esc(e.id)}" title="Después en la cola">▼</button></span>` : ''}
  </div>`;
}

/** La cola: arriba lo que está en obra (con su barra) y debajo lo que espera, en casillas numeradas por orden de arranque. */
export function seccionCola(a: Asentamiento, cargo: Cargo, esc: Escapar): string {
  const edificios = a.edificios ?? [];
  const cola = edificios.filter((e) => e.estado !== 'activo').sort((x, y) => (y.prioridad ?? 0) - (x.prioridad ?? 0));
  // Las mejoras en curso no están en la cola pero ocupan una cuadrilla de obra: van con las obras en marcha, sin acciones.
  const enMarcha = [...edificios.filter((e) => e.mejora), ...cola.filter((e) => e.estado === 'en_construccion')];
  const esperan = cola.filter((e) => e.estado === 'en_cola');
  if (enMarcha.length === 0 && esperan.length === 0) return '<p class="mapa-lista-vacia">Sin obras en marcha ni en cola.</p>';
  const casillas = esperan.map((e, i) => `<div class="obra-cola-casilla${e.danado ? ' danado' : ''}" style="--swatch:${EDIFICIO_COLOR[e.tipo] ?? '#888'}" title="${esc(`${i + 1}. ${nombreDe(e.tipo)}${e.danado ? ' · reconstrucción' : ''}`)}">
      <span class="obra-cola-n">${i + 1}</span>
      ${iconoEdificio(e.tipo, 28)}
      ${e.danado ? '<span class="obra-cola-danado" aria-hidden="true">⚠</span>' : ''}
      ${cargo ? `<span class="obra-cola-ctl"><button type="button" data-cola-mover="arriba" data-edificio="${esc(e.id)}" title="Antes" aria-label="Antes">◀</button><button type="button" data-cola-quitar="${esc(e.id)}" title="Quitar de la cola" aria-label="Quitar">✕</button><button type="button" data-cola-mover="abajo" data-edificio="${esc(e.id)}" title="Después" aria-label="Después"${i === esperan.length - 1 ? ' disabled' : ''}>▶</button></span>` : ''}
    </div>`).join('');
  return `${enMarcha.length ? `<div class="obra-titulo"><span class="faction-kicker">En obra</span><small>${enMarcha.length}</small></div><div class="obra-activas">${enMarcha.map((e) => htmlObraActiva(a, e, cargo, esc)).join('')}</div>` : ''}
    ${esperan.length ? `<div class="obra-titulo"><span class="faction-kicker">En espera</span><small>${esperan.length}</small>${ayuda('plaza:cola', 'Arrancan por orden cuando hay cuadrilla y con qué pagar. ◀ ▶ las adelantan o retrasan; ✕ las quita (solo las que aún no empezaron). La barra de las obras en marcha es una estimación con el tiempo del catálogo.')}</div><div class="obra-cola">${casillas}</div>` : ''}`;
}

/** Centro urbano › Edificios: construir y edificios y la cola, cada parte plegable con su resumen en iconos. La producción va en la ventana del
 * Almacén (0.107.0). */
export function htmlPanelObras(c: ContextoPlaza): string {
  const a = c.asentamiento;
  const edificios = a.edificios ?? [];
  const internos = edificios.filter((e) => (e.ambito ?? 'asentamiento') !== 'mapa' && e.tipo !== 'cantera');
  const enObra = edificios.filter((e) => e.estado === 'en_construccion' || e.mejora).length;
  const enCola = edificios.filter((e) => e.estado === 'en_cola').length;
  const chip = (texto: string, clase = ''): string => `<span class="obra-chip${clase ? ` ${clase}` : ''}">${texto}</span>`;
  const resumenCola = [enObra ? chip(`🔨 ${enObra}`, 'activa') : '', enCola ? chip(`⌛ ${enCola}`) : ''].join('') || chip('vacía');
  return plegable(`edificios:${a.id}`, `<strong>Edificios</strong>${chip(String(internos.filter((e) => e.estado === 'activo').length))}`, seccionEdificios(a, c.cargo, c.escapar), true)
    + plegable(`cola:${a.id}`, `<strong>Obras</strong>${resumenCola}`, seccionCola(a, c.cargo, c.escapar), true);
}
