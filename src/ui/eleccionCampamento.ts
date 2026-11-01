// Pantalla de ELEGIR CAMPAMENTO al crear el héroe (`sinHeroe`), como la de elegir punto de partida de un juego de estrategia: el mapa del mundo con
// cada campamento de mercenarios como un estandarte; al elegir uno la cámara vuela hasta él y marca su zona cercana (150 u) y su frontera (250 u).
// A la izquierda la lista, a la derecha la ficha del elegido: su tropa, cuánta gente hay y qué tierra le rodea (terreno, fertilidad, bosque,
// yacimientos, agua, bandidos y vecinos), todo leído del artefacto de mundo. «Recomendado», «Elegir por mí» y comparar dos son ayudas del cliente.
// El nombre de cada campamento es el de su región (el motor aún no les pone nombre).
import type { MapaGenerado, Point } from '../terreno';
import type { CampamentoParaElegir } from '../tiposDominio';
import type { TropaReclutable } from '../apiCliente';
import { imagenDeLejos, imagenDeZona } from '../mundo/pintarArtefacto';
import { dibujarIconoMapa, ICONOS_MAPA } from '../mundo/iconosMapa';
import { analizarCampamentos, edificioMilitarDe, nombresDeCampamentos, RADIO_FOCO, RADIO_FRONTERA, valorarCampamentos, type AnalisisCampamento, type ClaseDeSuelo, type Valoracion } from '../mundo/analisisCampamento';
import { RECURSO_COLOR, RECURSO_NOMBRE } from '../paletas';
import { iconoEdificio } from './iconosEdificio';
import { iconoTropa } from './iconosTropa';

type Escapar = (s: string) => string;

/** Lo que la pantalla necesita de fuera: los campamentos de la `Bienvenida`, el mundo y los datos de juego, y qué hacer al crear. */
export interface OpcionesEleccion {
  campamentos: readonly CampamentoParaElegir[];
  mapa: Promise<MapaGenerado>;
  /** Los edificios militares de `MERCENARIOS` y el nivel de los del campamento; `null` mientras no lleguen los datos. */
  edificiosMilitares: () => { lista: string[]; nivel: number } | null;
  tropas: () => TropaReclutable[] | null;
  /** ¿Es de arranque esa tecnología? (lo que todo campamento ofrece desde el primer día). */
  deArranque: (tecnologia: string) => boolean;
  /** Crea el héroe; devuelve el mensaje de error o `null` si fue bien. */
  crear: (nombre: string, campamentoId: string) => Promise<string | null>;
  escapar: Escapar;
  /** Para repintar cuando lleguen los datos de juego. */
  alCargarDatos?: (f: () => void) => void;
}

const EDIFICIO_NOMBRE: Record<string, string> = { barracon: 'Barracón', galeriaDeTiro: 'Galería de tiro', caballerizas: 'Caballerizas' };
const EDIFICIO_LEMA: Record<string, string> = { barracon: 'infantería', galeriaDeTiro: 'arqueros y honderos', caballerizas: 'jinetes y carros' };
/** Colores de estandarte, uno por campamento. */
const COLORES = ['#c0392b', '#2f6fd1', '#d4a017', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#b03a6f', '#5d6d7e', '#7f8c3a', '#a0522d', '#1f618d'];
const COLOR_SUELO: Record<ClaseDeSuelo, string> = { agua: '#2f5f95', costa: '#c4ba84', llano: '#8fbf63', colina: '#6f9450', montana: '#8a7d6a' };
const NOMBRE_SUELO: Record<ClaseDeSuelo, string> = { agua: 'Agua', costa: 'Costa', llano: 'Llano', colina: 'Colina', montana: 'Montaña' };
const ORDEN_NODOS = ['cobre', 'estano', 'hierro', 'oro', 'piedra', 'livestock'];
const ICONO_DE_NODO: Record<string, string> = { cobre: 'mena', estano: 'mena', hierro: 'mena', oro: 'mena', livestock: 'ganado', piedra: 'piedra' };
const colorNodo = (tipo: string): string => (tipo === 'piedra' ? '#b9b4aa' : RECURSO_COLOR[tipo] ?? '#ddd');

interface Ficha {
  c: CampamentoParaElegir;
  nombre: string;
  color: string;
  analisis: AnalisisCampamento | null;
  valoracion: Valoracion | null;
  edificio: string | undefined;
}

/** Un icono del mapa (512×512) en SVG, para el HTML. */
function svgIcono(id: string, color: string, lado = 18): string {
  const d = ICONOS_MAPA[id]?.d;
  if (!d) return `<span class="elegir-punto" style="background:${color}"></span>`;
  return `<svg class="elegir-icono" width="${lado}" height="${lado}" viewBox="0 0 512 512" aria-hidden="true"><path d="${d}" fill="${color}" stroke="#1b1a17" stroke-width="28" paint-order="stroke"/></svg>`;
}

const u = (d: number): string => `${Math.round(d)} u`;
const pct = (x: number): string => `${Math.round(x * 100)} %`;

/** Monta la pantalla en `raiz` (que ya trae el hueco `.elegir-screen`). Devuelve con qué limpiarla. */
export function montarEleccionCampamento(raiz: HTMLElement, o: OpcionesEleccion): () => void {
  const e = o.escapar;
  let mapa: MapaGenerado | null = null;
  let fichas: Ficha[] = o.campamentos.map((c, i) => ({ c, nombre: c.id, color: COLORES[i % COLORES.length]!, analisis: null, valoracion: null, edificio: undefined }));
  let elegido = 0;
  let comparar: number[] = [];
  let recomendado = -1;
  let vivo = true;

  raiz.innerHTML = `<div class="elegir-screen">
    <header class="elegir-barra">
      <div class="elegir-titulo"><h1>Elige dónde nace tu héroe</h1><p>Naces dentro de un campamento de mercenarios: allí resides, reclutas tu primera tropa y, cerca, fundarás tu plaza.</p></div>
      <div class="elegir-barra-acciones"><button type="button" class="btn-secondary" id="elegir-por-mi">🎲 Elegir por mí</button></div>
    </header>
    <div class="elegir-cuerpo">
      <aside class="elegir-lista" aria-label="Campamentos"></aside>
      <div class="elegir-mapa">
        <canvas class="elegir-lienzo"></canvas>
        <div class="elegir-leyenda"><span><i class="elegir-aro foco"></i>Zona cercana · ${RADIO_FOCO} u</span><span><i class="elegir-aro frontera"></i>Frontera · ${RADIO_FRONTERA} u</span><span>${svgIcono('bandidos', '#d9534f', 14)} Bandidos</span></div>
        <canvas class="elegir-minimapa" title="Pulsa un estandarte para ir a él"></canvas>
        <div class="elegir-cargando">Cargando el mapa del mundo…</div>
      </div>
      <aside class="elegir-ficha">
        <div class="elegir-ficha-cuerpo"></div>
        <section class="elegir-comparacion" hidden></section>
        <form class="elegir-form" id="form-crear-heroe">
          <label class="form-label" for="input-nombre-heroe">Nombre de tu héroe</label>
          <input type="text" id="input-nombre-heroe" class="form-input" required maxlength="24" autocomplete="off" placeholder="Cómo te llamarán" />
          <button type="submit" id="btn-crear-heroe" class="btn-primary">Nacer aquí</button>
          <p id="error-heroe" class="faction-error" role="alert"></p>
        </form>
      </aside>
    </div>
  </div>`;
  const lista = raiz.querySelector<HTMLElement>('.elegir-lista')!;
  const cuerpoFicha = raiz.querySelector<HTMLElement>('.elegir-ficha-cuerpo')!;
  const lienzo = raiz.querySelector<HTMLCanvasElement>('.elegir-lienzo')!;
  const mini = raiz.querySelector<HTMLCanvasElement>('.elegir-minimapa')!;
  const cajaComparar = raiz.querySelector<HTMLElement>('.elegir-comparacion')!;
  const botonCrear = raiz.querySelector<HTMLButtonElement>('#btn-crear-heroe')!;

  // ─────────── datos ───────────

  const maxGente = (): number => Math.max(1, ...fichas.map((f) => f.c.residentes + f.c.eligieronComoInicial));

  function calcular(): void {
    const edificios = o.edificiosMilitares();
    fichas = fichas.map((f, i) => ({ ...f, edificio: edificios ? edificioMilitarDe(f.c.posicion, numeroDe(f.c.id, i), edificios.lista) : undefined }));
    if (!mapa) return;
    const analisis = analizarCampamentos(mapa);
    // Bienvenida y artefacto se cruzan por el índice (`camp-N` es el N-ésimo del artefacto).
    const delCamp = fichas.map((f, i) => analisis[numeroDe(f.c.id, i)] ?? null);
    const nombres = nombresDeCampamentos(fichas.map((f, i) => delCamp[i]?.posicion ?? f.c.posicion), mapa.config.ancho, mapa.config.alto);
    const conAnalisis = delCamp.filter((a): a is AnalisisCampamento => Boolean(a));
    const notas = valorarCampamentos(conAnalisis, fichas.filter((_, i) => delCamp[i]).map((f) => f.c.residentes + f.c.eligieronComoInicial));
    let k = 0;
    fichas = fichas.map((f, i) => ({ ...f, nombre: nombres[i]!, analisis: delCamp[i] ?? null, valoracion: delCamp[i] ? notas[k++]! : null }));
    recomendado = fichas.reduce((m, f, i) => ((f.valoracion?.nota ?? -1) > (fichas[m]?.valoracion?.nota ?? -1) ? i : m), 0);
  }

  // ─────────── lista ───────────

  function htmlBarraSuelo(a: AnalisisCampamento | null, alto = 6): string {
    if (!a) return '';
    return `<div class="elegir-suelo" style="height:${alto}px">${(Object.keys(COLOR_SUELO) as ClaseDeSuelo[]).filter((k) => a.suelo[k] > 0.005).map((k) => `<i style="flex:${a.suelo[k]};background:${COLOR_SUELO[k]}" title="${NOMBRE_SUELO[k]} ${pct(a.suelo[k])}"></i>`).join('')}</div>`;
  }

  function pintarLista(): void {
    lista.innerHTML = fichas.map((f, i) => {
      const gente = f.c.residentes + f.c.eligieronComoInicial;
      return `<div class="elegir-tarjeta${i === elegido ? ' elegida' : ''}${comparar.includes(i) ? ' comparada' : ''}" data-i="${i}" role="button" tabindex="0" aria-pressed="${i === elegido}" style="--estandarte:${f.color}">
        <div class="elegir-tarjeta-cabeza"><span class="elegir-banderin" aria-hidden="true"></span><strong>${e(f.nombre)}</strong>${i === recomendado ? '<span class="elegir-recomendado">★ Recomendado</span>' : ''}</div>
        <div class="elegir-tarjeta-linea">${f.edificio ? `${iconoEdificio(f.edificio, 18)}<span>${e(EDIFICIO_NOMBRE[f.edificio] ?? f.edificio)}</span>` : '<span>…</span>'}<span class="elegir-gente" title="Residen ${f.c.residentes} · lo eligieron ${f.c.eligieronComoInicial}">👥 ${gente === 0 ? 'Vacío' : gente}</span></div>
        ${htmlBarraSuelo(f.analisis)}
        <label class="elegir-comparar"><input type="checkbox" data-comparar="${i}"${comparar.includes(i) ? ' checked' : ''}/> Comparar</label>
      </div>`;
    }).join('') || '<p class="mapa-lista-vacia">Esta partida no tiene campamentos.</p>';
  }

  // ─────────── ficha ───────────

  function htmlTropas(f: Ficha): string {
    const ed = f.edificio;
    if (!ed) return '<p class="elegir-nota">Cargando…</p>';
    const catalogo = o.tropas();
    const nivel = o.edificiosMilitares()?.nivel ?? 3;
    const suyas = (catalogo ?? []).filter((t) => t.edificio === ed && t.nivelRequerido <= nivel);
    const hoy = (t: TropaReclutable): boolean => o.deArranque(t.tecnologia);
    const orden = [...suyas].sort((a, b) => Number(hoy(b)) - Number(hoy(a)) || a.escalon - b.escalon || a.nivelRequerido - b.nivelRequerido);
    const ya = orden.filter(hoy);
    const luego = orden.filter((t) => !hoy(t));
    const chip = (t: TropaReclutable, conNombre: boolean): string => `<span class="elegir-tropa${hoy(t) ? ' ya' : ''}${conNombre ? '' : ' solo-icono'}" title="${e(t.nombre)} · ${hoy(t) ? 'se recluta desde el primer día' : 'cuando alguien descubra su tecnología'} · escalón ${t.escalon} · ${t.unidadesPorDefecto} hombres">${iconoTropa(t.id, 24)}${conNombre ? `<span>${e(t.nombre)}</span>` : ''}</span>`;
    return `<div class="elegir-edificio">${iconoEdificio(ed, 34)}<div><strong>${e(EDIFICIO_NOMBRE[ed] ?? ed)}</strong><span>Su tropa típica: ${e(EDIFICIO_LEMA[ed] ?? 'tropa')}</span></div></div>
      ${!catalogo ? '<p class="elegir-nota">Cargando las tropas…</p>' : `
        <p class="elegir-sub">Desde el primer día</p>
        ${ya.length ? `<div class="elegir-tropas">${ya.map((t) => chip(t, true)).join('')}</div>` : '<p class="elegir-nota aviso">Ninguna: aquí no se recluta hasta que alguien descubra su tecnología. Hasta entonces, la tropa que te prestan al nacer.</p>'}
        ${luego.length ? `<p class="elegir-sub">Cuando se descubra su tecnología</p><div class="elegir-tropas">${luego.map((t) => chip(t, false)).join('')}</div>` : ''}`}`;
  }

  function medidor(valor: number, color: string): string {
    return `<span class="elegir-medidor"><i style="width:${Math.round(Math.max(0, Math.min(1, valor)) * 100)}%;background:${color}"></i></span>`;
  }

  function htmlNodos(a: AnalisisCampamento): string {
    const filas = ORDEN_NODOS.map((tipo) => {
      const suyos = a.nodos.filter((n) => n.tipo === tipo);
      if (!suyos.length) return '';
      const cerca = suyos.filter((n) => n.distancia <= RADIO_FOCO).length;
      const cifra = (n: number): string => (n > 20 ? 'muchos' : n ? String(n) : '—');
      return `<tr><td>${svgIcono(ICONO_DE_NODO[tipo] ?? '', colorNodo(tipo))} ${e(RECURSO_NOMBRE[tipo] ?? tipo)}</td><td class="${cerca ? 'hay' : ''}">${cifra(cerca)}</td><td>${cifra(suyos.length - cerca)}</td><td>${u(suyos[0]!.distancia)}</td></tr>`;
    }).join('');
    return filas ? `<table class="elegir-nodos"><thead><tr><th></th><th>Zona cercana</th><th>Frontera</th><th>El más cerca</th></tr></thead><tbody>${filas}</tbody></table>` : '<p class="elegir-nota">Ningún yacimiento a menos de 250 u.</p>';
  }

  function htmlFicha(): string {
    const f = fichas[elegido];
    if (!f) return '';
    const a = f.analisis;
    const gente = f.c.residentes + f.c.eligieronComoInicial;
    const v = f.valoracion;
    const vecino = a?.vecino ? fichas.find((x, i) => numeroDe(x.c.id, i) === a.vecino!.indice) : undefined;
    const bandidoMax = a?.bandidos.reduce((m, b) => Math.max(m, b.nivel), 0) ?? 0;
    return `<header class="elegir-ficha-cabeza" style="--estandarte:${f.color}"><span class="elegir-banderin grande" aria-hidden="true"></span><div><h2>${e(f.nombre)}</h2><span>Campamento de mercenarios${a ? ` · (${Math.round(a.posicion.x)}, ${Math.round(a.posicion.y)})` : ''}</span></div></header>
      ${elegido === recomendado && v ? `<p class="elegir-recomendado-linea">★ Recomendado${v.razones.length ? `: ${e(v.razones.join(' · ').toLowerCase())}` : ''}</p>` : v?.razones.length ? `<p class="elegir-razones">${e(v.razones.join(' · '))}</p>` : ''}
      <section class="elegir-seccion"><h3>Tropa del campamento</h3>${htmlTropas(f)}</section>
      <section class="elegir-seccion"><h3>Gente</h3>
        <div class="elegir-fila"><span class="elegir-fila-nombre">Residen</span>${medidor(f.c.residentes / maxGente(), '#c8aa6e')}<span class="elegir-fila-dist">${f.c.residentes}</span></div>
        <div class="elegir-fila"><span class="elegir-fila-nombre">Nacieron aquí</span>${medidor(f.c.eligieronComoInicial / maxGente(), '#a9793f')}<span class="elegir-fila-dist">${f.c.eligieronComoInicial}</span></div>
        <p class="elegir-nota">${gente === 0 ? 'Nadie ha elegido aún este campamento: la tierra de alrededor es toda tuya.' : gente >= maxGente() && fichas.length > 1 ? 'El más concurrido: más vecinos con quien aliarse… o competir.' : 'Hay vecinos, pero queda sitio.'}</p></section>
      ${a ? `<section class="elegir-seccion"><h3>La tierra hasta ${RADIO_FOCO} u</h3>
        ${htmlBarraSuelo(a, 12)}
        <div class="elegir-suelo-leyenda">${(Object.keys(COLOR_SUELO) as ClaseDeSuelo[]).filter((k) => a.suelo[k] >= 0.01).map((k) => `<span><i style="background:${COLOR_SUELO[k]}"></i>${NOMBRE_SUELO[k]} ${pct(a.suelo[k])}</span>`).join('')}</div>
        <div class="elegir-fila"><span class="elegir-fila-nombre">🌾 Fertilidad</span>${medidor(a.fertilidad, '#c9a227')}<span class="elegir-fila-dist">${pct(a.fertilidad)}</span></div>
        <div class="elegir-fila"><span class="elegir-fila-nombre">🌲 Bosque</span>${medidor(a.bosque, '#3f7d4a')}<span class="elegir-fila-dist">${pct(a.bosque)}</span></div></section>
      <section class="elegir-seccion"><h3>Yacimientos hasta ${RADIO_FRONTERA} u</h3>${htmlNodos(a)}</section>
      <section class="elegir-seccion"><h3>Agua y peligros</h3>
        <div class="elegir-fila"><span class="elegir-fila-icono">〰️</span><span class="elegir-fila-nombre">Río</span><span class="elegir-fila-dato">${a.rio ? `a ${u(a.rio.distancia)}${a.rio.navegable ? ' · navegable' : ''}` : 'ninguno cerca'}</span></div>
        <div class="elegir-fila"><span class="elegir-fila-icono">🌊</span><span class="elegir-fila-nombre">Costa o lago</span><span class="elegir-fila-dato">${a.agua !== null ? `a ${u(a.agua)}` : 'ninguno cerca'}</span></div>
        <div class="elegir-fila">${svgIcono('bandidos', '#d9534f')}<span class="elegir-fila-nombre">Bandidos</span><span class="elegir-fila-dato">${a.bandidos.length ? `${a.bandidos.length} campamento${a.bandidos.length > 1 ? 's' : ''} · nivel hasta ${bandidoMax} · el más cercano a ${u(a.bandidos[0]!.distancia)}` : 'ninguno cerca'}</span></div>
        ${vecino && a.vecino ? `<div class="elegir-fila"><span class="elegir-banderin chico" style="--estandarte:${vecino.color}"></span><span class="elegir-fila-nombre">Vecino</span><span class="elegir-fila-dato"><a href="#" data-ir="${fichas.indexOf(vecino)}">${e(vecino.nombre)}</a> a ${u(a.vecino.distancia)}</span></div>` : ''}
      </section>` : `<p class="elegir-nota">${mapa ? 'Este campamento no está en el mapa del mundo.' : 'Cargando lo que hay alrededor…'}</p>`}
      <p class="elegir-nota tenue">El nombre es el de la región donde está, aproximado cerca de sus lindes.</p>`;
  }

  function pintarFicha(): void {
    cuerpoFicha.innerHTML = htmlFicha();
    botonCrear.textContent = fichas[elegido] ? `Nacer en ${fichas[elegido]!.nombre}` : 'Nacer aquí';
    botonCrear.disabled = !fichas[elegido];
  }

  // ─────────── comparar ───────────

  function pintarComparacion(): void {
    const [i, j] = comparar;
    if (i === undefined || j === undefined) { cajaComparar.hidden = true; cuerpoFicha.hidden = false; return; }
    const A = fichas[i]!, B = fichas[j]!;
    const fila = (titulo: string, va: number | null, vb: number | null, texto: (v: number | null, f: Ficha) => string, mejorAlto = true): string => {
      const gana = va === null || vb === null || va === vb ? 0 : (va > vb) === mejorAlto ? 1 : 2;
      return `<tr><th>${titulo}</th><td class="${gana === 1 ? 'gana' : ''}">${texto(va, A)}</td><td class="${gana === 2 ? 'gana' : ''}">${texto(vb, B)}</td></tr>`;
    };
    const an = (f: Ficha) => f.analisis;
    const cerca = (f: Ficha, tipo?: string) => an(f)?.nodos.filter((n) => n.distancia <= RADIO_FOCO && (!tipo || n.tipo === tipo)).length ?? null;
    const iconosCerca = (f: Ficha): string => ORDEN_NODOS.map((t) => { const n = cerca(f, t); return n ? `<span class="elegir-cmp-nodo">${svgIcono(ICONO_DE_NODO[t]!, colorNodo(t), 14)}${n > 20 ? '20+' : n}</span>` : ''; }).join('') || '—';
    const desdeYa = (f: Ficha): number | null => {
      const t = o.tropas();
      return t && f.edificio ? t.filter((x) => x.edificio === f.edificio && x.nivelRequerido <= (o.edificiosMilitares()?.nivel ?? 3) && o.deArranque(x.tecnologia)).length : null;
    };
    cajaComparar.innerHTML = `<header><h3>Comparar</h3><button type="button" class="elegir-cerrar" aria-label="Volver a la ficha" title="Volver a la ficha">×</button></header>
      <table><thead><tr><th></th><th style="--estandarte:${A.color}"><span class="elegir-banderin chico"></span>${e(A.nombre)}</th><th style="--estandarte:${B.color}"><span class="elegir-banderin chico"></span>${e(B.nombre)}</th></tr></thead><tbody>
      <tr><th>Tropa</th><td>${A.edificio ? `${iconoEdificio(A.edificio, 16)} ${e(EDIFICIO_NOMBRE[A.edificio] ?? A.edificio)}` : '…'}</td><td>${B.edificio ? `${iconoEdificio(B.edificio, 16)} ${e(EDIFICIO_NOMBRE[B.edificio] ?? B.edificio)}` : '…'}</td></tr>
      ${fila('Tropa desde el día 1', desdeYa(A), desdeYa(B), (v) => (v === null ? '…' : v ? String(v) : 'ninguna'))}
      ${fila('Gente', A.c.residentes + A.c.eligieronComoInicial, B.c.residentes + B.c.eligieronComoInicial, (v) => (v ? String(v) : 'Vacío'), false)}
      <tr><th>Terreno</th><td>${htmlBarraSuelo(an(A), 8)}</td><td>${htmlBarraSuelo(an(B), 8)}</td></tr>
      ${fila('Fertilidad', an(A)?.fertilidad ?? null, an(B)?.fertilidad ?? null, (v) => (v === null ? '…' : pct(v)))}
      ${fila('Bosque', an(A)?.bosque ?? null, an(B)?.bosque ?? null, (v) => (v === null ? '…' : pct(v)))}
      <tr><th>Yacimientos cerca</th><td>${iconosCerca(A)}</td><td>${iconosCerca(B)}</td></tr>
      ${fila('Río', an(A)?.rio ? -an(A)!.rio!.distancia : null, an(B)?.rio ? -an(B)!.rio!.distancia : null, (v) => (v === null ? 'lejos' : `a ${u(-v)}`))}
      ${fila('Costa o lago', an(A)?.agua != null ? -an(A)!.agua! : null, an(B)?.agua != null ? -an(B)!.agua! : null, (v) => (v === null ? 'lejos' : `a ${u(-v)}`))}
      ${fila('Bandidos cerca', an(A)?.bandidos.filter((b) => b.distancia <= RADIO_FOCO).length ?? null, an(B)?.bandidos.filter((b) => b.distancia <= RADIO_FOCO).length ?? null, (v) => (v === null ? '…' : String(v)), false)}
      ${fila('Vecino más cercano', an(A)?.vecino?.distancia ?? null, an(B)?.vecino?.distancia ?? null, (v) => (v === null ? '—' : `a ${u(v)}`))}
      ${fila('Valoración', A.valoracion?.nota ?? null, B.valoracion?.nota ?? null, (v, f) => (v === null ? '…' : `${'★'.repeat(Math.max(1, Math.round(v * 5)))}${fichas.indexOf(f) === recomendado ? ' <em>recomendado</em>' : ''}`))}
      </tbody></table>
      <div class="elegir-cmp-acciones"><button type="button" class="btn-secondary" data-ir="${i}">Elegir ${e(A.nombre)}</button><button type="button" class="btn-secondary" data-ir="${j}">Elegir ${e(B.nombre)}</button></div>`;
    cajaComparar.hidden = false;
    cuerpoFicha.hidden = true;
  }

  // ─────────── mapa ───────────

  const camara = { x: 0, y: 0, escala: 1 };
  /** El suelo de cerca de cada campamento ya mirado. */
  const zonas = new Map<number, { centro: Point; capa: HTMLCanvasElement }>();
  const RADIO_ZONA = RADIO_FRONTERA * 1.35;
  let vuelo: { desde: typeof camara; hasta: typeof camara; t0: number; ms: number } | null = null;
  let marco = 0;
  let pulso = 0;

  /** Dónde está cada campamento en el mapa: el centro del artefacto o, sin él, la puerta que manda el servidor. */
  const posicionDe = (f: Ficha): Point => f.analisis?.posicion ?? f.c.posicion;

  function tamano(): { w: number; h: number } {
    const r = lienzo.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  /** La cámara que encuadra los campamentos `indices` con su frontera. */
  function encuadre(indices: number[]): typeof camara {
    const { w, h } = tamano();
    const ps = indices.map((i) => posicionDe(fichas[i]!));
    const x0 = Math.min(...ps.map((p) => p.x)) - RADIO_FRONTERA * 1.25, x1 = Math.max(...ps.map((p) => p.x)) + RADIO_FRONTERA * 1.25;
    const y0 = Math.min(...ps.map((p) => p.y)) - RADIO_FRONTERA * 1.25, y1 = Math.max(...ps.map((p) => p.y)) + RADIO_FRONTERA * 1.25;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, escala: Math.min(w / (x1 - x0), h / (y1 - y0)) };
  }

  function volarA(destino: typeof camara, ms = 900): void {
    vuelo = { desde: { ...camara }, hasta: destino, t0: performance.now(), ms };
  }

  function enfocar(): void {
    if (!fichas.length) return;
    volarA(encuadre(comparar.length === 2 ? comparar : [elegido]));
  }

  function aPantalla(p: Point): Point {
    const { w, h } = tamano();
    return { x: (p.x - camara.x) * camara.escala + w / 2, y: (p.y - camara.y) * camara.escala + h / 2 };
  }

  function dibujarEstandarte(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, lado: number, activo: boolean): void {
    ctx.save();
    if (activo) { ctx.shadowColor = color; ctx.shadowBlur = 18; }
    // Mástil.
    ctx.strokeStyle = '#1b1a17';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - lado * 1.9); ctx.stroke();
    ctx.strokeStyle = '#d8b878';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - lado * 1.9); ctx.stroke();
    // Paño con cola de golondrina.
    const top = y - lado * 1.85, ancho = lado * 1.25, alto = lado * 1.05;
    ctx.beginPath();
    ctx.moveTo(x + 1, top); ctx.lineTo(x + ancho, top); ctx.lineTo(x + ancho - lado * 0.3, top + alto / 2); ctx.lineTo(x + ancho, top + alto); ctx.lineTo(x + 1, top + alto); ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = activo ? 2.5 : 1.5;
    ctx.strokeStyle = activo ? '#f1dcae' : '#1b1a17';
    ctx.stroke();
    dibujarIconoMapa(ctx, 'mercenarios', x + ancho * 0.42, top + alto / 2, lado * 0.72, '#f1dcae');
    ctx.restore();
  }

  function rotulo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, color = '#f1dcae'): void {
    ctx.font = `600 ${tam}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(11, 8, 5, 0.85)';
    ctx.strokeText(texto, x, y);
    ctx.fillStyle = color;
    ctx.fillText(texto, x, y);
  }

  /** Un rótulo en placa, centrado en `(x, y)`, sobre el borde de un círculo. */
  function placa(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, borde: string): void {
    ctx.save();
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    const w = ctx.measureText(texto).width + 16;
    ctx.fillStyle = 'rgba(17, 12, 8, 0.88)';
    ctx.strokeStyle = borde;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 10, w, 20, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f1dcae';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x, y + 0.5);
    ctx.restore();
  }

  function dibujar(ahora: number): void {
    if (!vivo) return;
    marco = requestAnimationFrame(dibujar);
    if (vuelo) {
      const t = Math.min(1, (ahora - vuelo.t0) / vuelo.ms);
      const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const { desde: a, hasta: b } = vuelo;
      // Un vuelo largo se aleja a medio camino, como la cámara de un mapa de estrategia.
      const lejos = Math.hypot(b.x - a.x, b.y - a.y) * Math.min(a.escala, b.escala) > tamano().w * 0.6;
      const arco = lejos ? 1 - 0.55 * Math.sin(Math.PI * k) : 1;
      camara.x = a.x + (b.x - a.x) * k;
      camara.y = a.y + (b.y - a.y) * k;
      camara.escala = Math.exp(Math.log(a.escala) + (Math.log(b.escala) - Math.log(a.escala)) * k) * arco;
      if (t >= 1) vuelo = null;
    }
    pulso = (ahora / 1000) % 1;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = tamano();
    if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) { lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr); }
    const ctx = lienzo.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1a2b';
    ctx.fillRect(0, 0, w, h);
    if (!mapa) return;
    const o0 = aPantalla({ x: 0, y: 0 });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagenDeLejos(mapa), o0.x, o0.y, mapa.config.ancho * camara.escala, mapa.config.alto * camara.escala);
    const marcados = comparar.length === 2 ? comparar : [elegido];
    // De cerca, el suelo de la zona con su relieve (se hace una vez por campamento, con la cámara ya quieta).
    for (const i of marcados) {
      const z = zonas.get(i);
      if (z) {
        const p = aPantalla({ x: z.centro.x - RADIO_ZONA, y: z.centro.y - RADIO_ZONA });
        ctx.save();
        ctx.beginPath();
        ctx.rect(o0.x, o0.y, mapa.config.ancho * camara.escala, mapa.config.alto * camara.escala); // fuera del mundo no hay suelo
        ctx.clip();
        ctx.drawImage(z.capa, p.x, p.y, 2 * RADIO_ZONA * camara.escala, 2 * RADIO_ZONA * camara.escala);
        ctx.restore();
      } else if (!vuelo && camara.escala > 0.5) {
        const centro = posicionDe(fichas[i]!);
        zonas.set(i, { centro, capa: imagenDeZona(mapa, centro, RADIO_ZONA, 1000) });
      }
    }
    // Los ríos, encima, para que se lean a cualquier escala.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(52, 104, 168, 0.95)';
    for (const r of mapa.rios) {
      ctx.lineWidth = Math.max(1, Math.min(4, camara.escala * (r.navegable ? 2.4 : 1.5)));
      ctx.beginPath();
      r.puntos.forEach((q, k) => { const p = aPantalla(q); if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.stroke();
    }
    ctx.restore();
    // Fuera de la frontera del elegido (o de los dos comparados), el mundo en penumbra.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    for (const i of marcados) { const p = aPantalla(posicionDe(fichas[i]!)); ctx.moveTo(p.x + RADIO_FRONTERA * camara.escala, p.y); ctx.arc(p.x, p.y, RADIO_FRONTERA * camara.escala, 0, Math.PI * 2, true); }
    ctx.fillStyle = `rgba(8, 6, 4, ${(0.55 * Math.max(0, Math.min(1, (camara.escala - 0.35) / 0.6))).toFixed(3)})`; // de lejos, sin penumbra
    ctx.fill('evenodd');
    ctx.restore();
    for (const i of marcados) {
      const f = fichas[i]!;
      const p = aPantalla(posicionDe(f));
      const rf = RADIO_FOCO * camara.escala, rr = RADIO_FRONTERA * camara.escala;
      ctx.save();
      ctx.fillStyle = 'rgba(241, 220, 174, 0.07)';
      ctx.beginPath(); ctx.arc(p.x, p.y, rf, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([10, 7]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(216, 184, 120, 0.85)';
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = f.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, rf, 0, Math.PI * 2); ctx.stroke();
      // Onda que sale del elegido.
      ctx.globalAlpha = 1 - pulso;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10 + pulso * 40, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // Yacimientos y bandidos: solo de cerca, donde se leen.
    if (camara.escala > 0.6) {
      const lado = Math.max(12, Math.min(20, camara.escala * 11));
      const vistos = new Set<string>();
      for (const n of mapa.nodos) {
        const p = aPantalla(n.posicion);
        if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue;
        // La piedra está por todas partes: solo muy de cerca, y una por hueco, para que no tape los metales.
        if (n.tipo === 'piedra') {
          if (camara.escala < 3) continue;
          const k = `${Math.round(p.x / (lado * 1.6))},${Math.round(p.y / (lado * 1.6))}`;
          if (vistos.has(k)) continue;
          vistos.add(k);
        }
        // Lo de fuera de la frontera, apagado.
        ctx.globalAlpha = marcados.some((i) => Math.hypot(n.posicion.x - posicionDe(fichas[i]!).x, n.posicion.y - posicionDe(fichas[i]!).y) <= RADIO_FRONTERA) ? 1 : 0.45;
        dibujarIconoMapa(ctx, ICONO_DE_NODO[n.tipo] ?? '', p.x, p.y, n.tipo === 'piedra' ? lado * 0.7 : lado, colorNodo(n.tipo));
        ctx.globalAlpha = 1;
      }
      for (const b of mapa.bandidos ?? []) {
        const p = aPantalla(b.posicion);
        if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue;
        dibujarIconoMapa(ctx, 'bandidos', p.x, p.y, lado * 1.25, '#d9534f');
        if (camara.escala > 1.2) rotulo(ctx, `N${b.nivel}`, p.x, p.y + lado * 0.7, 10, '#f3b0a8');
      }
    }
    // Estandartes, el elegido encima.
    const orden = fichas.map((_, i) => i).sort((a, b) => Number(marcados.includes(a)) - Number(marcados.includes(b)));
    for (const i of orden) {
      const f = fichas[i]!;
      const p = aPantalla(posicionDe(f));
      if (p.x < -60 || p.y < -60 || p.x > w + 60 || p.y > h + 80) continue;
      const activo = marcados.includes(i);
      dibujarEstandarte(ctx, p.x, p.y, f.color, activo ? 26 : 17, activo);
      rotulo(ctx, f.nombre, p.x, p.y + 6, activo ? 16 : 13, activo ? '#f1dcae' : '#e8dcc0');
      if (i === recomendado) rotulo(ctx, '★', p.x + (activo ? 40 : 28), p.y - (activo ? 58 : 42), activo ? 20 : 16, '#f5c542');
    }
    for (const i of marcados) {
      const f = fichas[i]!;
      const p = aPantalla(posicionDe(f));
      if (RADIO_FRONTERA * camara.escala < 60) continue;
      placa(ctx, `Zona cercana · ${RADIO_FOCO} u`, p.x, p.y + RADIO_FOCO * camara.escala, f.color);
      placa(ctx, `Frontera · ${RADIO_FRONTERA} u`, p.x, p.y + RADIO_FRONTERA * camara.escala, '#8a6a3a');
    }
    dibujarMinimapa();
  }

  function dibujarMinimapa(): void {
    if (!mapa) return;
    const dpr = window.devicePixelRatio || 1;
    const w = mini.clientWidth || 220, h = Math.round(w * (mapa.config.alto / mapa.config.ancho));
    if (mini.style.height !== `${h}px`) mini.style.height = `${h}px`;
    if (mini.width !== Math.round(w * dpr)) { mini.width = Math.round(w * dpr); mini.height = Math.round(h * dpr); }
    const ctx = mini.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = w / mapa.config.ancho;
    ctx.drawImage(imagenDeLejos(mapa), 0, 0, w, h);
    const { w: lw, h: lh } = tamano();
    ctx.strokeStyle = '#f1dcae';
    ctx.lineWidth = 1.5;
    ctx.strokeRect((camara.x - lw / 2 / camara.escala) * k, (camara.y - lh / 2 / camara.escala) * k, (lw / camara.escala) * k, (lh / camara.escala) * k);
    fichas.forEach((f, i) => {
      const p = posicionDe(f);
      const activo = i === elegido || comparar.includes(i);
      ctx.beginPath();
      ctx.arc(p.x * k, p.y * k, activo ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.lineWidth = activo ? 2 : 1;
      ctx.strokeStyle = activo ? '#f1dcae' : '#1b1a17';
      ctx.stroke();
    });
  }

  /** El campamento cuyo estandarte está bajo `(x, y)` del lienzo, si alguno. */
  function campamentoEn(x: number, y: number, radio: number, conv: (p: Point) => Point): number {
    let mejor = -1, d = radio;
    fichas.forEach((f, i) => {
      const p = conv(posicionDe(f));
      // El estandarte ocupa del pie hacia arriba y a la derecha.
      const dd = Math.min(Math.hypot(x - p.x, y - p.y), Math.hypot(x - p.x - 10, y - p.y + 25));
      if (dd < d) { d = dd; mejor = i; }
    });
    return mejor;
  }

  // ─────────── estado ───────────

  function elegir(i: number, volar = true): void {
    if (!fichas[i]) return;
    elegido = i;
    pintarLista();
    pintarFicha();
    if (comparar.length === 2) pintarComparacion();
    if (volar) enfocar();
    lista.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function alternarComparar(i: number, si: boolean): void {
    comparar = comparar.filter((x) => x !== i);
    if (si) comparar = [...comparar, i].slice(-2);
    pintarLista();
    pintarComparacion();
    enfocar();
  }

  function repintarTodo(): void {
    calcular();
    pintarLista();
    pintarFicha();
    pintarComparacion();
  }

  // ─────────── eventos ───────────

  lista.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const caja = t.closest<HTMLInputElement>('input[data-comparar]');
    if (caja) { alternarComparar(Number(caja.dataset.comparar), caja.checked); return; }
    if (t.closest('.elegir-comparar')) return;
    const tarjeta = t.closest<HTMLElement>('.elegir-tarjeta');
    if (tarjeta) elegir(Number(tarjeta.dataset.i));
  });
  lista.addEventListener('keydown', (ev) => {
    const tarjeta = (ev.target as HTMLElement).closest<HTMLElement>('.elegir-tarjeta');
    if (!tarjeta) return;
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elegir(Number(tarjeta.dataset.i)); }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const i = Math.max(0, Math.min(fichas.length - 1, Number(tarjeta.dataset.i) + (ev.key === 'ArrowDown' ? 1 : -1)));
      elegir(i);
      lista.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus();
    }
  });
  const irA = (ev: Event): void => {
    const a = (ev.target as HTMLElement).closest<HTMLElement>('[data-ir]');
    if (!a) return;
    ev.preventDefault();
    elegir(Number(a.dataset.ir));
  };
  cuerpoFicha.addEventListener('click', irA);
  cajaComparar.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('.elegir-cerrar')) { comparar = []; pintarLista(); pintarComparacion(); enfocar(); return; }
    // Elegir uno de los dos cierra la comparación y vuela hasta él.
    if ((ev.target as HTMLElement).closest('[data-ir]')) { comparar = []; pintarComparacion(); }
    irA(ev);
  });
  raiz.querySelector('#elegir-por-mi')?.addEventListener('click', () => {
    // Al azar entre los tres mejor valorados, con más peso cuanto mejor.
    const mejores = fichas.map((f, i) => ({ i, nota: f.valoracion?.nota ?? 0.5 })).sort((a, b) => b.nota - a.nota).slice(0, 3);
    const total = mejores.reduce((s, m) => s + m.nota + 0.05, 0);
    let r = Math.random() * total;
    const elegidoAzar = mejores.find((m) => (r -= m.nota + 0.05) <= 0) ?? mejores[0];
    if (elegidoAzar) elegir(elegidoAzar.i);
  });

  // Arrastrar para mover, rueda para acercar; un clic sobre un estandarte lo elige.
  let arrastre: { x: number; y: number; cx: number; cy: number; movido: boolean } | null = null;
  lienzo.addEventListener('pointerdown', (ev) => { arrastre = { x: ev.clientX, y: ev.clientY, cx: camara.x, cy: camara.y, movido: false }; lienzo.setPointerCapture(ev.pointerId); });
  lienzo.addEventListener('pointermove', (ev) => {
    const r = lienzo.getBoundingClientRect();
    if (!arrastre) { lienzo.style.cursor = campamentoEn(ev.clientX - r.left, ev.clientY - r.top, 26, aPantalla) >= 0 ? 'pointer' : 'grab'; return; }
    const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y;
    if (Math.hypot(dx, dy) > 4) arrastre.movido = true;
    if (arrastre.movido) { vuelo = null; camara.x = arrastre.cx - dx / camara.escala; camara.y = arrastre.cy - dy / camara.escala; lienzo.style.cursor = 'grabbing'; }
  });
  lienzo.addEventListener('pointerup', (ev) => {
    const a = arrastre;
    arrastre = null;
    if (!a || a.movido) return;
    const r = lienzo.getBoundingClientRect();
    const i = campamentoEn(ev.clientX - r.left, ev.clientY - r.top, 26, aPantalla);
    if (i >= 0) elegir(i);
  });
  lienzo.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    vuelo = null;
    const r = lienzo.getBoundingClientRect();
    const { w, h } = tamano();
    const mx = ev.clientX - r.left - w / 2, my = ev.clientY - r.top - h / 2;
    const antes = { x: camara.x + mx / camara.escala, y: camara.y + my / camara.escala };
    camara.escala = Math.max(mapa ? 0.8 * Math.min(w / mapa.config.ancho, h / mapa.config.alto) : 0.15, Math.min(6, camara.escala * Math.exp(-ev.deltaY * 0.0015)));
    camara.x = antes.x - mx / camara.escala;
    camara.y = antes.y - my / camara.escala;
  }, { passive: false });
  mini.addEventListener('click', (ev) => {
    if (!mapa) return;
    const r = mini.getBoundingClientRect();
    const k = r.width / mapa.config.ancho;
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const i = campamentoEn(x, y, 14, (p) => ({ x: p.x * k, y: p.y * k }));
    if (i >= 0) elegir(i);
    else volarA({ x: x / k, y: y / k, escala: camara.escala }, 500);
  });

  raiz.querySelector<HTMLFormElement>('#form-crear-heroe')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = fichas[elegido];
    const nombre = raiz.querySelector<HTMLInputElement>('#input-nombre-heroe')?.value.trim() ?? '';
    if (!f) return;
    botonCrear.disabled = true;
    const mensaje = await o.crear(nombre, f.c.id);
    if (!mensaje || !vivo) return;
    botonCrear.disabled = false;
    const error = raiz.querySelector<HTMLElement>('#error-heroe');
    if (error) error.textContent = mensaje;
  });

  // ─────────── arranque ───────────

  calcular();
  pintarLista();
  pintarFicha();
  o.alCargarDatos?.(() => { if (vivo) repintarTodo(); });
  marco = requestAnimationFrame(dibujar);
  void o.mapa.then((m) => {
    if (!vivo) return;
    mapa = m;
    raiz.querySelector('.elegir-cargando')?.remove();
    repintarTodo();
    elegir(recomendado >= 0 ? recomendado : 0, false);
    // Se abre con el mundo entero y la cámara baja hasta el recomendado.
    const { w, h } = tamano();
    Object.assign(camara, { x: m.config.ancho / 2, y: m.config.alto / 2, escala: Math.min(w / m.config.ancho, h / m.config.alto) });
    setTimeout(() => { if (vivo) volarA(encuadre([elegido]), 1400); }, 450);
  }).catch(() => {
    const aviso = raiz.querySelector('.elegir-cargando');
    if (aviso) aviso.textContent = 'No se pudo cargar el mapa del mundo: puedes elegir igual desde la lista.';
  });

  return () => { vivo = false; cancelAnimationFrame(marco); };
}

/** El N de `camp-N` (el índice en el artefacto); si el id no lo trae, su posición en la lista. */
function numeroDe(id: string, porDefecto: number): number {
  const m = /(\d+)$/.exec(id);
  return m ? Number(m[1]) : porDefecto;
}
