// Banco de la capa de fertilidad por cultivo (`/pruebas/fertilidad/`, 0.190.0): el modo mapa sin servidor, con el mundo que sirve `/__banco/mundo`
// (vite.config.ts, el que generó el motor), todo explorado, la fertilidad puesta y la lista de capas abierta. `?cultivo=trigo|vid|oliva|cebada|sesamo`
// la abre con ese cultivo; `&x=&y=&ancho=` encuadra un trozo del mundo (en u; de serie, el mundo entero). Los datos de juego son los de
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
import { cablearCapas, htmlCapas } from '../../src/ui/capasMapa';
import { capasDelMapa, cultivoDeLaCapa, fijarCapa, fijarCultivoDeLaCapa } from '../../src/mundo/capasDelMapa';
import { esCultivo } from '../../src/mundo/fertilidad';
import { reglasDeAldea } from '../../src/ui/pueblos';
import { bloqueDeDatos, type ProyeccionJugador } from '../../src/apiCliente';

const banco = { listo: false };
(window as unknown as { __banco: typeof banco }).__banco = banco;
const qs = new URLSearchParams(location.search);
const pedido = qs.get('cultivo');
if (esCultivo(pedido)) fijarCultivoDeLaCapa(pedido);
fijarCapa('fertilidad', true);

await new Promise<void>((listo) => { if (bloqueDeDatos('PUEBLOS_EXTRACTORES', listo)) listo(); });
const mapa = mapaDesdeArtefacto(fromBinary(ArtefactoDeMundoSchema, new Uint8Array(await (await fetch('/__banco/mundo')).arrayBuffer())));

document.getElementById('app')!.innerHTML = `<div class="mapa-screen mapa-interior" style="position:fixed;inset:0">
  <div class="mapa-lienzo"><canvas id="mapa-interior"></canvas></div>
  ${htmlCapas('mapa', reglasDeAldea().fertilidadMinima)}
</div>`;
const raiz = document.querySelector<HTMLElement>('.mapa-interior')!;
const canvas = document.querySelector<HTMLCanvasElement>('#mapa-interior')!;
// Sin niebla (todo explorado) ni nada propio: solo el suelo, los ríos, los nodos y la capa.
const p = {
  heroeId: 'h', faccionId: null, facciones: [], asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [], pueblos: [], obrasDeMapa: [], avanzadas: [],
  caravanas: [], ejercitos: [], ejercitosAvistados: [], caravanasAvistadas: [], campamentosBandidos: [], campamentosMercenarios: [], heroesVisibles: [], aedas: [], alijos: [],
  exploracion: { tamanoCelda: 5, columnas: 0, filas: 0, celdas: '', visibles: '' }, instante: 0,
} as unknown as ProyeccionJugador;

function pintar(): void {
  const ancho = Number(qs.get('ancho') ?? mapa.config.ancho);
  const x0 = Number(qs.get('x') ?? 0), y0 = Number(qs.get('y') ?? 0);
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const escala = canvas.width / ancho;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, -x0 * escala, -y0 * escala);
  pintarTerreno(ctx, mapa, p, escala, true, capasDelMapa().fertilidad ? { fertilidad: { minimaAldea: reglasDeAldea().fertilidadMinima, cultivo: cultivoDeLaCapa() } } : {});
}
cablearCapas(raiz, pintar);
pintar();
// la lista abierta, para verla
raiz.querySelector<HTMLButtonElement>('.mapa-capas-boton')?.click();
banco.listo = true;
