# Índice de comandos del cliente jugador

Fuente, en el repositorio del **backend**: `src/session/comandos/registro.ts` (el catálogo) y
`src/session/comandos/esquemas.ts` (la forma de los `params`). Última revisión: **2026-09-26**, contra
`BronzeAgeFase0@8091638` (rama `ritmo-crecimiento`: subida de nivel manual, obras en horas, asedio como orden y
ciclo de Batalla de Unity).

> **Sync 2026-10-05 — taberna e intel (backend `c6dda58`):** +`comprarMirada { origen, centro }` y +`comprarInformePlaza { origen,
> asentamientoId }` (`origen = { tipo: 'asentamiento' | 'campamento', id }`). Los cablea `src/ui/panelIntel.ts`. Rechazo de dominio:
> `intel.invalida`. Esta tabla sigue contando los comandos de la revisión del 2026-09-26: desde entonces el backend ha añadido
> los de los campamentos de mercenarios, los Aedas y estos dos (el esquema publicado trae 102).

El backend expone **77 comandos de partida**. La matriz de `src/session/comandos/autorizacion.ts` admite el rol
`jugador` en **76**: el que falta, `crearFaccionNpc`, es solo de administración y no se lista aquí. Nada de lo
que falta aquí está bloqueado por permisos. La interfaz cablea **23**; el resto solo es alcanzable llamando a
mano al wrapper `ejecutarComando` de `src/apiCliente.ts`.

> **Sync 2026-09-26 — ritmo de crecimiento y asedio como orden:** (1) +`solicitarAscenso`: el nivel de un
> asentamiento **ya no sube solo** al cumplir población y edificios; eso pasa a ser el requisito para pedirlo. Lo pide
> el Gobernador, se paga entero del almacén, tarda una obra (`asentamiento.ascenso`) y exige solvencia al nivel
> destino y cupo de la Facción; la evaluación viaja en `proyeccion.ascensoDeAsentamiento`. (2) `atacar` acepta
> `objetivo: { tipo: 'asentamiento', id }`: **llegar a una plaza enemiga solo es acampar delante**; asediarla es
> atacarla a 15 o menos. Con servidores de batalla, `atacar` abre una batalla de Unity y devuelve `{ battleId }`.
> (3) +`unirseABatalla` y +`cancelarBatalla` (ciclo de Batalla, opt-in con `SERVIDORES_BATALLA`; sin eso todo se
> resuelve con números y `proyeccion.batallas` llega vacío). Todo comando que toque algo que está en una batalla
> activa se rechaza con `batalla.bloqueado`. (4) `mejorarEdificioAhora` ya no termina la mejora: la **arranca**
> (`edificio.mejora`, con duración), ocupa una de las 2 cuadrillas de obra y se rechaza si están las dos ocupadas.
> Recuento: 74 → 77 en el backend, 76 de jugador.

> **Sync 2026-09-15 — Herido y bandidos con columna:** (1) `atacar` acepta `objetivo: { tipo: 'campamento', id }`:
> un campamento de bandidos se ataca con la columna que llega a él (Doc 1.9), y sale `atacarCampamentoBandidos`
> (el ataque desde una plaza). Recuento: 75 → 74 en el backend, 73 de jugador. (2) La Tregua de columna
> desaparece: el héroe que pierde una batalla queda **herido** 2 minutos (`heroe.heridoHasta`, también en
> `heroesVisibles`); no ataca, no persigue y sus escuadras no combaten, y a una columna de solo heridos no se la
> puede atacar ni perseguir. (3) Al caer una plaza, quien estaba dentro sale junto a ella, en una columna.

> **Sync 2026-09-14 (2) — fases 2 y 3 del Héroe:** +5 comandos del héroe sobre sí mismo, sin `heroeId` en los
> `params` (el actor es siempre su propio héroe): `repartirPuntos`, `guardarLoadout`, `borrarLoadout`,
> `asignarGuarnicion` y `retirarGuarnicion`, con un rechazo común, `heroe.invalido`. Los usa el panel Héroe
> (cliente 0.5.0). Ningún comando existente cambia
> de forma; sí de significado: `escuadronIds` y `escoltaEscuadronIds` son ids de escuadras de TU héroe
> (`proyeccion.heroe.escuadrones`), una escuadra en guarnición no puede salir, escoltar ni atacar (la maneja la
> IA), y ni `guarnecer` ni `entrarEnAsentamiento` dejan ya la tropa en la plaza: la devuelven al campamento de su
> héroe. Recuento: 70 → 75 en el backend, 74 de jugador.

> **Sync 2026-09-14 — modelo de Héroe:** se juega con un héroe, no con el jugador. (1) Todos los `params`
> `jugadorId` pasan a `heroeId`, y `sucesorId`, `solicitanteId`, `vetadoId` y `nuevoReyId` también son ids de
> héroe. (2) +`crearHeroe`: una membresía sin héroe no puede mandar ningún otro comando (`403`). (3) Fuera
> `alternarFaccionNpc`: una Facción de jugador ya no se cede a la IA; las Facciones NPC las crea el admin con
> `crearFaccionNpc`. Recuento: 69 → 70 en el backend, 69 de jugador.

> **Sync 2026-09-08 — un supuesto roto:** `fundarAsentamiento` **ya no acepta `posicion`** (backend
> `76d7e9b`/`4fe611b`, "se funda DONDE SE ESTÁ", Doc 1.3). El backend deriva la posición de la columna del
> fundador, que exige estar en campo abierto (`salirAlMundo`, aún sin cablear). El cliente dejó de mandar
> `posicion` (`confirmarFundacion` en `src/main.ts`), pero el punto que se elige en el mapa es hoy **solo la
> vista previa de recursos** — el flujo real de fundación necesita la presencia del jugador. Ver
> `Analisis_Brecha_Backend.md`.

La lectura de conjunto —por qué faltan, en qué orden conviene atacarlos y qué más hay sin consumir aparte de
los comandos— está en [`Analisis_Brecha_Backend.md`](Analisis_Brecha_Backend.md).

## Criterio para marcar un comando

Marcar `[x]` únicamente cuando exista una interacción de la interfaz que construya sus `params`, invoque
`ejecutarComando(gameId, tipo, params)` y gestione su respuesta o su error. Tener el endpoint o la función
wrapper definidos no cuenta como aplicado.

## Checklist de implementación en la interfaz

### Héroe

- [x] `crearHeroe` — `displayName`, `classDefinitionId`, `genero` (`masculino` \| `femenino`), `avatar` (`{ cabezaId, peloId, barbaId, cejasId }`) · devuelve `{ heroeId }`; el héroe aparece en el mundo con su columna. Único comando que admite una membresía sin héroe · pantalla Héroe, **provisional**: solo el nombre, con clase, género y avatar fijos (`Features_Pendientes.md` §0.1)

Los cinco siguientes no llevan `heroeId`: el actor es su propio héroe. Wrapper tipado en `src/apiCliente.ts`, y los usa el panel Héroe (`src/ui/panelHeroe.ts`, riel del Mapa y barra del Asentamiento; `Features_Pendientes.md` §0.2). Rechazo de dominio: `heroe.invalido`.

- [x] `repartirPuntos` — `atributos` (`{ fuerza?, destreza?, armadura?, vitalidad? }`, enteros) · cada punto suma 1, tope 100, sin pasar de `puntosDeAtributoSinGastar`; hoy ningún nivel da puntos
- [x] `guardarLoadout` — `displayName`, `squadIds`, `perksSeleccionados` (enteros; hoy `[]`, el catálogo espera a CQ-004); opcionales: `loadoutId` (ausente = uno nuevo), `activo` · devuelve `{ loadoutId, liderazgoTotal }`; las escuadras tienen que caber en el Liderazgo, y el activo es el que defiende tu residencia mientras estás dentro
- [x] `borrarLoadout` — `loadoutId`
- [x] `asignarGuarnicion` — `squadId` · una escuadra de tu campamento pasa a la guarnición de tu residencia, dentro de `heroe.cupoGuarnicion`
- [x] `retirarGuarnicion` — `squadId`

### Fundación y expansión

- [x] `fundarAsentamiento` — **`faccionId`** (2026-09-08: ya NO lleva `posicion`; la posición sale de la columna del fundador) · pestaña Asentamientos
- [ ] `lanzarCaravanaFundacion` — `origenAsentamientoId`, `destino`, `numJugadores`
- [ ] `desarmarCaravanaFundacion` — `caravanaId`

### Facción y ciudadanía

- [x] `crearFaccion` — `nombre`, `sigilo` (campo, emblema y dos colores del catálogo; no se cambia nunca) · pestaña Facción
- [x] `unirseAFaccion` — `faccionId` · pestaña Facción, lista buscable
- [ ] `dejarFaccion` — sin parámetros (`{}`); el actor solo puede dejar la suya
- [ ] `comprarCasa` — `asentamientoId`, `heroeId` · segunda vía de entrar en una Facción, abierta a quien no tenga ninguna
- [ ] `cambiarResidencia` — `destinoId`, `heroeId` (nuevo 2026-09-08, Doc 2.5) · atómico: deja la residencia actual (libera vivienda, vacía cargos locales viejos) + toma una nueva en otra plaza de tu Facción con hueco y permiso; tu campamento se muda contigo y tu guarnición se suelta (2026-09-14). Prerrequisito de consolidar una conquista

### Cargos y políticas

- [ ] `asignarRey` — `faccionId`, `heroeId`
- [ ] `asignarEmbajador` — `faccionId`, `heroeId`
- [x] `asignarCargoLocal` — `asentamientoId`, `cargo`, `heroeId` · panel Facción de la pantalla Asentamiento (el Rey nombra Gobernador; el Gobernador, el resto)
- [ ] `activarPolitica` — `asentamientoId`, `cargo`, `politicaId`

### Construcción y gestión local

- [x] `anadirEdificioManualmente` — `asentamientoId`, `cargo`, `tipo` · pestaña Edificios
- [x] `quitarDeCola` — `asentamientoId`, `cargo`, `edificioId` · pestaña Cola
- [x] `moverEnCola` — `asentamientoId`, `cargo`, `edificioId`, `direccion` (`arriba` \| `abajo`) · pestaña Cola
- [x] `mejorarEdificioAhora` — `asentamientoId`, `cargo`, `edificioId` · arranca la mejora (se paga ya, dura `edificio.mejora.completaEn`, ocupa cuadrilla) · pestaña Edificios (⬆); la mejora en curso sale en la pestaña Cola
- [x] `alternarAutoConstruccion` — `asentamientoId`, `pausada` · pestaña Resumen
- [x] `solicitarAscenso` — `asentamientoId` · solo el Gobernador residente, sin `cargo` · pestaña Resumen, «Subir a nivel N», apagado mientras `ascensoDeAsentamiento.puede` sea falso (se listan los bloqueos, el coste, la obra y el déficit de mantenimiento). Rechazo de dominio: `ascenso.invalido`
- [ ] `calibrarReservaManual` — `asentamientoId`, `recurso`, `valor`
- [ ] `renombrarAsentamiento` — `asentamientoId`, `nombre` (vacío = volver a mostrar el id)

### Murallas — sistema completo

- [x] `comprometerRecinto` — `asentamientoId`, `cargo`, `nivel` (1 \| 2 \| 3) · pestaña Muralla
- [x] `abandonarRecinto` — `asentamientoId`, `recintoId` · pestaña Muralla; solo el Gobernador, sin `cargo`
- [x] `mejorarRecinto` — `asentamientoId`, `cargo`, `recintoId` · pestaña Muralla

### Diplomacia

- [ ] `proponerRelacion` — `tipo` (`vasallaje` \| `alianza`), `faccionAId`, `faccionBId`; opcionales: `tributoRecurso`, `tributoCantidad` (solo se usan en vasallaje)
- [ ] `romperRelacion` — `relacionId`, `iniciadorFaccionId`
- [ ] `rebelionVasallo` — `relacionId`
- [x] `proponerAnexion` — `faccionAId` (absorbente), `faccionBId`: Rey o Embajador (pestaña Facción, `ui/panelAnexion.ts`)
- [x] `responderAnexion` — `propuestaId`, `aceptar`: solo el Rey de la absorbida
- [x] `retirarAnexion` — `propuestaId`: Rey o Embajador de la absorbente
- [x] `proponerFusion` — `faccionAId`, `faccionBId`, `nuevoNombre`, `nuevoReyId` (el Rey de A o el de B): solo el Rey de A (pestaña Facción, `ui/panelFusion.ts`)
- [x] `responderFusion` — `propuestaId`, `aceptar`: solo el Rey de B
- [x] `retirarFusion` — `propuestaId`: solo el Rey de A

### Comercio

- [ ] `proponerTrueque` — `asentamientoAId`, `recursoA`, `cantidadA`, `asentamientoBId`, `recursoB`, `cantidadB` (nace `'propuesto'`; ya no obliga a nadie hasta `aceptarTrueque` — cambio del backend 2026-09-07)
- [ ] `aceptarTrueque` — `acuerdoId` (solo lo puede aceptar el lado B, el receptor de la propuesta)
- [ ] `rechazarTrueque` — `acuerdoId`
- [ ] `colocarOrdenMercado` — `asentamientoId`, `tipo` (`compra` \| `venta`), `recurso`, `cantidad`; opcional: `precio`
- [ ] `comerciarEnPlaza` — `heroeId`, `asentamientoId`, `ordenId`, `cantidad` (toma una orden EN PERSONA: exige tener una columna propia en la puerta de esa plaza y ser su Líder — sustituye al viejo emparejamiento automático entre plazas, ver `Comercio_Fisico_Definicion.md` del backend)

### Caravanas — revamp del backend 2026-09-08 (`Revamp_Caravanas_Definicion.md`)

Una caravana ya no nace lista: se crea un casco vacío, se le montan carros y animales, y se lanza a mano.

- [ ] `crearCaravana` — `asentamientoId` (casco vacío)
- [ ] `agregarCarroCaravana` — `caravanaId`, `tipoCarro` (`basico` \| `reforzado`)
- [ ] `comprarAnimalCaravana` — `caravanaId`, `carroIndice`, `tipoAnimal` (`buey` \| `caballo` \| `camello`) — el buey cuesta oro (economía del oro, 2026-09-08)
- [ ] `moverCarroCaravana` — `desdeCaravanaId`, `haciaCaravanaId`, `carroIndice`
- [ ] `reservarCaravana` — `caravanaId`, `reservada` (boolean)
- [ ] `prepararCaravana` — `caravanaId`, `heroeId`, `destinoAsentamientoId`, `carga` (recurso→cantidad); opcional: `escoltaEscuadronIds` — lanzamiento manual con preparación (escolta sin héroe, Doc 3.13.4)
- [ ] `cancelarCaravana` — `caravanaId`
- [ ] `moverCargaCaravanaAparcada` — `heroeId`, `caravanaId`, `asentamientoId`, `recurso`, `cantidad`, `sentido` (`cargar` \| `descargar`) (nuevo 2026-09-09, Doc 3.13.7) · intercambia carga entre una caravana `'aparcada'` tras `guarnecer` y el almacén de la plaza anfitriona
- [ ] `enviarCaravanaAlOrigen` — `heroeId`, `caravanaId`, `asentamientoId` (nuevo 2026-09-09) · saca una caravana `'aparcada'` de vuelta a su origen (vacía al instante; cargada recorre el mapa y vuelca en el almacén de origen al llegar)

### Militar

- [ ] `reclutarTropa` — `asentamientoId`, `heroeId`, `tropaId`, `origen` (`pesants` \| `artesanos`)
- [ ] `iniciarAsedio` — `atacanteId`, `defensorId`, `escuadronIds`

### Ejércitos y logística de campaña

- [ ] `movilizarEjercito` — `asentamientoId`, `heroeId`, `escuadronIds`, `objetivo`: `{ tipo: 'asentamiento', id }` o `{ tipo: 'punto', punto: { x, y } }`; opcional: `politicaDeUnion` (`rechazar` \| `aceptar` \| `preguntar`, Doc 5.14.1 — qué hacer con quien pida unirse en campo)
- [ ] `unirseAEjercito` — `ejercitoId`, `asentamientoId`, `heroeId`, `escuadronIds`
- [ ] `replegarEjercito` — `ejercitoId`
- [ ] `estacionarEjercito` — `ejercitoId`
- [ ] `alternarReabastecerAliados` — `asentamientoId`, `permitido`
- [ ] `adjuntarCaravana` — `ejercitoId`, `caravanaId`, `heroeId` (2026-09-09: acepta también una caravana `'aparcada'`)
- [ ] `soltarCaravana` — `ejercitoId`, `caravanaId`, `heroeId`
- [ ] `cargarCaravana` — `ejercitoId`, `caravanaId`, `asentamientoId`, `recurso`, `cantidad`
- [ ] `entregarDeCaravana` — `ejercitoId`, `caravanaId`, `acuerdoId`
- [ ] `guarnecer` — `asentamientoId`, `heroeId` (nuevo 2026-09-09, Doc 5.12.4 / Ocupacion §2.3) · un ejército en la puerta de una plaza de su Facción donde residen todos los que van en él se deshace: la tropa vuelve a sus campamentos y el carro al almacén; los héroes quedan DENTRO (2026-09-14). Las caravanas adjuntas pasan a `'aparcada'` en esa plaza

### Presencia del jugador (Doc 1.10)

Nuevos desde el "jugador situado" (backend, 2026-09-05/06): dónde está un jugador en el mundo deja de ser
implícito y pasa a ser estado que estos comandos mueven. Sin ellos no hay forma de sacar a un jugador de su
residencia, así que **tampoco hay forma de usar el comercio ni la interacción de abajo**, que exigen tener una
columna plantada en algún sitio.

- [x] `salirAlMundo` — `asentamientoId`, `heroeId`, `escuadronIds`, `carga` (mapa recurso → cantidad; puede ir vacío) · única salida con pantalla de equipamiento — sales de tu propia residencia con el roster y el almacén delante · hoy en seco, botón «Salir al mundo» (falta la pantalla de equipamiento, `Features_Pendientes.md` §1.1)
- [x] `marcharA` — `heroeId`, `objetivo`: `{ tipo: 'asentamiento', id }` o `{ tipo: 'punto', punto: { x, y } }` · rectifica el rumbo de la columna en la que vas, sin límite de veces · clic en el mapa
- [x] `entrarEnAsentamiento` — `asentamientoId`, `heroeId` · en tu residencia disuelve la columna (tropas a tu campamento, carro al almacén); en cualquier otra la deja aparcada intacta · botón «Entrar» del panel de Selección
- [ ] `salirDeAsentamiento` — `asentamientoId`, `heroeId` · retoma la columna aparcada en una plaza AJENA, sin pantalla de equipamiento (de tu propia residencia se sale con `salirAlMundo`)
- [ ] `fijarPoliticaDeAcceso` — `asentamientoId`, `heroeId`, `politica` (`abierto` \| `faccion_y_aliados` \| `solo_faccion` \| `cerrado`) · la puerta de la plaza, solo el Gobernador
- [ ] `vetarJugador` — `asentamientoId`, `heroeId`, `vetadoId`, `vetar` (boolean)

### Interacción en el mapa (Doc 5.12.3)

El menú de clic sobre algo en marcha. Los encuentros ya no son automáticos por pasar cerca: hay que haber
decidido acercarse (`inspeccionar`) o ir a por algo (`atacar`/`perseguir`) para que pase cualquier cosa.

- [ ] `inspeccionar` — `heroeId`, `objetivo`: `{ tipo: 'ejercito', id }` o `{ tipo: 'caravana', id }` · ver de cerca sin comprometerse a nada
- [x] `atacar` — `heroeId`, `objetivo`: la misma forma que `inspeccionar`, `{ tipo: 'campamento', id }` para un campamento de bandidos (Doc 1.9) o `{ tipo: 'asentamiento', id }` para asediar una plaza de otra Facción (Doc 5.12.4) · panel de Selección del mapa, **campamentos y plazas**; columnas y caravanas pendientes (`Features_Pendientes.md` §1.4). Con servidores de batalla devuelve `{ battleId }`
- [ ] `perseguir` — `heroeId`, `objetivo` (misma forma) · un objetivo MÓVIL, la ruta se recalcula cada tick hacia donde esté
- [ ] `dejarDePerseguir` — `heroeId`

### Composición de columna compartida (Doc 5.14)

Varios jugadores pueden compartir una columna. La política de quién entra la fija el Líder al parir la columna
(`movilizarEjercito.politicaDeUnion`, arriba); estos comandos gestionan la vida de esa composición después.

- [ ] `unirseEnCampo` — `ejercitoId`, `heroeId` · pedir unirse a una columna que ya está en marcha
- [ ] `responderPeticionDeUnion` — `ejercitoId`, `heroeId`, `solicitanteId`, `aceptar` (boolean) · solo el Líder, y solo si su política es `preguntar`
- [ ] `separarseDelEjercito` — `heroeId` (sin `ejercitoId`: se sale de la columna en la que vas, y solo puedes ir en una)
- [ ] `cederLiderazgo` — `ejercitoId`, `heroeId`, `sucesorId` · el Líder es quien formó la columna y el único que puede cancelar la marcha; para irse tiene que ceder antes

### Batallas de Unity (doc 02 §3.1)

Solo tienen efecto si el backend declara `SERVIDORES_BATALLA` (en Render, hoy no). Sin interfaz: `Features_Pendientes.md` §1.5.

- [ ] `unirseABatalla` — `heroeId`, `battleId` · un compañero de Facción a distancia de ataque, mientras el bando no esté lleno
- [ ] `cancelarBatalla` — `battleId` · solo quien la inició, antes de que empiece

## Comandos retirados del backend

No implementar: se retiraron en el Paso 11 del movimiento de ejércitos, sustituidos por encuentros que
dispara la geometría durante el tick (ver `src/engine/combate.ts` en el backend). Estuvieron listados en
versiones anteriores de este documento.

- `combateCampoAbierto`
- `interceptarCaravana`

## Contrato HTTP común

```http
POST /v1/jugador/partidas/{gameId}/comandos
Authorization: sesion <sesionId>
Content-Type: application/json
```

```json
{
  "tipo": "nombreDelComando",
  "params": {},
  "idempotencyKey": "opcional-y-unica"
}
```

El backend valida la forma de `params` según `tipo` (`additionalProperties: false`: un campo de más es un
`400`), comprueba autorización y reglas de dominio, y devuelve `resultado`. En caso de éxito **también
devuelve la `proyeccion` del jugador ya actualizada** (Fase C6, "respuesta autosuficiente"): no hace falta un
`GET` aparte tras cada comando. Hoy el cliente descarta esa proyección y encadena un `GET` de más.

Estados esperados: `400` body, tipo o `params` inválidos; `401` sesión inválida; `403` no autorizado (también cualquier
comando que no sea `crearHeroe` mientras la membresía no tenga héroe); `409`
**fallo de persistencia** (y `404` partida no abierta).

Un **rechazo de dominio no es un error HTTP**: llega como `200` con `resultado.ok === false` y un
`resultado.codigoError` ("sin recursos", "plaza ocupada"...). Hay que comprobar las dos cosas —el status y
`resultado.ok`—, tal como hace `ejecutarYRefrescar` en `src/main.ts`.
