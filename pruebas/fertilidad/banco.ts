// Banco de la capa de fertilidad por cultivo (`/pruebas/fertilidad/`, 0.190.0): el modo mapa sin servidor, con el mundo que sirve `/__banco/mundo`
// (vite.config.ts, el que generó el motor), todo explorado, la fertilidad puesta y la lista de capas abierta. `?cultivo=trigo|vid|oliva|cebada|sesamo`
// la abre con ese cultivo; `&x=&y=&ancho=` encuadra un trozo del mundo (en u; de serie, el mundo entero). `&nivel=N` (0.192.0): la plaza de
// mayor nivel de tu Facción, que dice qué cultivos tienen casilla (de serie 4, los cinco; con 1, solo el trigo). `&sitios=<cultivo>` (0.194.0):
// los cuadritos de los sitios de aldea de ese cultivo en un círculo en el centro del encuadre, como al elegir el sitio en Territorio; `&capa=0`, sin
// la capa de fertilidad. Los datos de juego son los de
// `../plaza/datos.json` (el corte de la aldea). Cuando acaba de pintar, `window.__banco.listo`.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import { fromBinary } from '@bufbuild/protobuf';
import { ArtefactoDeMundoSchema } from '../../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../../src/mundo/artefacto';
import { pintarTerreno } from '../../src/render';
import { cablearCapas, cultivoVisible, htmlCapas } from '../../src/ui/capasMapa';
import { capasDelMapa, fijarCapa, fijarCultivoDeLaCapa } from '../../src/mundo/capasDelMapa';
import { esCultivo, pintarSitiosDeAldea, sitiosDeAldea } from '../../src/mundo/fertilidad';
import { poligonoDeZona } from '../../src/mundo/zonasRecordadas';
import { cultivosDesbloqueados, reglasDeAldea } from '../../src/ui/pueblos';
import { bloqueDeDatos, type ProyeccionJugador } from '../../src/apiCliente';

const banco = { listo: false };
(window as unknown as { __banco: typeof banco }).__banco = banco;
const qs = new URLSearchParams(location.search);
const pedido = qs.get('cultivo');
if (esCultivo(pedido)) fijarCultivoDeLaCapa(pedido);
fijarCapa('fertilidad', qs.get('capa') !== '0');

await new Promise<void>((listo) => { if (bloqueDeDatos('PUEBLOS_EXTRACTORES', listo)) listo(); });
// los cultivos con casilla: los de una Facción cuya plaza mayor es de `&nivel`
const deLaFaccion = { faccionId: 'f-1', asentamientos: [], plazasPropias: [], asentamientosAvistados: [{ id: 'pl-1', faccionId: 'f-1', nivel: Number(qs.get('nivel') ?? 4) }] } as unknown as ProyeccionJugador;
const cultivos = () => cultivosDesbloqueados(deLaFaccion);
const mapa = mapaDesdeArtefacto(fromBinary(ArtefactoDeMundoSchema, new Uint8Array(await (await fetch('/__banco/mundo')).arrayBuffer())));

document.getElementById('app')!.innerHTML = `<div class="mapa-screen mapa-interior" style="position:fixed;inset:0">
  <div class="mapa-lienzo"><canvas id="mapa-interior"></canvas></div>
  ${htmlCapas('mapa', reglasDeAldea().fertilidadMinima, cultivos())}
</div>`;
const raiz = document.querySelector<HTMLElement>('.mapa-interior')!;
const canvas = document.querySelector<HTMLCanvasElement>('#mapa-interior')!;
// Sin niebla (todo explorado) ni nada propio: solo el suelo, los ríos, los nodos y la capa.
const p = {
  heroeId: 'h', faccionId: null, facciones: [], asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [], pueblos: [], obrasDeMapa: [], avanzadas: [],
  caravanas: [], ejercitos: [], ejercitosAvistados: [], caravanasAvistadas: [], campamentosBandidos: [], campamentosMercenarios: [], heroesVisibles: [], aedas: [], alijos: [],
  exploracion: { tamanoCelda: 5, columnas: 0, filas: 0, celdas: '', visibles: '' }, instante: 0,
} as unknown as ProyeccionJugador;

// `&zonas=1` (0.198.2): estás dentro de tu plaza (no va entre las avistadas), en el centro del encuadre, y dos plazas de otras Facciones que solo
// recuerdas se le acercan por el sur y el este. Antes sus zonas recordadas se metían en la tuya; ahora la recortan, como en la vista 3D.
function ponerZonas(centro: { x: number; y: number }, r: number): void {
  const conocidas = [
    { asentamientoId: 'as-461', faccionId: 'f-2', nivel: 1, posicion: { x: centro.x - r * 0.3, y: centro.y + r * 1.45 }, conocidoEn: 0, radioPotencial: r * 0.8 },
    { asentamientoId: 'as-570', faccionId: 'f-3', nivel: 1, posicion: { x: centro.x + r * 1.3, y: centro.y + r * 0.9 }, conocidoEn: 0, radioPotencial: r * 0.9 },
  ];
  // la zona real de tu plaza la recorta el motor contra las vecinas: aquí igual
  const zonaReal = poligonoDeZona({ centro, radio: r, faccionId: 'f-1' }, conocidas.map((c) => ({ centro: c.posicion, radio: c.radioPotencial, faccionId: c.faccionId })));
  Object.assign(p, {
    faccionId: 'f-1',
    facciones: [{ id: 'f-1', nombre: 'Tu Facción' }, { id: 'f-2', nombre: 'Casa de Suppiluliuma' }, { id: 'f-3', nombre: 'Casa de Amenofis' }],
    asentamientos: [{ id: 'as-1', nombre: 'Tu plaza', faccionId: 'f-1', nivel: 2, posicion: centro, zonaReal, edificios: [] }],
    zonasFusionadas: [{ faccionId: 'f-1', contornos: [zonaReal] }],
    asentamientosConocidos: conocidas,
  });
}

function pintar(): void {
  const ancho = Number(qs.get('ancho') ?? mapa.config.ancho);
  const x0 = Number(qs.get('x') ?? 0), y0 = Number(qs.get('y') ?? 0);
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  if (qs.get('zonas')) ponerZonas({ x: x0 + ancho / 2, y: y0 + (ancho * canvas.height) / canvas.width / 2 }, ancho / 6);
  const escala = canvas.width / ancho;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, -x0 * escala, -y0 * escala);
  pintarTerreno(ctx, mapa, p, escala, true, capasDelMapa().fertilidad ? { fertilidad: { minimaAldea: reglasDeAldea().fertilidadMinima, cultivo: cultivoVisible(cultivos()) } } : {});
  const deLaAldea = qs.get('sitios');
  if (esCultivo(deLaAldea)) {
    const centro = { x: x0 + ancho / 2, y: y0 + (ancho * canvas.height) / canvas.width / 2 };
    const sitios = sitiosDeAldea(mapa, { centro, radio: ancho / 6 }, [], reglasDeAldea().fertilidadMinima, reglasDeAldea().separacionMinima, deLaAldea);
    if (sitios) pintarSitiosDeAldea(ctx, sitios, escala);
  }
}
cablearCapas(raiz, pintar, cultivos);
pintar();
// la lista abierta, para verla
raiz.querySelector<HTMLButtonElement>('.mapa-capas-boton')?.click();
banco.listo = true;
