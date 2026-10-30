import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// A diferencia de `cliente/vite.config.ts`, SIN ningún alias `@motor/*` — es la prueba de que este proyecto
// no depende del motor de ninguna forma. Ver README.md.
//
// El motor (`bronzeage-servidor`) sirve en un solo puerto el acceso, el artefacto de mundo y el WebSocket, con el CORS abierto: el cliente
// lo llama directamente (`VITE_API_BASE`, por defecto el mismo host en el puerto 7878; ver `src/apiCliente.ts`). Sin proxy.

/** Solo en desarrollo, para el banco de pruebas del mundo 3D (`pruebas/mundo3d/`, `npm run mundo3d`): sirve el artefacto de mundo y su paquete
 * de relieve que haya generado el motor (`generador/salida/mundo/` del checkout hermano, o `MOTOR`) en `/__banco/mundo` y `/__banco/relieve`.
 * No es una dependencia del motor: son ficheros que se leen como los bajaría el cliente. */
function bancoMundo3d(): Plugin {
  const motor = process.env.MOTOR ?? ['../BronzeAgeFase0', '../BronzeAge'].map((p) => resolve(p)).find((p) => existsSync(p)) ?? '';
  const dir = join(motor, 'generador/salida/mundo');
  const fichero = (prefijo: string) => (existsSync(dir) ? readdirSync(dir).find((n) => n.startsWith(prefijo) && n.endsWith('.bin')) : undefined);
  return {
    name: 'banco-mundo3d',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__banco', (req, res) => {
        const nombre = req.url === '/mundo' ? fichero('mundo-') : req.url === '/relieve' ? fichero('relieve-') : undefined;
        if (!nombre) {
          res.statusCode = 404;
          res.end(`no hay ${req.url} en ${dir}: genera el mundo en el motor`);
          return;
        }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(readFileSync(join(dir, nombre)));
      });
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [bancoMundo3d()],
  server: {
    port: 5174,
  },
});
