// Banco del panel de obras de la plaza (`/pruebas/plaza/`): Centro urbano › Edificios (construir, edificios, producción y cola) con una plaza de
// mentira, sin servidor. Los datos de juego son los bloques de Docs/Mechanics del motor (`datos.json`, como `GET /v1/datos`). Las órdenes no salen:
// se anotan en `window.__banco.enviadas`.
import datos from './datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { bloqueDeDatos } from '../../src/apiCliente';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { plegable, cablearPlegables } from '../../src/ui/plegable';
import { cablearPanelObras, htmlPanelObras } from '../../src/ui/panelObras';
import { htmlProduccionYRecetas } from '../../src/ui/vistaCiudad';
import type { Asentamiento, Edificio } from '../../src/tiposDominio';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const banco = { enviadas: [] as [string, object][], listo: false, ver: (_: string) => {} };
(window as unknown as { __banco: typeof banco }).__banco = banco;

const AHORA = Date.parse('2026-11-02T10:00:00Z');
const MIN = 60_000;
let n = 0;
const ed = (tipo: string, x: Partial<Edificio> = {}): Edificio => ({ id: `ed-${++n}`, tipo, estado: 'activo', posicion: { x: 0, y: 0 }, ...x });
const edificios: Edificio[] = [
  ed('centroUrbano', { nivelInterno: 2 }),
  ...Array.from({ length: 6 }, (_, i) => ed('vivienda', { nivelInterno: i < 2 ? 2 : 1 })),
  ed('almacen'), ed('almacen', { mejora: { nivelObjetivo: 2, completaEn: AHORA + 95 * MIN } }),
  ed('granero'),
  ed('granja', { nivelInterno: 2 }), ed('granja'), ed('granja'),
  ed('lenera', { pausadoPorAlmacenLleno: true }), ed('lenera', { pausadoPorAlmacenLleno: true }),
  ed('curtiduria'), ed('fundicion'), ed('armeria'),
  ed('barracon'),
  ed('mercado', { estado: 'en_construccion', completaEn: AHORA + 200 * MIN, prioridad: 90 }),
  ed('taberna', { estado: 'en_cola', prioridad: 60 }),
  ed('galeriaDeTiro', { estado: 'en_cola', prioridad: 40, danado: true }),
  ed('vivienda', { estado: 'en_cola', prioridad: 30 }),
];
const alm = (cantidad: number, capacidad: number, producido: number, consumido: number) => ({ cantidad, capacidad, producido, consumido, porMinuto: producido - consumido });
const plaza = {
  id: 'as-1', nombre: 'Kydonia', faccionId: 'f-1', nivel: 2, posicion: { x: 0, y: 0 }, edificios,
  poblacion: { pesants: 22, artesanos: 6, nobleza: 0 },
  almacen: {
    trigo: alm(420, 600, 8.5, 5.3), madera: alm(300, 300, 0, 0.6), piedra: alm(120, 400, 0.4, 0.9), cobre: alm(36, 200, 1.2, 2), livestock: alm(18, 100, 0.3, 0.5),
    lingoteCobre: alm(14, 100, 1, 0.6), cuero: alm(22, 100, 4, 2.5), armaduraBasica: alm(6, 50, 0.5, 0), armaMadera: alm(9, 50, 0, 0),
  },
  recetasPausadas: ['armaMadera'],
  cargos: { gobernadorId: 'heroe-1' },
} as unknown as Asentamiento;
const p = {
  instante: AHORA, heroeId: 'heroe-1', faccionId: 'f-1', asentamientos: [plaza], facciones: [{ id: 'f-1', nombre: 'Casa del Toro', nivel: 1 }],
  tecnologia: { propias: { adoptadas: ['leva_comunal'] } }, tecnologiasAdoptadas: ['leva_comunal'], heroe: { id: 'heroe-1', escuadrones: [] },
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo')!;
function ver(v: string): void {
  const cargo = v === 'gobernador' ? 'gobernador' as const : null;
  const ctx = { proyeccion: p, asentamiento: plaza, cuerpo, ejecutar: async (t: string, x: object) => { banco.enviadas.push([t, x]); return null; }, refrescar: () => ver(v), cargo, resideAqui: true, escapar: e };
  cuerpo.innerHTML = `<div class="asent-lado-cuerpo">${htmlPanelObras(ctx as never)}</div>`;
  cablearPlegables(cuerpo);
  cablearPanelObras(cuerpo, () => ver(v));
}
void plegable; void htmlProduccionYRecetas;
banco.ver = ver;
document.querySelectorAll<HTMLButtonElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => ver(b.dataset.ver!)));
const esperar = (): void => { if (bloqueDeDatos('EDIFICIO_CATALOGO', esperar)) { ver('gobernador'); banco.listo = true; } };
esperar();
