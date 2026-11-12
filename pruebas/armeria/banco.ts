// Banco de la ARMERÍA (0.207.0, `/pruebas/armeria/`): la ventana «Armería» de la plaza, sin servidor, con la tienda (`?pestana=tienda`), la forja
// (`?pestana=forja`) y abrir la forja (`?pestana=abrir`, con `&cargo=tesorero`). `&grupo=aliados|neutrales|enemigos` te pone de visita en una plaza
// de otra Facción con esa relación (`&abierta=1` le abre la forja a tu grupo con su recargo); `&era=1..5` fija la Era del mundo; `&llena=1` llena
// la mochila; `&monedas=N` cambia tus monedas. Las órdenes se anotan en `window.__banco.enviadas`.
import '../../src/style.css';
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import { bloqueDeDatos, catalogoDeTecnologia, type ProyeccionJugador } from '../../src/apiCliente';
import type { Asentamiento, ItemInstancia } from '../../src/tiposDominio';
import { cablearArmeria, htmlArmeria, pestanasDeArmeria } from '../../src/ui/armeria';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { iconoEdificio } from '../../src/ui/iconosEdificio';

const qs = new URLSearchParams(location.search);
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const grupo = qs.get('grupo');
const ajena = grupo === 'aliados' || grupo === 'neutrales' || grupo === 'enemigos';
const ERAS = ['reinos_palaciales', 'crisis_adaptacion', 'polis_imperios', 'profesionalizacion_imperial', 'hegemonia_macedonica'];
const era = ERAS[Math.max(0, Math.min(4, Number(qs.get('era') ?? 3) - 1))]!;

const OBJETOS = (Object.values((datos as unknown as { documentos: Record<string, Record<string, unknown>> }).documentos).find((d) => 'OBJETOS' in d)!.OBJETOS as { objetos: { id: string; tipo: string; precio: number }[] }).objetos;
const pieza = (id: string, casilla: number, cantidad = 1): ItemInstancia => {
  const f = OBJETOS.find((o) => o.id === id)!;
  return { itemDefinitionId: id, tipo: f.tipo, cantidad, precio: f.precio, casillaInventario: casilla } as ItemInstancia;
};
const mochila = [
  pieza('plano_2', 0, 2), pieza('crisol', 1, 5), pieza('plano_3', 2), pieza('medalla_tropa_pequena', 3, 2), pieza('casco_ligera_cobre', 4),
  pieza('dagas_cobre', 5), pieza('torso_pesada_cobre', 6),
];
if (qs.get('llena')) for (let n = 7; n < 72; n++) mochila.push(pieza('casco_ligera_cobre', n));

const plaza = {
  id: 'as-1', nombre: ajena ? 'Hattusa' : 'Micenas', faccionId: ajena ? 'fac-2' : 'fac-1', nivel: 3, nivelActual: 3, posicion: { x: 120, y: 150 },
  heroesFundadoresIds: ajena ? [] : ['heroe-1'], casasCompradas: [],
  cargos: { gobernadorId: 'heroe-9', tesoreroId: qs.get('cargo') === 'tesorero' && !ajena ? 'heroe-1' : 'heroe-8', maestroCaravanasId: null, maestroObrasId: null, generalId: null, sacerdoteId: null },
  edificios: [{ id: 'e1', tipo: 'armeria', estado: 'activo', nivelInterno: 2 }],
  armeriaActiva: true,
  metalesArmeria: ['bronce', 'cobre', 'hierro_temprano', 'inicio'],
  forja: {
    aliados: { abierta: Boolean(qs.get('abierta')) && grupo === 'aliados' ? true : !ajena, recargoPct: 100 },
    neutrales: { abierta: Boolean(qs.get('abierta')) && grupo === 'neutrales', recargoPct: 200 },
    enemigos: { abierta: false, recargoPct: 500 },
    fondo: 2350,
  },
  puertaCerradaA: ['enemigos'],
} as unknown as Asentamiento;

const p = {
  gameId: 'banco', instante: Date.parse('2026-11-12T18:00:00Z'), version: 1, heroeId: 'heroe-1', faccionId: 'fac-1',
  heroe: {
    id: 'heroe-1', displayName: 'Víctor', classDefinitionId: 'arco_lanza', residenciaId: 'as-1', monedas: Number(qs.get('monedas') ?? 1450),
    ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, escuadrones: [],
    inventario: mochila, almacenObjetos: [],
    equipamiento: { arma: pieza('arco_lanza_cobre', 0), casco: null, torso: pieza('torso_media_cobre', 0), guantes: null, pantalones: null, botas: null, montura: pieza('montura_tiro', 0) },
    // en tu plaza, tu almacén personal y tu carro; de visita, el carro de la columna con la que entraste (abajo)
    almacenPersonal: ajena ? {} : { lingoteCobre: 6, cuero: 14, madera: 10, cueroCurtido: 4 },
    carro: ajena ? {} : { lingoteHierro: 3, cueroCurtido: 3 },
  },
  ejercitos: ajena ? [{ id: 'ej-1', liderId: 'heroe-1', participantes: [{ heroeId: 'heroe-1' }], posicionActual: { x: 120, y: 150 }, suministro: { lingoteCobre: 2, cuero: 9, madera: 4 } }] : [],
  facciones: [{ id: 'fac-1', nombre: 'Casa de Micenas', reyId: 'heroe-1' }, { id: 'fac-2', nombre: 'Reino de Hatti', reyId: 'heroe-20' }],
  relaciones: grupo === 'aliados' ? [{ tipo: 'alianza', faccionAId: 'fac-1', faccionBId: 'fac-2', estado: 'activa' }] : grupo === 'enemigos' ? [{ tipo: 'guerra', faccionAId: 'fac-2', faccionBId: 'fac-1', estado: 'activa' }] : [],
  asentamientos: [plaza], asentamientosAvistados: [], asentamientosConocidos: [], campamentosMercenarios: [],
  tecnologia: { era, propias: { adoptadas: [], aparecidas: [] }, reveladas: [], logros: [], epicasPosibles: [] },
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const enviadas: { tipo: string; params: Record<string, unknown> }[] = [];
const banco = { listo: false, enviadas };
(window as unknown as { __banco: unknown }).__banco = banco;
let pestana = qs.get('pestana') ?? 'tienda';
const app = document.querySelector<HTMLElement>('#app')!;

function pintar(): void {
  const resideAqui = !ajena;
  const subs = pestanasDeArmeria(p, plaza, resideAqui);
  if (!subs.some(([id]) => id === pestana)) pestana = subs[0]![0];
  app.innerHTML = `<section class="asent-ventana banco-ventana" data-ancho="completa">
    <header class="asent-ventana-cab"><div class="asent-ventana-titulo"><span class="asent-ventana-icono" aria-hidden="true">${iconoEdificio('armeria', 28)}</span><h2>Armería · ${e(plaza.nombre ?? '')}</h2></div></header>
    <div class="asent-edif-cuerpo">${subs.length > 1 ? `<div class="asent-tabs asent-subtabs">${subs.map(([id, n]) => `<button class="asent-tab${id === pestana ? ' activo' : ''}" type="button" data-sub="${id}">${n}</button>`).join('')}</div>` : ''}
      <div class="asent-lado-cuerpo">${htmlArmeria(p, plaza, resideAqui, pestana, e)}</div></div></section>`;
  app.querySelectorAll<HTMLButtonElement>('[data-sub]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.sub!; pintar(); }));
  cablearArmeria(app, plaza, async (tipo, params) => { enviadas.push({ tipo, params }); return null; }, pintar);
}

const alLlegar = (): void => {
  pintar();
  banco.listo = bloqueDeDatos('OBJETOS', alLlegar) !== null && catalogoDeTecnologia(alLlegar) !== null;
};
alLlegar();
