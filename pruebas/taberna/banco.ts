// Banco de la taberna regional (tanda 69, `/pruebas/taberna/`): una partida de mentira, sin servidor, para mirar y fotografiar el informe de la
// región en la taberna (`?ver=intel`), el tablón de los campamentos de la región (`?ver=mercenarios`) y las órdenes de la región en el Mercado
// (`?ver=mercado`). `&monedas=N` da monedas al héroe; `&sinCargo=1` le quita el Gobierno de la plaza. Las órdenes se anotan en `window.__banco.enviadas`.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import { bloqueDeDatos, tarifasDeIntel, type ProyeccionJugador } from '../../src/apiCliente';
import type { MapaGenerado } from '../../src/terreno';
import { estadoCliente } from '../../src/ui/estadoCliente';
import type { ContextoPlaza } from '../../src/ui/ganchos';
import { cablearPanelIntel, renderPanelIntel } from '../../src/ui/panelIntel';
import { cablearMercenariosDeRegion, cablearOrdenesRegion, htmlMercenariosDeRegion, htmlOrdenesRegion } from '../../src/ui/tabernaRegion';

const qs = new URLSearchParams(location.search);
const ver = qs.get('ver') ?? 'intel';
const AHORA = Date.parse('2026-11-08T18:00:00Z');
const MIN = 60_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Un mundo de 400 × 300 con dos regiones del relieve: la mitad oeste (3) y la este (5).
const columnas = 40, filas = 30;
const region = new Uint8Array(columnas * filas).map((_, i) => (i % columnas < 24 ? 3 : 5));
estadoCliente.mapaCache = { id: 'banco', mapa: { rasters: { region: { columnas, filas, celda: 10, datos: region } }, regiones: [{ id: 3, nombre: 'Llanura de Argos' }, { id: 5, nombre: 'Altiplano interior' }], nodos: [], parcelas: [] } as unknown as MapaGenerado };

const sinCargo = Boolean(qs.get('sinCargo'));
const plaza = {
  id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, nivelActual: 3, posicion: { x: 120, y: 150 },
  heroesFundadoresIds: ['heroe-1'],
  cargos: { gobernadorId: sinCargo ? 'heroe-9' : 'heroe-1', tesoreroId: null, maestroCaravanasId: null, maestroObrasId: null, generalId: null, sacerdoteId: null },
  almacen: { oro: { cantidad: 340, capacidad: 2000 }, trigo: { cantidad: 900, capacidad: 2000 }, vino: { cantidad: 60, capacidad: 2000 }, madera: { cantidad: 400, capacidad: 2000 } },
  edificios: [{ id: 'e1', tipo: 'taberna', estado: 'activo', nivelInterno: 1 }, { id: 'e2', tipo: 'mercado', estado: 'activo', nivelInterno: 2 }],
  politicasActivas: [],
  mercenariosRegion: [
    { heroeId: 'heroe-30', campamentoId: 'camp-2', tropa: [{ tropaId: 'milicia_lanceros', cantidad: 60, nivel: 4 }, { tropaId: 'arqueros', cantidad: 30, nivel: 3 }], tarifas: [{ plazoDias: 1, oro: 12, monedas: 1200 }, { plazoDias: 3, oro: 28, monedas: 2800 }, { plazoDias: 7, oro: 56, monedas: 5600 }, { oro: 400, monedas: 40000 }],
      ficha: { rango: 3, rangoId: 'capitan', renombre: 420, renombreSiguienteRango: 700, medallas: [{ id: 'muralla', grado: 2, cuenta: 12, siguienteUmbral: 25 }], premios: 0, historial: { firmados: 14, terminados: 12, despidos: 1, buenas: 6, malas: 1 } } },
    { heroeId: 'heroe-31', campamentoId: 'camp-4', tropa: [{ tropaId: 'granjeros', cantidad: 20, nivel: 1 }], tarifas: [{ plazoDias: 1, oro: 6, monedas: 600 }, { plazoDias: 3, oro: 13, monedas: 1300 }, { plazoDias: 7, oro: 25, monedas: 2500 }, { oro: 180, monedas: 18000 }],
      ficha: { rango: 1, rangoId: 'a_sueldo', renombre: 20, renombreSiguienteRango: 100, medallas: [], premios: 0, historial: { firmados: 1, terminados: 0, despidos: 1, buenas: 0, malas: 0 } } },
  ],
};
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'heroe-1', faccionId: 'fac-1',
  heroe: { id: 'heroe-1', displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, monedas: Number(qs.get('monedas') ?? 0), escuadrones: [] },
  facciones: [
    { id: 'fac-1', nombre: 'Casa de Micenas', nivel: 3, reyId: sinCargo ? 'heroe-9' : 'heroe-1', miembros: [{ heroeId: 'heroe-1', residenciaId: 'as-1', cargos: sinCargo ? [] : ['rey', 'gobernador@as-1'], participacion: 100 }],
      informesRegion: [
        { region: 3, tipo: 'ordenes', compradoEn: AHORA - 40 * MIN, caducaEn: AHORA + 160 * MIN, libreEn: AHORA + 320 * MIN },
        { region: 5, tipo: 'plazas', compradoEn: AHORA - 300 * MIN, libreEn: AHORA + 60 * MIN },
      ] },
    { id: 'fac-2', nombre: 'Reino de Tirinto', nivel: 2 },
    { id: 'fac-3', nombre: 'Hermandad de Pilos', nivel: 1 },
    { id: 'fac-4', nombre: 'Liga de Tebas', nivel: 2 },
  ],
  directorioFacciones: [{ id: 'fac-5', nombre: 'Clan de Eubea', nivel: 1, ciudadanos: 4, derrotada: false, sigilo: {} }],
  asentamientos: [plaza],
  // Lo que ves ahora y lo que recuerdas: en la región 3 (oeste) Argos se ve; en la 5 (este), las fichas del informe de plazas. Tebas está en
  // guerra con tu Facción (no entra en los informes) y Corinto es tuya.
  asentamientosAvistados: [{ id: 'as-9', nombre: 'Argos', faccionId: 'fac-3', nivel: 2, posicion: { x: 100, y: 60 }, zona: [] }],
  asentamientosConocidos: [
    { asentamientoId: 'as-7', nombre: 'Tirinto', faccionId: 'fac-2', nivel: 2, posicion: { x: 170, y: 120 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-8', nombre: 'Nauplia', faccionId: 'fac-3', nivel: 1, posicion: { x: 60, y: 230 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-10', nombre: 'Lerna', faccionId: 'fac-2', nivel: 1, posicion: { x: 150, y: 250 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-20', nombre: 'Orcómeno', faccionId: 'fac-3', nivel: 3, posicion: { x: 300, y: 60 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-21', nombre: 'Gla', faccionId: 'fac-2', nivel: 2, posicion: { x: 330, y: 110 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-22', nombre: 'Platea', faccionId: 'fac-5', nivel: 1, posicion: { x: 270, y: 180 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-23', nombre: 'Tanagra', faccionId: 'fac-3', nivel: 2, posicion: { x: 360, y: 200 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-24', nombre: 'Calcis', faccionId: 'fac-5', nivel: 4, posicion: { x: 380, y: 40 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-25', nombre: 'Áulide', faccionId: 'fac-2', nivel: 1, posicion: { x: 320, y: 260 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-26', nombre: 'Tebas', faccionId: 'fac-4', nivel: 4, posicion: { x: 290, y: 140 }, conocidoEn: AHORA - 300 * MIN },
    { asentamientoId: 'as-27', nombre: 'Corinto', faccionId: 'fac-1', nivel: 2, posicion: { x: 250, y: 90 }, conocidoEn: AHORA - 300 * MIN },
  ],
  ordenes: [
    { id: 'ord-11', asentamientoId: 'as-7', tipo: 'venta', recurso: 'estano', cantidad: 120, cantidadCumplida: 20, precioUnitario: 3.2, creadoEn: AHORA - 90 * MIN, expiraEn: AHORA + 300 * MIN, estado: 'activa' },
    { id: 'ord-12', asentamientoId: 'as-7', tipo: 'compra', recurso: 'trigo', cantidad: 400, cantidadCumplida: 0, precioUnitario: 1.1, creadoEn: AHORA - 30 * MIN, expiraEn: AHORA + 600 * MIN, estado: 'activa' },
    { id: 'ord-13', asentamientoId: 'as-8', tipo: 'compra', recurso: 'aceite', cantidad: 50, cantidadCumplida: 0, precioUnitario: 4.5, creadoEn: AHORA - 10 * MIN, expiraEn: AHORA + 200 * MIN, estado: 'activa' },
    { id: 'ord-14', asentamientoId: 'as-8', tipo: 'venta', recurso: 'cobre', cantidad: 80, cantidadCumplida: 0, precioUnitario: 2.6, creadoEn: AHORA - 10 * MIN, expiraEn: AHORA + 200 * MIN, estado: 'activa' },
    { id: 'ord-15', asentamientoId: 'as-9', tipo: 'venta', recurso: 'vino', cantidad: 30, cantidadCumplida: 0, precioUnitario: 5.0, creadoEn: AHORA - 10 * MIN, expiraEn: AHORA + 90 * MIN, estado: 'activa' },
  ],
  caravanas: [
    { id: 'car-3', nombre: 'Ánfora', tipo: 'comercial', origenAsentamientoId: 'as-1', posicionActual: plaza.posicion, estado: 'disponible', carros: [{ tipoCarro: 'basico', animal: 'buey' }, { tipoCarro: 'basico', animal: 'buey' }], contenido: {} },
    { id: 'car-5', nombre: 'Sal del Egeo', tipo: 'comercial', origenAsentamientoId: 'as-1', posicionActual: { x: 200, y: 150 }, estado: 'en_transito', carros: [{ tipoCarro: 'basico', animal: 'buey' }], contenido: {} },
  ],
  campamentosMercenarios: [{ id: 'camp-2', posicion: { x: 90, y: 110 }, residentesIds: [], edificios: [] }, { id: 'camp-4', posicion: { x: 210, y: 70 }, residentesIds: [], edificios: [] }],
  heroesVisibles: [
    { heroeId: 'heroe-30', displayName: 'Korax el Tracio', classDefinitionId: 'guerrero', nivel: 9, escuadrasQueLleva: [], equipamiento: {} },
    { heroeId: 'heroe-31', displayName: 'Dumu', classDefinitionId: 'guerrero', nivel: 3, escuadrasQueLleva: [], equipamiento: {} },
  ],
  pueblos: [], avanzadas: [], convocatorias: [], campamentosBandidos: [], ejercitos: [], ejercitosAvistados: [], caravanasAvistadas: [],
  relaciones: [{ id: 'rel-1', tipo: 'guerra', estado: 'activa', faccionAId: 'fac-1', faccionBId: 'fac-4' }],
  miradasIntel: [], informesPlaza: [], nombresDeCompaneros: {},
  tarifasIntel: tarifasDeIntel(),
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const enviadas: unknown[] = [];
const ejecutar = async (tipo: string, params: object): Promise<string | null> => { enviadas.push({ tipo, params }); return null; };
const lienzo = document.getElementById('lienzo')!;

function pintar(): void {
  p.tarifasIntel = tarifasDeIntel();
  const a = p.asentamientos[0]!;
  if (ver === 'mercenarios') {
    lienzo.innerHTML = `<div class="banco-marco estrecho"><div class="asent-lado-cuerpo">${htmlMercenariosDeRegion(p, a, e)}</div></div>`;
    cablearMercenariosDeRegion(lienzo, ejecutar, pintar);
  } else if (ver === 'mercado') {
    lienzo.innerHTML = '<div class="banco-marco estrecho"><div class="asent-lado-cuerpo"></div></div>';
    const cuerpo = lienzo.querySelector<HTMLElement>('.asent-lado-cuerpo')!;
    const c = { proyeccion: p, asentamiento: a, cuerpo, ejecutar, refrescar: pintar, cargo: 'gobernador', resideAqui: true, escapar: e } as unknown as ContextoPlaza;
    cuerpo.innerHTML = htmlOrdenesRegion(c);
    cablearOrdenesRegion(c);
  } else {
    lienzo.innerHTML = `<div class="banco-marco"><div class="asent-lado-cuerpo">${renderPanelIntel(p, e)}</div></div>`;
    cablearPanelIntel(lienzo, p, ejecutar, pintar);
  }
}
pintar();
bloqueDeDatos('INTEL', pintar);
bloqueDeDatos('EDIFICIO_CATALOGO', pintar);
(window as unknown as { __banco: unknown }).__banco = { enviadas, listo: true };
