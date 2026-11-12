// Banco de los dos árboles (0.205.0, `/pruebas/arboles/`), sin servidor: `?arbol=tecnologias` (por defecto) o `?arbol=tropas`. Una Facción que
// ha adoptado las Eras I a III y parte de la IV, con el mundo en la Era IV (Profesionalización), para ver las Eras IV y V con sus hitos nuevos
// (escuadras vivas, héroes en la Facción, plaza de nivel, columnas en marcha, edificio en plaza de nivel) y las diez tropas nuevas con su ficha
// de combate. Las órdenes no salen.
import '../../src/style.css';
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import { bloqueDeDatos, catalogoDeTecnologia, tropasReclutables, type ProyeccionJugador } from '../../src/apiCliente';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { cablearTecnologia, htmlTecnologia } from '../../src/ui/panelTecnologia';
import { cablearReclutamiento, htmlReclutamiento } from '../../src/ui/reclutamiento';
import type { Asentamiento } from '../../src/tiposDominio';

const AHORA = Date.parse('2026-11-12T10:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const qs = new URLSearchParams(location.search);
const arbol = qs.get('arbol') ?? 'tecnologias';
const ERA_I = ['leva_comunal', 'hostigamiento_tribal', 'metalurgia_cobre', 'aleacion_bronce', 'escudos_ligeros', 'armamento_palacial', 'arqueria_palacial', 'cria_caballar', 'carros_guerra', 'canteria'];
const ERA_II = ['bronce_calidad_militar', 'forja_hierro_temprana', 'panoplia_bronce', 'disciplina_formacion', 'arco_compuesto', 'equitacion_militar', 'carpinteria_militar'];
const ERA_III = ['instituciones_civicas', 'ciudadania_militar', 'falange_hoplita', 'pantalla_escaramuzadores', 'arqueria_especializada', 'forja_hierro_estandarizada', 'bronce_laminado', 'caballeria_organizada', 'trabajos_asedio'];
const adoptadas = [...ERA_I, ...ERA_II, ...ERA_III, 'ejercito_permanente', 'logistica_campana',
  // en el de tropas, además, las que abren tropas de las Eras IV y V
  ...(arbol === 'tropas' ? ['cuerpo_oficiales', 'infanteria_profesional', 'hostigadores_profesionales', 'carga_caballeria', 'reforma_macedonica', 'falange_sarisa'] : [])];
const edificios = [['centroUrbano', 3], ['barracon', 3], ['galeriaDeTiro', 3], ['caballerizas', 3], ['armeria', 3], ['fundicion', 3], ['salaConsejo', 2]]
  .map(([tipo, n], i) => ({ id: `e${i}`, tipo, estado: 'activo', nivelInterno: n, posicion: { x: i, y: 0 } }));
const almacen = Object.fromEntries(Object.entries({ madera: 900, piedra: 400, trigo: 900, oro: 2400, armaMadera: 60, armaBronce: 40, armaHierro: 30, armaduraBasica: 40, armaduraIntermedia: 30, armaduraPesada: 10, caballos: 20 }).map(([k, n]) => [k, { cantidad: n, capacidad: 4000 }]));
const a = { id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 5, posicion: { x: 140, y: 120 }, edificios, almacen, cargos: { gobernadorId: 'h' }, poblacion: { pesants: 120, artesanos: 40, nobleza: 12 }, heroesFundadoresIds: ['h'] } as unknown as Asentamiento;
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'h', faccionId: 'fac-1',
  heroe: { id: 'h', displayName: 'Víctor', nivel: 18, liderazgoBase: 65, ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, residenciaId: 'as-1', carro: {}, escuadrones: [], loadouts: [] },
  facciones: [{ id: 'fac-1', nombre: 'Casa de Micenas', reyId: 'h', nivel: 6, ciudadanosIds: ['h', 'h2', 'h3'], miembros: [] }],
  asentamientos: [a], plazasPropias: [a], asentamientosAvistados: [], ejercitos: [], caravanas: [], heroesVisibles: [], nombresDeCompaneros: {},
  tecnologia: {
    era: arbol === 'tropas' ? 'hegemonia_macedonica' : 'profesionalizacion_imperial', eraDesde: AHORA - 50 * H, capitalId: 'as-1', logros: [], epicasPosibles: [], plazas: 9,
    contadores: { 'escuadras.veteranas': 3, 'batallas.conRey': 1, 'persecuciones.deCaballeria': 4 },
    propias: { adoptadas, aparecidas: ['cuerpo_oficiales', 'infanteria_profesional'] }, reveladas: [],
  },
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const panel = document.querySelector<HTMLElement>('.jugador-panel')!;
const ejecutar = async (): Promise<string | null> => null;
function pintar(): void {
  if (arbol === 'tropas') {
    panel.innerHTML = htmlReclutamiento(p, a, e, pintar);
    cablearReclutamiento(panel, p, a, ejecutar, pintar);
  } else {
    panel.innerHTML = htmlTecnologia(p, e);
    cablearTecnologia(panel, ejecutar);
  }
}
// el catálogo llega en segundo plano: se repinta hasta tenerlo
const reloj = setInterval(() => {
  const listo = catalogoDeTecnologia(() => {}) && tropasReclutables(() => {}) && bloqueDeDatos('EDIFICIO_CATALOGO') && bloqueDeDatos('OBJETOS');
  pintar();
  if (listo) { clearInterval(reloj); (window as unknown as { __banco: unknown }).__banco = { listo: true, p }; }
}, 300);
pintar();
