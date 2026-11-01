// Banco de la interfaz de mercenarios por contrato (`/pruebas/mercenarios/`): una partida de mentira, sin servidor, para mirar y fotografiar el tablón
// del campamento, la pestaña «Mercenarios» de la Facción, la marca en Miembros y la ficha reducida de un héroe a la vista. Las órdenes no salen: se
// anotan en `window.__banco.enviadas`.
import '../../src/style.css';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { cablearMercenariosFaccion, cablearTablonMercenarios, htmlMercenariosFaccion, htmlMercenarioPublico, htmlTablonMercenarios, anotarHechoMercenario } from '../../src/ui/mercenarios';
import { htmlMiembrosFaccion } from '../../src/ui/participacion';
import type { FichaMercenario } from '../../src/tiposDominio';

const AHORA = Date.parse('2026-11-01T18:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const medallas = (g: Record<string, [number, number, number?]>) => Object.entries(g).map(([id, [grado, cuenta, sig]]) => ({ id, grado, cuenta, siguienteUmbral: sig }));
const ficha = (rango: number, rangoId: string, renombre: number, sig: number | undefined, m: Record<string, [number, number, number?]>, h: [number, number, number, number, number]): FichaMercenario => ({
  rango, rangoId, renombre, renombreSiguienteRango: sig, medallas: medallas(m), premios: 0,
  historial: { firmados: h[0], terminados: h[1], despidos: h[2], buenas: h[3], malas: h[4] },
});
const fichas = {
  korax: ficha(3, 'capitan', 420, 700, { muralla: [2, 12, 25], palabra_cumplida: [2, 11, 30], cazador_de_bandidos: [1, 4, 10], bien_valorado: [0, 2, 5] }, [14, 12, 1, 6, 1]),
  ita: ficha(2, 'lanza', 140, 300, { buen_camino: [1, 7, 20], palabra_cumplida: [1, 3, 10] }, [4, 3, 0, 1, 0]),
  dumu: ficha(1, 'a_sueldo', 20, 100, {}, [1, 0, 1, 0, 0]),
  ninsun: ficha(5, 'senor_de_la_guerra', 1720, undefined, { asaltante: [3, 16], campana: [3, 18], muralla: [3, 27], leal: [2, 40, 90], cazador_de_bandidos: [2, 13, 25] }, [31, 29, 1, 17, 0]),
};
const reducida = (f: FichaMercenario): FichaMercenario => ({ ...f, historial: undefined, renombreSiguienteRango: undefined, medallas: f.medallas.filter((m) => m.grado > 0).map((m) => ({ id: m.id, grado: m.grado, cuenta: 0 })) });

let soloGobernador = false;
const p = (): ProyeccionJugador => ({
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'heroe-1', faccionId: 'fac-1', mapaId: 'm',
  heroe: { id: 'heroe-1', displayName: 'Víctor', ubicacion: { tipo: 'mercenarios', campamentoId: 'camp-2' }, carro: { oro: 260 }, escuadrones: [] },
  facciones: [
    {
      id: 'fac-1', nombre: 'Casa de Micenas', reyId: soloGobernador ? 'heroe-9' : 'heroe-1', embajadorId: null, nivel: 3, ciudadanosIds: ['heroe-1', 'heroe-9', 'heroe-21', 'heroe-22', 'heroe-23'],
      miembros: [
        { heroeId: 'heroe-1', residenciaId: 'as-1', cargos: soloGobernador ? ['gobernador@as-1'] : ['rey', 'gobernador@as-1'], participacion: 420 },
        { heroeId: 'heroe-9', residenciaId: 'as-4', cargos: soloGobernador ? ['rey'] : ['general@as-4'], participacion: 180 },
        { heroeId: 'heroe-21', residenciaId: 'camp-2', cargos: [], participacion: 0, marca: 'temporal' },
        { heroeId: 'heroe-22', residenciaId: 'camp-3', cargos: [], participacion: 0, marca: 'temporal' },
        { heroeId: 'heroe-23', residenciaId: 'as-4', cargos: [], participacion: 0, marca: 'permanente' },
      ],
      contratos: [
        { mercenarioId: 'heroe-21', faccionId: 'fac-1', asentamientoId: 'as-1', trabajo: 'defender', objetivo: { campo: 'puebloId', id: 'pu-3' }, plazoDias: 3, firmadoPorId: 'heroe-1', puestoFirma: 'gobernador@as-1', firmadoEn: AHORA - 60 * H, venceEn: AHORA + 12 * H, campamentoBaseId: 'camp-2', renombre: 25,
          orden: { tipo: 'guardar', objetivo: { campo: 'puebloId', id: 'pu-3' }, dadaPorId: 'heroe-1', dadaEn: AHORA - 60 * H, unido: false } },
        { mercenarioId: 'heroe-22', faccionId: 'fac-1', trabajo: 'atacar', objetivo: { campo: 'campamentoId', id: 'band-7' }, plazoDias: 7, firmadoPorId: 'heroe-1', puestoFirma: 'rey', firmadoEn: AHORA - 20 * H, venceEn: AHORA + 148 * H, campamentoBaseId: 'camp-3', renombre: 50,
          orden: { tipo: 'atacar', objetivo: { campo: 'campamentoId', id: 'band-7' }, dadaPorId: 'heroe-1', puesto: 'rey', dadaEn: AHORA - 3 * H, venceEn: AHORA + 21 * H, unido: false } },
        { mercenarioId: 'heroe-23', faccionId: 'fac-1', trabajo: 'permanente', objetivo: { campo: 'faccionId', id: 'fac-1' }, firmadoPorId: 'heroe-1', puestoFirma: 'rey', firmadoEn: AHORA - 400 * H, campamentoBaseId: 'camp-2', renombre: 0 },
      ],
    },
    { id: 'fac-2', nombre: 'Reino de Hatti', nivel: 4 },
  ],
  asentamientos: [
    { id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', posicion: { x: 410, y: 300 } },
    { id: 'as-4', nombre: 'Tirinto', faccionId: 'fac-1', posicion: { x: 470, y: 352 } },
  ],
  asentamientosAvistados: [{ id: 'as-8', nombre: 'Hattusa', faccionId: 'fac-2', posicion: { x: 560, y: 240 } }],
  asentamientosConocidos: [],
  pueblos: [
    { id: 'pu-3', madreId: 'as-1', propio: true, tipo: 'minaCobre', posicion: { x: 430, y: 290 } },
    { id: 'pu-5', madreId: 'as-4', propio: true, tipo: 'aldeaAgricola', posicion: { x: 480, y: 340 } },
  ],
  avanzadas: [{ id: 'av-1', madreId: 'as-4', etapa: 2, posicion: { x: 500, y: 330 }, enRuinas: false, propia: true }],
  caravanas: [{ id: 'car-5', origenAsentamientoId: 'as-1', destinoAsentamientoId: 'as-4', posicionActual: { x: 440, y: 322 }, faccionId: 'fac-1', tipo: 'comercial' }],
  ejercitos: [
    { id: 'ej-2', faccionId: 'fac-1', tipo: 'ejercito', liderId: 'heroe-9', estado: 'marchando', posicionActual: { x: 452, y: 333 }, participantes: [{ heroeId: 'heroe-9', unidoEn: 0 }, { heroeId: 'heroe-22', unidoEn: 0 }] },
  ],
  convocatorias: [],
  campamentosBandidos: [{ id: 'band-7', posicion: { x: 520, y: 380 } }, { id: 'band-9', posicion: { x: 300, y: 260 } }],
  ejercitosAvistados: [{ id: 'ej-14', faccionId: 'fac-2', posicionActual: { x: 548, y: 262 }, participantes: 3, heroeIds: [] }],
  caravanasAvistadas: [],
  relaciones: [{ tipo: 'guerra', estado: 'activa', faccionAId: 'fac-1', faccionBId: 'fac-2' }],
  campamentosMercenarios: [{ id: 'camp-2', posicion: { x: 392, y: 318 }, residentesIds: [], edificios: [] }],
  heroesVisibles: [
    { heroeId: 'heroe-30', displayName: 'Korax el Tracio', classDefinitionId: 'guerrero', nivel: 9, escuadrasQueLleva: [], equipamiento: {} },
    { heroeId: 'heroe-31', displayName: 'Ita de Ugarit', classDefinitionId: 'explorador', nivel: 6, escuadrasQueLleva: [], equipamiento: {} },
    { heroeId: 'heroe-32', displayName: 'Dumu', classDefinitionId: 'guerrero', nivel: 3, escuadrasQueLleva: [], equipamiento: {}, heridoHasta: AHORA + 2 * H },
    { heroeId: 'heroe-21', displayName: 'Ninsun de Uruk', classDefinitionId: 'guerrero', nivel: 14, escuadrasQueLleva: [{ tropaId: 'milicia_lanceros', cantidad: 40, nivel: 3 }], equipamiento: {}, contratado: 'temporal', fichaMercenario: reducida(fichas.ninsun) },
    { heroeId: 'heroe-22', displayName: 'Bardylis', classDefinitionId: 'guerrero', nivel: 8, escuadrasQueLleva: [], equipamiento: {}, contratado: 'temporal', fichaMercenario: reducida(fichas.ita) },
    { heroeId: 'heroe-23', displayName: 'Sharru el Viejo', classDefinitionId: 'guerrero', nivel: 11, escuadrasQueLleva: [], equipamiento: {}, contratado: 'permanente', fichaMercenario: reducida(fichas.korax) },
  ],
  nombresDeCompaneros: { 'heroe-9': 'Agamenón' },
} as unknown as ProyeccionJugador);

const tablon = [
  { heroeId: 'heroe-30', desde: AHORA - 5 * H, ficha: fichas.korax, tropa: [{ tropaId: 'milicia_lanceros', cantidad: 60, nivel: 4 }, { tropaId: 'arqueros', cantidad: 30, nivel: 3 }, { tropaId: 'lenadores', cantidad: 20, nivel: 1 }], tarifas: [{ plazoDias: 1, oro: 48 }, { plazoDias: 3, oro: 112 }, { plazoDias: 7, oro: 224 }, { oro: 1600 }] },
  { heroeId: 'heroe-31', desde: AHORA - 1 * H, ficha: fichas.ita, tropa: [{ tropaId: 'milicia_lanceros', cantidad: 30, nivel: 2 }, { tropaId: 'granjeros', cantidad: 20, nivel: 1 }], tarifas: [{ plazoDias: 1, oro: 21 }, { plazoDias: 3, oro: 49 }, { plazoDias: 7, oro: 98 }, { oro: 700 }] },
  { heroeId: 'heroe-32', desde: AHORA - 30 * 60_000, ficha: fichas.dumu, tropa: [{ tropaId: 'mineros', cantidad: 20, nivel: 1 }], heridoHasta: AHORA + 2 * H, tarifas: [{ plazoDias: 1, oro: 9 }, { plazoDias: 3, oro: 21 }, { plazoDias: 7, oro: 42 }, { oro: 300 }] },
];

// Un contrato que acabó ayer: aparece para valorarlo.
anotarHechoMercenario({ codigo: 'mercenarios.terminado', mensaje: '', version: 1, momento: new Date(AHORA - 20 * H).toISOString(), payload: { mercenario: 31, motivo: 'plazo' } });

const enviadas: unknown[] = [];
const ejecutar = async (tipo: string, params: object) => { enviadas.push({ tipo, params }); return null; };
const lienzo = document.getElementById('lienzo')!;
let ver = new URLSearchParams(location.search).get('ver') ?? 'tablon';

function pintar(): void {
  const proy = p();
  if (ver === 'tablon') {
    lienzo.innerHTML = `<div class="banco-marco banco-campamento"><div class="asent-lado-cuerpo">${htmlTablonMercenarios(proy, tablon as never, e)}</div><p id="camp-error" class="faction-error"></p></div>`;
    cablearTablonMercenarios(lienzo, ejecutar, (m) => { lienzo.querySelector('#camp-error')!.textContent = m; }, pintar);
  } else if (ver === 'faccion') {
    lienzo.innerHTML = `<div class="banco-marco" style="width:1000px">${htmlMercenariosFaccion(proy, e)}</div>`;
    cablearMercenariosFaccion(lienzo, ejecutar, pintar);
  } else if (ver === 'miembros') {
    lienzo.innerHTML = `<div class="banco-marco" style="max-width:520px">${htmlMiembrosFaccion(proy, proy.facciones[0]!, e)}</div>`;
  } else {
    lienzo.innerHTML = `<div class="banco-marco" style="max-width:360px">${proy.heroesVisibles.slice(3).map((h) => `<div class="mapa-lista-item"><div><strong>${e(h.displayName)}</strong><span>guerrero · nivel ${h.nivel}</span>${htmlMercenarioPublico(h.contratado, h.fichaMercenario, e)}</div></div>`).join('')}</div>`;
  }
}

document.querySelectorAll<HTMLButtonElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => { ver = b.dataset.ver!; pintar(); }));
document.getElementById('gobernador')!.addEventListener('change', (ev) => { soloGobernador = (ev.target as HTMLInputElement).checked; pintar(); });
pintar();
(window as unknown as { __banco: unknown }).__banco = { enviadas, ver: (v: string) => { ver = v; pintar(); }, gobernador: (s: boolean) => { soloGobernador = s; pintar(); }, listo: true };
