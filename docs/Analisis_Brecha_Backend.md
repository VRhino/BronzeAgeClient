# Análisis de brecha: este cliente frente al backend

Qué ofrece el backend a un jugador, qué consume este cliente hoy y qué falta por construir. Fotografía
tomada el **2026-09-15**, contra `BronzeAgeFase0` en `3602f71` (rama `heroe-dominio`) y este cliente en su HEAD
actual.

> **Sync 2026-09-15 (Herido y bandidos con columna — cambio de forma, ya alineado):** (1) `atacar` gana el objetivo
> `campamento` y sale `atacarCampamentoBandidos` (74 comandos, 73 de jugador); el cliente ya ataca campamentos
> desde el panel de Selección. (2) `heroe.heridoHasta` y `heroesVisibles[].heridoHasta` (Doc 5.16.4) sustituyen a
> la Tregua de columna; el panel Héroe lo enseña y el ataque se apaga mientras dura. (3) Al caer una plaza, quien
> estaba dentro queda fuera en una columna, lo que el router ya lleva a la pantalla Mapa.

> **Sync 2026-09-14 (modelo de Héroe, fases 2 y 3 — cambio de forma, ya alineado):** (1) las escuadras viven en
> el héroe: `ejercitos[].escuadrones` pasa a `escuadronIds` (solo ids) y `Asentamiento.escuadrones` desaparece.
> (2) La proyección gana `heroe` (tu héroe completo, con todas tus escuadras y su coste de Liderazgo, loadouts y
> cupo de guarnición con lo ocupado), `heroesVisibles` (la ficha pública de los ajenos que se ven) y
> `nombresDeCompaneros` (el nombre de cada ciudadano de tu Facción); `ejercitosAvistados[]` gana `heroeIds`. (3)
> Catálogo 70 → 75: `repartirPuntos`, `guardarLoadout`, `borrarLoadout`, `asignarGuarnicion`,
> `retirarGuarnicion`. El cliente lee los datos (`CHANGELOG.md` 0.4.0) y los cinco comandos los usa el panel
> Héroe (0.5.0, `Features_Pendientes.md` §0.2).
>
> **Sync 2026-09-14 (modelo de Héroe, fase 1 — cambio de forma, ya alineado):** se juega con un HÉROE.
> (1) `proyeccion.jugadorId` → `heroeId`, y todo id de persona que viaja (cargos, `reyId`, `ciudadanosIds`,
> dueños de escuadrón, participantes de columna, `heroesFundadoresIds`) es un id de héroe; los `params`
> `jugadorId` de los comandos pasan a `heroeId`. (2) Sin héroe, la proyección es `{ ...resumen, sinHeroe: true }`
> y todo comando salvo `crearHeroe` es `403`. (3) Catálogo 69 → 70: +`crearHeroe`, +`crearFaccionNpc` (solo
> admin), −`alternarFaccionNpc`. El cliente ya está alineado (`CHANGELOG.md` 0.3.0); la pantalla de creación
> de héroe es provisional (`Features_Pendientes.md` §0).
>
> **Sync 2026-09-09 (contrato, sin comandos nuevos):** +3 comandos en el backend (66 → 69): `guarnecer`
> (Doc 5.12.4 — un ejército vuelca su tropa en una plaza propia; sus caravanas adjuntas pasan a `'aparcada'`),
> `moverCargaCaravanaAparcada` y `enviarCaravanaAlOrigen` (operar esas caravanas aparcadas). Niebla **Paso 4**
> (`f20d64e`): la visión se comparte EN VIVO con aliados/señor/vasallo — se suma a las capas "viéndolo ahora"
> (`asentamientosAvistados`, `ejercitosAvistados`, `caravanasAvistadas`, `campamentosBandidos`, la máscara
> `visibles` de la niebla), NUNCA a lo explorado ni a la memoria; **sin campos ni tipos nuevos**. Al romperse
> la relación, lo que solo veías por ella desaparece en la proyección siguiente.
>
> **Sync 2026-09-08:** el cliente se alineó con el cambio de `fundarAsentamiento` (ya no manda `posicion`),
> añadió a los tipos locales `Edificio.danado` y `Asentamiento.ocupacionHasta` (Doc 5.12.9), y corrigió el
> typo `mantenimiento` → `medidorMantenimiento`. Ver `CHANGELOG.md`.

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
| Comandos de partida (de jugador) | **73** | 22 | **51** |
| Bloques de datos de la proyección | 31 | 20 | 11 |

Desde la revisión del 2026-09-09: +`crearHeroe` (cableado, pantalla provisional), +5 del héroe sobre sí mismo
(cableados en el panel Héroe) y −`alternarFaccionNpc` (las Facciones NPC las crea ahora el admin con
`crearFaccionNpc`, que no es de jugador). En la proyección, +`heroe`, +`heroesVisibles` y +`nombresDeCompaneros`, que ya se
leen para los nombres. Y el cliente cableó 9 que ya existían, con las pantallas nuevas: `marcharA`, `entrarEnAsentamiento`,
`salirAlMundo` (en seco), `asignarCargoLocal` y 5 de construcción.

Reparto por sistema de juego, para ver dónde está el hueco:

| Sistema | Comandos | Implementados |
|---|---:|---|
| Héroe | 6 | **6 — completo** (`crearHeroe` con pantalla provisional; los otros 5 en el panel Héroe) |
| Murallas | 3 | **3 — completo** |
| Facción y ciudadanía | 5 | 2 (`crearFaccion`, `unirseAFaccion`) |
| Expansión | 3 | 1 (`fundarAsentamiento`) |
| Cargos y políticas | 4 | 1 (`asignarCargoLocal`) |
| Diplomacia | 5 | 0 |
| Comercio y caravanas | 14 | 0 |
| Construcción y gestión local | 7 | 5 (faltan `calibrarReservaManual`, `renombrarAsentamiento`) |
| Militar | 2 | 0 |
| Ejércitos y logística | 10 | 0 |
| Presencia del jugador | 6 | 3 (`salirAlMundo` en seco, `marcharA`, `entrarEnAsentamiento`) |
| Interacción en el mapa | 4 | 1 (`atacar`, solo campamentos de bandidos) |
| Composición de columna compartida | 4 | 0 |

Héroe y Murallas son los únicos sistemas enteros. Construcción y presencia ya se usan desde las pantallas
nuevas, pero ejércitos, militar, comercio, diplomacia, interacción y composición de columna siguen a cero: el
mapa **pinta** ejércitos, caravanas y campamentos de bandidos, pero no se puede reclutar, movilizar ni atacar
con ninguno. Frente a la capa militar y de campaña el jugador es hoy un espectador.

Los tres sistemas nuevos de la última fila —presencia, interacción y composición de columna— no existían la
revisión anterior de este documento: nacieron con el "jugador situado" (backend, 2026-09-05/06) y son la
condición previa de todo lo demás que involucre moverse por el mapa, incluido el comercio en persona (§2).

---

## 1. Endpoints

### Consumidos

- [x] `POST /v1/sesiones` — login con cuenta local (`Authorization: clave <nick>:<contraseña>`)
- [x] `POST /v1/jugador/partidas/{gameId}/membresia`
- [x] `GET /v1/jugador/partidas/{gameId}` — la proyección (o `sinHeroe`, que lleva a la pantalla Héroe)
- [x] `GET /v1/jugador/partidas/{gameId}/mapa/{mapaId}` — cacheado en memoria por `mapaId`
- [x] `POST /v1/jugador/partidas/{gameId}/comandos` — con 22 de los 73 comandos

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

## 2. Comandos: 22 de 73

El checklist por comando, con sus `params` exactos, vive en [`COMANDOS.md`](COMANDOS.md) — **es la única
lista de esa granularidad**, para no mantener dos que se contradigan. Aquí solo la lectura de conjunto.

Ninguno de los 51 que faltan está fuera de alcance por permisos: la matriz de `autorizacion.ts` admite el rol
`jugador` en los 73 (el único comando de partida que no es suyo, `crearFaccionNpc`, es de administración). Lo
que falta es siempre interfaz, nunca backend.

Dos comandos que este cliente llegó a documentar ya **no existen**: `combateCampoAbierto` e
`interceptarCaravana` se retiraron en el Paso 11 del movimiento de ejércitos, sustituidos por encuentros que
dispara la geometría durante el tick. No hay que implementarlos.

**Diecisiete llegaron del backend entre el 2026-09-05 y el 09-07** (de 42 a 59 comandos totales); tres de
ellos —`salirAlMundo`, `marcharA`, `entrarEnAsentamiento`— ya están cableados:

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

Y dos que ya existían **cambiaron de forma**, sin sumar al recuento: `movilizarEjercito` ganó un parámetro
opcional, `politicaDeUnion` (`rechazar` \| `aceptar` \| `preguntar`) — qué hacer con quien pida unirse en
campo a la columna que se está formando. Y `adjuntarCaravana` (2026-09-09) acepta ahora también una caravana
en estado `'aparcada'` (las que un ejército dejó al `guarnecer`).

## 3. Datos que el servidor manda y el cliente tira

La proyección trae **31 bloques** (antes 18 — la cuenta subió con el jugador situado, el comercio y el héroe). El
cliente consume 20. Estos llegan en cada respuesta y no se leen en ningún sitio:

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

Y hallazgos **dentro de lo que sí se lee**, que cambiaron de forma sin que el tipo local se enterara:

- **`ejercitos[].escuadrones` → `escuadronIds` (2026-09-14, fase 2 del Héroe) — ya alineado.** El mapa contaba
  los rombos de una columna por los dueños distintos de sus escuadrones y encontraba "tu columna" por ellos; con
  solo ids habría dejado de pintar rombos. Ahora los dos salen de `participantes`, que era lo correcto de todas
  formas (un viajero sin tropa también es un rombo). `Asentamiento.escuadrones` desapareció del tipo local, que
  ninguna pantalla leía.
- **`asentamientos` cambió de significado por completo** — ver la sección de arriba, "Lo más urgente". No es
  un campo que falte, es un campo que se lee con la semántica vieja.
- **`asentamientosAvistados` ganó tres secciones opcionales** (`cargos?`, `politicasActivas?`,
  `interiorRecordado?`, Doc 1.10.4 — "tres niveles de acceso": público, de la Facción, de quien la pisó). El
  tipo local (`AsentamientoAvistado`, `src/tiposDominio.ts`) todavía las declara todas como si fueran
  siempre visibles/inexistentes por igual; no distingue estos tres niveles.
- **Niebla Paso 4 (2026-09-09, `f20d64e`): las capas "viéndolo ahora" ya no son solo tus ojos.** Un aliado, un
  señor o un vasallo ve lo que ves tú, EN VIVO — sus plazas y columnas se suman al cálculo de
  `asentamientosAvistados`, `ejercitosAvistados`, `caravanasAvistadas`, `campamentosBandidos` y la máscara
  `visibles` de la niebla. NUNCA a `exploracion.celdas` ni a `asentamientosConocidos` (la memoria): la visión
  compartida es en vivo, al romperse la relación desaparece. Sin campos ni tipos nuevos — el cliente ya pinta
  esas capas; solo que ahora traen también lo que ven tus aliados. Ver `Niebla_De_Guerra_Definicion.md` §5.6
  del backend.
- **`Caravana.estado` ganó el valor `'aparcada'` (2026-09-09)** — una caravana adjunta que su ejército dejó en
  una plaza al `guarnecer`. El tipo local `Caravana` (`src/tiposDominio.ts`) ni siquiera modelaba `estado`;
  el sync le añadió el campo con el enum completo.

Y dentro de `Asentamiento` (la plaza propia completa), el tipo local de `src/tiposDominio.ts` declara 20
campos frente a los **27** del dominio (`ocupacionHasta` se añadió el 2026-09-08, Doc 5.12.9). No modela,
entre otros: `politicasActivas`, `politicaDeAcceso`, `vetadosIds`, `permiteReabastecerAliados`,
`ultimaCaravanaCreadaEn`.

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
      `CAP_FUNDACION_POR_NIVEL` en `src/ui/estadoCliente.ts`, el radio `30` de la zona inicial en
      `src/ui/pestanaAsentamientos.ts` y el radio de choque `15` (`LOGISTICA.radioEncuentro`) en `src/main.ts`. Es exactamente la divergencia silenciosa contra la que avisa el doc 9
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

0. **Héroe** ([`Features_Pendientes.md`](Features_Pendientes.md) §0): la creación provisional solo pide el
   nombre, y es lo primero que ve cualquier jugador nuevo. El panel Héroe ya existe (§0.2); le faltan el equipo,
   los perks y la ficha de los héroes ajenos.
1. **Corregir el supuesto de `asentamientos`** (§4, primer punto) — no es trabajo nuevo, es dejar de leer mal
   un campo que ya llega. Bloquea con seguridad silenciosa cualquier otra cosa que se construya sobre la
   pestaña Asentamientos.
2. **`GET /v1/balance` y el tiempo real (WebSocket + `/eventos`).** Son los dos habilitadores: sin balance no
   hay catálogo con el que dibujar ninguna pantalla de gestión, y sin tiempo real todo lo demás se siente
   muerto.
3. **Presencia del jugador (3 de 6 hechos).** Faltan `salirDeAsentamiento`, `fijarPoliticaDeAcceso`,
   `vetarJugador` y la pantalla de equipamiento de `salirAlMundo` (hoy sale en seco).
4. **Selector de asentamiento** (§4) — desbloquea el `asentamientoId` de casi todo lo que sigue, ahora que
   §1 ya resolvió de dónde leer cada plaza.
5. **Gestión local: faltan 2 de los 7 comandos de construcción** (`calibrarReservaManual`,
   `renombrarAsentamiento`), **más `estadoMapa`**.
6. **Cargos y políticas (1 de 4: `asignarCargoLocal`).** Muchas condiciones de autorización del resto exigen un cargo: sin
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
