// Panel de rendimiento del cliente (Víctor, 2026-11-05): se abre y se cierra con F3 y solo mide mientras está abierto, así que cerrado no cuesta
// nada en producción. Enseña:
//   fotograma  fps, ms por fotograma (media, p95, máximo) de los últimos segundos, medidos con requestAnimationFrame
//   dibujo     llamadas de dibujo, triángulos, geometrías y texturas de cada vista 3D en pantalla (renderer.info, `rendimiento.ts`)
//   memoria    el montón de JS (solo en Chrome, `performance.memory`)
//   red        ping, bytes y mensajes por segundo, lo que tarda en aplicarse cada cambio y cada orden por tipo (`contrato/medidas.ts`)
// «Copiar» deja todo en el portapapeles como JSON, para pegarlo en un informe.
import { medidas } from '../contrato/medidas';
import { infoDeRenderers } from '../rendimiento';

/** Los fotogramas que entran en la media y el p95 (unos 4 s a 60 fps). */
const FOTOGRAMAS = 240;
/** Cada cuánto se repinta el panel, en ms. */
const REPINTAR_MS = 500;

let caja: HTMLElement | null = null;
let bucle = 0;
let temporizador: ReturnType<typeof setInterval> | undefined;
let intervalos: number[] = [];
let anterior = 0;

function fotograma(t: number): void {
  if (anterior) {
    intervalos.push(t - anterior);
    if (intervalos.length > FOTOGRAMAS) intervalos.shift();
  }
  anterior = t;
  bucle = requestAnimationFrame(fotograma);
}

function estadisticas(v: number[]): { media: number; p95: number; max: number } | null {
  if (!v.length) return null;
  const orden = [...v].sort((a, b) => a - b);
  return { media: v.reduce((t, x) => t + x, 0) / v.length, p95: orden[Math.min(orden.length - 1, Math.floor(orden.length * 0.95))]!, max: orden[orden.length - 1]! };
}

/** Todo lo medido, en un objeto (lo que pinta el panel y lo que copia «Copiar»). */
function foto() {
  const memoria = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const f = estadisticas(intervalos);
  return {
    fotograma: f ? { fps: 1000 / f.media, ...f } : null,
    dibujo: infoDeRenderers(),
    memoria: memoria ? { usadaMB: memoria.usedJSHeapSize / 1_048_576, limiteMB: memoria.jsHeapSizeLimit / 1_048_576 } : null,
    red: medidas.resumen(),
  };
}

const ms = (x: number | undefined): string => (x === undefined ? '—' : x < 10 ? x.toFixed(1) : Math.round(x).toString());
const miles = (x: number): string => Math.round(x).toLocaleString('es-ES');
const kb = (x: number): string => (x >= 1_048_576 ? `${(x / 1_048_576).toFixed(1)} MB` : `${(x / 1024).toFixed(1)} KB`);
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function pintar(): void {
  if (!caja) return;
  const d = foto();
  const f = d.fotograma;
  const tono = (x: number, bien: number, mal: number): string => (x <= bien ? 'bien' : x >= mal ? 'mal' : 'regular');
  const red = d.red;
  caja.querySelector('.rendimiento-cuerpo')!.innerHTML = `
    <div class="rendimiento-grupo"><b>Fotograma</b>${f
      ? `<span class="${tono(f.p95, 20, 40)}">${Math.round(f.fps)} fps · ${ms(f.media)} ms · p95 ${ms(f.p95)} · máx ${ms(f.max)}</span>`
      : '<span>midiendo…</span>'}</div>
    ${d.dibujo.length
      ? d.dibujo.map((r) => `<div class="rendimiento-grupo"><b>Dibujo · ${esc(r.nombre)}</b><span>${miles(r.llamadas)} llamadas · ${miles(r.triangulos)} triángulos</span><small>${r.geometrias} geometrías · ${r.texturas} texturas</small></div>`).join('')
      : '<div class="rendimiento-grupo"><b>Dibujo</b><span>sin vista 3D en pantalla</span></div>'}
    <div class="rendimiento-grupo"><b>Memoria JS</b><span>${d.memoria ? `${Math.round(d.memoria.usadaMB)} MB de ${Math.round(d.memoria.limiteMB)} MB` : 'solo en Chrome'}</span></div>
    <div class="rendimiento-grupo"><b>Red</b>
      <span class="${red.ping.media === undefined ? '' : tono(red.ping.media, 80, 250)}">ping ${ms(red.ping.ultima)} ms · media ${ms(red.ping.media)} · p95 ${ms(red.ping.p95)}</span>
      <span>recibe ${kb(red.bytesPorSegundo)}/s · ${red.mensajesPorSegundo.toFixed(1)} mensajes/s · ${kb(red.bytesTotales)} en total</span>
      <span>aplicar cambios: ${ms(red.aplicar.media)} ms · p95 ${ms(red.aplicar.p95)} · máx ${ms(red.aplicar.max)} <small>(${miles(red.aplicar.n)})</small></span></div>
    <div class="rendimiento-grupo"><b>Órdenes${red.ordenesEnVuelo ? ` · ${red.ordenesEnVuelo} en vuelo` : ''}</b>${red.ordenes.length
      ? `<table><tr><th>tipo</th><th>n</th><th>última</th><th>media</th><th>p95</th></tr>${red.ordenes.slice(0, 12).map((o) => `<tr><td>${esc(o.tipo)}</td><td>${o.n}</td><td>${ms(o.ultima)}</td><td>${ms(o.media)}</td><td>${ms(o.p95)}</td></tr>`).join('')}</table>`
      : '<span>ninguna todavía</span>'}</div>`;
}

function abrir(): void {
  if (caja) return;
  caja = document.createElement('aside');
  caja.className = 'rendimiento-panel';
  caja.setAttribute('role', 'status');
  caja.innerHTML = `<div class="rendimiento-cab"><span>Rendimiento <small>F3 para cerrar</small></span><button type="button" data-rendimiento-copiar>Copiar</button></div><div class="rendimiento-cuerpo"></div>`;
  caja.querySelector<HTMLButtonElement>('[data-rendimiento-copiar]')!.addEventListener('click', (ev) => {
    const b = ev.currentTarget as HTMLButtonElement;
    void navigator.clipboard?.writeText(JSON.stringify({ cuando: new Date().toISOString(), ...foto() }, null, 2))
      .then(() => { b.textContent = 'Copiado'; setTimeout(() => { b.textContent = 'Copiar'; }, 1500); }, () => { b.textContent = 'No se pudo'; });
  });
  document.body.appendChild(caja);
  intervalos = [];
  anterior = 0;
  bucle = requestAnimationFrame(fotograma);
  temporizador = setInterval(pintar, REPINTAR_MS);
  pintar();
}

function cerrar(): void {
  cancelAnimationFrame(bucle);
  if (temporizador) clearInterval(temporizador);
  temporizador = undefined;
  caja?.remove();
  caja = null;
  intervalos = [];
}

/** ¿Está abierto? */
export const rendimientoAbierto = (): boolean => caja !== null;

/** Abre o cierra el panel. */
export function alternarRendimiento(abrirlo = !caja): void {
  if (abrirlo) abrir();
  else cerrar();
}

/** Escucha F3 (una vez, al arrancar el cliente). */
export function montarPanelRendimiento(): void {
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'F3' || ev.repeat) return;
    ev.preventDefault();
    alternarRendimiento();
  });
}
