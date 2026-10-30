// Una caché de un solo fichero en IndexedDB, por su hash: guarda el vigente y borra el anterior (un mundo nuevo deja viejo al de antes). Sin
// IndexedDB (navegación privada, pruebas) no guarda nada y el fichero se vuelve a bajar. La usan el artefacto de mundo y el paquete de relieve.

export interface CacheDeUno {
  /** El fichero guardado con esa clave, si es el que hay. */
  leer(clave: string): Promise<Uint8Array | undefined>;
  /** Guarda el fichero y borra el que hubiera. */
  guardar(clave: string, datos: Uint8Array): Promise<void>;
  /** La clave del fichero guardado, si hay alguno. */
  clave(): Promise<string | undefined>;
}

export function cacheDeUno(bd: string, almacen: string): CacheDeUno {
  const abrir = (): Promise<IDBDatabase | undefined> =>
    new Promise((resolver) => {
      try {
        const p = indexedDB.open(bd, 1);
        p.onupgradeneeded = () => p.result.createObjectStore(almacen);
        p.onsuccess = () => resolver(p.result);
        p.onerror = () => resolver(undefined);
      } catch {
        resolver(undefined);
      }
    });
  const pedir = async <T>(f: (s: IDBObjectStore) => IDBRequest, convertir: (r: unknown) => T | undefined): Promise<T | undefined> => {
    const base = await abrir();
    if (!base) return undefined;
    return new Promise((resolver) => {
      try {
        const p = f(base.transaction(almacen).objectStore(almacen));
        p.onsuccess = () => resolver(convertir(p.result));
        p.onerror = () => resolver(undefined);
      } catch {
        resolver(undefined);
      }
    });
  };
  return {
    leer: (clave) => pedir((s) => s.get(clave), (r) => (r instanceof Uint8Array ? r : undefined)),
    clave: () => pedir((s) => s.getAllKeys(), (r) => (Array.isArray(r) && typeof r[0] === 'string' ? r[0] : undefined)),
    async guardar(clave, datos) {
      const base = await abrir();
      if (!base) return;
      try {
        const t = base.transaction(almacen, 'readwrite');
        t.objectStore(almacen).clear();
        t.objectStore(almacen).put(datos, clave);
      } catch {
        // sin caché, se bajará otra vez
      }
    },
  };
}
