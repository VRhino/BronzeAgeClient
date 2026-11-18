// Banco de un pueblo por dentro (`/pruebas/pueblos/`): el mismo esqueleto que monta `montarPueblo` en main.ts (blasón, almacén, riel con sus partes y
// la ventana), sin 3D ni servidor y con un fondo de imagen o degradado. `?tipo=aldea|cantera` (la aldea de trigo o la cantera), `&parte=resumen|
// guarnicion|acarreo|carga` con esa parte abierta, `&gobernador=1` como Gobernador de la madre, `&visita=1` de otra Facción (no gestionas),
// `&fondo=<url>` imagen detrás. Los botones no hacen nada.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import { bloqueDeDatos, tropasReclutables, type ProyeccionJugador } from '../../src/apiCliente';
import { htmlBarraJugador } from '../../src/ui/barraJugador';
import { htmlBlasonInterior, htmlPlacaDeRecursos, htmlRielInterior, htmlTituloDeParte, iconoDePueblo } from '../../src/ui/hudInterior';
import { cablearInteriorPueblo, htmlCuerpoPueblo, nombreDePueblo, pestanasDePueblo, type PestanaPueblo } from '../../src/ui/pueblos';
import { vigilarPieArriba } from '../../src/ui/hudPlaza';
import { estadoCliente } from '../../src/ui/estadoCliente';
import type { Asentamiento, PuebloDeMapa } from '../../src/tiposDominio';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const qs = new URLSearchParams(location.search);
const tipo = qs.get('tipo') === 'cantera' ? 'cantera' : 'aldeaAgricola';
const parte = (qs.get('parte') as PestanaPueblo | null) ?? null;
const gobernador = qs.get('gobernador') === '1';
const visita = qs.get('visita') === '1';

const madre = { id: 'as-1', nombre: 'Tirinto', faccionId: visita ? 'f-2' : 'f-1', posicion: { x: 500, y: 500 }, nivel: 4, nivelActual: 4, edificios: [], cargos: { gobernadorId: gobernador ? 'h' : 'h2' } } as unknown as Asentamiento;
const pueblo: PuebloDeMapa = {
  id: 'pu-3', madreId: madre.id, propio: !visita, tipo, posicion: { x: 540, y: 480 }, nodoId: 'nodo-9',
  almacen: tipo === 'cantera' ? { piedra: 380 } : { trigo: 540 }, capacidad: tipo === 'cantera' ? 2000 : 1200,
  nivelAldea: 2, ...(tipo === 'cantera' ? {} : { fertilidad: 1.1, cultivo: 'trigo' }),
  guarnicionJugadoresIds: ['g1'], cupoGuarnicionPorHeroe: 45,
};
const escuadrones = [
  { id: 'g1', nombre: 'Lanceros de Tirinto', tropaId: 'lanceros', cantidad: 30, nivel: 2, costeLiderazgo: 6, contenedor: { tipo: 'pueblo', puebloId: pueblo.id } },
  { id: 's1', nombre: 'Honderos', tropaId: 'honderos', cantidad: 25, nivel: 1, costeLiderazgo: 4, contenedor: { tipo: 'ejercito', ejercitoId: 'ej-1' } },
  { id: 's2', nombre: 'Escudados', tropaId: 'escudados', cantidad: 30, nivel: 1, costeLiderazgo: 8, contenedor: { tipo: 'ejercito', ejercitoId: 'ej-1' } },
];
const columna = { id: 'ej-1', liderId: 'h', participantes: [{ heroeId: 'h' }], posicionActual: pueblo.posicion, suministro: { madera: 180, trigo: 90 }, capacidadCarga: 400 };
const p = {
  instante: Date.now(), heroeId: 'h', faccionId: 'f-1', pueblos: [pueblo], asentamientos: visita ? [] : [madre], asentamientosAvistados: visita ? [madre] : [],
  asentamientosConocidos: [{ asentamientoId: madre.id, nombre: madre.nombre, faccionId: madre.faccionId, posicion: madre.posicion, nivel: 4, conocidoEn: 0 }],
  facciones: [{ id: 'f-1', nombre: 'Argólide', miembros: [{ heroeId: 'h', cargos: gobernador ? [`gobernador@${madre.id}`] : [] }] }], relaciones: [],
  heroe: { id: 'h', displayName: 'Víctor', ubicacion: { tipo: 'pueblo', puebloId: pueblo.id }, residenciaId: visita ? undefined : madre.id, viveres: 140, escuadrones, loadouts: [], carro: { madera: 120, piedra: 60 } },
  ejercitos: [columna], caravanas: [], obrasDeMapa: [], avanzadas: [], tecnologiasAdoptadas: ['lanzas', 'arcos', 'escudos', 'hondas'],
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const app = document.getElementById('app')!;
function pintar(): void {
  if (!document.querySelector('.pueblo-screen')) {
    app.innerHTML = `<div class="asent-screen pueblo-screen plaza-3d">
      ${htmlBarraJugador(p, e)}
      <div class="asent-cuerpo">
        <div class="asent-centro"><div class="asent-mapa pueblo-mapa"><div class="pueblo-fondo"></div></div></div>
        <aside class="asent-izq"><div class="asent-blason"></div></aside>
        <aside class="asent-der"></aside>
        <div class="asent-pie pueblo-almacen"></div>
        <nav class="asent-riel" aria-label="Partes del pueblo"></nav>
        <header class="asent-barra"><div class="asent-barra-acciones"><button class="btn-primary" type="button">Salir al mundo</button></div></header>
        <section class="asent-ventana" role="dialog" aria-label="Pueblo" hidden>
          <header class="asent-ventana-cab"><div class="asent-ventana-titulo"></div><button class="asent-ventana-cerrar" type="button">✕</button></header>
          <div class="asent-edif-cuerpo pueblo-lado"></div>
        </section>
      </div>
    </div>`;
    vigilarPieArriba(app.querySelector<HTMLElement>('.plaza-3d'));
    const fondo = app.querySelector<HTMLElement>('.pueblo-fondo')!;
    fondo.style.cssText = `position:absolute;inset:0;background:${qs.get('fondo') ? `url("${qs.get('fondo')}") center/cover` : 'radial-gradient(circle at 50% 45%, #6f8a4a, #2f3d22)'}`;
  }
  app.querySelector<HTMLElement>('.asent-blason')!.innerHTML = htmlBlasonInterior({
    icono: iconoDePueblo(pueblo.tipo, undefined, pueblo.cultivo), nombre: nombreDePueblo(pueblo), lineas: [`De ${madre.nombre}`, pueblo.propio ? 'De tu Facción' : 'De visita'],
  }, e);
  app.querySelector<HTMLElement>('.pueblo-almacen')!.innerHTML = htmlPlacaDeRecursos('almacen', 'Almacén', pueblo.almacen, e, pueblo.capacidad || undefined);
  const partes = pestanasDePueblo(p, pueblo);
  app.querySelector<HTMLElement>('.asent-riel')!.innerHTML = htmlRielInterior(partes.map(([id, t]) => ({ id, titulo: t })), parte, e);
  const ventana = app.querySelector<HTMLElement>('.asent-ventana')!;
  ventana.hidden = !parte;
  if (!parte) return;
  ventana.dataset.ancho = 'normal';
  ventana.querySelector<HTMLElement>('.asent-ventana-titulo')!.innerHTML = htmlTituloDeParte(parte, partes.find(([id]) => id === parte)?.[1] ?? parte, e);
  const lado = ventana.querySelector<HTMLElement>('.pueblo-lado')!;
  lado.innerHTML = htmlCuerpoPueblo(p, pueblo, parte, e);
  cablearInteriorPueblo(lado, p, pueblo, async () => null, pintar);
}
// el balance llega en segundo plano: se repinta cuando están las tropas y las reglas
(window as unknown as { __p?: unknown }).__p = tropasReclutables(pintar) && bloqueDeDatos('PUEBLO', pintar);
pintar();
