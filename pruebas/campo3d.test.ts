// El prototipo del generador del campo de batalla del lugar (`pruebas/campo3d/generador.ts`) con mundos de mentira: el tipo de campo, los
// spawns a la misma distancia del centro y en su lado, y el recorte que se desplaza hacia la tierra.
import { describe, expect, test } from 'vitest';
import { bytesEnProtobuf, crearTicket, generarCampo, leerTicket, PARAMETROS, recortar, ZONA, type Mundo, type P, type Procedencias, type TicketDelLugar } from './campo3d/generador';

/** Un mundo llano de 200 × 200 u a 100 m, con un río norte-sur en x = 100 (con o sin vado en el medio) o mar al este de x = 100. */
function mundo(opciones: { rio?: 'vado' | 'sinVado'; marAlEste?: boolean; altura?: (x: number, y: number) => number; clase?: number }): Mundo {
  const agua = (x: number) => !!opciones.marAlEste && x >= 100;
  return {
    ancho: 200,
    alto: 200,
    alturaEn: opciones.altura ?? (() => 100),
    aguaEn: (x) => agua(x),
    marEn: (x) => agua(x),
    celda: 4,
    terrenoCelda: (i) => (agua((i + 0.5) * 4) ? 1 : (opciones.clase ?? 3)),
    bosqueCelda: () => 0,
    fertilidadCelda: () => 128,
    rios: opciones.rio
      ? [{ puntos: [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 200 }], vados: opciones.rio === 'vado' ? [{ x: 100, y: 100 }] : [] }]
      : [],
  };
}

function campo(m: Mundo, punto: P, procedencias: Procedencias) {
  return generarCampo(recortar(m, punto), procedencias);
}

// cada prueba genera uno o varios campos enteros (unos 0,5 a 1 s cada uno): más margen que los 5 s de serie
describe('el campo de batalla del lugar', { timeout: 30_000 }, () => {
  test('un vado: tipo vado y los bandos en orillas opuestas, cada uno en la suya', () => {
    const c = campo(mundo({ rio: 'vado' }), { x: 99.4, y: 100 }, { defensor: { x: 97.5, y: 100 }, atacante: { x: 102.5, y: 100 } });
    expect(c.informe.tipo).toBe('vado');
    expect(c.vados.length).toBe(1);
    // el río pasa por x = (100 − 99,4)·75 = 45 m del campo
    const rio = (100 - c.recorte.centro.x) * c.escala;
    expect(c.spawns!.atacante.x).toBeGreaterThan(rio);
    expect(c.spawns!.defensor.x).toBeLessThan(rio);
    expect(c.informe.avisos).not.toContain('el río no parte el campo en dos orillas: los bandos no quedan en orillas opuestas');
    // el río y el vado, proporcionales al mapa de mundo: 1,5 u y 0,8 u por 75 m/u, unos 112 y 60 m (en celdas de 4 m)
    const n = c.nZonas, fila = Math.floor(n / 4), columna = Math.floor((rio + c.lado / 2) / c.celdaZonas);
    let ancho = 0, largoVado = 0;
    for (let i = 0; i < n; i++) if (c.zonas[fila * n + i] === ZONA.honda) ancho += c.celdaZonas;
    for (let j = 0; j < n; j++) if (c.zonas[j * n + columna] === ZONA.somero) largoVado += c.celdaZonas;
    expect(Math.abs(ancho - PARAMETROS.ancho_rio_mundo * c.escala)).toBeLessThanOrEqual(2 * c.celdaZonas);
    expect(Math.abs(largoVado - PARAMETROS.ancho_vado_mundo * c.escala)).toBeLessThanOrEqual(2 * c.celdaZonas);
  });

  test('los dos spawns, a la misma distancia del centro y en lados opuestos; el quieto, al borde opuesto del que llega', () => {
    const c = campo(mundo({}), { x: 100, y: 100 }, { atacante: { x: 100, y: 98 }, defensor: null });
    const { atacante: a, defensor: d } = c.spawns!;
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(Math.hypot(d.x, d.y), 6);
    expect(a.x + d.x).toBeCloseTo(0, 6);
    expect(a.y + d.y).toBeCloseTo(0, 6);
    expect(a.y).toBeLessThan(0); // el atacante llega del norte
    expect(d.y).toBeGreaterThan(0);
    expect(c.informe.distancia).toBe(PARAMETROS.distancia_pequena);
    expect(c.informe.rumbo).toBeCloseTo(0, 6);
    expect(c.spawns!.puntos.length).toBe(6);
  });

  test('con más de la mitad de agua, el recorte se desplaza hacia la tierra', () => {
    const r = recortar(mundo({ marAlEste: true }), { x: 101, y: 100 });
    expect(r.aguaAntes).toBeGreaterThan(0.5);
    expect(r.desplazamiento).toBeGreaterThan(0);
    expect(r.aguaDespues).toBeLessThan(0.5);
    expect(r.centro.x).toBeLessThan(101);
  });

  test('una ribera: el río no se cruza y los dos bandos quedan en la misma orilla', () => {
    const c = campo(mundo({ rio: 'sinVado' }), { x: 98, y: 100 }, { atacante: { x: 98, y: 97.5 }, defensor: null });
    expect(c.informe.tipo).toBe('ribera');
    const rio = (100 - c.recorte.centro.x) * c.escala;
    expect(c.spawns!.atacante.x).toBeLessThan(rio);
    expect(c.spawns!.defensor.x).toBeLessThan(rio);
  });

  test('el ticket: lo que sale de él, pasado a JSON, es el mismo campo que el del recorte', () => {
    const m = mundo({ rio: 'vado' }), punto = { x: 99.4, y: 100 }, procedencias = { defensor: { x: 97.5, y: 100 }, atacante: { x: 102.5, y: 100 } };
    const ticket = JSON.parse(JSON.stringify(crearTicket(m, punto, procedencias, 'mundo-de-prueba'))) as TicketDelLugar;
    expect(ticket.recorte.agua.length).toBe(ticket.recorte.alturas.valores.length);
    // compacto: unos 2,5 bytes por muestra de altura (con su agua), más lo fijo; crece con el anillo de fondo (§13)
    expect(bytesEnProtobuf(ticket)).toBeLessThan(3 * ticket.recorte.alturas.valores.length + 1024);
    const { recorte, procedencias: leidas } = leerTicket(ticket);
    expect(leidas).toEqual(procedencias);
    const desdeTicket = generarCampo(recorte, leidas), directo = campo(m, punto, procedencias);
    expect(desdeTicket.informe.tipo).toBe(directo.informe.tipo);
    expect(desdeTicket.spawns!.atacante.x).toBeCloseTo(directo.spawns!.atacante.x, 3);
    expect(desdeTicket.spawns!.defensor.y).toBeCloseTo(directo.spawns!.defensor.y, 3);
    expect(desdeTicket.vados).toEqual(directo.vados);
    // un bando quieto viaja como quieto
    const quieto = leerTicket(crearTicket(m, punto, { atacante: { x: 102.5, y: 100 }, defensor: null }, 'mundo-de-prueba'));
    expect(quieto.procedencias.defensor).toBeNull();
  });

  test('el acento crece las lomas del mundo, no las laderas uniformes', () => {
    const conAcento = (altura: (x: number, y: number) => number, acento: number) =>
      generarCampo(recortar(mundo({ altura }), { x: 100, y: 100 }), { atacante: { x: 100, y: 98 }, defensor: null }, { ...PARAMETROS, acento_relieve: acento, detalle_amplitud: 0, detalle_rugosidad: 0, detalle_pendiente: 0, relieve_minimo: 0 }).informe;
    // una loma de 20 m y 1 u de radio al este del centro
    const loma = (x: number, y: number) => 100 + 20 * Math.exp(-((x - 101.5) ** 2 + (y - 100) ** 2) / (2 * 0.8 ** 2));
    expect(conAcento(loma, 3).desnivel).toBeGreaterThan(conAcento(loma, 1).desnivel * 1.5);
    // una ladera de 2 m por u: no tiene rasgos, el acento no la cambia
    const ladera = (x: number) => 100 + 2 * x;
    expect(conAcento(ladera, 3).desnivel / conAcento(ladera, 1).desnivel).toBeLessThan(1.15);
  });

  test('el campo es un zoom: una ladera tiene la misma pendiente que en el mundo', () => {
    // 2 m por u del mundo (12 m): 9,46°
    const ladera = (x: number) => 100 + 2 * x;
    const i = generarCampo(recortar(mundo({ altura: ladera }), { x: 100, y: 100 }), { atacante: { x: 100, y: 98 }, defensor: null }, { ...PARAMETROS, detalle_amplitud: 0, detalle_rugosidad: 0, detalle_pendiente: 0, relieve_minimo: 0 }).informe;
    expect(i.pendienteCampo).toBeCloseTo((Math.atan(2 / 12) * 180) / Math.PI, 0);
  });

  test('una batalla grande (campal) lee más mundo con el mismo zoom y separa más los bandos', () => {
    const m = mundo({}), punto = { x: 100, y: 100 }, procedencias = { atacante: { x: 100, y: 98 }, defensor: null };
    const campal = { tipo: 'campo_abierto', solitarios: false } as const;
    const ticket = crearTicket(m, punto, procedencias, 'mundo-de-prueba', PARAMETROS, campal);
    expect(ticket.contexto).toEqual(campal);
    // los jugables de la grande y el anillo de fondo a cada lado, a la escala del campo
    expect(ticket.recorte.lado_recorte).toBeCloseTo((PARAMETROS.lado_grande + 2 * PARAMETROS.anillo_fondo) / PARAMETROS.escala_campo, 6);
    const { recorte, procedencias: leidas } = leerTicket(ticket);
    expect(recorte.tamano).toBe('grande');
    const c = generarCampo(recorte, leidas);
    expect(c.jugable).toBe(PARAMETROS.lado_grande);
    expect(c.escala).toBe(PARAMETROS.escala_campo);
    expect(c.informe.separacion).toBe(2 * PARAMETROS.distancia_grande);
    // y la persecución, pequeña
    expect(leerTicket(crearTicket(m, punto, procedencias, 'mundo-de-prueba', PARAMETROS, { tipo: 'campo_abierto', solitarios: true })).recorte.tamano).toBe('pequena');
  });

  test('el detalle fractal: más variación en montaña que en llano, y más donde el mundo es quebrado', () => {
    const variacion = (opciones: Parameters<typeof mundo>[0]) =>
      generarCampo(recortar(mundo(opciones), { x: 100, y: 100 }), { atacante: { x: 100, y: 98 }, defensor: null }, { ...PARAMETROS, relieve_minimo: 0 }).informe.variacion;
    const llano = variacion({ clase: 3 }), montana = variacion({ clase: 5 });
    expect(montana).toBeGreaterThan(llano * 2);
    // un mundo quebrado (ondas de 1 u y 3 m) pide más detalle que uno liso, con la misma clase
    const quebrado = variacion({ clase: 4, altura: (x, y) => 100 + 3 * Math.sin(x * Math.PI) * Math.sin(y * Math.PI) }), liso = variacion({ clase: 4 });
    expect(quebrado).toBeGreaterThan(liso);
  });

  test('el llano nunca es liso', () => {
    const c = campo(mundo({}), { x: 100, y: 100 }, { atacante: { x: 102, y: 100 }, defensor: null });
    expect(c.informe.tipo).toBe('llano');
    expect(c.informe.desnivel).toBeGreaterThanOrEqual(PARAMETROS.relieve_minimo * 0.9);
  });

  test('un vado dentro del agua (el río sigue por el lago) no es un vado: ni el tipo ni el paso', () => {
    // agua al este de x = 100 y un río este-oeste que entra en ella, con su "vado" a 10 u dentro del agua
    const m: Mundo = { ...mundo({ marAlEste: true }), rios: [{ puntos: [{ x: 60, y: 100 }, { x: 140, y: 100 }], vados: [{ x: 110, y: 100 }] }] };
    const c = campo(m, { x: 96, y: 100 }, { atacante: { x: 96, y: 98 }, defensor: null });
    expect(c.lectura.vado).toBeNull();
    expect(c.informe.tipo).not.toBe('vado');
    expect(c.vados.length).toBe(0);
  });

  test('un llano sin bosque tiene sotos: grupitos de árboles, no árboles sueltos', () => {
    // el mundo de prueba no tiene bosque: los árboles que haya son de los sotos
    const c = campo(mundo({}), { x: 100, y: 100 }, { atacante: { x: 102, y: 100 }, defensor: null });
    expect(c.informe.sotos).toBeGreaterThan(0);
    expect(c.informe.arboles).toBeGreaterThanOrEqual(3 * c.informe.sotos * 0.5);
    // cada árbol tiene otro a menos de 25 m (están en grupos)
    const a = c.arboles, n = a.length / 2;
    let solos = 0;
    for (let i = 0; i < n; i++) {
      let cerca = false;
      for (let j = 0; j < n && !cerca; j++) if (i !== j && Math.hypot(a[2 * i]! - a[2 * j]!, a[2 * i + 1]! - a[2 * j + 1]!) < 25) cerca = true;
      if (!cerca) solos++;
    }
    expect(solos / n).toBeLessThan(0.1);
  });
});
