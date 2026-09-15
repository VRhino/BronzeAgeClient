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
- [`docs/COMANDOS.md`](docs/COMANDOS.md) — los 73 comandos de partida y cuáles están cableados.
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
- **Bandidos**: clic en un campamento abre su ficha y marcha hacia él; con la columna al lado, «Atacar».
- **Comandos**: 22 de los 73 de jugador — ver [`docs/COMANDOS.md`](docs/COMANDOS.md).

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
- **51 de 73 comandos sin interfaz**, entre ellos todo el sistema militar, el de ejércitos, el de comercio,
  el de diplomacia, la interacción en el mapa y la composición de columna compartida.
- **La creación del héroe es provisional** (clase, género y aspecto fijos), y el panel Héroe aún no tiene equipo
  ni perks — ver `docs/Features_Pendientes.md` §0.
- **Sin leer `GET /v1/balance`**: hay valores del servidor copiados a mano en `src/ui/`.
- No soporta partidas creadas con `region` (ver la limitación documentada en `src/terreno/elevacion.ts`).
- No crea partidas (eso es administración): asume que una partida con el `gameId` indicado ya existe.

## Uso

Requiere el backend corriendo aparte, y una partida ya creada por un administrador. Desde el 2026-09-14 tiene
que ser la rama `heroe-dominio` del backend (modelo de Héroe), hasta que se fusione a `main`:

```bash
ADMINISTRADORES='dev:jefa' npm run server
```

```bash
npm install
npm run dev
```

El login es con **cuenta local** (nick + contraseña, proveedor `clave` del backend). La primera vez se marca
"No tengo cuenta — crear una" en la pantalla de login; si el backend arrancó con `CODIGO_REGISTRO`, hay que
poner ese código. La sesión se guarda en `localStorage`; cuando caduca (12 h) la UI vuelve al login (no hay
re-login en silencio: la contraseña no se guarda).

La primera vez que se entra en una partida hay que crear el héroe: hasta entonces el backend no deja hacer nada
más.

`vite.config.ts` proxya `/v1` hacia `:3000` para evitar CORS en desarrollo.

Para desplegarlo como sitio estático apuntando a un backend en otro dominio: `VITE_API_BASE=https://<backend>
npm run build` (el backend debe listar el origen de este cliente en `ORIGENES_PERMITIDOS`). Sin
`VITE_API_BASE` las peticiones van a `/v1` del mismo origen — lo que vale si el backend sirve este estático.
