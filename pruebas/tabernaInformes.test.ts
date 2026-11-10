// Lo que trae un informe de región comprado en la taberna (0.198.0, Víctor 2026-11-10): en «Tus informes de región», el informe es un botón que
// abre debajo la lista de las plazas de su región con un buscador arriba; en el de órdenes, cada plaza con órdenes abre sus órdenes de compra y de
// venta. Sin DOM: raíces y botones de mentira.
import { describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { MapaGenerado } from '../src/terreno';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { cablearInformesRegion, htmlInformesRegion, plazasDeLaRegion } = await import('../src/ui/tabernaRegion');
const { estadoCliente } = await import('../src/ui/estadoCliente');
const { sigiloAleatorio } = await import('../src/sigilo/sigilo');
const SIGILO = sigiloAleatorio();

const AHORA = 1_000_000_000;
const MIN = 60_000;
// Un mundo de 40 × 20 en celdas de 10: la región 3 al oeste (x < 20) y la 5 al este.
const mapa = { rasters: { region: { columnas: 4, filas: 2, celda: 10, datos: new Uint8Array([3, 3, 5, 5, 3, 3, 5, 5]) } }, regiones: [{ id: 3, nombre: 'Llanura de Argos' }, { id: 5, nombre: 'Altiplano interior' }] } as unknown as MapaGenerado;
estadoCliente.mapaCache = { id: 'm', mapa };

const conocida = (id: string, nombre: string, faccionId: string, x: number, y: number, nivel = 1) => ({ asentamientoId: id, nombre, faccionId, nivel, posicion: { x, y }, conocidoEn: AHORA - 300 * MIN });
const orden = (id: string, asentamientoId: string, tipo: 'compra' | 'venta', recurso: string, cantidad: number, estado = 'activa') =>
  ({ id, asentamientoId, tipo, recurso, cantidad, cantidadCumplida: 0, precioUnitario: 3.2, expiraEn: AHORA + 90 * MIN, estado });
const INFORMES = [
  { region: 5, tipo: 'plazas', compradoEn: AHORA - 300 * MIN, libreEn: AHORA + 60 * MIN },
  { region: 3, tipo: 'ordenes', compradoEn: AHORA - 40 * MIN, caducaEn: AHORA + 160 * MIN, libreEn: AHORA + 320 * MIN },
];
const proy = (informes: unknown[] = INFORMES): ProyeccionJugador =>
  ({
    heroeId: 'heroe-1', faccionId: 'f-1', instante: AHORA,
    facciones: [{ id: 'f-1', nombre: 'Casa de Micenas', informesRegion: informes }, { id: 'f-2', nombre: 'Reino de Tirinto', sigilo: SIGILO }, { id: 'f-4', nombre: 'Liga de Tebas' }],
    directorioFacciones: [{ id: 'f-5', nombre: 'Clan de Eubea', sigilo: SIGILO }],
    relaciones: [{ id: 'r', tipo: 'guerra', estado: 'activa', faccionAId: 'f-4', faccionBId: 'f-1' }],
    asentamientos: [], plazasPropias: [],
    // Argos se ve ahora (gana a su ficha vieja); Tebas es de una Facción en guerra contigo y Corinto es tuya: no entran.
    asentamientosAvistados: [{ id: 'as-9', nombre: 'Argos', faccionId: 'f-2', nivel: 3, posicion: { x: 5, y: 5 }, zona: [] }],
    asentamientosConocidos: [
      conocida('as-9', 'Argos', 'f-2', 5, 5, 1),
      conocida('as-7', 'Tirinto', 'f-2', 15, 5, 2),
      conocida('as-8', 'Lerna', 'f-2', 5, 15),
      conocida('as-20', 'Orcómeno', 'f-2', 25, 5, 3),
      conocida('as-21', 'Áulide', 'f-5', 35, 5),
      conocida('as-22', 'Gla', 'f-2', 25, 15, 2),
      conocida('as-26', 'Tebas', 'f-4', 35, 15, 4),
      conocida('as-27', 'Corinto', 'f-1', 30, 10, 2),
    ],
    ordenes: [
      orden('o1', 'as-7', 'venta', 'estano', 100),
      orden('o2', 'as-7', 'compra', 'trigo', 400),
      orden('o3', 'as-9', 'venta', 'vino', 30),
      orden('o4', 'as-8', 'venta', 'cobre', 10, 'cumplida'),
    ],
  }) as unknown as ProyeccionJugador;

const e = (t: string): string => t;
type Manejador = () => void;
/** Un botón o un campo de mentira con lo que lee el cableado. */
function control(dataset: Record<string, string>, value = '') {
  const manejadores: Manejador[] = [];
  return { dataset, value, hidden: false, addEventListener: (_: string, f: Manejador) => manejadores.push(f), disparar: () => manejadores.forEach((f) => f()) };
}
/** Una raíz de mentira: cada selector devuelve lo que se le da. */
const raiz = (por: Record<string, unknown[]>) => ({
  querySelectorAll: (s: string) => por[s] ?? [],
  querySelector: (s: string) => (por[s] ?? [])[0] ?? null,
}) as unknown as ParentNode;

/** Pulsa el botón `[atributo]` con ese valor, como en el panel de verdad. */
function pulsar(atributo: 'data-region-informe' | 'data-region-plaza', valor: string): void {
  const clave = atributo === 'data-region-informe' ? 'regionInforme' : 'regionPlaza';
  const b = control({ [clave]: valor });
  cablearInformesRegion(raiz({ [`[${atributo}]`]: [b] }), () => {});
  b.disparar();
}
const filas = (html: string): string[] => [...html.matchAll(/class="region-plaza-(?:fila|item)[^"]*" data-region-texto="([^"]+)"/g)].map((m) => m[1]!);

describe('lo que trae un informe de región comprado', () => {
  test('las plazas que entran: las de esa región, sin las tuyas ni las de una Facción en guerra contigo; lo que se ve gana a la memoria', () => {
    const p = proy();
    expect(plazasDeLaRegion(p, 5).map((x) => x.nombre)).toEqual(['Áulide', 'Gla', 'Orcómeno']);
    const oeste = plazasDeLaRegion(p, 3);
    expect(oeste.map((x) => x.nombre)).toEqual(['Argos', 'Lerna', 'Tirinto']);
    expect(oeste[0]!.nivel).toBe(3); // Argos se ve ahora
    expect(oeste[0]!.conocidoEn).toBeUndefined();
  });

  test('en «Tus informes» cada informe con algo que ver es un botón; el de órdenes caducado, no', () => {
    const caducado = { region: 3, tipo: 'ordenes', compradoEn: AHORA - 300 * MIN, caducaEn: AHORA - 1, libreEn: AHORA + 60 * MIN };
    const html = htmlInformesRegion(proy([INFORMES[0], caducado]), e);
    expect(html).toContain('data-region-informe="5:plazas" aria-expanded="false"');
    expect(html).not.toContain('data-region-informe="3:ordenes"');
    expect(html).toContain('ya no se ven');
    expect(html).not.toContain('region-resultado'); // nada abierto de entrada
  });

  test('el de plazas abre la lista de sus plazas con un buscador arriba, y se cierra con otro clic', () => {
    pulsar('data-region-informe', '5:plazas');
    const html = htmlInformesRegion(proy(), e);
    expect(html).toContain('data-region-informe="5:plazas" aria-expanded="true"');
    expect(html).toContain('Las plazas de Altiplano interior');
    expect(html).toMatch(/<input[^>]*type="search"[^>]*data-region-buscar="5:plazas"/);
    expect(html.indexOf('data-region-buscar')).toBeLessThan(html.indexOf('region-plaza-fila'));
    expect(filas(html)).toEqual(['aulide clan de eubea', 'gla reino de tirinto', 'orcomeno reino de tirinto']);
    expect(html).toContain('Clan de Eubea · 📍 35, 5 · de hace 5 h');
    expect(html).not.toContain('Tebas');
    expect(html).not.toContain('Corinto');
    expect(html).not.toContain('data-region-plaza='); // en el de plazas no hay órdenes que abrir
    // cada plaza con el blasón de su Facción (de FACCION o del directorio)
    expect(html.match(/<span class="region-plaza-blason" aria-hidden="true"><svg/g)).toHaveLength(3);
    pulsar('data-region-informe', '5:plazas');
    expect(htmlInformesRegion(proy(), e)).not.toContain('region-resultado');
  });

  test('el buscador esconde lo que no casa (sin tildes, por nombre o Facción) y lo buscado sigue tras repintar', () => {
    pulsar('data-region-informe', '5:plazas');
    const html = htmlInformesRegion(proy(), e);
    const filasFalsas = filas(html).map((t) => control({ regionTexto: t }));
    const nada = control({});
    const campo = control({ regionBuscar: '5:plazas' }, 'AULIDE');
    cablearInformesRegion(raiz({ '[data-region-buscar]': [campo], '[data-region-texto]': filasFalsas, '[data-region-sin-coincidencias]': [nada] }), () => {});
    campo.disparar();
    expect(filasFalsas.map((f) => f.hidden)).toEqual([false, true, true]);
    expect(nada.hidden).toBe(true);
    campo.value = 'tirinto';
    campo.disparar();
    expect(filasFalsas.map((f) => f.hidden)).toEqual([true, false, false]);
    campo.value = 'esparta';
    campo.disparar();
    expect(nada.hidden).toBe(false);
    // repintado: el campo trae lo buscado y las filas que no casan salen escondidas
    campo.value = 'tirinto';
    campo.disparar();
    const otra = htmlInformesRegion(proy(), e);
    expect(otra).toContain('value="tirinto"');
    expect(otra).toContain('data-region-texto="aulide clan de eubea" hidden');
    expect(otra).toMatch(/data-region-texto="gla reino de tirinto">/);
    campo.value = '';
    campo.disparar();
    pulsar('data-region-informe', '5:plazas');
  });

  test('el de órdenes: cada plaza con órdenes se abre en sus órdenes de compra y de venta, una a la vez; las que no tienen, sin botón', () => {
    pulsar('data-region-informe', '3:ordenes');
    let html = htmlInformesRegion(proy(), e);
    expect(html).toContain('Las órdenes de mercado de Llanura de Argos');
    expect(html).toContain('data-region-buscar="3:ordenes"');
    expect(html).toMatch(/data-region-plaza="as-7" aria-expanded="false"[\s\S]*?▲ 1[\s\S]*?▼ 1/);
    expect(html).toContain('data-region-plaza="as-9" aria-expanded="false"');
    expect(html).not.toContain('data-region-plaza="as-8"'); // Lerna: su única orden está cumplida
    expect(html).toMatch(/data-region-texto="lerna reino de tirinto">[\s\S]*?sin órdenes/);
    expect(html).not.toContain('Vende 100');
    pulsar('data-region-plaza', 'as-7');
    html = htmlInformesRegion(proy(), e);
    expect(html).toContain('data-region-plaza="as-7" aria-expanded="true"');
    expect(html).toContain('Vende 100 Estaño');
    expect(html).toContain('Compra 400 Trigo');
    expect(html).toContain('🪙 3.20 c/u · caduca en 90 min');
    expect(html.indexOf('Vende 100')).toBeLessThan(html.indexOf('Compra 400'));
    expect(html).not.toContain('Vende 30'); // la de Argos sigue cerrada
    expect(html).not.toContain('data-region-tomar'); // solo para verlas: se toman desde el Mercado
    pulsar('data-region-plaza', 'as-9');
    html = htmlInformesRegion(proy(), e);
    expect(html).toContain('Vende 30 Vino');
    expect(html).not.toContain('Vende 100');
    pulsar('data-region-informe', '3:ordenes');
  });

  test('al abrir otro informe se cierra el que estaba abierto', () => {
    pulsar('data-region-informe', '3:ordenes');
    pulsar('data-region-informe', '5:plazas');
    const html = htmlInformesRegion(proy(), e);
    expect(html).toContain('data-region-informe="5:plazas" aria-expanded="true"');
    expect(html).toContain('data-region-informe="3:ordenes" aria-expanded="false"');
    expect(html.match(/class="region-resultado"/g)).toHaveLength(1);
    pulsar('data-region-informe', '5:plazas');
  });
});
