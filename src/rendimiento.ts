// Los renderizadores de three.js que hay en pantalla, para el panel de rendimiento (F3, `ui/panelRendimiento.ts`): la vista del mundo y la de
// la plaza se apuntan al crearse; el panel solo lee `renderer.info` (llamadas de dibujo y triángulos del último fotograma) mientras está abierto.
// Leerlo no cuesta nada: three.js lo cuenta siempre.
import type { WebGLRenderer } from 'three';

const renderizadores = new Map<string, WebGLRenderer>();

/** Apunta (o sustituye) el renderizador de una vista por su nombre. */
export function registrarRenderer(nombre: string, r: WebGLRenderer): void {
  renderizadores.set(nombre, r);
}

/** Los que siguen en la página, con lo que dibujaron en su último fotograma. */
export function infoDeRenderers(): { nombre: string; llamadas: number; triangulos: number; geometrias: number; texturas: number }[] {
  return [...renderizadores.entries()].filter(([, r]) => r.domElement.isConnected).map(([nombre, r]) => ({
    nombre,
    llamadas: r.info.render.calls,
    triangulos: r.info.render.triangles,
    geometrias: r.info.memory.geometries,
    texturas: r.info.memory.textures,
  }));
}
