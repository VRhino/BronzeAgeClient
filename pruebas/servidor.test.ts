// Contra un `bronzeage-servidor` de verdad (solo con `BRONZEAGE_URL=http://127.0.0.1:7878`): registro, login, sesión, Bienvenida sin héroe,
// `crear_heroe` con respuesta causal, el artefacto de mundo y su relieve, la VISTA con su niebla y la reanudación sin novedad.
import { describe, expect, test } from 'vitest';
import { fromBinary } from '@bufbuild/protobuf';
import { TipoEntidad } from '../src/contrato/gen/bronzeage/v1/common_pb';
import { ArtefactoDeMundoSchema, PaqueteRelieveSchema } from '../src/contrato/gen/bronzeage/v1/world_pb';
import { Resultado, TipoCliente } from '../src/contrato/gen/bronzeage/v1/session_pb';
import { descargarArtefacto, descargarRelieve, entrar, registrar } from '../src/contrato/acceso';
import { verificarRelieve } from '../src/mundo/relieve';
import { Sesion } from '../src/contrato/sesion';

const BASE = process.env.BRONZEAGE_URL;
const WS = BASE?.replace(/^http/, 'ws') + '/';

async function hasta(cond: () => boolean, ms = 10_000): Promise<void> {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error('no llegó a tiempo');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe.skipIf(!BASE)('servidor real', () => {
  test('una cuenta nueva entra, crea su héroe y reanuda sin novedad', async () => {
    const nick = `prueba${Date.now() % 1_000_000}`;
    await registrar(BASE!, nick, 'clave-larga', process.env.CODIGO_REGISTRO ?? '');
    const acceso = await entrar(BASE!, nick, 'clave-larga');
    expect(acceso.bot).toBe(false);

    const s = new Sesion({ url: WS, token: acceso.token, versionCliente: 'pruebas', cliente: TipoCliente.CLIENTE_UNITY, reconectar: false });
    const b = await s.abrir();
    expect(b.heroeId).toBeUndefined();
    expect(b.campamentosParaElegir.length).toBeGreaterThan(0);
    expect(b.mundo?.urlArtefacto).toMatch(/^\/v1\/mundo\//);

    const artefacto = fromBinary(ArtefactoDeMundoSchema, await descargarArtefacto(BASE!, b.mundo!.urlArtefacto));
    expect(artefacto.manifiesto?.hash).toBe(b.mundo!.hash);
    // El relieve fino, si el servidor lo tiene al lado del artefacto: su ruta, su hash y que es el de este mundo.
    if (b.mundo!.urlRelieve) {
      expect(b.mundo!.urlRelieve).toBe(`/v1/mundo/${b.mundo!.hash}/relieve`);
      const relieve = fromBinary(PaqueteRelieveSchema, await descargarRelieve(BASE!, b.mundo!.urlRelieve));
      expect(await verificarRelieve(relieve, b.mundo!.hashRelieve)).toBe(true);
      expect(relieve.hashArtefacto).toBe(b.mundo!.hash);
    }

    const camp = b.campamentosParaElegir[0]!;
    const r = await s.ordenar({ case: 'crearHeroe', value: { displayName: 'Ana', campamentoId: camp.campamentoId } });
    expect(r.resultado, JSON.stringify(r.rechazo)).toBe(Resultado.ORDEN_ACEPTADA);
    // Respuesta causal: al llegar el resultado, el almacén ya tiene el héroe y su ámbito (el nombre aún lo pone el motor: «Héroe N»).
    const heroeId = r.creadas.find((c) => c.entidad === TipoEntidad.HEROE)!.id;
    expect(s.almacen.ambitos.has(`HEROE:${heroeId}`)).toBe(true);
    expect(s.almacen.ambitos.has(`CAMPAMENTO:${camp.campamentoId}`)).toBe(true);
    expect(s.almacen.todas('heroe').map((h) => h.id)).toContain(heroeId);
    s.cerrar();

    // Otra sesión con lo que se guardó: la Bienvenida trae el héroe y todo reanuda sin novedad.
    const s2 = new Sesion({ url: WS, token: acceso.token, versionCliente: 'pruebas', almacen: s.almacen, mundoHash: b.mundo!.hash, reconectar: false });
    const b2 = await s2.abrir();
    expect(b2.heroeId).toBe(heroeId);
    expect(b2.ambitos.every((a) => a.decision === 3 /* REANUDA_SIN_NOVEDAD */ || a.ambito?.tipo === 4 /* VISTA */)).toBe(true);

    // La VISTA alrededor del campamento llega como foto con su niebla.
    const p = camp.posicion!;
    const r200 = 200_000n;
    s2.cambiarVista({ min: { x: p.x - r200, y: p.y - r200 }, max: { x: p.x + r200, y: p.y + r200 } });
    await hasta(() => [...s2.almacen.ambitos.keys()].some((k) => k.startsWith('VISTA:')));
    const vista = [...s2.almacen.ambitos.entries()].find(([k]) => k.startsWith('VISTA:'))![1];
    expect(vista.niebla?.columnas).toBeGreaterThan(0);
    expect(s2.ahoraMundo()).toBeGreaterThan(0);
    s2.cerrar();
  }, 30_000);
});
