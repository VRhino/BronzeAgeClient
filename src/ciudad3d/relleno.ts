// Lo que llena las celdas libres de la ciudad (la textura del suelo pone los huertos y los patios; aquí va lo que tiene bulto: árboles,
// rediles de piedra, hornos, leña, almiares) y los árboles del campo de alrededor (`estado.ts` decide qué va en cada celda).
import { COLOR } from './config';
import { hash3, type CiudadEnVista, type Relleno } from './estado';
import { arbol } from './modelos';
import type { Forma, Piezas } from './piezas';

/** Un marco mínimo para reutilizar `arbol` de los modelos en coordenadas de la escena. */
const enEscena = (p: Piezas) => ({
  forma: (f: Forma, color: number, u: number, v: number, l: number, s: number, h: number, y = 0) => p.forma(f, color, u, v, l, s, h, 0, y),
});

function celda(p: Piezas, r: Relleno, T: number, estilo: number): void {
  const az = (k: number): number => hash3(r.semilla, k, 11);
  const cx = r.x + T / 2, cz = r.y + T / 2, m = enEscena(p);
  switch (r.tipo) {
    case 'arboles': {
      const n = 1 + Math.floor(az(1) * 3);
      for (let k = 0; k < n; k++) arbol(m, cx + (az(10 + k) - 0.5) * (T - 1.1), cz + (az(20 + k) - 0.5) * (T - 1.1), az(30 + k), estilo);
      break;
    }
    case 'redil': {
      // un redil redondo de piedra seca (la aldea en ladera), o de varas en los niveles bajos
      const rr = T * 0.36, n = 14;
      for (let k = 0; k < n; k++) {
        if (k === 0) continue;
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        p.viga(estilo >= 2 ? COLOR.piedra : COLOR.zarzo, cx + Math.cos(a0) * rr, cz + Math.sin(a0) * rr, cx + Math.cos(a1) * rr, cz + Math.sin(a1) * rr, 0, 0.18, 0.42);
      }
      break;
    }
    case 'horno':
      p.forma('cupula', COLOR.barro, cx + (az(1) - 0.5), cz + (az(2) - 0.5), 0.7, 0.7, 0.42);
      if (az(3) < 0.5) p.forma('cupula', COLOR.adobe, cx - 0.6, cz + 0.5, 0.9, 0.9, 0.6);
      break;
    case 'lena':
      for (let c = 0; c < 3; c++) for (let i = 0; i < 4 - c; i++) {
        p.forma('cilindro', i % 2 ? COLOR.madera : COLOR.tronco, cx, cz - 0.33 + i * 0.22 + c * 0.11, 0.2, 0.2, 1.2, Math.PI / 2 * (az(1) < 0.5 ? 1 : 0) + Math.PI / 2, c * 0.18, Math.PI / 2);
      }
      break;
    case 'almiar':
      for (let k = 0; k < 1 + Math.floor(az(1) * 2); k++) {
        const x = cx + (k - 0.5) * 1.1, z = cz + (az(5 + k) - 0.5);
        p.forma('cono', COLOR.heno, x, z, 0.9, 0.9, 1.0);
        p.poste(COLOR.madera, x, z, 1.2, 0.05);
      }
      break;
    case 'huerto':
      // las varas de la valla del huerto (los surcos van en el suelo)
      if (az(1) < 0.6) {
        const a = r.x + 0.25, b = r.x + T - 0.25, c = r.y + 0.25, d = r.y + T - 0.25;
        for (const [x0, z0, x1, z1] of [[a, c, b, c], [b, c, b, d], [b, d, a, d]] as const) {
          for (let k = 0; k <= 4; k++) p.poste(COLOR.madera, x0 + ((x1 - x0) * k) / 4, z0 + ((z1 - z0) * k) / 4, 0.4, 0.05);
          p.viga(COLOR.zarzo, x0, z0, x1, z1, 0.18, 0.04, 0.18);
        }
      }
      break;
    case 'patio':
      if (az(1) < 0.35) arbol(m, cx + (az(2) - 0.5), cz + (az(3) - 0.5), az(4) * 0.6, estilo);
      break;
    default:
      if (az(1) < 0.25) arbol(m, cx + (az(2) - 0.5) * 1.5, cz + (az(3) - 0.5) * 1.5, az(4), estilo);
  }
}

/** Las celdas libres de la ciudad y el campo de alrededor. `estilo`: el de la plaza. */
export function montarRelleno(p: Piezas, c: CiudadEnVista, estilo: number): void {
  const T = c.celda;
  for (const r of c.libres) celda(p, r, T, estilo);
}
