// Plano de un campamento de bandidos, como el de una plaza pero más cerca: los campamentos no crecen, así que el plano llena el cuadro.
// ESQUEMÁTICO: el backend no publica un trazado de los campamentos de bandidos (solo de plazas y de campamentos de mercenarios), así que
// esto es un dibujo decorativo, estable por id y que crece con el nivel (más tiendas, empalizada, torres). No transmite ningún dato de juego
// que no esté ya en la ficha. Si el backend publica su trazado, este fichero se sustituye por ese.
import type { CampamentoBandido } from '../tiposDominio';

function semilla(texto: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Radio de la empalizada y número de tiendas por nivel (1-3). */
const POR_NIVEL: Record<number, { radio: number; tiendas: number }> = { 1: { radio: 54, tiendas: 4 }, 2: { radio: 66, tiendas: 7 }, 3: { radio: 78, tiendas: 11 } };

export function svgPlanoBandidos(c: CampamentoBandido): string {
  const nivel = Math.min(3, Math.max(1, c.nivel ?? 1));
  const { radio, tiendas } = POR_NIVEL[nivel]!;
  const azar = semilla(c.id);
  const f = (n: number): string => n.toFixed(1);
  const partes: string[] = [`<rect width="200" height="200" fill="#8b7d57"/>`];
  // Empalizada: estacas en anillo, con la puerta al sur.
  const estacas = Math.round(radio / 3.2);
  for (let i = 0; i < estacas; i++) {
    const ang = (i / estacas) * 2 * Math.PI;
    if (Math.sin(ang) > 0.93) continue; // puerta
    partes.push(`<circle cx="${f(100 + radio * Math.cos(ang))}" cy="${f(100 + radio * Math.sin(ang))}" r="2.6" fill="#4a3320" stroke="#241a10" stroke-width="0.6"/>`);
  }
  if (nivel === 3) for (const sx of [-1, 1]) partes.push(`<rect x="${f(100 + sx * radio * 0.72 - 5)}" y="${f(100 - radio * 0.72 - 5)}" width="10" height="10" fill="#5a4026" stroke="#241a10" stroke-width="0.8"><title>Atalaya</title></rect>`);
  // Tiendas en anillo interior, con algo de ruido; la del jefe, mayor, al fondo.
  for (let i = 0; i < tiendas; i++) {
    const ang = (i / tiendas) * 2 * Math.PI + azar() * 0.4;
    const r = radio * (0.45 + azar() * 0.15);
    const x = 100 + r * Math.cos(ang);
    const y = 100 + r * Math.sin(ang);
    partes.push(`<polygon points="${f(x)},${f(y - 7)} ${f(x - 7)},${f(y + 5)} ${f(x + 7)},${f(y + 5)}" fill="#b89a62" stroke="#3a2a14" stroke-width="0.8"><title>Tienda</title></polygon>`);
  }
  partes.push(`<polygon points="100,${f(100 - radio * 0.3 - 11)} ${f(100 - 13)},${f(100 - radio * 0.3 + 6)} ${f(100 + 13)},${f(100 - radio * 0.3 + 6)}" fill="#8f3a2c" stroke="#2c110c" stroke-width="1"><title>Tienda del jefe</title></polygon>`);
  partes.push(`<circle cx="100" cy="100" r="5" fill="#d9772b" stroke="#3a2a14" stroke-width="1"><title>Hoguera</title></circle>`);
  return `<svg class="campamento-plano bandidos-plano" viewBox="0 0 200 200" role="img" aria-label="Plano esquemático del campamento de bandidos">${partes.join('')}</svg>`;
}
