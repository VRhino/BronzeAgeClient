// Banco de la ventana de Diplomacia de la Facción (`/pruebas/diplomacia/?elegida=fac-2`): una partida de mentira, sin servidor, con la misma
// estructura que pinta `renderPanelJugador` en main.ts, para mirarla a distintos tamaños de pantalla. `?sinFaccion=1`: «Pedir ingreso» sin Facción.
import '../../src/style.css';
import datos from '../plaza/datos.json';
// El balance (`/v1/datos`) del banco de la plaza: el árbol de tecnologías lo necesita.
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import type { ProyeccionJugador } from '../../src/apiCliente';
import { cablearListaDiplomacia, cablearPlazasFaccion, elegirFaccion, htmlLateralFaccion, htmlListaFacciones, PESTANAS_FACCION, renderPestanaFaccion } from '../../src/ui/pestanaFaccion';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { cablearTecnologia, htmlTecnologia } from '../../src/ui/panelTecnologia';
import { catalogoDeTecnologia } from '../../src/apiCliente';
import { cablearDiplomacia } from '../../src/ui/panelDiplomacia';
import { cablearAnexion } from '../../src/ui/panelAnexion';

const AHORA = Date.parse('2026-11-03T12:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sig = (n: number) => ({ forma: n % 5, colorFondo: n % 7, colorFigura: (n + 3) % 7, figura: n % 9, division: n % 4 });
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'heroe-1', faccionId: 'fac-1', mapaId: 'm',
  heroe: { id: 'heroe-1', displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, carro: {}, escuadrones: [] },
  facciones: [
    { id: 'fac-1', nombre: 'Casa de Micenas', sigilo: sig(1), reyId: 'heroe-1', embajadorId: 'heroe-9', nivel: 3, reputacion: 14, prestigio: 340, topeAlianzas: 4, capFundacion: { cap: 4, plazas: 2, caravanas: 1 }, cuposDeNivel: [{ nivel: 2, cupo: 2, ocupadas: 1 }, { nivel: 3, cupo: 1, ocupadas: 1 }, { nivel: 4, cupo: 0, ocupadas: 0 }, { nivel: 5, cupo: 0, ocupadas: 0 }], experiencia: 420, ciudadanosIds: ['heroe-1', 'heroe-9', 'heroe-21'],
      miembros: [{ heroeId: 'heroe-1', residenciaId: 'as-1', cargos: ['rey'], participacion: 420 }, { heroeId: 'heroe-9', residenciaId: 'as-4', cargos: ['embajador'], participacion: 180 }] },
    { id: 'fac-2', nombre: 'Reino de Hatti', sigilo: sig(2), reyId: 'heroe-40', nivel: 4, reputacion: -3, prestigio: 1210, topeAlianzas: 13, ciudadanosIds: ['heroe-40', 'heroe-41'] },
    { id: 'fac-3', nombre: 'Señorío de Ugarit', sigilo: sig(3), reyId: 'heroe-50', nivel: 2, reputacion: 20, prestigio: 95, topeAlianzas: 1, ciudadanosIds: ['heroe-50', 'heroe-51', 'heroe-52', 'heroe-53'], esBot: true },
    { id: 'fac-4', nombre: 'Casa de Pilos', sigilo: sig(4), reyId: 'heroe-60', nivel: 2, reputacion: 5, prestigio: 40, topeAlianzas: 1, ciudadanosIds: ['heroe-60'] },
  ],
  directorioFacciones: Array.from({ length: 14 }, (_, i) => ({ id: `fac-d${i}`, nombre: ['Tribu de Arzawa', 'Gente de Lukka', 'Clan de Mitanni', 'Casa de Tebas', 'Reino de Alashiya', 'Casa de Cnosos', 'Señorío de Troya'][i % 7] + (i >= 7 ? ' II' : ''), sigilo: sig(i + 10), nivel: 1 + (i % 3), ciudadanos: 1 + (i % 4), esBot: i % 3 === 0 })),
  asentamientos: [{ id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, posicion: { x: 410, y: 300 } }],
  asentamientosAvistados: [{ id: 'as-8', nombre: 'Hattusa', faccionId: 'fac-2', nivel: 4, posicion: { x: 560, y: 240 } }, { id: 'as-9', nombre: 'Ugarit', faccionId: 'fac-3', nivel: 2, posicion: { x: 600, y: 400 } }],
  asentamientosConocidos: [{ asentamientoId: 'as-10', nombre: 'Pilos', faccionId: 'fac-4', nivel: 2, posicion: { x: 300, y: 420 } }],
  pueblos: [], avanzadas: [], caravanas: [], ejercitos: [], convocatorias: [], campamentosBandidos: [], ejercitosAvistados: [], caravanasAvistadas: [],
  relaciones: [
    { id: 'rel-1', tipo: 'guerra', estado: 'activa', faccionAId: 'fac-1', faccionBId: 'fac-2', pazPropuestaPor: 'fac-2' },
    { id: 'rel-2', tipo: 'alianza', estado: 'activa', faccionAId: 'fac-1', faccionBId: 'fac-3' },
  ],
  propuestasRelacion: [
    { id: 'prop-1', tipo: 'vasallaje', faccionAId: 'fac-4', faccionBId: 'fac-1', expiraEn: AHORA + 40 * H, tributo: { recurso: 'trigo', cantidadPorMinuto: 6 } },
    { id: 'prop-2', tipo: 'alianza', faccionAId: 'fac-1', faccionBId: 'fac-d1', expiraEn: AHORA + 60 * H },
  ],
  propuestasAnexion: [{ id: 'anx-1', absorbenteId: 'fac-4', absorbidaId: 'fac-1', propuestaPor: 'heroe-60', creadaEn: AHORA - H, expiraEn: AHORA + 50 * H }],
  propuestasFusion: [],
  campamentosMercenarios: [], heroesVisibles: [], titulos: [],
  nombresDeCompaneros: { 'heroe-9': 'Agamenón', 'heroe-40': 'Hattusili', 'heroe-50': 'Niqmaddu', 'heroe-60': 'Néstor' },
  tecnologia: {
    era: 'crisis_adaptacion', eraDesde: AHORA - 30 * H, capitalId: 'as-1',
    logros: [{ contador: 'caravanas.destruidasOCapturadas', umbral: 11000, en: AHORA - 20 * H }, { contador: 'reclutados.arqueros', umbral: 400, en: AHORA - 6 * H }],
    propias: {
      adoptadas: ['leva_comunal', 'hostigamiento_tribal', 'metalurgia_cobre', 'aleacion_bronce', 'escudos_ligeros', 'armamento_palacial', 'arqueria_palacial', 'cria_caballar', 'canteria'],
      aparecidas: ['carros_guerra', 'bronce_calidad_militar'],
    },
    reveladas: [{ tecnologiaId: 'forja_hierro_temprana', descubridorFaccionId: 'fac-2', hito: [{ tipo: 'edificio', edificio: 'fundicion', nivelInterno: 2 }, { tipo: 'yacimientoEnTerritorio', recurso: 'hierro' }], cumplidas: [true, false] }],
    epicasPosibles: ['equitacion_militar'],
    // Los contadores en curso del servidor (forma pública de `HEROE`, motor aa70ece6).
    contadores: { 'extraido.estano': 61250, 'extraido.cobre': 9000, 'reclutados.arqueros_compuesto': 40, 'fabricado.armaduraBronce': 12 },
    plazas: 12, // N de los umbrales por plaza (motor 8feafd4); sin `logrosPendientes`, lo cumplido sale de `logros`
  },
  aedasAvistados: [{ id: 'aeda-9', posicion: { x: 410, y: 300 }, enAsentamientoId: 'as-1' }],
  aedasResidentes: [{ id: 'aeda-1', nombre: 'Demódoco', asentamientoId: 'as-1' }],
} as unknown as ProyeccionJugador;
// `&vista=inicio`: una Facción recién fundada en la Era I (solo se ve la Era I); `&vista=avanzada`: 3 de 10 de la Era I, aparece la II bloqueada
const vistaTec = new URLSearchParams(location.search).get('vista');
if (vistaTec === 'inicio' || vistaTec === 'avanzada') {
  const t = p.tecnologia!;
  t.era = 'reinos_palaciales';
  t.propias = vistaTec === 'inicio'
    ? { adoptadas: ['leva_comunal', 'hostigamiento_tribal'], aparecidas: ['escudos_ligeros'] }
    : { adoptadas: ['leva_comunal', 'hostigamiento_tribal', 'escudos_ligeros', 'metalurgia_cobre'], aparecidas: ['aleacion_bronce', 'cria_caballar'] };
  t.reveladas = vistaTec === 'inicio' ? [] : [{ tecnologiaId: 'arqueria_palacial', descubridorFaccionId: 'fac-2', hito: [{ tipo: 'edificio', edificio: 'galeriaDeTiro', nivelInterno: 1 }], cumplidas: [false] }];
  t.logros = [{ contador: 'extraido.cobre', umbral: 999999, en: AHORA - H }];
  t.contadores = { 'extraido.estano': 3000, 'extraido.cobre': 9000, 'bandidos.campamentosDestruidos': 70 };
  t.epicasPosibles = [];
}
(p.asentamientos[0] as { almacen?: unknown }).almacen = { oro: { cantidad: 900, capacidad: 9999 }, madera: { cantidad: 5000, capacidad: 9999 }, piedra: { cantidad: 40, capacidad: 9999 } };

// `?pestana=plazas`: las plazas de tu Facción con su interior desde fuera (0.141.0, motor 5776ab69).
const M = 60_000;
const ex = (cantidad: number, capacidad: number, producido: number, consumido: number) => ({ cantidad, capacidad, porMinuto: producido - consumido, producido, produccion: producido, consumido });
(p as unknown as { plazasPropias: unknown[] }).plazasPropias = [
  { id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, nivelActual: 3, posicion: { x: 410, y: 300 }, medidorMantenimiento: 92, nutricionPoblacion: 100,
    poblacion: { pesants: 182, artesanos: 41, nobleza: 9 },
    almacen: { trigo: ex(640, 1200, 18, 11.5), madera: ex(1200, 1200, 9, 2), piedra: ex(310, 1200, 4, 1), cobre: ex(88, 600, 1.5, 0), estano: ex(12, 600, 0, 0.4), bronce: ex(40, 600, 0.6, 0), oro: ex(512, 2000, 3.2, 0.8) },
    edificios: [
      { id: 'ed-1', tipo: 'fundicion', estado: 'en_construccion', ambito: 'asentamiento', posicion: { x: 0, y: 0 }, completaEn: AHORA + 3 * M },
      { id: 'ed-2', tipo: 'granero', estado: 'activo', ambito: 'asentamiento', posicion: { x: 0, y: 0 }, nivelInterno: 1, mejora: { nivelObjetivo: 2, completaEn: AHORA + 42 * M } },
      { id: 'ed-3', tipo: 'lenera', estado: 'activo', ambito: 'asentamiento', posicion: { x: 0, y: 0 }, pausadoPorAlmacenLleno: true },
    ],
    ascenso: { nivelObjetivo: 4, iniciadoEn: AHORA - 4 * M, completaEn: AHORA + 6 * M },
    guarnicionIds: ['esc-1', 'esc-2', 'esc-3'], cupoGuarnicion: 60,
    guarnicion: [{ tropaId: 'lanceros', cantidad: 40, heroeId: 'heroe-1' }, { tropaId: 'arqueros', cantidad: 25, heroeId: 'heroe-1' }, { tropaId: 'lanceros', cantidad: 30, heroeId: 'heroe-9' }] },
  { id: 'as-4', nombre: 'Tirinto', faccionId: 'fac-1', nivel: 2, nivelActual: 1, posicion: { x: 380, y: 340 }, medidorMantenimiento: 38, nutricionPoblacion: 64,
    poblacion: { pesants: 64, artesanos: 8, nobleza: 0 }, autoConstruccionPausada: true,
    almacen: { trigo: ex(22, 600, 4, 6.5), madera: ex(140, 600, 3, 1), oro: ex(70, 1000, 0.8, 0.4) },
    edificios: [{ id: 'ed-9', tipo: 'vivienda', estado: 'activo', ambito: 'asentamiento', posicion: { x: 0, y: 0 }, danado: true }], cupoGuarnicion: 30 },
];
p.asentamientosAvistados.push({ id: 'as-4', nombre: 'Tirinto', faccionId: 'fac-1', nivel: 2, posicion: { x: 380, y: 340 } } as never);
// `&tope=1` (tanda 69): tu Facción con una sola alianza de tope (la de Ugarit) y Pilos que te propone otra: solo se puede rechazar
if (new URLSearchParams(location.search).get('tope')) {
  Object.assign(p.facciones[0]!, { prestigio: 60, topeAlianzas: 1 });
  p.propuestasRelacion = [{ id: 'prop-3', tipo: 'alianza', faccionAId: 'fac-4', faccionBId: 'fac-1', expiraEn: AHORA + 40 * H } as never];
}
estadoCliente.proyeccionUltima = p;

const panel = document.querySelector<HTMLElement>('.jugador-panel')!;
function pintar(): void {
  if (new URLSearchParams(location.search).get('sinFaccion')) {
    // como `renderPanelJugador` sin Facción: la cabecera y el cuerpo, con la lista que rellena `cablearFaccion`
    (p as unknown as { faccionId: null }).faccionId = null;
    estadoCliente.modoPanelFaccion = 'unirse';
    panel.classList.remove('jugador-panel-faccion');
    panel.innerHTML = `<div class="faccion-cabecera"><div class="mapa-panel-jugador">Víctor</div><button class="btn-secondary" type="button">Cerrar</button></div><div class="faccion-cuerpo">${renderPestanaFaccion(p, e, 'resumen')}</div>`;
    // como `cablearFaccion` en main.ts: bots al final y, con la casilla marcada (de serie), ocultos
    const lista = panel.querySelector<HTMLElement>('#lista-facciones')!;
    const casilla = panel.querySelector<HTMLInputElement>('#check-sin-bots')!;
    const pintarLista = (): void => { lista.innerHTML = htmlListaFacciones(p, e, { accion: (f) => (f.esBot || p.directorioFacciones?.find((x) => x.id === f.id)?.esBot ? '<span class="faccion-pedido">🤖 De bots</span>' : '<button class="btn-join-faction" type="button">Pedir ingreso</button>'), botsAlFinal: true, sinBots: casilla.checked }); };
    casilla.addEventListener('change', pintarLista);
    pintarLista();
    return;
  }
  elegirFaccion(new URLSearchParams(location.search).get('elegida'));
  // `?pestana=tecnologia`: la pestaña de Tecnología (0.123.0), como la pinta main.ts
  const pestana = new URLSearchParams(location.search).get('pestana') ?? 'diplomacia';
  const pestanas = `<nav class="faccion-pestanas" role="tablist">${PESTANAS_FACCION.map(([id, nombre]) => `<button type="button" class="faccion-pestana${id === pestana ? ' activo' : ''}">${nombre}</button>`).join('')}</nav>`;
  const cuerpo = pestana === 'plazas' ? renderPestanaFaccion(p, e, 'plazas', '', true) : pestana === 'tecnologia' ? `<section class="faccion-tecnologia">${htmlTecnologia(p, e, false)}</section>` : renderPestanaFaccion(p, e, 'diplomacia', '', true);
  panel.innerHTML = `<div class="faccion-cabecera"><div class="mapa-panel-jugador">Facción</div><button class="btn-secondary" type="button">Cerrar</button></div><div class="faccion-marco">${htmlLateralFaccion(p, e)}<div class="faccion-principal">${pestanas}<div class="faccion-cuerpo${pestana === 'diplomacia' ? ' faccion-cuerpo-diplomacia' : pestana === 'plazas' || pestana === 'tecnologia' ? ' faccion-cuerpo-ancho' : ''}">${cuerpo}</div></div></div>`;
  cablearPlazasFaccion(panel, pintar);
  cablearListaDiplomacia(panel, pintar);
  const ejecutar = async (tipo: string, params: object): Promise<string | null> => { console.log('orden', tipo, JSON.stringify(params)); return null; };
  cablearDiplomacia(panel, p, ejecutar, (m) => console.log('aviso', m));
  cablearAnexion(panel, p, ejecutar, (m) => console.log('aviso', m));
  const tec = panel.querySelector<HTMLElement>('.faccion-tecnologia');
  if (tec) cablearTecnologia(tec, ejecutar);
  panel.querySelectorAll<HTMLButtonElement>('[data-elegir-faccion]').forEach((b) => b.addEventListener('click', () => {
    const u = new URL(location.href); u.searchParams.set('elegida', b.dataset.elegirFaccion!); history.replaceState(null, '', u); pintar();
  }));
}
catalogoDeTecnologia(() => pintar());
pintar();
(window as unknown as { __banco: unknown }).__banco = { listo: true };
