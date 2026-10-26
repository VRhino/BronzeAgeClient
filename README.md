# Cliente de jugador

Cliente de jugador de Bronze Age Collapse. Vive en su propio repositorio y **habla con el backend
(`BronzeAgeFase0`) solo por red**: sin alias `@motor/*`, sin `paths` en `tsconfig.json`, sin import de su
código fuente. Ese aislamiento es el criterio de cierre de la Fase C del backend.

Nace de una decisión concreta (2026-08-26, hito **C11b** del roadmap del backend,
`Docs/Arquitectura/3_Plan_Evolucion_Roadmap.md`): en vez de que el backend rasterice el terreno y lo sirva
como imagen/rejilla, este cliente lleva su **propia copia** de las funciones puras de evaluación de terreno
(`src/terreno/`) y lo recalcula él mismo a partir de los parámetros públicos que ya sirve
`GET /jugador/partidas/:gameId/mapa/:mapaId` (Fase C11a).

## Documentación

- [`docs/Analisis_Brecha_Backend.md`](docs/Analisis_Brecha_Backend.md) — qué ofrece el backend, qué consume
  este cliente y qué falta, con checklist. **Empezar por aquí.**
- [`docs/COMANDOS.md`](docs/COMANDOS.md) — los 76 comandos de partida y cuáles están cableados.
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — endpoints, formas de petición y respuesta.
- [`docs/Features_Pendientes.md`](docs/Features_Pendientes.md) — cómo se quiere que sea la interfaz.

## Por qué duplicar el terreno en vez de importarlo

Duplicar el evaluador de terreno (no importarlo) es una decisión informada, no una improvisación — ver
`Docs/Arquitectura/9_Reglas_vs_Simulacion.md` en el backend: las funciones
de `src/terreno/` de aquí son **T2a** ("regla de entrada propia/no privilegiada, el cliente puede calcularla
sin viaje de red") — el terreno lo ve todo el mundo por igual, no es información privilegiada de ningún
jugador ni de ningún rival. El coste aceptado es el mismo que en cualquier T2a: la fórmula existe dos veces
(servidor por autoridad — aunque hoy el servidor tampoco la ejecuta para nada propio, solo la generó una vez —
y cliente por presentación) y puede divergir si una cambia sin la otra. Ver `src/terreno/README.md` para el
detalle y la disciplina de mantenimiento.

## Qué hace hoy

- **Mapa del mundo**: terreno (biomas, relieve, ríos, bosques fusionados), nodos de recurso, niebla de guerra
  con sus tres estados, fronteras propias y ajenas, asentamientos vistos y recordados, ejércitos propios y
  avistados, caravanas, caminos y campamentos de bandidos.
- **Vista de asentamiento**: el trazado urbano que llega calculado en la proyección, con murallas y
  edificios.
- **Panel de interacción**: pestañas de Facción (crear, unirse), Asentamientos (fundar con previsualización
  sobre el mapa, almacén, edificios, muralla) e Información.
- **Héroe**: si la membresía no tiene héroe, la única pantalla es la de crearlo (provisional: solo el nombre).
  Su nombre sale en el menú de esquina, el panel de Facción y el selector de cargos. El **panel Héroe** (riel del
  Mapa y barra del Asentamiento) enseña su ficha y reparte atributos, lista sus escuadras con la guarnición, y
  gestiona sus loadouts. Si está herido, lo dice y cuánto le queda.
- **Bandidos y asedio**: clic en un campamento o en una plaza de otra Facción abre su ficha y marcha hacia él; con la
  columna a 15 o menos, «Atacar» (asediar, si es una plaza).
- **Subida de nivel**: la pestaña Resumen enseña si la plaza puede subir, qué cuesta y qué lo impide; el Gobernador
  la pide. Las mejoras de edificio tardan y salen en la Cola.
- **Comandos**: 23 de los 76 de jugador — ver [`docs/COMANDOS.md`](docs/COMANDOS.md).

Las zonas de Facción llegan ya fusionadas del servidor y **así debe seguir siendo**: fusionarlas aquí con
`unirFormas`/`unirPoligonos` no se puede, porque su entrada (la posición de asentamientos rivales) es
privilegiada (T2b, doc 9 del backend). Terreno y bosques sí se fusionan localmente porque son T2a.

## Qué NO hace todavía

El detalle, con checklist, está en
[`docs/Analisis_Brecha_Backend.md`](docs/Analisis_Brecha_Backend.md). En titulares:

- **`asentamientos` ya no es "todos los tuyos".** Desde el 2026-09-06 (jugador situado) el campo trae
  SOLO la plaza donde el jugador está físicamente parado —cero o un elemento—, no la lista completa de su
  Facción. `src/ui/pestanaAsentamientos.ts` sigue escrito sobre el supuesto viejo (`asentamientos[0]`), así
  que un jugador que salga a caminar con su columna verá su propia pestaña de Asentamientos vacía. Es un bug
  latente, no solo una carencia — ver el detalle en `docs/Analisis_Brecha_Backend.md`, sección "Lo más
  urgente".
- **La fundación elige un punto en el mapa que ya no se envía.** Desde el 2026-09-08 `fundarAsentamiento`
  solo lleva `faccionId` — el backend funda donde está la columna del fundador (Doc 1.3). El punto que se
  marca en el mapa es hoy solo la vista previa de recursos; el flujo real necesita `salirAlMundo`, sin
  cablear. Ver `CHANGELOG.md`.
- **Sin tiempo real**: el único refresco es el botón de recargar. El WebSocket de la partida y el cursor
  `/eventos` están sin consumir.
- **53 de 76 comandos sin interfaz**, entre ellos todo el sistema militar, el de ejércitos, el de comercio,
  el de diplomacia, la interacción en el mapa y la composición de columna compartida.
- **La creación del héroe es provisional** (clase, género y aspecto fijos), y el panel Héroe aún no tiene equipo
  ni perks — ver `docs/Features_Pendientes.md` §0.
- **Sin leer `GET /v1/balance`**: hay valores del servidor copiados a mano en `src/ui/`.
- No soporta partidas creadas con `region` (ver la limitación documentada en `src/terreno/elevacion.ts`).
- No crea partidas (eso es administración): asume que una partida con el `gameId` indicado ya existe.

## Uso

Desde la fase 7 (2026-10-26) el cliente habla con el **motor en Rust** (`VRhino/BronzeAge`) por la sesión del contrato 05 (ver
[`src/contrato/README.md`](src/contrato/README.md)). Requiere el servidor del motor corriendo aparte, con su artefacto de mundo:

```bash
# en el motor (la primera vez, el mundo: cd generador && npm ci && npm run generar && npx tsx scripts/generar-mundo.ts 42 salida/mundo)
CODIGO_REGISTRO_BOTS=dev-bots ADMINISTRADORES=jefa cargo run --release -p servicio   # 127.0.0.1:7878
```

```bash
npm install
npm run dev        # http://127.0.0.1:5174
```

El login es con **cuenta** del servicio de acceso del motor (nick + contraseña). La primera vez se marca "No tengo cuenta — crear una"; si
el servidor arrancó con `CODIGO_REGISTRO`, hay que poner ese código. El token se guarda en `localStorage`; cuando caduca (12 h) la UI vuelve
al login. El motor tiene **una sola partida** por servidor: la pantalla de partidas enseña solo «Mundo». La primera vez hay que crear el héroe
(el motor aún le pone «Héroe N»).

El servidor sirve en un solo puerto el HTTP de acceso, el artefacto de mundo y el WebSocket, con el CORS abierto: por defecto el cliente lo
busca en el mismo host, puerto 7878; `VITE_API_BASE=http://<host>:<puerto>` lo apunta a otro (también para `npm run build`).

En `npm run dev`, `?sinNiebla` en la URL quita la niebla del mapa (para mirar el terreno entero) y `sesionBronzeAge` en la consola es la
sesión, con su almacén.
