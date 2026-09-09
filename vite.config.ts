import { defineConfig } from 'vite';

// A diferencia de `cliente/vite.config.ts`, SIN ningún alias `@motor/*` — es la prueba de que este proyecto
// no depende del motor de ninguna forma. Ver README.md.
//
// El backend (Fastify) corre aparte, con todo bajo `/v1`. Por defecto `http://localhost:3000`; `BACKEND_URL`
// apunta el proxy a otra instancia (p.ej. la de Render) sin tocar código ni tener que lidiar con CORS —
// `npm run dev` sirve el cliente en local y reenvía `/v1` al backend que digas.
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  root: '.',
  server: {
    port: 5174,
    proxy: {
      '/v1': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
});
