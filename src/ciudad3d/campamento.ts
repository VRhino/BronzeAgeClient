// Un campamento de mercenarios en la vista 3D: su planta (la que manda el motor estando dentro, `EscenaCampamento`) dibujada como una plaza de
// nivel 1, con su empalizada de estacas; las viviendas son tiendas de campaña (`tienda` en `modelos.ts`). Las piezas van en sus huellas
// exactas: el trazado manda (Víctor, 2026-11-02).
import type { Edificio, EscenaCampamento, RectanguloLocal } from '../tiposDominio';
import { anillosDe, ciudadEnVista, hash3, type CiudadEnVista, type OpcionesCiudad, type Relleno, type TipoRelleno } from './estado';

// el orden de las celdas de una empalizada vive en `estado.ts` (lo usa también la muralla de las plazas)
export { anillosDe } from './estado';

/** El campamento que se dibuja, o `null` sin planta. */
export function campamentoEnVista(e: EscenaCampamento, o: OpcionesCiudad): CiudadEnVista | null {
  if (e.edificios.length === 0) return null;
  const T = e.unidadesPorCelda || 3;
  const enUl = (r: { col: number; row: number; ancho: number; alto: number }): RectanguloLocal => ({ x: r.col * T, y: r.row * T, ancho: r.ancho * T, alto: r.alto * T });
  const huellas: Record<string, RectanguloLocal> = {};
  const edificios: Edificio[] = e.edificios.map((p) => {
    const ancho = p.ancho * T, alto = p.alto * T;
    huellas[p.edificioId] = { x: p.posicion.x - ancho / 2, y: p.posicion.y - alto / 2, ancho, alto };
    return { id: p.edificioId, tipo: p.tipo === 'vivienda' ? 'tienda' : p.tipo, estado: 'activo', posicion: p.posicion };
  });
  const recintos = anillosDe(e.empalizada).map((celdas, i) => ({ id: `${e.campamentoId}-empalizada-${i}`, nivel: 1, celdas, avance: celdas.length }));
  const c = ciudadEnVista(
    { id: e.campamentoId, nivel: 1, edificios, recintos },
    { calles: e.calles.map(enUl), caminos: e.caminos.map(enUl), huellas, murallas: [], radio: e.radio > 0 ? e.radio : undefined, celda: T },
    o,
  );
  if (c) c.libres = rellenoDeCampamento(c, T);
  return c;
}

/** Si un punto cae dentro de un anillo (sus centros de celda, en orden). */
function dentroDe(x: number, y: number, anillo: { x: number; y: number }[]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const a = anillo[i]!, b = anillo[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/**
 * Lo que llena las celdas libres de un campamento: dentro de la empalizada, el suelo despejado y pisado, todo él (algún árbol que se dejó,
 * leña, heno, algún horno; ni huertos, ni patios, ni rediles); fuera, el campo de siempre.
 */
export function rellenoDeCampamento(c: CiudadEnVista, T: number): Relleno[] {
  const anillos = c.recintos.map((r) => r.celdas).filter((a) => a.length > 2);
  const dentro = (x: number, y: number): boolean => anillos.some((a) => dentroDe(x, y, a));
  const clave = (x: number, y: number): string => `${Math.round(x / T)},${Math.round(y / T)}`;
  // lo ocupado (edificios, calles, la empalizada) no se rellena
  const ocupada = new Set<string>();
  const marcar = (r: { x: number; y: number; ancho: number; alto: number }): void => {
    for (let x = r.x; x < r.x + r.ancho - 1e-6; x += T) for (let y = r.y; y < r.y + r.alto - 1e-6; y += T) ocupada.add(clave(x, y));
  };
  c.edificios.forEach(marcar);
  c.calles.forEach(marcar);
  c.caminos.forEach(marcar);
  for (const a of anillos) for (const k of a) ocupada.add(clave(k.x - T / 2, k.y - T / 2));
  const fuera: Relleno[] = [], vistas = new Set<string>();
  const poner = (x: number, y: number, semilla: number, previo?: Relleno): void => {
    const u = hash3(Math.round(x), Math.round(y), 131);
    if (dentro(x + T / 2, y + T / 2)) {
      vistas.add(clave(x, y));
      // lo que había lejos de todo era campo: casi todo despejado
      const tipo: TipoRelleno = previo?.campo || !previo ? (u < 0.06 ? 'arboles' : 'vacio') : u < 0.16 ? 'lena' : u < 0.25 ? 'almiar' : u < 0.33 ? 'arboles' : u < 0.36 ? 'horno' : 'vacio';
      fuera.push({ x, y, tipo, semilla });
      return;
    }
    if (previo && (previo.campo || (previo.tipo !== 'huerto' && previo.tipo !== 'patio' && previo.tipo !== 'redil'))) fuera.push(previo);
  };
  for (const r of c.libres) poner(r.x, r.y, r.semilla, r);
  // las celdas de dentro que no traían nada (el campo vacío): también pisadas
  for (const a of anillos) {
    const xs = a.map((k) => k.x), ys = a.map((k) => k.y);
    for (let x = Math.min(...xs) - T / 2; x < Math.max(...xs); x += T) for (let y = Math.min(...ys) - T / 2; y < Math.max(...ys); y += T) {
      const k = clave(x, y);
      if (!ocupada.has(k) && !vistas.has(k)) poner(x, y, Math.floor(hash3(Math.round(x), Math.round(y), 17) * 1e9));
    }
  }
  return fuera;
}
