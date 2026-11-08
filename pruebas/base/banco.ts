// Banco de la BASE PERSONAL (0.161.0, `/pruebas/base/`): una partida de mentira, sin servidor, con la ventana que pinta `renderPanelJugador`.
// `?pestana=tropas|bienes|loadouts|heroe|historial|plazas`; `?donde=plaza` (por defecto: dentro de tu plaza, con escuadras por reponer),
// `?donde=camp` (en tu campamento de mercenarios, con una prestada y una del Barracón por reponer) o `?donde=columna` (en el mapa).
import '../../src/style.css';
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import type { ProyeccionJugador } from '../../src/apiCliente';
import { cablearBasePersonal, elegirPestanaBase, htmlBasePersonal, type PestanaBase } from '../../src/ui/basePersonal';
import { estadoCliente } from '../../src/ui/estadoCliente';

const qs = new URLSearchParams(location.search);
const donde = qs.get('donde') ?? 'plaza';
const AHORA = Date.parse('2026-11-06T12:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const enCamp = donde === 'camp';
const columna = donde === 'columna';
const edificios = [
  { id: 'e1', tipo: 'centroUrbano', estado: 'activo', nivelInterno: 3 }, { id: 'e2', tipo: 'barracon', estado: 'activo', nivelInterno: 2 },
  { id: 'e3', tipo: 'galeriaDeTiro', estado: 'activo', nivelInterno: 1 },
];
const almacen = Object.fromEntries(Object.entries({ madera: 640, piedra: 210, trigo: 900, oro: 120, armaMadera: 14, armaBronce: 2, armaduraBasica: 6, armaduraIntermedia: 0 }).map(([k, n]) => [k, { cantidad: n, capacidad: 2000 }]));
const esc = (id: string, nombre: string, tropaId: string, cantidad: number, contenedor: object, extra: object = {}) => ({
  id, nombre, heroeId: 'h', tropaId, origen: 'pesants', cantidad, nivel: 2, experiencia: 4, moral: 86, contenedor, enGuarnicion: false, habilidadesDesbloqueadas: [], formacionesDesbloqueadas: [], formacionSeleccionada: 0, costeLiderazgo: Math.ceil(cantidad / 2), ...extra,
});
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'h', faccionId: enCamp ? null : 'fac-1', mapaId: 'm',
  heroe: {
    id: 'h', displayName: 'Víctor', classDefinitionId: 'guerrero', nivel: 7, experienciaHaciaSiguienteNivel: 340, liderazgoBase: 120, puntosDeAtributoSinGastar: 3, puntosDePerkSinGastar: 0,
    atributosBase: { fuerza: 12, destreza: 8, armadura: 6, vitalidad: 10 }, perksDesbloqueados: [],
    ubicacion: enCamp ? { tipo: 'mercenarios', campamentoId: 'camp-2' } : columna ? { tipo: 'columna', ejercitoId: 'ej-1' } : { tipo: 'asentamiento', asentamientoId: 'as-1' },
    residenciaId: enCamp ? 'camp-2' : 'as-1',
    almacenPersonal: { oro: 86, trigo: 120, madera: 40, armaBronce: 3 }, capacidadAlmacenPersonal: 1000, carro: columna ? {} : { madera: 60, trigo: 30 },
    viveres: 210, monedas: 1450, cupoGuarnicion: 60, guarnicionOcupada: 13,
    escuadrones: enCamp ? [
      esc('s1', 'Leñadores', 'lenadores', 12, { tipo: 'campamento' }, { prestada: { campamentoId: 'camp-2' } }),
      esc('s2', 'Lanceros de mimbre', 'lanceros_mimbre', 9, { tipo: 'campamento' }),
      esc('s3', 'Honderos', 'honderos', 20, { tipo: 'campamento' }, { enGuarnicion: true }),
    ] : [
      esc('s1', 'Lanceros de mimbre', 'lanceros_mimbre', 25, columna ? { tipo: 'ejercito', ejercitoId: 'ej-1' } : { tipo: 'campamento' }, { enGuarnicion: !columna }),
      esc('s2', 'Hacheros ligeros', 'hacheros_ligeros', 7, columna ? { tipo: 'ejercito', ejercitoId: 'ej-1' } : { tipo: 'campamento' }),
      esc('s3', 'Honderos', 'honderos', 11, { tipo: 'campamento' }),
      esc('s4', 'Milicia de lanceros', 'milicia_lanceros', 25, { tipo: 'pueblo', puebloId: 'pu-1' }),
      esc('s5', 'Espadachines de cobre', 'espadachines_cobre', 14, { tipo: 'plaza', asentamientoId: 'as-4' }),
    ],
    loadouts: [{ id: 'l1', displayName: 'Defensa de casa', squadIds: ['s1', 's3'], perksSeleccionados: [], activo: true, liderazgoTotal: 18 }, { id: 'l2', displayName: 'Salida', squadIds: ['s1', 's2'], perksSeleccionados: [], activo: false, liderazgoTotal: 16 }],
    inventario: [{ itemDefinitionId: 'pocion_vigor', tipo: 'consumible', cantidad: 3, precio: 20, casillaInventario: 0 }, { itemDefinitionId: 'escudo_mimbre', tipo: 'armadura', cantidad: 1, precio: 45, casillaInventario: 1 }],
    equipamiento: { arma: { itemDefinitionId: 'espada_bronce', tipo: 'arma', cantidad: 1, precio: 120, casillaInventario: -1, estadisticas: [{ nombre: 'daño', valor: 14 }] }, casco: null, torso: { itemDefinitionId: 'coraza_lino', tipo: 'armadura', cantidad: 1, precio: 60, casillaInventario: -1 }, guantes: null, pantalones: null, botas: null },
    bandidosDestruidos: [AHORA - 30 * H, AHORA - 5 * H], alijosAbiertos: ['al-1', 'al-4', 'al-9'],
    plazasRecordadas: enCamp ? [] : [{ asentamientoId: 'as-1', vistoEn: AHORA - 3 * H, almacen: { madera: 610, piedra: 200, trigo: 880, oro: 110 }, obras: 2, guarnicion: 3 }],
  },
  facciones: enCamp ? [] : [{ id: 'fac-1', nombre: 'Casa de Micenas', reyId: 'h', nivel: 3, ciudadanosIds: ['h'], miembros: [{ heroeId: 'h', residenciaId: 'as-1', cargos: ['rey', 'gobernador@as-1'], participacion: 420 }] }],
  asentamientos: columna || enCamp ? [] : [{ id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, posicion: { x: 410, y: 300 }, heroesFundadoresIds: ['h'], edificios, almacen, poblacion: { pesants: 26, artesanos: 4, nobleza: 1 } }],
  plazasPropias: [{ id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, posicion: { x: 410, y: 300 } }, { id: 'as-4', nombre: 'Tirinto', faccionId: 'fac-1', nivel: 2, posicion: { x: 450, y: 330 } }],
  asentamientosAvistados: [],
  pueblos: [{ id: 'pu-1', tipo: 'cantera', recurso: 'piedra', madreId: 'as-1', posicion: { x: 420, y: 310 }, nombre: 'Cantera del Norte' }],
  campamentosMercenarios: [{ id: 'camp-2', posicion: { x: 200, y: 200 }, origen: 0, edificios: ['barracon', 'galeriaDeTiro'], residentesIds: enCamp ? ['h'] : [], eligieronComoInicial: 0, mercado: {} }],
  mercadoCampamento: enCamp ? { precios: {}, cupoRestante: {}, reclutamiento: { tropas: [{ tropaId: 'lanceros_mimbre', precioPorSoldado: 2.4, desbloqueada: true }, { tropaId: 'honderos', precioPorSoldado: 2.1, desbloqueada: true }], poblacion: 40, topePoblacion: 80 } } : undefined,
  ejercitos: columna ? [{ id: 'ej-1', tipo: 'personal', liderId: 'h', participantes: [{ heroeId: 'h' }], escuadronIds: ['s1', 's2'], posicionActual: { x: 300, y: 260 }, estado: 'marchando', suministro: { trigo: 90, oro: 25 }, capacidadCarga: 500, ruta: [] }] : [],
  informesPlaza: enCamp ? [] : [{ asentamientoId: 'as-8', faccionId: 'fac-2', nombre: 'Hattusa', nivel: 4, conocidoEn: AHORA - 26 * H, edificios: [{ tipo: 'centroUrbano', posicion: { x: 0, y: 0 }, estado: 'activo', ambito: 'ciudad', nivel: 4 }, { tipo: 'barracon', posicion: { x: 3, y: 1 }, estado: 'activo', ambito: 'ciudad', nivel: 2 }], recintos: [{ nivel: 1, celdas: [], avance: 0.6 }], guarnicion: [{ tropaId: 'arqueros', cantidad: 36, heroeId: 'x' }], heroesIds: ['x'] }],
  tarifasIntel: { informe: { oroPorNivel: 20, cooldownMinutos: 600 }, mirada: { radio: 20, duracionMinutos: 120, oroBase: 10, oroPorUnidad: 0.5, cooldownMinutos: 60 } },
  miradasIntel: [], caravanas: [], convocatorias: [], nombresHeroes: {},
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;
elegirPestanaBase((qs.get('pestana') ?? 'tropas') as PestanaBase);
const panel = document.querySelector<HTMLElement>('.jugador-panel')!;
function pintar(): void {
  panel.innerHTML = htmlBasePersonal(p, e, pintar);
  cablearBasePersonal(panel, p, { ejecutar: async () => null, aplicar: async () => null, repintar: pintar, cerrar: () => {}, abrirInforme: () => {}, abrirFaccion: () => {}, verEnMapa: () => {} });
}
pintar();
// el catálogo de tropas llega en segundo plano: se repinta hasta tenerlo
const reloj = setInterval(() => { pintar(); if (panel.querySelector('.base-escuadra .obra-barra')) clearInterval(reloj); }, 300);
(window as unknown as { __banco: unknown }).__banco = { listo: true, p };
