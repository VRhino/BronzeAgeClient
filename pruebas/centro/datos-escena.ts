// Las escenas del banco de Centro urbano: una plaza de mentira en tres situaciones (Gobernador y Rey que reside, de visita sin cargo, y con la
// subida de nivel en obra y bajo ocupación). Lleva también las misiones y el tablón de la plaza, y su territorio (zona, pueblos, obras y avanzadas).
import type { ProyeccionJugador } from '../../src/apiCliente';
import type { Asentamiento, Edificio } from '../../src/tiposDominio';

export const AHORA = Date.parse('2026-11-02T10:00:00Z');
const MIN = 60_000;
let n = 0;
const ed = (tipo: string, x: Partial<Edificio> = {}): Edificio => ({ id: `ed-${++n}`, tipo, estado: 'activo', posicion: { x: 0, y: 0 }, ...x });
const alm = (cantidad: number, capacidad: number) => ({ cantidad, capacidad, producido: 0, consumido: 0, porMinuto: 0 });

const TEC = ['leva_comunal', 'escudos_ligeros', 'armamento_palacial', 'hostigamiento_tribal', 'arqueria_palacial', 'aleacion_bronce'];
const esc = (id: string, tropaId: string, cantidad: number, costeLiderazgo = 14, contenedor: object = { tipo: 'campamento' }) => ({ id, nombre: tropaId, heroeId: 'heroe-1', tropaId, cantidad, nivel: 1, moral: 80, contenedor, enGuarnicion: false, costeLiderazgo });

export type Escena = 'gobernador' | 'visita' | 'obra';

const mision = (id: string, estado: string, condiciones: [string, number, number][], x: object = {}) =>
  ({ id, estado, condiciones: condiciones.map(([contador, avance, umbral]) => ({ contador, avance, umbral })), recompensaExperiencia: 0, participacion: 30, recompensas: [], ...x });
const definicion = (id: string, duracion: 'diaria' | 'semanal', tipo: 'individual' | 'grupal', titulo: string, texto: string, condiciones: [string, number][], x: object = {}) =>
  ({ id, duracion, tipo, limiteSemanal: tipo === 'individual' ? 5 : 0, condiciones: condiciones.map(([contador, umbral]) => ({ contador, avance: 0, umbral })), experiencia: 0, participacion: 10, recompensas: [], titulo, texto, explicacion: '', ...x });
const CATALOGO = [
  definicion('d1', 'diaria', 'grupal', 'Leña para el invierno', 'Entre todos, llevad madera al almacén de la plaza.', [['madera', 500]], { recompensas: [{ tipo: 'recurso', clave: 'trigo', cantidad: 100 }] }),
  definicion('d2', 'diaria', 'individual', 'Patrulla de caminos', 'Destruye un campamento de bandidos.', [['bandidos', 1]], { recompensas: [{ tipo: 'oro', cantidad: 20 }] }),
  definicion('d3', 'diaria', 'individual', 'Mercado vivo', 'Cumple un trueque con otra plaza.', [['trueques', 1]], { cargo: 'maestroCaravanas', participacion: 15 }),
  definicion('d4', 'diaria', 'individual', 'Manos a la obra', 'Entrega materiales a una obra de pueblo.', [['entregas', 2]]),
  definicion('s1', 'semanal', 'grupal', 'Gran cosecha', 'Entre todos, llenad el granero.', [['trigo', 3000]], { participacion: 40, recompensas: [{ tipo: 'tropa', clave: 'lanceros_mimbre', cantidad: 10 }] }),
  definicion('s2', 'semanal', 'individual', 'Escolta de caravanas', 'Llega a destino con tu columna cinco veces.', [['llegadas', 5]], { experiencia: 50, participacion: 20 }),
  definicion('s3', 'semanal', 'individual', 'Fortificar', 'Termina un recinto de la muralla.', [['recintos', 1]], { cargo: 'maestroObras', participacion: 30 }),
];
const def = (id: string) => CATALOGO.find((x) => x.id === id)!;
const cond = (id: string, avance: number) => def(id).condiciones.map((c) => ({ ...c, avance }));

/** Un anillo rectangular de muralla (celda a celda, en el orden en que se levanta), con dos puertas y una torre cada cinco celdas. */
function anillo(id: string, r: number, nivel: number, avance: number | 'todo', x: object = {}) {
  const celdas: { col: number; row: number; clase: 'muro' | 'puerta' | 'torre' }[] = [];
  const ancho = Math.round(r * 1.4);
  for (let c = -ancho; c < ancho; c++) celdas.push({ col: c, row: -r, clase: 'muro' });
  for (let f = -r; f < r; f++) celdas.push({ col: ancho, row: f, clase: 'muro' });
  for (let c = ancho; c > -ancho; c--) celdas.push({ col: c, row: r, clase: 'muro' });
  for (let f = r; f > -r; f--) celdas.push({ col: -ancho, row: f, clase: 'muro' });
  celdas.forEach((k, i) => { if (i % 5 === 0) k.clase = 'torre'; });
  for (const i of [ancho, ancho + 1, Math.floor(celdas.length * 0.62)]) celdas[i]!.clase = 'puerta';
  return { id, nivel, celdas, avance: avance === 'todo' ? celdas.length - 1 : avance, ...x };
}

export function escena(cual: Escena): { p: ProyeccionJugador; a: Asentamiento } {
  const edificios: Edificio[] = [
    ed('centroUrbano', { nivelInterno: 2 }), ...Array.from({ length: 24 }, () => ed('vivienda')), ed('almacen'), ed('granero'),
    ed('granja', { nivelInterno: 2 }), ed('granja'), ed('lenera', { fuenteId: 'pc-1' }), ed('curtiduria'), ed('fundicion'), ed('barracon', { nivelInterno: 2 }), ed('galeriaDeTiro', { nivelInterno: 2 }), ed('taberna'),
    ed('armeria', { estado: 'en_construccion', completaEn: AHORA + 200 * MIN }), ed('palacio'), ed('mercado', { nivelInterno: 2 }),
  ];
  const a = {
    id: 'as-1', nombre: 'Kydonia', faccionId: 'f-1', nivel: 2, posicion: { x: 0, y: 0 }, edificios,
    poblacion: { pesants: 342, artesanos: 118, nobleza: 4 },
    medidorMantenimiento: cual === 'obra' ? 38 : 82, nutricionPoblacion: cual === 'obra' ? 18 : 64,
    ultimaCaravanaCreadaEn: AHORA - 60 * MIN,
    almacen: { cobre: alm(0, 300), lingoteCobre: alm(14, 300), estano: alm(0, 300), madera: alm(900, 2000), piedra: alm(620, 2000), oro: alm(260, 1000), lingoteBronce: alm(40, 300), trigo: alm(800, 1000), armaMadera: alm(30, 100), armaCobre: alm(12, 100), armaBronce: alm(4, 100), armaduraBasica: alm(20, 100), cuero: alm(25, 100) },
    recintos: cual === 'obra'
      ? [anillo('r-1', 5, 2, 'todo'), anillo('r-2', 9, 1, 'todo', { mejorandoA: 2, mejoradas: 21, siguienteCeldaEn: AHORA + 12 * MIN })]
      : [anillo('r-1', 5, 2, 'todo'), anillo('r-2', 9, 1, 58, { siguienteCeldaEn: AHORA + 6 * MIN })],
    puertaCerradaA: ['enemigos', 'aedas'], vetadosIds: ['heroe-30', 'heroe-31'], permiteReabastecerAliados: cual !== 'obra',
    reservaManual: { madera: 300, piedra: 150, trigo: 900 },
    politicasActivas: [
      { id: 'pa-1', politicaId: 'edicto_cosecha', cargo: 'gobernador', activadaEn: AHORA - 40 * MIN, expiraEn: AHORA + 110 * MIN },
      { id: 'pa-2', politicaId: 'via_rapida', cargo: 'maestroObras', activadaEn: AHORA - 120 * MIN, expiraEn: AHORA + 30 * MIN },
      { id: 'pa-3', politicaId: 'presion_fiscal', cargo: 'tesorero', activadaEn: AHORA - 10 * MIN, expiraEn: AHORA + 140 * MIN },
    ],
    cargos: { gobernadorId: 'heroe-1', maestroObrasId: 'heroe-2', tesoreroId: cual === 'visita' ? null : 'heroe-1', maestroCaravanasId: 'heroe-4', generalId: 'heroe-3', sacerdoteId: null },
    heroesFundadoresIds: ['heroe-1', 'heroe-2'], casasCompradas: ['heroe-3', 'heroe-4'],
    participacion: { 'heroe-1': 140, 'heroe-2': 85, 'heroe-3': 210, 'heroe-4': 12, 'heroe-5': 30 },
    capitalDeFaccionId: cual === 'gobernador' ? undefined : 'f-1',
    autoConstruccionPausada: cual === 'obra',
    zonaReal: [{ x: -13, y: -12 }, { x: 13, y: -13 }, { x: 14, y: 12 }, { x: -12, y: 13 }],
    tablon: {
      misiones: [
        { definicion: def('d1'), desde: AHORA - 600 * MIN, hasta: AHORA + 840 * MIN, aceptaciones: [], aceptadasSemana: 0, estado: 'en_curso', condiciones: cond('d1', 340), aportes: { 'heroe-1': 200, 'heroe-2': 140 } },
        { definicion: def('d2'), desde: AHORA - 600 * MIN, hasta: AHORA + 840 * MIN, aceptaciones: [{ heroeId: 'heroe-1', estado: 'cumplida', condiciones: cond('d2', 1) }], aceptadasSemana: 3, condiciones: [], aportes: {} },
        { definicion: def('d3'), desde: AHORA - 600 * MIN, hasta: AHORA + 840 * MIN, aceptaciones: [], aceptadasSemana: 0, condiciones: [], aportes: {} },
        { definicion: def('s1'), desde: AHORA - 4 * 1440 * MIN, hasta: AHORA + 3 * 1440 * MIN, aceptaciones: [], aceptadasSemana: 0, estado: 'en_curso', condiciones: cond('s1', 1240), aportes: { 'heroe-1': 800, 'heroe-3': 440 } },
        { definicion: def('s2'), desde: AHORA - 4 * 1440 * MIN, hasta: AHORA + 3 * 1440 * MIN, aceptaciones: [{ heroeId: 'heroe-1', estado: 'en_curso', condiciones: cond('s2', 2) }], aceptadasSemana: 2, condiciones: [], aportes: {} },
      ],
      diariasIds: ['d1', 'd2', 'd3'], semanalesIds: ['s1', 's2'], conEleccion: true, elegidasDiariasIds: ['d1', 'd2', 'd4'], elegidasSemanalesIds: ['s1', 's3'],
      renovacionDiaria: AHORA + 840 * MIN, renovacionSemanal: AHORA + 3 * 1440 * MIN, catalogo: CATALOGO,
    },
    ...(cual === 'obra' ? { ascenso: { nivelObjetivo: 3, iniciadoEn: AHORA - 3000 * MIN, completaEn: AHORA + 7080 * MIN }, ocupacionHasta: AHORA + 95 * MIN } : {}),
  } as unknown as Asentamiento;
  const yo = cual === 'visita' ? 'heroe-6' : 'heroe-1';
  const p = {
    instante: AHORA, heroeId: yo, faccionId: 'f-1', asentamientos: [a],
    facciones: [{ id: 'f-1', nombre: 'Casa del Toro', nivel: 2, reyId: 'heroe-1', ciudadanosIds: ['heroe-1', 'heroe-2', 'heroe-3', 'heroe-4', 'heroe-5', 'heroe-6'], miembros: [] }, { id: 'f-2', nombre: 'Reino de Hatti', nivel: 3 }, { id: 'f-3', nombre: 'Liga de Ugarit', nivel: 2 }],
    nombresDeCompaneros: { 'heroe-30': 'Atreo', 'heroe-31': 'Tiestes', 'heroe-1': 'Minos', 'heroe-2': 'Ariadna', 'heroe-3': 'Teseo', 'heroe-4': 'Dédalo', 'heroe-5': 'Ícaro', 'heroe-6': 'Fedra' },
    pueblos: [
      { id: 'pueblo-1', tipo: 'aldeaAgricola', propio: true, madreId: 'as-1', posicion: { x: 3, y: 3 }, almacen: { trigo: 180, livestock: 60 }, capacidad: 500, carroId: 'k-9', nivelAldea: 1, fertilidad: 0.62, rebano: { especie: 'vacuno', cabezas: 34 } },
      { id: 'pueblo-2', tipo: 'cantera', nodoId: 'n-1', propio: true, madreId: 'as-1', posicion: { x: 4, y: -5 }, almacen: { piedra: 470 }, capacidad: 500, ...(cual === 'obra' ? { batallaId: 'b-1' } : {}) },
    ],
    obrasDeMapa: [
      ...(cual === 'obra' ? [] : [{ id: 'obra-3', madreId: 'as-1', propia: true, tipo: 'pueblo', nodoId: 'n-2', posicion: { x: -7, y: 3 }, requerido: { madera: 230, piedra: 80, oro: 10 }, entregado: { madera: 120, piedra: 80 } }]),
      ...(cual === 'obra' ? [{ id: 'obra-4', madreId: 'as-1', propia: true, tipo: 'mejoraAldea', destinoId: 'pueblo-1', posicion: { x: 3, y: 3 }, requerido: { madera: 300, piedra: 100 }, entregado: { madera: 300, piedra: 100 }, terminaEn: AHORA + 190 * MIN }] : []),
      { id: 'obra-5', madreId: 'as-1', propia: true, tipo: 'avanzada', posicion: { x: 9, y: -8 }, requerido: { madera: 200, piedra: 100 }, entregado: { madera: 80 } },
    ],
    avanzadas: [{ id: 'av-1', madreId: 'as-1', etapa: 1, posicion: { x: -8, y: -6 }, enRuinas: false, propia: true }],
    misiones: {
      heroe: [], faccion: [], plazaId: 'as-1',
      plaza: [
        mision('A2', 'cumplida', [['mercado', 1, 1]], { recompensas: [{ tipo: 'recurso', clave: 'madera', cantidad: 200 }, { tipo: 'oro', cantidad: 50 }] }),
        mision('A6', 'activa', [['artesanos', 118, 150]], { participacion: 40 }),
        mision('A8', 'activa', [['avanzadas', 0, 1]], { participacion: 60, recompensas: [{ tipo: 'tropa', clave: 'arqueros', cantidad: 12 }] }),
        mision('A9', 'activa', [['nivel', 2, 3]], { participacion: 100, recompensas: [{ tipo: 'recurso', clave: 'piedra', cantidad: 400 }] }),
        mision('A1', 'reclamada', [['aldeas', 1, 1]]), mision('A3', 'reclamada', [['barracon', 1, 1]]), mision('A4', 'reclamada', [['nivel', 2, 2]]),
      ],
    },
    tecnologia: { propias: { adoptadas: TEC } }, tecnologiasAdoptadas: TEC, heroesVisibles: [],
    heroe: { id: yo, displayName: yo === 'heroe-1' ? 'Minos' : 'Fedra', ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, escuadrones: [esc('s1', 'milicia_lanceros', 18), esc('s2', 'honderos', 20), esc('s3', 'arqueros', 6), esc('s4', 'lanceros_mimbre', 30, 22, { tipo: 'escolta', caravanaId: 'k-1' })] },
    ejercitos: [], campamentosMercenarios: [], asentamientosConocidos: [{ asentamientoId: 'as-5', nombre: 'Knossos', faccionId: 'f-1', nivel: 2 }],
    asentamientosAvistados: [{ id: 'as-9', nombre: 'Hattusa', faccionId: 'f-2', nivel: 3, posicion: { x: 120, y: 80 } }, { id: 'as-8', nombre: 'Ugarit', faccionId: 'f-3', nivel: 2, posicion: { x: 60, y: 140 } }],
    miradasIntel: [
      { id: 'm1', faccionId: 'f-1', origenId: 'as-1', centro: { x: 120, y: 80 }, radio: 30, compradaEn: AHORA - 40 * MIN, expiraEn: AHORA + 80 * MIN, libreEn: AHORA + 200 * MIN },
      { id: 'm2', faccionId: 'f-1', origenId: 'as-1', centro: { x: 64, y: 30 }, radio: 30, compradaEn: AHORA - 150 * MIN, expiraEn: AHORA - 30 * MIN, libreEn: AHORA + 90 * MIN },
    ],
    ordenes: [
      { id: 'o1', asentamientoId: 'as-1', tipo: 'venta', recurso: 'madera', cantidad: 200, cantidadCumplida: 120, precioUnitario: 0.8, creadoEn: AHORA - 60 * MIN, expiraEn: AHORA + 140 * MIN, estado: 'activa' },
      { id: 'o2', asentamientoId: 'as-1', tipo: 'compra', recurso: 'estano', cantidad: 50, cantidadCumplida: 5, precioUnitario: 3.5, creadoEn: AHORA - 20 * MIN, expiraEn: AHORA + 180 * MIN, estado: 'activa' },
      { id: 'o3', asentamientoId: 'as-1', tipo: 'venta', recurso: 'armaMadera', cantidad: 20, cantidadCumplida: 0, precioUnitario: 6, creadoEn: AHORA - 5 * MIN, expiraEn: AHORA + 195 * MIN, estado: 'activa' },
    ],
    caravanas: [
      { id: 'k-1', tipo: 'comercial', origenAsentamientoId: 'as-1', posicionActual: { x: 0, y: 0 }, estado: 'disponible', carros: [{ tipoCarro: 'basico', animal: 'buey' }, { tipoCarro: 'reforzado', animal: 'caballo' }, { tipoCarro: 'basico' }], escoltaIds: ['s4'], escoltaLiderazgo: { usado: 22, cupo: 200 } },
      { id: 'k-2', tipo: 'comercial', origenAsentamientoId: 'as-1', destinoAsentamientoId: 'as-9', posicionActual: { x: 40, y: 30 }, estado: 'en_transito', carros: [{ tipoCarro: 'basico', animal: 'caballo' }], contenido: { madera: 300 }, escoltaIds: [], escoltaLiderazgo: { usado: 0, cupo: 200 } },
      { id: 'kf-1', tipo: 'construccion', origenAsentamientoId: 'as-1', faccionId: 'f-1', titularId: 'heroe-1', posicionActual: { x: 0, y: 0 }, estado: 'disponible', caducaEn: AHORA + 30 * 60 * MIN },
      { id: 'kf-2', tipo: 'construccion', origenAsentamientoId: 'as-1', faccionId: 'f-1', titularId: 'heroe-3', posicionActual: { x: 30, y: 10 }, estado: 'adjunta' },
      { id: 'k-9', tipo: 'acarreo', origenAsentamientoId: 'as-1', posicionActual: { x: 2, y: 2 }, estado: cual === 'obra' ? 'disponible' : 'en_transito', carros: [{ tipoCarro: 'basico', animal: 'buey' }], contenido: cual === 'obra' ? {} : { trigo: 120, livestock: 40 }, escoltaIds: [], escoltaLiderazgo: { usado: 0, cupo: 100 } },
      { id: 'k-7', tipo: 'comercial', origenAsentamientoId: 'as-5', posicionActual: { x: 0, y: 0 }, estado: 'aparcada', carros: [{ tipoCarro: 'basico', animal: 'buey' }], contenido: { trigo: 120, cuero: 30 } },
    ],
    acuerdos: [
      { id: 't1', asentamientoAId: 'as-9', asentamientoBId: 'as-1', lineasA: [{ recurso: 'cobre', cantidadTotal: 100, cantidadEntregada: 0 }, { recurso: 'estano', cantidadTotal: 20, cantidadEntregada: 0 }], lineasB: [{ recurso: 'madera', cantidadTotal: 300, cantidadEntregada: 0 }], creadoEn: AHORA - 30 * MIN, expiraEn: AHORA + 90 * MIN, estado: 'propuesto' },
      { id: 't2', asentamientoAId: 'as-1', asentamientoBId: 'as-8', lineasA: [{ recurso: 'trigo', cantidadTotal: 400, cantidadEntregada: 250 }], lineasB: [{ recurso: 'cuero', cantidadTotal: 60, cantidadEntregada: 60 }, { recurso: 'lingoteBronce', cantidadTotal: 10, cantidadEntregada: 4 }], creadoEn: AHORA - 300 * MIN, expiraEn: AHORA + 600 * MIN, estado: 'activo' },
      { id: 't3', asentamientoAId: 'as-1', asentamientoBId: 'as-9', lineasA: [{ recurso: 'piedra', cantidadTotal: 200, cantidadEntregada: 0 }], lineasB: [{ recurso: 'oro', cantidadTotal: 50, cantidadEntregada: 0 }], creadoEn: AHORA - 900 * MIN, expiraEn: AHORA - 100 * MIN, estado: 'rechazado' },
    ],
    informesPlaza: [{ asentamientoId: 'as-9', faccionId: 'f-2', nombre: 'Hattusa', nivel: 3, conocidoEn: AHORA - 300 * MIN, heroesIds: ['heroe-20', 'heroe-21'],
      edificios: [['centroUrbano', 0, 0], ['vivienda', 3, 0], ['vivienda', 3, 2], ['vivienda', 5, 1], ['barracon', -3, 1], ['granja', 0, 4], ['granja', 2, 5], ['almacen', -2, -2], ['palacio', 1, -3]].map(([tipo, x, y]) => ({ tipo, estado: 'activo', posicion: { x, y } })),
      guarnicion: [{ tropaId: 'lanceros_mimbre', cantidad: 40, heroeId: 'heroe-20' }, { tropaId: 'arqueros', cantidad: 18, heroeId: 'heroe-21' }],
      recintos: [{ nivel: 2, avance: 13, celdas: Array.from({ length: 20 }, (_, i) => ({ clase: i % 7 === 0 ? 'puerta' : 'muro' })) }] }],
  } as unknown as ProyeccionJugador;
  return { p, a };
}

/** El mapa que el banco deja en `estadoCliente.mapaCache`: los nodos y las parcelas de bosque de la zona (sin capa de fertilidad). */
export const MAPA = {
  id: 'banco',
  mapa: {
    nodos: [
      { id: 'n-1', tipo: 'piedra', posicion: { x: 4, y: -5 } }, { id: 'n-2', tipo: 'cobre', posicion: { x: -7, y: 3 } }, { id: 'n-3', tipo: 'estano', posicion: { x: 9, y: 8 } },
      { id: 'n-4', tipo: 'piedra', posicion: { x: -3, y: -9 } }, { id: 'n-5', tipo: 'cobre', posicion: { x: 11, y: -2 } }, { id: 'n-6', tipo: 'ganado', posicion: { x: -10, y: 9 } },
      { id: 'n-9', tipo: 'hierro', posicion: { x: 40, y: 40 } },
    ],
    parcelas: Array.from({ length: 9 }, (_, i) => ({ id: `pc-${i + 1}`, centro: { x: -10 + (i % 3) * 3, y: -10 + Math.floor(i / 3) * 3 } })),
  },
};
