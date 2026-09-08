# Análisis de brecha: este cliente frente al backend

Qué ofrece el backend a un jugador, qué consume este cliente hoy y qué falta por construir. Fotografía
tomada el **2026-09-08**, contra `BronzeAgeFase0` en `4fe611b` y este cliente en su HEAD actual.

> **Sync 2026-09-08 (parcial):** el cliente se alineó con el cambio de `fundarAsentamiento` (ya no manda
> `posicion`), añadió a los tipos locales `Edificio.danado` y `Asentamiento.ocupacionHasta` (ocupación
> post-conquista, backend Doc 5.12.9), y corrigió el typo `mantenimiento` → `medidorMantenimiento`. NO se
> cablearon comandos nuevos — el bloque grande (60 sin interfaz) sigue igual. Ver `CHANGELOG.md`.

No es una lista de deseos de producto —eso vive en [`Features_Pendientes.md`](Features_Pendientes.md)— sino
la brecha medible entre dos superficies que ya existen: todo lo marcado `[ ]` aquí está **ya construido y
autorizado en el servidor**, esperando interfaz.

## Cómo se ha medido (para poder repetirlo)

| Qué | Dónde se lee, en el repo del backend |
|---|---|
| Catálogo de comandos | `src/session/comandos/registro.ts` — el registro **es** la lista completa; su `satisfies` obliga a que nada quede fuera |
| Forma de los `params` | `src/session/comandos/esquemas.ts` |
| Quién puede ejecutar qué | `src/session/comandos/autorizacion.ts` |
| Endpoints de jugador | `src/server/rutas/jugador.ts`, `tiempoReal.ts`, `sesiones.ts`, `balance.ts` |
| Campos de la proyección | `src/session/proyecciones/jugador.ts`, interfaz `ProyeccionJugador` |

Y en este repositorio: `src/apiCliente.ts` (qué se llama), `src/main.ts` y `src/ui/*` (qué se cablea),
`src/render.ts` (qué se pinta).

**Criterio para marcar `[x]`**: existe una interacción de la interfaz que construye la llamada, la invoca y
gestiona su respuesta o su error. Tener el wrapper en `apiCliente.ts`, o el tipo en `tiposDominio.ts`, no
cuenta.

## Lo más urgente: dos supuestos rotos, no solo huecos

### `fundarAsentamiento` ya no lleva `posicion` (2026-09-08) — corregido en el código, pendiente en la UX

Backend `76d7e9b`/`4fe611b` ("se funda DONDE SE ESTÁ", Doc 1.3): el comando pasó a `{ faccionId }` a secas y el
backend deriva la posición de la columna del fundador (que exige estar en campo abierto). El cliente ya no
manda `posicion` — pero el flujo de "elige un punto en el mapa" que sigue en `pestanaAsentamientos.ts` es hoy
**solo la vista previa de recursos**: el punto no se envía. La fundación real necesita `salirAlMundo` (sin
cablear), y hasta entonces solo funciona si el jugador ya está en campo abierto. Rehacer esa pantalla es
trabajo de la fase de "presencia del jugador" (§2).

### `asentamientos` cambió de significado (2026-09-06)

No es una carencia como las demás sino algo que **hoy da un resultado
incorrecto** con las pantallas que ya existen: desde el 2026-09-06 (jugador situado, Doc 1.10.1), el campo
`asentamientos` de la proyección **ya no trae "todos los tuyos, completos"**. Trae **la plaza donde el
jugador está físicamente parado, y solo esa** — cero elementos si está en el mapa o desconectado, uno si
está dentro de una plaza de su propia Facción.

`src/ui/pestanaAsentamientos.ts` sigue escrito sobre el supuesto viejo:

```ts
const propios = proyeccion.asentamientos.filter((item) => item.faccionId === faccion.id);
// ...
const asentamiento = propios[0];
```

Con el jugador dentro de su ciudad esto sigue funcionando por coincidencia (`dentroDe` es esa misma plaza).
En cuanto exista `salirAlMundo` (§2, sección "Presencia del jugador") y un jugador salga a caminar, esa
pestaña le mostrará **"Todavía no tienes un asentamiento fundado"** aunque tenga uno — porque `propios`
estará vacío. Es un bug latente HOY, no una carencia de mañana: simplemente no se ha notado porque hoy nada
puede sacar a un jugador de su ciudad todavía. Ver §3 y §4 más abajo para el detalle completo, y
`API_CONTRACT.md` para la forma exacta del campo.

## Resumen en cifras

| Superficie | Total | En el cliente | Brecha |
|---|---:|---:|---:|
| Endpoints (jugador, sesión y balance) | 9 | 5 | 4 |
| Comandos de partida | **66** | 6 | **60** |
| Bloques de datos de la proyección | 28 | 17 | 11 |

Los 7 comandos nuevos desde la revisión anterior (59 → 66, backend 2026-09-08): `cambiarResidencia` (Doc 2.5)
y 6 del revamp de caravanas (`agregarCarroCaravana`, `comprarAnimalCaravana`, `moverCarroCaravana`,
`reservarCaravana`, `prepararCaravana`, `cancelarCaravana`; `crearCaravana` se conserva). Ninguno cablea
nada en este cliente todavía.

Reparto por sistema de juego, para ver dónde está el hueco:

| Sistema | Comandos | Implementados |
|---|---:|---|
| Murallas | 3 | **3 — completo** |
| Facción y ciudadanía | 6 | 2 (`crearFaccion`, `unirseAFaccion`) — +`cambiarResidencia` desde 2026-09-08 |
| Expansión | 3 | 1 (`fundarAsentamiento`) |
| Cargos y políticas | 4 | 0 |
| Diplomacia | 5 | 0 |
| Comercio y caravanas | 12 | 0 — +6 del revamp de caravanas desde 2026-09-08 |
| Construcción y gestión local | 7 | 0 |
| Militar | 3 | 0 |
| Ejércitos y logística | 9 | 0 |
| Presencia del jugador | 6 | 0 |
| Interacción en el mapa | 4 | 0 |
| Composición de columna compartida | 4 | 0 |

Murallas es el único sistema entero. Los bloques mayores —ejércitos (9), presencia del jugador (6) y
construcción (7)— están a cero: el mapa **pinta** ejércitos, caravanas y campamentos de bandidos, pero no se
puede mover, reclutar ni atacar con ninguno, y ni siquiera se puede sacar a un jugador de su residencia.
Frente a la capa militar y de campaña el jugador es hoy un espectador.

Los tres sistemas nuevos de la última fila —presencia, interacción y composición de columna— no existían la
revisión anterior de este documento: nacieron con el "jugador situado" (backend, 2026-09-05/06) y son la
condición previa de todo lo demás que involucre moverse por el mapa, incluido el comercio en persona (§2).

---

## 1. Endpoints

### Consumidos

- [x] `POST /v1/sesiones` — login de desarrollo (`Authorization: dev <usuario>`)
- [x] `POST /v1/jugador/partidas/{gameId}/membresia`
- [x] `GET /v1/jugador/partidas/{gameId}` — la proyección
- [x] `GET /v1/jugador/partidas/{gameId}/mapa/{mapaId}` — cacheado en memoria por `mapaId`
- [x] `POST /v1/jugador/partidas/{gameId}/comandos` — con 6 de los 66 comandos

### Sin consumir

- [ ] `WS /v1/jugador/partidas/{gameId}/tiempo-real` — canal único por jugador con suscripción a
      `mapa/general` y `asentamiento/<id>` (Fase C5). **Es la brecha más grande del cliente**: hoy el único
      refresco es el botón de recargar, así que no se ve nada de lo que hacen los demás jugadores ni el
      avance del mundo. El navegador no puede mandar cabeceras en el handshake: la credencial viaja como
      `?sesion=<id>`. Al reconectar se pierden las suscripciones y hay que rehacerlas.
- [ ] `GET /v1/jugador/partidas/{gameId}/eventos?desde={version}` — cursor de eventos ya filtrados por
      visibilidad (Fase C13). Es el compañero del WebSocket: rellena el hueco tras una reconexión, usando el
      campo `version` de la proyección como cursor.
- [ ] `GET /v1/balance` — las 40 tablas de balance como datos, más `version` para invalidar caché. No exige
      sesión. Ver §4: sin esto no hay catálogo con el que construir ninguna pantalla de gestión. **Nota:** la
      tabla `MERCADO` (plazo de caducidad de una orden, Doc 3.3) todavía no viaja aquí — falta en el propio
      backend, no en este cliente.
- [ ] `GET /v1/sesiones/actual` — `obtenerWhoami()` existe en `apiCliente.ts` y **no lo invoca nadie**: hoy
      es código muerto. O se cablea (para conocer el rol real en la partida) o se borra.

## 2. Comandos: 6 de 66

El checklist por comando, con sus `params` exactos, vive en [`COMANDOS.md`](COMANDOS.md) — **es la única
lista de esa granularidad**, para no mantener dos que se contradigan. Aquí solo la lectura de conjunto.

Ninguno de los 53 que faltan está fuera de alcance por permisos: la matriz de `autorizacion.ts` admite el rol
`jugador` en los 66 (uno, `alternarFaccionNpc`, admite ADEMÁS `administrador_partida`, nunca en su lugar). Lo
que falta es siempre interfaz, nunca backend.

Dos comandos que este cliente llegó a documentar ya **no existen**: `combateCampoAbierto` e
`interceptarCaravana` se retiraron en el Paso 11 del movimiento de ejércitos, sustituidos por encuentros que
dispara la geometría durante el tick. No hay que implementarlos.

**Diecisiete de los 53 son nuevos desde la revisión anterior de este documento** (backend, 2026-09-05 a
09-07) — coincide exacto con el salto de 42 a 59 comandos totales:

- **Comercio (+3):** `aceptarTrueque`, `rechazarTrueque`, `comerciarEnPlaza`. Un trueque ya no se pacta al
  proponerse: hace falta que el lado receptor conteste, y comerciar con una orden de mercado exige estar
  físicamente en la plaza con una columna — el emparejamiento automático entre plazas que existía antes se
  retiró del backend (`Comercio_Fisico_Definicion.md`).
- **Presencia del jugador (+6):** `salirAlMundo`, `marcharA`, `entrarEnAsentamiento`, `salirDeAsentamiento`,
  `fijarPoliticaDeAcceso`, `vetarJugador`. Sin estos no hay forma de sacar a un jugador de su residencia — y
  por tanto tampoco de usar el comercio en persona ni la interacción de abajo.
- **Interacción en el mapa (+4):** `inspeccionar`, `atacar`, `perseguir`, `dejarDePerseguir`. Los encuentros
  dejaron de ser automáticos por pasar cerca; ahora hay que decidirlos.
- **Composición de columna (+4):** `unirseEnCampo`, `responderPeticionDeUnion`, `separarseDelEjercito`,
  `cederLiderazgo`.

Y uno que ya existía **cambió de forma**, sin sumar al recuento de arriba: `movilizarEjercito` ganó un
parámetro opcional, `politicaDeUnion` (`rechazar` \| `aceptar` \| `preguntar`) — qué hacer con quien pida
unirse en campo a la columna que se está formando.

## 3. Datos que el servidor manda y el cliente tira

La proyección trae **28 bloques** (antes 18 — la cuenta subió con el jugador situado y con el comercio). El
cliente consume 17. Estos llegan en cada respuesta y no se leen en ningún sitio:

- [ ] `estadoMapa` (`extraido`, `regeneraEn`) — **el más urgente de este grupo, porque hoy produce
      información falsa**: el mapa dibuja cada nodo con la `cantidadInicial` del asset estático, así que **un
      yacimiento agotado se sigue pintando lleno**, y el resumen de recursos de la fundación cuenta mineral
      que ya no está.
- [ ] `preciosReferencia` — precio de referencia por recurso. El jugador **no puede** calcularlo (necesita el
      almacén de todo el mundo), así que el servidor lo manda a propósito: tirarlo es desperdicio puro.
- [ ] `ordenes` — órdenes de compra/venta del mercado. **Tiene tipo local desde 2026-09-07**
      (`OrdenMercado`, `src/tiposDominio.ts`) y viaja ya tipado en `ProyeccionJugador`, pero sigue sin ningún
      sitio que lo lea — tener el tipo no cuenta para el criterio de `[x]` de arriba. Trae las propias
      completas (con las cumplidas: es tu historial de mercado) más las activas de cualquier plaza ajena en
      cuya puerta tengas una columna — el "escaparate" que hace falta para usar `comerciarEnPlaza` (§2).
- [ ] `acuerdos` — trueques vigentes. Mismo caso: tipo local nuevo (`AcuerdoTrueque`), sin interfaz.
      Nace `'propuesto'` desde 2026-09-07 y no obliga a nadie hasta `aceptarTrueque`/`rechazarTrueque`.
- [ ] `relaciones` — alianzas, vasallajes y guerras; son públicas por diseño
- [ ] `titulos` — el ranking
- [ ] `historial` — el log de eventos, ya filtrado a lo que este jugador puede ver
- [ ] `zonas` — zona de influencia por asentamiento (solo se usa la silueta fusionada `zonasFusionadas`)
- [ ] `version` — el cursor con el que se pediría `/eventos`
- [ ] `caravanasAvistadas` — **bloque enteramente nuevo (2026-09-06)**, sin tipo local todavía. Caravanas
      ajenas que se están viendo AHORA, redactadas a qué llevan (`recursos: string[]`, sin cantidades) y si
      van escoltadas. Sin esto no hay nada sobre lo que hacer clic para `inspeccionar`/`atacar`/`perseguir`
      una caravana rival — los tres comandos de interacción de arriba dependen de poder verla primero.
- [ ] `gameId` — se recibe pero el cliente ya lo conoce por su propio estado (`estadoCliente.gameIdActivo`);
      no hay una lectura directa de `proyeccion.gameId` en ningún sitio.

Y dos hallazgos **dentro de lo que sí se lee**, que cambiaron de forma sin que el tipo local se enterara:

- **`asentamientos` cambió de significado por completo** — ver la sección de arriba, "Lo más urgente". No es
  un campo que falte, es un campo que se lee con la semántica vieja.
- **`asentamientosAvistados` ganó tres secciones opcionales** (`cargos?`, `politicasActivas?`,
  `interiorRecordado?`, Doc 1.10.4 — "tres niveles de acceso": público, de la Facción, de quien la pisó). El
  tipo local (`AsentamientoAvistado`, `src/tiposDominio.ts`) todavía las declara todas como si fueran
  siempre visibles/inexistentes por igual; no distingue estos tres niveles.

Y dentro de `Asentamiento` (la plaza propia completa), el tipo local de `src/tiposDominio.ts` declara ~15
campos frente a los **27** del dominio (`ocupacionHasta` se añadió el 2026-09-08, Doc 5.12.9). No modela,
entre otros: `jugadoresFundadoresIds`, `politicasActivas`, `escuadrones`, `casasCompradas`,
`politicaDeAcceso`, `vetadosIds`, `autoConstruccionPausada`, `reservaManual`, `permiteReabastecerAliados`,
`nutricionPoblacion`, `ultimaCaravanaCreadaEn`.

- **`Edificio.danado` y `Asentamiento.ocupacionHasta` (2026-09-08, ocupación post-conquista, Doc 5.12.9)** —
  añadidos al tipo local en el sync. Un saqueo de conquista baja edificios a `en_cola` marcados `danado`
  (reconstrucción barata) y abre una ventana de ocupación (`ocupacionHasta`, instante de mundo): inmune a
  nuevo asedio, recaudación/crecimiento ×0.5, mantenimiento congelado. La pestaña Asentamientos ya muestra
  el "· dañado" en la lista de edificios y un aviso de ocupación con los minutos restantes.

**Typo `mantenimiento?` → `medidorMantenimiento?` — CORREGIDO (2026-09-08).** El campo local se llamaba
`mantenimiento?` y el dominio no tiene ningún campo así (el real es `medidorMantenimiento`), así que
`asentamiento.mantenimiento` era `undefined` siempre y la pestaña "General" mostraba "No disponible" en
silencio. Renombrado el campo local y `pestanaAsentamientos.ts` lee `medidorMantenimiento`.

## 4. Brechas transversales

No son de una mecánica concreta; condicionan a todas las demás.

- [ ] **`asentamientos` ya no es "todos los tuyos".** Ver "Lo más urgente" arriba. Antes de tocar cualquier
      otra cosa de la pestaña Asentamientos, hay que decidir cómo se sigue mostrando la ciudad propia cuando
      el jugador no está dentro — probablemente leyéndola de `asentamientosAvistados` con el filtro de
      Facción, en vez de asumir que siempre viaja en `asentamientos`.
- [ ] **Tiempo real.** Ver §1. Sin WebSocket ni `/eventos`, el mundo solo cambia cuando el jugador pulsa
      refrescar.
- [ ] **Catálogo de balance.** Hoy el cliente **copia a mano** valores del servidor:
      `CAP_FUNDACION_POR_NIVEL` en `src/ui/estadoCliente.ts` y el radio `30` de la zona inicial en
      `src/ui/pestanaAsentamientos.ts`. Es exactamente la divergencia silenciosa contra la que avisa el doc 9
      del backend, y además no basta: sin el catálogo de edificios, tropas y políticas no se puede construir
      la interfaz de los 7 comandos de construcción ni la de los 3 militares. Leerlo de `GET /v1/balance`
      resuelve las dos cosas de una vez.
- [ ] **Más de un asentamiento.** Con el cambio de `asentamientos` esto se reformula: hoy ni siquiera el
      PRIMER asentamiento es fiable si el jugador no está dentro de él (ver arriba). Un selector de
      asentamiento sigue haciendo falta para gestionar una segunda plaza, pero ya no basta por sí solo —
      también hace falta resolver desde dónde se lee cada uno (`asentamientos` si se está dentro,
      `asentamientosAvistados` si no) antes de que un selector tenga algo consistente que ofrecer.
- [ ] **Aprovechar la respuesta autosuficiente.** La Fase C6 diseñó `POST /comandos` para devolver la
      proyección ya actualizada; el cliente la descarta y encadena un `GET` de más tras cada acción.
- [ ] **Terreno con `region`.** Documentado en `src/terreno/elevacion.ts`: una partida creada con `region` se
      renderiza mal, porque la copia local del evaluador no interpreta regiones geográficas.

## 5. Orden sugerido

1. **Corregir el supuesto de `asentamientos`** (§4, primer punto) — no es trabajo nuevo, es dejar de leer mal
   un campo que ya llega. Bloquea con seguridad silenciosa cualquier otra cosa que se construya sobre la
   pestaña Asentamientos.
2. **`GET /v1/balance` y el tiempo real (WebSocket + `/eventos`).** Son los dos habilitadores: sin balance no
   hay catálogo con el que dibujar ninguna pantalla de gestión, y sin tiempo real todo lo demás se siente
   muerto.
3. **Presencia del jugador (6 comandos).** Es la condición previa de todo lo que sigue: sin poder sacar a un
   jugador de su residencia no hay columna que mover, con la que comerciar en persona o que atacar.
4. **Selector de asentamiento** (§4) — desbloquea el `asentamientoId` de casi todo lo que sigue, ahora que
   §1 ya resolvió de dónde leer cada plaza.
5. **Gestión local: los 7 comandos de construcción, más `estadoMapa`.** Es donde más datos están ya llegando
   sin usarse.
6. **Cargos y políticas (4 comandos).** Muchas condiciones de autorización del resto exigen un cargo: sin
   poder asignarlos, buena parte de la gestión queda inalcanzable en la práctica.
7. **Ejércitos, interacción y militar (20 comandos).** El bloque mayor; el mapa ya pinta ejércitos y
   caravanas, falta el panel de campaña y `caravanasAvistadas`/interacción para poder hacer algo con lo ajeno.
8. **Comercio (6) y diplomacia (5).** El comercio ya tiene su condición previa resuelta en el punto 3; la
   diplomacia no depende de nada de lo anterior y puede adelantarse si conviene.

## Mantenimiento de este documento

Queda obsoleto en cuanto el backend añada un comando, cambie la forma de un bloque de la proyección, o este
cliente cablee uno de los dos. Al tocar cualquiera de las tres superficies, revisar aquí las cifras del
resumen y el checklist de [`COMANDOS.md`](COMANDOS.md); el apartado "Cómo se ha medido" está para que
rehacer la medición cueste minutos, no una tarde. Cuando el hallazgo sea un CAMBIO DE FORMA de un campo ya
consumido (como `asentamientos` esta vez) y no solo un campo nuevo sin leer, vale la pena destacarlo aparte
—como en "Lo más urgente" arriba— en vez de enterrarlo en el checklist de §3: es la clase de brecha que rompe
algo que ya funcionaba, no solo la que deja algo sin construir.
