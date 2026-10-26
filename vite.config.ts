import { defineConfig } from 'vite';

// A diferencia de `cliente/vite.config.ts`, SIN ningún alias `@motor/*` — es la prueba de que este proyecto
// no depende del motor de ninguna forma. Ver README.md.
//
// El motor (`bronzeage-servidor`) sirve en un solo puerto el acceso, el artefacto de mundo y el WebSocket, con el CORS abierto: el cliente
// lo llama directamente (`VITE_API_BASE`, por defecto el mismo host en el puerto 7878; ver `src/apiCliente.ts`). Sin proxy.
export default defineConfig({
  root: '.',
  server: {
    port: 5174,
  },
});
