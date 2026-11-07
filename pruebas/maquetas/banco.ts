// Banco de las maquetas de plaza del mundo 3D, vistas desde arriba sin WebGL (0.173.0): los niveles 1 a 5 en columnas y tres semillas en filas.
// `?rc=4` el radio de la ciudad (u). Cada caja con su color de material; más clara cuanto más alta.
import { piezasDeCiudad } from '../../src/mundo3d/maquetas';

const COLOR: Record<string, string> = { muro: '#c9b48f', adobe: '#d2bf9a', techo: '#a8714a', madera: '#8a6440', filo: '#f4ead2', campo: '#b59a3a', ruina: '#7d7466' };
const rc = Number(new URLSearchParams(location.search).get('rc') ?? 4);
const celda = 300, escala = celda / (2 * rc + 1.2);
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = celda * 5; c.height = celda * 3;
const g = c.getContext('2d')!;
for (let fila = 0; fila < 3; fila++) for (let nivel = 1; nivel <= 5; nivel++) {
  const ox = (nivel - 0.5) * celda, oy = (fila + 0.5) * celda;
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(ox, oy, rc * escala, 0, Math.PI * 2); g.stroke();
  const piezas = piezasDeCiudad(0, 0, rc, nivel, 1000 + fila * 7919).sort((a, b) => a.base + a.alto - (b.base + b.alto));
  for (const p of piezas) {
    g.save(); g.translate(ox + p.x * escala, oy + p.y * escala); g.rotate(p.giro);
    g.fillStyle = COLOR[p.mat] ?? '#888'; g.globalAlpha = 0.85;
    g.fillRect(-p.ancho * escala / 2, -p.fondo * escala / 2, p.ancho * escala, p.fondo * escala);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; g.strokeRect(-p.ancho * escala / 2, -p.fondo * escala / 2, p.ancho * escala, p.fondo * escala);
    g.restore();
  }
  g.fillStyle = '#fff'; g.fillText(`nivel ${nivel}`, ox - celda / 2 + 8, oy - celda / 2 + 16);
}
(window as unknown as { listo: boolean }).listo = true;
