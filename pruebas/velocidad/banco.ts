// Banco de la velocidad de la columna (`/pruebas/velocidad/`): una partida de mentira, sin servidor, con la ventana «Salir al mundo» de tu plaza,
// un ejército en preparación con una Caravana de Fundación esperando, la barra de víveres con su indicador y el aviso de fundar sin parcelas.
// Los datos de juego (tropas, movimiento, caravanas, animales) son los bloques de Docs/Mechanics del motor, en `datos.json`. Las órdenes no salen:
// se anotan en `window.__banco.enviadas`.
import datos from './datos.json';
// `GET /v1/datos` se contesta con `datos.json` antes de que el cliente lo pida.
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { tropasReclutables } from '../../src/apiCliente';
import { pintarVentanaSalida, reiniciarVentanaSalida } from '../../src/ui/ventanaSalida';
import { htmlIndicadorVelocidad, piezaDeFundacion, piezaDeTropa, velocidadDePiezas } from '../../src/ui/velocidadColumna';
import { htmlParcelasAlFundar } from '../../src/ui/pestanaAsentamientos';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const banco = { enviadas: [] as [string, object][], listo: false, ver: (_: string) => {} };
(window as unknown as { __banco: typeof banco }).__banco = banco;

const esc = (id: string, tropaId: string, nombre: string, cantidad: number, coste: number) => ({
  id, nombre, heroeId: 'heroe-1', tropaId, origen: 'pesants', cantidad, nivel: 2, experiencia: 0, moral: 80, contenedor: { tipo: 'campamento' }, enGuarnicion: false,
  habilidadesDesbloqueadas: [], formacionesDesbloqueadas: [], formacionSeleccionada: 0, costeLiderazgo: coste,
});
const escuadrones = [
  esc('e1', 'milicia_lanceros', 'Milicia de lanceros', 25, 7),
  esc('e2', 'honderos', 'Honderos', 20, 14),
  esc('e3', 'exploradores_caballo', 'Exploradores a caballo', 10, 22),
  esc('e4', 'hacheros_armados', 'Hacheros armados', 20, 22),
  esc('e5', 'arqueros', 'Arqueros', 20, 14),
];
const plaza = { id: 'as-1', nombre: 'Kydonia', faccionId: 'f-1', nivel: 2, posicion: { x: 0, y: 0 }, almacen: { trigo: { cantidad: 400 }, madera: { cantidad: 220 } }, heroesFundadoresIds: ['heroe-1'] };
const base = {
  instante: Date.parse('2026-11-02T10:00:00Z'), heroeId: 'heroe-1', faccionId: 'f-1',
  facciones: [{ id: 'f-1', nombre: 'Casa del Toro', reyId: 'heroe-1', miembros: [] }],
  asentamientos: [plaza], campamentosMercenarios: [], ejercitos: [], caravanas: [], convocatorias: [], heroesVisibles: [],
  heroe: { id: 'heroe-1', displayName: 'Korax', escuadrones, loadouts: [{ id: 'l1', displayName: 'Vanguardia', squadIds: ['e1', 'e2'], activo: true }], liderazgoBase: 100, viveres: 180, carro: { capacidad: 300 }, almacenPersonal: {} },
  nombresDeCompaneros: { 'heroe-2': 'Ita', 'heroe-3': 'Nestor' },
};
const proyeccion = (extra: object): ProyeccionJugador => ({ ...base, ...extra }) as unknown as ProyeccionJugador;

const convocatoria = {
  id: 'cv-1', lugar: { tipo: 'asentamiento', id: 'as-1' }, liderId: 'heroe-1', soyLider: true, politicaDeUnion: 'aceptar', peticiones: [],
  integrantes: [
    { heroeId: 'heroe-1', escuadronIds: ['e1', 'e2'], tropaIds: ['milicia_lanceros', 'honderos'], tropas: [], carga: {} },
    { heroeId: 'heroe-2', escuadronIds: ['x1', 'x2'], tropaIds: ['peltastas', 'exploradores_caballo'], tropas: [], carga: {} },
  ],
};
const fundacion = { id: 'caravana-7', tipo: 'construccion', estado: 'disponible', origenAsentamientoId: 'as-1', contenido: { madera: 300, piedra: 150, trigo: 120 }, posicionActual: { x: 0, y: 0 } };

const lienzo = document.querySelector<HTMLElement>('#lienzo')!;
let vista = 'salida';
function ver(v: string): void {
  vista = v;
  lienzo.innerHTML = '';
  if (v === 'salida' || v === 'convocatoria') {
    const p = v === 'salida' ? proyeccion({}) : proyeccion({ convocatorias: [convocatoria], miConvocatoriaId: 'cv-1', caravanas: [fundacion] });
    const caja = document.createElement('div');
    caja.className = 'salida-ventana';
    caja.style.position = 'static';
    lienzo.append(caja);
    const ejecutar = async (tipo: string, params: object) => { banco.enviadas.push([tipo, params]); return null; };
    const pintarla = (): void => pintarVentanaSalida(caja, p, { tipo: 'residencia', asentamiento: plaza as never }, ejecutar as never, () => {}, pintarla, e);
    reiniciarVentanaSalida();
    pintarla();
  } else if (v === 'barra') {
    const fila = (titulo: string, piezas: string[], forzada: boolean, caravana = false): string => {
      const vel = velocidadDePiezas([...piezas.map(piezaDeTropa), ...(caravana ? [piezaDeFundacion()] : [])], forzada);
      return `<p>${titulo}</p><div class="mapa-comida"><button type="button" class="mapa-forzada${forzada ? ' activa' : ''}">» Marcha forzada</button>${htmlIndicadorVelocidad(vel, e)}<span>🌾 Víveres</span><div class="mapa-comida-barra"><i style="width:60%"></i></div><strong>180 / 300</strong><button type="button" class="btn-secondary">＋ desde el carro</button></div>`;
    };
    lienzo.innerHTML = `<div class="banco-barras">
      ${fila('Con la Caravana de Fundación (10 u/min)', ['milicia_lanceros'], false, true)}
      ${fila('Con hacheros armados (pesada, 18)', ['milicia_lanceros', 'hacheros_armados'], false)}
      ${fila('Con arqueros (media, 24)', ['milicia_lanceros', 'arqueros'], false)}
      ${fila('Solo infantería ligera (30)', ['milicia_lanceros', 'honderos'], false)}
      ${fila('Ligera con marcha forzada (45)', ['milicia_lanceros', 'honderos'], true)}
      ${fila('Solo caballería (84)', ['exploradores_caballo'], false)}
    </div>`;
  } else {
    lienzo.innerHTML = `<div class="foundation-resources" style="max-width:420px">${htmlParcelasAlFundar([])}${htmlParcelasAlFundar([{ centro: { x: 0, y: 0 }, estado: 'ocupada' }])}${htmlParcelasAlFundar([{ centro: { x: 0, y: 0 }, estado: 'libre' }, { centro: { x: 1, y: 0 }, estado: 'libre' }])}</div>`;
  }
}
banco.ver = ver;
document.querySelectorAll<HTMLButtonElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => ver(b.dataset.ver!)));
// Se pinta cuando llega el catálogo (el balance se pide al primer uso).
const esperar = (): void => { if (tropasReclutables(esperar)) { ver(vista); banco.listo = true; } };
esperar();
