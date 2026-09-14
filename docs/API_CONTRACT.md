# Contrato API del cliente jugador

Documento de referencia de este cliente. El backend escucha bajo el prefijo `/v1`. Última revisión:
**2026-09-14**, contra `BronzeAgeFase0@6d43688` (rama `heroe-dominio`: modelo de Héroe, fases 1 a 3).

Para el porqué de cada hueco y el orden en que conviene cerrarlos, ver
[`Analisis_Brecha_Backend.md`](Analisis_Brecha_Backend.md); el catálogo de comandos, en
[`COMANDOS.md`](COMANDOS.md).

## Estado de implementación

### Llamadas utilizadas actualmente por la UI

- [x] `POST /v1/sesiones`
- [x] `POST /v1/jugador/partidas/{gameId}/membresia`
- [x] `GET /v1/jugador/partidas/{gameId}`
- [x] `GET /v1/jugador/partidas/{gameId}/mapa/{mapaId}`
- [x] `POST /v1/jugador/partidas/{gameId}/comandos` — con 21 de los 74 comandos de jugador (ver `COMANDOS.md`)
- [x] Reintento automático tras una respuesta `401`, creando una sesión nueva con `POST /v1/sesiones`

### Funciones disponibles en `apiCliente.ts`, pero sin llamada desde la UI actual

- [ ] `GET /v1/sesiones/actual` — `obtenerWhoami()` no lo invoca nadie: hoy es código muerto. O se cablea o
      se borra.

### Superficie de backend todavía no consumida por este cliente

- [ ] `WS /v1/jugador/partidas/{gameId}/tiempo-real` — la brecha mayor: sin ella el mundo solo cambia al
      pulsar refrescar
- [ ] `GET /v1/jugador/partidas/{gameId}/eventos?desde={version}`
- [ ] `GET /v1/balance`

## Autenticación

Todas las rutas, excepto el login, requieren la cabecera:

```http
Authorization: sesion <sesionId>
```

El login de desarrollo utiliza:

```http
Authorization: dev <usuario>
```

La implementación actual usa el nombre de usuario introducido en el formulario como credencial `dev`.
Este mecanismo corresponde al proveedor de desarrollo del backend y no debe considerarse autenticación de
producción.

## Endpoints utilizados

### Crear sesión

```http
POST /v1/sesiones
Authorization: dev <usuario>
```

No requiere body. Devuelve `201 Created`:

```json
{
  "usuarioId": "ana",
  "sesionId": "sesion-...",
  "expiraEn": "2026-08-27T12:00:00.000Z"
}
```

Errores relevantes:

- `401`: credencial, proveedor o cabecera inválida.
- `0` en el cliente: no se pudo contactar con el backend.

### Unirse a una partida

```http
POST /v1/jugador/partidas/{gameId}/membresia
Authorization: sesion <sesionId>
```

No requiere body. Devuelve `201 Created`:

```json
{
  "jugadorId": "ana"
}
```

`jugadorId` identifica la **membresía** (es el `usuarioId`), no a quien juega: dentro de la partida se juega con
un **héroe**, que se crea aparte con el comando `crearHeroe` (ver «Partida sin héroe», abajo).

El cliente trata `409 Conflict` como membresía ya existente y continúa con el login.
Otros errores no se ignoran:

- `401`: sesión inválida o ausente.
- `404`: partida no abierta o inexistente.
- `409`: ya existe una membresía para ese usuario y partida.

### Consultar proyección del jugador

```http
GET /v1/jugador/partidas/{gameId}
Authorization: sesion <sesionId>
```

La respuesta es la proyección filtrada para el jugador, no el estado completo de la partida. Trae **31
bloques** (`ProyeccionJugador`, `src/session/proyecciones/jugador.ts` en el backend); el cliente consume 20.

```json
{
  "gameId": "local",
  "instante": 1756900000000,
  "version": 42,
  "heroeId": "heroe-3",
  "faccionId": "faccion-1",
  "mapaId": "mapa-...",
  "estadoMapa": { "extraido": {}, "regeneraEn": {} },
  "facciones": [],
  "asentamientos": [],
  "asentamientosAvistados": [],
  "asentamientosConocidos": [],
  "territorioPorEjercito": {},
  "exploracion": { "tamanoCelda": 0, "columnas": 0, "filas": 0, "celdas": "", "visibles": "" },
  "caravanas": [],
  "caravanasAvistadas": [],
  "ejercitos": [],
  "ejercitosAvistados": [],
  "heroe": {},
  "heroesVisibles": [],
  "nombresDeCompaneros": {},
  "acuerdos": [],
  "ordenes": [],
  "relaciones": [],
  "titulos": [],
  "caminos": [],
  "campamentosBandidos": [],
  "historial": [],
  "zonas": [],
  "zonasFusionadas": [],
  "trazadoPorAsentamiento": {},
  "preciosReferencia": {}
}
```

`heroeId` (antes `jugadorId`, 2026-09-14) es el héroe con el que juega esta membresía. Todo id de persona que
viaja en la proyección —`reyId`, `embajadorId` y `ciudadanosIds` de una Facción, los `cargos` de un
asentamiento, `heroesFundadoresIds`, `casasCompradas`, el dueño de cada escuadrón y los `participantes` de una
columna— es un id de héroe (`heroe-12`), no un nick: se compara con `proyeccion.heroeId`. El nombre viaja en
`heroe.displayName` (el tuyo), en `nombresDeCompaneros` (`heroeId` → nombre de todos los ciudadanos de tu Facción,
se les vea o no) y en `heroesVisibles` (los ajenos que se ven, abajo).

#### El héroe y sus escuadras

`heroe` es tu héroe completo (`HeroeProyectado`, `src/tiposDominio.ts`): identidad, `ubicacion`, progresión
(nivel, experiencia, las dos bolsas de puntos, `atributosBase`, perks), `loadouts` con el `liderazgoTotal` que
calcula el servidor, `inventario`, `equipamiento`, `monedasHeroe`, `cupoGuarnicion` con su `guarnicionOcupada`, y
**todas tus escuadras** (`escuadrones`, cada una con su `contenedor` —campamento, ejército o escolta—,
`enGuarnicion` y su `costeLiderazgo`). Es el único sitio
donde viajan escuadras completas: un ejército lleva solo `escuadronIds` (antes `escuadrones`), y un `Asentamiento`
ya no trae `escuadrones` (su guarnición son las escuadras `enGuarnicion` de sus residentes).

`heroesVisibles` son los héroes AJENOS que se ven —en una columna tuya o avistada, o dentro de la plaza que
pisas—, solo en su parte pública (`HeroePublico`: nombre, clase, nivel, escuadras que lleva en la columna y
equipo puesto). `ejercitosAvistados[].heroeIds` dice quién va en cada columna ajena.

#### Partida sin héroe

Mientras la membresía no tiene héroe, este mismo `GET` no devuelve la proyección sino el resumen de la partida:

```json
{ "gameId": "local", "instante": 1756900000000, "version": 42, "mapaId": "mapa-...", "sinHeroe": true }
```

En ese estado el único comando que se acepta es `crearHeroe` (el resto responde `403`) y `/eventos` devuelve
`{ "eventos": [] }`. El cliente lo modela como `PartidaSinHeroe` (`src/apiCliente.ts`) y monta la pantalla
Héroe; en cuanto se crea el héroe, la proyección vuelve a ser la normal.

`instante` es **la única referencia temporal del contrato** desde que cerró la Fase D: milisegundos desde la
época Unix, el "ahora" del mundo. Con él el cliente pinta cuentas atrás localmente (`completaEn - instante`).
El `tick` interno del motor **no viaja**; versiones anteriores de este documento lo listaban, y el cliente
llegó a imprimir `Tick: undefined` por ello — sigue habiendo un acceso muerto a `proyeccion.tick` en
`src/render.ts`, pendiente de limpiar.

El campo `mapa` tampoco viaja: solo `mapaId`, para localizar el asset del mapa.

**`asentamientos` cambió de significado el 2026-09-06 (jugador situado, Doc 1.10.1) y este es el hueco más
importante del contrato hoy.** Antes traía TODOS los asentamientos de tu Facción, completos. Ahora trae **la
plaza donde el jugador está físicamente parado, y solo esa** — cero elementos si está en el mapa o
desconectado, uno si está dentro de una plaza de su propia Facción:

```ts
asentamientos: dentroDe ? [dentroDe] : []
```

Esto **rompe el supuesto con el que está escrita la pestaña Asentamientos de este cliente**
(`src/ui/pestanaAsentamientos.ts`: `proyeccion.asentamientos.filter((item) => item.faccionId === faccion.id)`,
luego `propios[0]`): un jugador con una ciudad fundada y en marcha por el mapa con su columna verá esa lista
**vacía**, no su ciudad. La ciudad propia, cuando no se está dentro, pasa a viajar en
`asentamientosAvistados` — redactada, igual que cualquier otra. Ver §3 y §4 de
[`Analisis_Brecha_Backend.md`](Analisis_Brecha_Backend.md).

`asentamientosAvistados` también cambió de forma en la misma fecha: ya no es una ficha plana. El backend
distingue **tres niveles de acceso** para una plaza en la que no se está (Doc 1.10.4), un solo tipo con
secciones opcionales — el cliente pinta lo que llega y no pregunta por qué falta:

1. **Público** (siempre): `id`, `nombre?`, `faccionId`, `posicion`, `nivel`, `zona` (silueta real), y
   `edificios` — pero **solo los que están EN PIE** (`estado === 'activo'`); la cola de construcción es
   privada.
2. **De la Facción** (`cargos?`, `politicasActivas?`): quién gobierna y bajo qué políticas. Presente solo si
   el jugador es ciudadano de esa misma Facción; ausente para cualquier otra.
3. **De quien la pisó alguna vez** (`interiorRecordado?`): la última foto de su interior —almacén, cola,
   guarnición—, con `vistoEn` (Doc 1.10.1). Es información VIEJA a propósito: el cliente debe mostrar "hace
   N min" y no tratarla como el estado actual.

`caravanasAvistadas` es un bloque **enteramente nuevo** (2026-09-06): caravanas ajenas que se están viendo
ahora, redactadas a qué llevan (`recursos: string[]`, sin cantidades) y si van escoltadas — sin esto no hay
nada sobre lo que hacer clic para interceptar. No tiene tipo local en `src/tiposDominio.ts` todavía.

`ordenes` y `acuerdos` sí tienen ya tipo local (`OrdenMercado`/`AcuerdoTrueque`, añadidos 2026-09-07) pero
ninguna pantalla los lee. Ambos vienen ya filtrados a lo que toca a este jugador: `ordenes` trae las de tus
propias plazas completas (incluidas las cumplidas, tu historial de mercado) más las activas de cualquier plaza
AJENA en cuya puerta tengas una columna (el "escaparate" del mostrador, Doc 3.3); `acuerdos`, los trueques
—`'propuesto'`, `'activo'`, `'rechazado'`, `'cumplido'` o `'expirado'`— que tocan un asentamiento tuyo.

El resto de bloques que el tipo local todavía no declara —`estadoMapa`, `relaciones`, `titulos`, `historial`,
`zonas`, `preciosReferencia`— no cambiaron de forma; siguen sin interfaz que los lea. Detalle completo en §3
de `Analisis_Brecha_Backend.md`.

Errores relevantes:

- `401`: sesión inválida o ausente.
- `403`: la sesión no tiene membresía de jugador en la partida.
- `404`: partida no abierta o inexistente.

### Obtener el mapa como asset

```http
GET /v1/jugador/partidas/{gameId}/mapa/{mapaId}
Authorization: sesion <sesionId>
```

Devuelve el `MapaGenerado` actual. El backend establece:

```http
Cache-Control: private, max-age=31536000, immutable
```

`mapaId` funciona como identificador de versión/cache-buster. El servidor valida la sesión y la partida, pero
el handler no interpreta el valor del `mapaId`; devuelve el mapa vigente del runner.

El cliente cachea el resultado en memoria y actualmente lo identifica solo por `mapaId`.

Forma principal de la respuesta:

```json
{
  "version": 7,
  "config": {
    "ancho": 2000,
    "alto": 2000,
    "seed": 123
  },
  "bosques": [],
  "nodos": [],
  "fertilidad": {},
  "elevacion": {},
  "rios": []
}
```

El campo `elevacion.region` puede estar presente. La copia del evaluador en este cliente no interpreta
regiones geográficas y el terreno renderizado puede divergir del backend en ese caso.

Errores relevantes:

- `401`: sesión inválida o ausente.
- `403`: la sesión no tiene membresía de jugador.
- `404`: partida no abierta o inexistente.

### Ejecutar comando

```http
POST /v1/jugador/partidas/{gameId}/comandos
Authorization: sesion <sesionId>
Content-Type: application/json
```

Body mínimo:

```json
{
  "tipo": "<tipo-de-comando>",
  "params": {}
}
```

También admite opcionalmente `idempotencyKey`. El backend valida `params` según el `tipo`, con
`additionalProperties: false`. El catálogo de jugador son **74 comandos** (75 en el backend: `crearFaccionNpc`
es solo de administración), de los que la interfaz cablea 21: la
lista completa, con sus parámetros, está en [`COMANDOS.md`](COMANDOS.md).

En caso de éxito la respuesta incluye `resultado`, resumen de partida y **la `proyeccion` del jugador ya
actualizada** (Fase C6, "respuesta autosuficiente"): no hace falta un `GET` aparte tras cada comando. Hoy el
cliente descarta esa proyección y encadena un `GET` de más.

Un **rechazo de dominio no es un error HTTP**: llega como `200` con `resultado.ok === false` y un
`resultado.codigoError`. Hay que comprobar el status *y* `resultado.ok`.

Errores relevantes: `400` petición, tipo o `params` inválidos; `401` sesión inválida; `403` no autorizado
(también, sin héroe, cualquier comando que no sea `crearHeroe`); `409` **fallo de persistencia**; `404`
partida no abierta.

## Endpoints todavía no consumidos

### Consultar identidad y rol

```http
GET /v1/sesiones/actual?gameId={gameId}
Authorization: sesion <sesionId>
```

Respuesta esperada:

```json
{
  "usuarioId": "ana",
  "esAdministradorGlobal": false,
  "gameId": "local",
  "rol": "jugador",
  "jugadorId": "ana"
}
```

`gameId` es opcional. Sin él, la respuesta solo garantiza `usuarioId` y `esAdministradorGlobal`. `jugadorId` es
el de la membresía: no trae el `heroeId`. El wrapper
`obtenerWhoami()` existe en `apiCliente.ts` pero no lo invoca nadie.

### Tiempo real (WebSocket)

```
WS /v1/jugador/partidas/{gameId}/tiempo-real?sesion=<sesionId>
```

Una sola conexión permanente por jugador, con canales lógicos multiplexados encima (Fase C5). La credencial
va en el *query string* porque el navegador no puede añadir cabeceras al *handshake*; la autenticación ocurre
**antes** de completarlo, así que un rechazo llega como `401`/`403` HTTP normal y no como un socket que se
abre y se cierra solo.

Protocolo, JSON sobre el socket:

```jsonc
// cliente -> servidor
{ "accion": "suscribir" | "desuscribir", "canal": "mapa/general" | "asentamiento/<id>" }

// servidor -> cliente
{ "tipo": "suscrito" | "desuscrito", "canal": "..." }
{ "tipo": "error", "canal": "...", "error": "..." }
{ "tipo": "evento", "canal": "...", "evento": { } }
```

No hay mensaje de "conectado": el evento `open` nativo ya lo dice, y para entonces la conexión está
autenticada. **Al reconectar se pierden las suscripciones**: rehacerlas es cosa del cliente.

Solo se puede suscribir al canal de un asentamiento que este jugador tenga derecho a ver; `mapa/general` está
abierto a cualquier jugador de la partida.

### Cursor de eventos

```http
GET /v1/jugador/partidas/{gameId}/eventos?desde={version}
Authorization: sesion <sesionId>
```

Devuelve `{ "eventos": [...] }` con los eventos de dominio de `version > desde`, filtrados con el mismo
criterio que la proyección. `desde` ausente equivale a `0`, y debe ser un entero no negativo (`400` si no).

Es el compañero del WebSocket: sirve para rellenar el hueco tras una reconexión, usando el campo `version` de
la proyección como cursor.

### Balance

```http
GET /v1/balance
```

**No requiere sesión.** Publica las tablas de balance como datos (patrón *Static Data Export*), agrupadas por
tema:

```json
{
  "version": 8,
  "catalogos": { "EDIFICIO_CATALOGO": {}, "POLITICA_CATALOGO": {}, "TROPAS_RECLUTABLES": {}, "CARAVANA_CATALOGO": {} },
  "cuposYNiveles": { "NIVEL_FACCION": {}, "NIVEL_ASENTAMIENTO": {}, "CAP_FUNDACION_POR_NIVEL": [], "CUPO_NIVEL_ASENTAMIENTO": {}, "POLITICAS": {}, "CIUDADANIA": {} },
  "costesYEconomia": { "MANTENIMIENTO": {}, "ALMACEN": {}, "NECESIDADES": {}, "PRECIO_BASE": {}, "PRECIO_REFERENCIA": {}, "COMISION": {}, "TRUEQUE": {}, "RESERVA_CONSTRUCCION": {} },
  "geometriaUrbana": { "REJILLA_ASENTAMIENTO": {}, "EDIFICIO_TAMANO": {}, "TRAZADO": {}, "SITIO": {}, "PUESTO_MERCADO_FORMA": {}, "MERCADO_PUESTOS_POR_NIVEL": {} },
  "mundoYMilitar": { "ZONA_INFLUENCIA": {}, "FUNDACION": {}, "POBLACION": {}, "MILITAR": {}, "LENERA_POR_BOSQUE": {} },
  "caravanas": {}, "reputacion": {}, "temporal": {}, "internas": {}
}
```

**Nota de exactitud (2026-09-07):** el backend añadió `MERCADO` (`plazoOrdenMinutos`, cuánto vive una orden de
mercado sin que nadie la tome) junto a `TRUEQUE` en `constants.ts`, pero **todavía no lo publica** en
`costesYEconomia` — es una tabla real que falta en esta respuesta, no un error de esta documentación. Se anota
aquí para no dar por hecho que está y para que quien construya la pantalla de mercado sepa que hoy no puede
leer ese plazo de `/v1/balance`.

`version` sirve para invalidar la caché local. Dos valores que **este cliente hoy copia a mano** viven aquí:
`cuposYNiveles.CAP_FUNDACION_POR_NIVEL` (duplicado en `src/ui/estadoCliente.ts`) y
`mundoYMilitar.ZONA_INFLUENCIA.radioInicial`, que es el `30` escrito a pelo en `src/ui/pestanaAsentamientos.ts`.

`temporal.SIMULACION` trae `epocaInicial` y `duracionTickMs`, con los que traducir ticks a fecha de mundo.

## Errores comunes del wrapper

`apiCliente.ts` convierte todas las respuestas HTTP no exitosas en `ApiError`, conservando `status` y `message`.
El mensaje se obtiene de `{ "error": "..." }` cuando el backend lo devuelve. Los fallos de red usan estado
`0` y un mensaje local indicando que el backend no está disponible.

Ante un `401` de una petición autenticada, el wrapper intenta volver a autenticarse automáticamente usando el
último usuario conocido. Si la reautenticación funciona, repite la petición original una vez.

## Fuentes del contrato

En este repositorio:

- Wrapper de red: `src/apiCliente.ts`
- Pantalla y secuencia de llamadas: `src/main.ts`

En el repositorio del backend (`BronzeAgeFase0`):

- Rutas de jugador: `src/server/rutas/jugador.ts`
- Rutas de sesión: `src/server/rutas/sesiones.ts`
- Asset de mapa: `src/server/rutas/mapa.ts`
- Comandos HTTP: `src/server/rutas/comandos.ts`
- WebSocket y canales: `src/server/rutas/tiempoReal.ts`, `src/session/canales.ts`
- Balance: `src/server/rutas/balance.ts`
- Forma de la proyección: `src/session/proyecciones/jugador.ts`

El backend publica además `GET /v1/openapi.json`, que es la fuente viva de todo lo anterior.
