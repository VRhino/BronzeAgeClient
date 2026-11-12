// Banco de la pantalla de elegir campamento al crear el héroe (`/pruebas/eleccion/`): sin servidor. El mundo es el artefacto que sirve
// `/__banco/mundo` (vite.config.ts, el del motor); la gente de cada campamento es de mentira y los datos de juego, los de `datos.json`
// (TROPAS_RECLUTABLES y las tecnologías de arranque, sacados de Docs/Mechanics del motor). Crear no sale: se anota en `window.__banco.creado`. Las clases del héroe, de `pruebas/plaza/datos.json`.
import '../../src/style.css';
import { fromBinary } from '@bufbuild/protobuf';
import { ArtefactoDeMundoSchema } from '../../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../../src/mundo/artefacto';
import { montarEleccionCampamento } from '../../src/ui/eleccionCampamento';
import type { TropaReclutable } from '../../src/apiCliente';
import datos from './datos.json';
import juego from '../plaza/datos.json';
import type { ClaseHeroe, FichaObjeto } from '../../src/ui/clasesHeroe';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const GENTE: [number, number][] = [[4, 9], [1, 2], [0, 0], [6, 14], [2, 3], [0, 1], [3, 5], [0, 0], [1, 1], [2, 2]];
const banco = { creado: null as null | { nombre: string; campamentoId: string; clase: string }, listo: false };
// las clases y los objetos, de los datos del motor (Objetos_Del_Heroe, motor c82d6ed)
const objetosDelHeroe = (juego.documentos as unknown as Record<string, { CLASES_HEROE: { clases: ClaseHeroe[] }; OBJETOS: { objetos: FichaObjeto[] } }>).Objetos_Del_Heroe!;
(window as unknown as { __banco: typeof banco }).__banco = banco;

const mapa = fetch('/__banco/mundo').then(async (r) => mapaDesdeArtefacto(fromBinary(ArtefactoDeMundoSchema, new Uint8Array(await r.arrayBuffer()))));
void mapa.then((m) => {
  const campamentos = (m.campamentos ?? []).map((c, i) => ({ id: `camp-${i}`, posicion: c.posicion, origen: c.origen, residentes: GENTE[i % GENTE.length]![0], eligieronComoInicial: GENTE[i % GENTE.length]![1] }));
  montarEleccionCampamento(document.querySelector<HTMLElement>('#app')!, {
    campamentos,
    mapa: Promise.resolve(m),
    edificiosMilitares: () => ({ lista: ['barracon', 'galeriaDeTiro', 'caballerizas'], nivel: 3 }),
    tropas: () => datos.tropas as unknown as TropaReclutable[],
    deArranque: (t) => datos.deArranque.includes(t),
    clases: () => objetosDelHeroe.CLASES_HEROE.clases,
    objetos: () => objetosDelHeroe.OBJETOS.objetos,
    crear: async (nombre, campamentoId, clase) => { banco.creado = { nombre, campamentoId, clase }; return nombre ? null : 'Ponle un nombre a tu héroe.'; },
    escapar: e,
  });
  setTimeout(() => { banco.listo = true; }, 2500);
});
