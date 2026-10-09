# Índice de comandos del cliente jugador

Fuente, en el repositorio del **backend**: `src/session/comandos/registro.ts` (el catálogo) y
`src/session/comandos/esquemas.ts` (la forma de los `params`). Última revisión: **2026-10-09**, contra
`BronzeAgeFase0@02bd153` (`main`) y el canon de `Docs/Game`.

> **Sync 2026-10-09 — contraste completo con el backend:** el catálogo registrado trae **120 comandos de partida**, todos con el rol `jugador`
> (`crearFaccionNpc` es solo del admin y ya no está en `registro.ts`). Se añaden a este índice los que faltaban (campamentos de mercenarios,
> Aedas y tecnología, diplomacia, puerta, residencia, intel, recetas, capital); se retiran `comprarCasa`, `fijarPoliticaDeAcceso`,
> `fundarAsentamiento` (hoy es `fundar`) y `atacarCampamentoBandidos`, que ya no existen. `vetarJugador` **sí existe** (Doc 1.10.5). Los comandos de
> **Unity** (batalla, creación completa del héroe, equipo, perks) quedan marcados «no aplica». Hay además un endpoint nuevo:
> `GET /v1/jugador/partidas` (`02bd153`), al final.

> **Sync 2026-10-07 — batallas con héroes y ejércitos en campo (backend `101c035`):** +`organizarEjercito { heroeId, politicaDeUnion:
> 'aceptar' | 'preguntar' }`, +`cancelarFormacion { heroeId }` y +`admitirOtrasFacciones { faccionId, admitir }`; `unirseABatalla` acepta `lado`
> (obligatorio en una persecución). Cableados en `src/ui/panelBatalla.ts` y `src/ui/panelAdmision.ts`, junto con `unirseEnCampo` y
> `separarseDelEjercito`. Solo un ejército abre un asedio (`atacar` una plaza con una columna personal se rechaza). Rechazos de dominio:
> `batalla.invalida`, `movilizacion.invalida`.

> **Sync 2026-10-05 — taberna e intel (backend `c6dda58`):** +`comprarMirada { origen, centro }` y +`comprarInformePlaza { origen,
> asentamientoId }` (`origen = { tipo: 'asentamiento' | 'campamento', id }`). Los cablea `src/ui/panelIntel.ts`. Rechazo de dominio:
> `intel.invalida`. Esta tabla sigue contando los comandos de la revisión del 2026-09-26: desde entonces el backend ha añadido
> los de los campamentos de mercenarios, los Aedas y estos dos (el esquema publicado trae 102).

El backend registra **120 comandos de partida** y la matriz admite el rol `jugador` en todos (ver la nota de 2026-10-09 arriba). La interfaz cablea **117 entradas de este índice**; el resto solo es alcanzable llamando a
mano al wrapper `ejecutarComando` de `src/apiCliente.ts`, o no aplica (Unity).

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

- [x] `crearHeroe` — `displayName`, `classDefinitionId`, `genero` (`masculino` \| `femenino`), `avatar` (`{ cabezaId, peloId, barbaId, cejasId }`) · devuelve `{ heroeId }`; el héroe aparece en el mundo con su columna. Único comando que admite una membresía sin héroe · pantalla Héroe, **provisional**: solo el nombre, con clase, género y avatar fijos (`Features_Pendientes.md` §0.1) · **Unity:** la creación completa (clase, género y aspecto salen del catálogo de Conquest) no aplica al cliente web

Los cinco siguientes no llevan `heroeId`: el actor es su propio héroe. Wrapper tipado en `src/apiCliente.ts`, y los usa el panel Héroe (`src/ui/panelHeroe.ts`, barra superior del jugador; `Features_Pendientes.md` §0.2). Rechazo de dominio: `heroe.invalido`.

- [x] `repartirPuntos` — `atributos` (`{ fuerza?, destreza?, armadura?, vitalidad? }`, enteros) · cada punto suma 1, tope 100, sin pasar de `puntosDeAtributoSinGastar`; hoy ningún nivel da puntos
- [x] `guardarLoadout` — `displayName`, `squadIds`, `perksSeleccionados` (enteros; hoy `[]`, el catálogo espera a CQ-004); opcionales: `loadoutId` (ausente = uno nuevo), `activo` · devuelve `{ loadoutId, liderazgoTotal }`; las escuadras tienen que caber en el Liderazgo, y el activo es el que defiende tu residencia mientras estás dentro
- [x] `borrarLoadout` — `loadoutId`
- [x] `asignarGuarnicion` — `squadId` · una escuadra de tu campamento pasa a la guarnición de tu residencia, dentro de `heroe.cupoGuarnicion`
- [x] `retirarGuarnicion` — `squadId`

### Fundación y expansión

- [x] `fundar` — sin `params` (`{}`; antes `fundarAsentamiento`): se funda DONDE SE ESTÁ, con la Caravana de Fundación enganchada a tu columna; los ciudadanos de la columna son cofundadores, hasta 5 (Doc 1.3) · riel del mapa › Fundar
- [x] `lanzarCaravanaFundacion` — `origenAsentamientoId` · Centro urbano › Fundación
- [x] `desarmarCaravanaFundacion` — `caravanaId` · Centro urbano › Fundación (titular, caravana suelta y en la puerta de su plaza)

### Facción y ciudadanía

- [x] `crearFaccion` — `nombre`, `sigilo` (campo, emblema y dos colores del catálogo; no se cambia nunca) · pestaña Facción
- [x] `unirseAFaccion` — `faccionId` · pestaña Facción, lista buscable
- [x] `dejarFaccion` — `{}` · Facción › Abandonar (`ui/panelCargos.ts`)
- [x] `cambiarResidencia` — `destinoId`, `heroeId` (nuevo 2026-09-08, Doc 2.5) · atómico: deja la residencia actual (libera vivienda, vacía cargos locales viejos) + toma una nueva en otra plaza de tu Facción con hueco y permiso; tu campamento se muda contigo y tu guarnición se suelta (2026-09-14). Prerrequisito de consolidar una conquista · botón «Hacer de esta plaza mi base» en la barra de la plaza (solo en una plaza de tu Facción donde no resides)

### Cargos y políticas

- [x] `asignarRey` — `{ faccionId, heroeId }` · Facción › Cargos › Traspasar el trono (`ui/panelCargos.ts`)
- [x] `asignarEmbajador` — `{ faccionId, heroeId }` · Facción › Cargos › Designar Embajador (`ui/panelCargos.ts`)
- [x] `asignarCargoLocal` — `asentamientoId`, `cargo`, `heroeId` · panel Facción de la pantalla Asentamiento (el Rey nombra Gobernador; el Gobernador, el resto)
- [x] `activarPolitica` — `asentamientoId`, `cargo`, `politicaId` · Centro urbano › Tesorería (cada cargo, las de su pool; el Gobernador, todas)

### Construcción y gestión local

- [x] `anadirEdificioManualmente` — `asentamientoId`, `cargo`, `tipo` · pestaña Edificios
- [x] `quitarDeCola` — `asentamientoId`, `cargo`, `edificioId` · pestaña Cola
- [x] `moverEnCola` — `asentamientoId`, `cargo`, `edificioId`, `direccion` (`arriba` \| `abajo`) · pestaña Cola
- [x] `mejorarEdificioAhora` — `asentamientoId`, `cargo`, `edificioId` · arranca la mejora (se paga ya, dura `edificio.mejora.completaEn`, ocupa cuadrilla) · pestaña Edificios (⬆); la mejora en curso sale en la pestaña Cola
- [x] `alternarAutoConstruccion` — `asentamientoId`, `pausada` · pestaña Resumen
- [x] `solicitarAscenso` — `asentamientoId` · solo el Gobernador residente, sin `cargo` · pestaña Resumen, «Subir a nivel N», apagado mientras `ascensoDeAsentamiento.puede` sea falso (se listan los bloqueos, el coste, la obra y el déficit de mantenimiento). Rechazo de dominio: `ascenso.invalido`
- [x] `calibrarReservaManual` — `asentamientoId`, `recurso`, `valor` (0–999) · Centro urbano › Tesorería (solo el Tesorero residente presente)
- [x] `renombrarAsentamiento` — `asentamientoId`, `nombre` (vacío = volver a mostrar el id) · Centro urbano › Resumen › «Nombre de la ciudad» (solo residentes)

### Murallas — sistema completo

- [x] `comprometerRecinto` — `asentamientoId`, `cargo`, `nivel` (1 \| 2 \| 3) · pestaña Muralla (solo en `#/legacy`: falta traerla a la plaza)
- [x] `abandonarRecinto` — `asentamientoId`, `recintoId` · pestaña Muralla (solo en `#/legacy`: falta traerla a la plaza); solo el Gobernador, sin `cargo`
- [x] `mejorarRecinto` — `asentamientoId`, `cargo`, `recintoId` · pestaña Muralla (solo en `#/legacy`: falta traerla a la plaza)

### Diplomacia

- [x] `proponerRelacion` — `{ tipo: 'vasallaje'|'alianza', faccionAId, faccionBId, tributoRecurso?, tributoCantidad? }` · Facción › Diplomacia (`ui/panelDiplomacia.ts`)
- [x] `romperRelacion` — `{ relacionId, iniciadorFaccionId }` · Facción › Diplomacia (romper alianza / liberar vasallo)
- [x] `rebelionVasallo` — `{ relacionId }` · Facción › Diplomacia (solo la vasalla)
- [x] `proponerAnexion` — `faccionAId` (absorbente), `faccionBId`: Rey o Embajador (pestaña Facción, `ui/panelAnexion.ts`)
- [x] `responderAnexion` — `propuestaId`, `aceptar`: solo el Rey de la absorbida
- [x] `retirarAnexion` — `propuestaId`: Rey o Embajador de la absorbente
- [x] `proponerFusion` — `faccionAId`, `faccionBId`, `nuevoNombre`, `nuevoReyId` (el Rey de A o el de B): solo el Rey de A (pestaña Facción, `ui/panelFusion.ts`)
- [x] `responderFusion` — `propuestaId`, `aceptar`: solo el Rey de B
- [x] `retirarFusion` — `propuestaId`: solo el Rey de A

### Comercio

- [x] `proponerTrueque` — `{ asentamientoAId, lineasA: [{recurso, cantidad}], asentamientoBId, lineasB }` · Mercado › Trueques (`src/ui/panelTrueques.ts`)
- [x] `aceptarTrueque` — `{ acuerdoId }` · Mercado › Trueques
- [x] `rechazarTrueque` — `{ acuerdoId }` · Mercado › Trueques
- [x] `colocarOrdenMercado` — `asentamientoId`, `tipo` (`compra` \| `venta`), `recurso`, `cantidad`; opcional: `precio` · pestaña Mercado › Órdenes de la plaza (solo residentes); lista las órdenes en pie de la plaza
- [x] `comerciarEnPlaza` — `{ heroeId, asentamientoId, ordenId, cantidad }` → `{ cantidad, valor, comision }` · ficha de plaza del mapa (`src/ui/mercadoDePlaza.ts`)

### Caravanas — revamp del backend 2026-09-08 (`Revamp_Caravanas_Definicion.md`)

Una caravana ya no nace lista: se crea un casco vacío, se le montan carros y animales, y se lanza a mano.

- [x] `crearCaravana` — `asentamientoId` (casco vacío) · pestaña Mercado › Caravanas
- [x] `agregarCarroCaravana` — `caravanaId`, `tipoCarro` (`basico` \| `reforzado`) · Mercado › Caravanas
- [x] `comprarAnimalCaravana` — `caravanaId`, `carroIndice`, `tipoAnimal` (`buey` \| `caballo` \| `camello`) — el buey cuesta oro (economía del oro, 2026-09-08) · Mercado › Caravanas
- [x] `moverCarroCaravana` — `desdeCaravanaId`, `haciaCaravanaId`, `carroIndice` · Mercado › Caravanas
- [x] `reservarCaravana` — `caravanaId`, `reservada` (boolean) · Mercado › Caravanas
- [x] `asignarEscolta` — `caravanaId`, `heroeId`, `escuadronIds` · panel «Escolta» de la plaza: cede escuadras a una caravana comercial parada en su origen; cupo en puntos de Liderazgo (`caravanas[].escoltaLiderazgo`), `comercio.caravana_invalida` si no cabe (nuevo 2026-10-08, Doc 3.13.4)
- [x] `quitarEscolta` — `caravanaId`, `heroeId`, `escuadronIds?` · mismo panel: retira las tuyas, vuelven al campamento
- [x] `pasarAViveres` — `cantidad` · responde `{ movido }` · botón «＋ desde el carro» de la barra de víveres del mundo abierto: pasa trigo del carro a TUS víveres, solo lo que cabe (350 por héroe); solo el Líder de la columna (nuevo 2026-10-08, Doc 5.13)
- [x] `prepararCaravana` — `caravanaId`, `heroeId`, `destinoAsentamientoId`, `carga` (recurso→cantidad); opcional: `escoltaEscuadronIds` — lanzamiento manual con preparación (escolta sin héroe, Doc 3.13.4) · Mercado › Caravanas: destino y carga del almacén (la escolta se cede en Mercado › Escolta)
- [x] `cancelarCaravana` — `caravanaId` · Mercado › Caravanas, solo en `preparando`
- [x] `moverCargaCaravanaAparcada` — `{ heroeId, caravanaId, asentamientoId, recurso, cantidad, sentido: 'cargar'|'descargar' }` · Mercado › Aparcadas (`src/ui/panelAparcadas.ts`)
- [x] `enviarCaravanaAlOrigen` — `{ heroeId, caravanaId, asentamientoId }` · Mercado › Aparcadas

### Militar

- [x] `reclutarTropa` — `asentamientoId`, `heroeId`, `tropaId`, `origen` (`pesants` \| `artesanos`) · pestaña Reclutamiento de la plaza: solo las tropas con tecnología adoptada (`tecnologia.propias.adoptadas`) y edificio activo del nivel pedido; `origen` no se envía
- [ ] `iniciarAsedio` — `atacanteId`, `defensorId`, `escuadronIds` · **no aplica**: vía directa entre dos asentamientos vecinos que el backend conserva sin movilizar (`ejercitos.ts`), pero el canon (Doc 5.12.3-5.12.4) solo reconoce asediar con **Atacar** desde un ejército a distancia de choque, que es lo que usa el cliente (`atacar`)

### Ejército en preparación (backend 2026-10-08, Doc 5.14.5)

Panel «Salir» de un campamento y «Salir al mundo» de la plaza (`ui/convocatoria.ts`, `ui/salidaComoEjercito.ts`):

- [x] `convocarEjercito` — `heroeId`, `politicaDeUnion` (`aceptar` | `preguntar`), `escuadronIds`, `carga` · convoca dentro del lugar; espera sin caducidad
- [x] `unirseAConvocatoria` — `heroeId`, `convocatoriaId`, `escuadronIds`, `carga` · misma Facción y mismo lugar
- [x] `responderPeticionDeConvocatoria` — `heroeId` (Líder), `convocatoriaId`, `solicitanteId`, `aceptar`
- [x] `separarseDeConvocatoria` — `heroeId` · un integrante no Líder; sigue dentro
- [x] `cancelarConvocatoria` — `heroeId` · solo el Líder; nadie se mueve
- [x] `cambiarSeleccionDeConvocatoria` — `heroeId`, `escuadronIds` (en orden de combate), `carga` · «Tu tropa» del panel de preparación: casillas y flechas, solo la propia
- [x] `partirConvocatoria` — `heroeId` · solo el Líder; salen todos juntos como UN ejército quieto en la puerta, que dirige el Líder con `marcharA`

### Ejércitos y logística de campaña

- [x] `movilizarEjercito` — `asentamientoId`, `heroeId`, `escuadronIds`, `objetivo`: `{ tipo: 'asentamiento', id }` o `{ tipo: 'punto', punto: { x, y } }`; opcional: `politicaDeUnion` (`rechazar` \| `aceptar` \| `preguntar`, Doc 5.14.1 — qué hacer con quien pida unirse en campo) · `objetivo` opcional desde 2026-10-08 (sin él sale quieto); la UI usa la convocatoria + `partirConvocatoria`
- [x] `unirseAEjercito` — `ejercitoId`, `asentamientoId`, `heroeId`, `escuadronIds` · panel «Ejércitos» de la plaza: sumarte con tropa de tu campamento a un ejército de tu Facción que pasa a ≤ 60 de la plaza
- [x] `replegarEjercito` — `ejercitoId` · panel ⚑ Ejército del mapa (Líder)
- [x] `estacionarEjercito` — `ejercitoId` · panel ⚑ Ejército del mapa (Líder, en marcha)
- [x] `alternarReabastecerAliados` — `{ asentamientoId, permitido }` · `src/ui/panelAliados.ts` (subpestaña «Aliados» de Centro urbano)
- [x] `adjuntarCaravana` — `{ ejercitoId, caravanaId, heroeId }` · «Lo que llevas» › Para enganchar (`src/ui/caravanasAdjuntas.ts`); acepta también `aparcada`. El flujo de la Caravana de Fundación del panel `fundar` sigue igual.
- [x] `soltarCaravana` — `{ ejercitoId, caravanaId, heroeId }` · «Lo que llevas» › caravana enganchada › Soltar
- [x] `cargarCaravana` — `{ ejercitoId, caravanaId, asentamientoId, recurso, cantidad }` · «Lo que llevas» › caravana enganchada › Cargar
- [x] `entregarDeCaravana` — `{ ejercitoId, caravanaId, acuerdoId }` · «Lo que llevas» › caravana enganchada › Entregar
- [x] `guarnecer` — `asentamientoId`, `heroeId` (nuevo 2026-09-09, Doc 5.12.4 / Ocupacion §2.3) · un ejército en la puerta de una plaza de su Facción donde residen todos los que van en él se deshace: la tropa vuelve a sus campamentos y el carro al almacén; los héroes quedan DENTRO (2026-09-14). Las caravanas adjuntas pasan a `'aparcada'` en esa plaza · botón «Entrar con el ejército» de la ficha de una plaza propia (backend 2026-10-08: el ejército se desarma; residentes entran normal, el resto de visita; las caravanas adjuntas deben ser del lugar)

### Presencia del jugador (Doc 1.10)

Nuevos desde el "jugador situado" (backend, 2026-09-05/06): dónde está un jugador en el mundo deja de ser
implícito y pasa a ser estado que estos comandos mueven. Sin ellos no hay forma de sacar a un jugador de su
residencia, así que **tampoco hay forma de usar el comercio ni la interacción de abajo**, que exigen tener una
columna plantada en algún sitio.

- [x] `salirAlMundo` — `asentamientoId`, `heroeId`, `escuadronIds`, `carga` (mapa recurso → cantidad; puede ir vacío) · única salida con pantalla de equipamiento — sales de tu propia residencia con el roster y el almacén delante · hoy en seco, botón «Salir al mundo» (falta la pantalla de equipamiento, `Features_Pendientes.md` §1.1)
- [x] `marcharA` — `heroeId`, `objetivo`: `{ tipo: 'asentamiento', id }` o `{ tipo: 'punto', punto: { x, y } }` · rectifica el rumbo de la columna en la que vas, sin límite de veces · clic en el mapa
- [x] `entrarEnAsentamiento` — `asentamientoId`, `heroeId` · en tu residencia disuelve la columna (tropas a tu campamento, carro al almacén); en cualquier otra la deja aparcada intacta · botón «Entrar» del panel de Selección
- [x] `salirDeAsentamiento` — `{ asentamientoId, heroeId }` · `src/ui/salidaDePlazaAjena.ts` (panel «Salir» de la plaza, `pintarSalidaAsentamiento` en `main.ts`)
- [x] `fijarPuerta` — `{ asentamientoId, heroeId, cerradaA[] }` · Centro urbano › Puerta (`ui/panelPuerta.ts`)
- [x] `vetarJugador` — `{ asentamientoId, heroeId, vetadoId, vetar }` · Centro urbano › Puerta

### Interacción en el mapa (Doc 5.12.3)

El menú de clic sobre algo en marcha. Los encuentros ya no son automáticos por pasar cerca: hay que haber
decidido acercarse (`inspeccionar`) o ir a por algo (`atacar`/`perseguir`) para que pase cualquier cosa.

- [x] `inspeccionar` — `{ heroeId, objetivo: { tipo: 'ejercito'|'caravana', id } }` · ficha de columna/caravana ajena (`ui/interaccionAjena.ts`)
- [x] `atacar` — `heroeId`, `objetivo`: la misma forma que `inspeccionar`, `{ tipo: 'campamento', id }` para un campamento de bandidos (Doc 1.9) o `{ tipo: 'asentamiento', id }` para asediar una plaza de otra Facción (Doc 5.12.4) · panel de Selección del mapa, **campamentos y plazas**; columnas y caravanas pendientes (`Features_Pendientes.md` §1.4). Con servidores de batalla devuelve `{ battleId }`
- [x] `perseguir` — `{ heroeId, objetivo: { tipo: 'ejercito'|'caravana', id } }` · ficha de columna/caravana ajena
- [x] `dejarDePerseguir` — `{ heroeId }` · ficha de la presa que persigues

### Composición de columna compartida (Doc 5.14)

Varios jugadores pueden compartir una columna. La política de quién entra la fija el Líder al parir la columna
(`movilizarEjercito.politicaDeUnion`, arriba); estos comandos gestionan la vida de esa composición después.

- [x] `unirseEnCampo` — `ejercitoId`, `heroeId` · pedir unirse a una columna que ya está en marcha · panel ⚑ Ejército y ficha del ejército en el mapa
- [x] `responderPeticionDeUnion` — `ejercitoId`, `heroeId`, `solicitanteId`, `aceptar` (boolean) · solo el Líder, y solo si su política es `preguntar` · panel ⚑ Ejército del mapa (Líder, política «decide el Líder»)
- [x] `separarseDelEjercito` — `heroeId` (sin `ejercitoId`: se sale de la columna en la que vas, y solo puedes ir en una) · panel ⚑ Ejército
- [x] `cederLiderazgo` — `ejercitoId`, `heroeId`, `sucesorId` · el Líder es quien formó la columna y el único que puede cancelar la marcha; para irse tiene que ceder antes · panel ⚑ Ejército del mapa (Líder)

### Batallas de Unity (doc 02 §3.1)

Solo tienen efecto si el backend declara `SERVIDORES_BATALLA` (en Render, hoy no). **No aplica al cliente web** (Unity): `Features_Pendientes.md`, «No aplica».

- [ ] `unirseABatalla` — `heroeId`, `battleId` · un compañero de Facción a distancia de ataque, mientras el bando no esté lleno · **Unity: no aplica**
- [ ] `cancelarBatalla` — `battleId` · solo quien la inició, antes de que empiece · **Unity: no aplica**

## Comandos que faltaban en este índice (contraste de 2026-10-09)

### Campamentos de mercenarios y almacén personal (Doc 1.9b)

- [x] `residirEnCampamento` — `heroeId`, `campamentoId` · pestaña Resumen del campamento, solo si no resides
- [x] `reclutarEnCampamento` — `{ tropaId, pagarCon?: 'almacenPersonal'|'carro' }` · Campamento › Tropa › Reclutar (`src/ui/pantallaCampamento.ts`)
- [x] `pedirPrestamo` — `tropaIds` · pestaña Tropa del campamento (leva comunal prestada)
- [x] `reponerPrestamo` — sin `params` · pestaña Tropa
- [x] `abrirAlijo` — `alijoId` · ficha del alijo en el mapa
- [x] `comprarEnCampamento` — `recurso`, `cantidad`; opcional: `campamentoId` · pestaña Mercado del campamento
- [x] `aportarARefundacion` — `recurso`, `cantidad`, `lado` (`almacen` \| `carro`) · pestaña Fondo
- [x] `retirarDeRefundacion` — `recurso`, `cantidad`, `lado` · pestaña Fondo
- [x] `comprarCaravanaDeRefundacion` — sin `params` · pestaña Fondo
- [x] `entrarEnCampamento` — `campamentoId`, `heroeId` · ficha del campamento (también con un ejército entero)
- [x] `salirDelCampamento` — `campamentoId`, `heroeId`, `escuadronIds`, `carga` · pestaña Salir
- [x] `guardarEnAlmacenPersonal` / `sacarDelAlmacenPersonal` — `recurso`, `cantidad` · panel del Carro
- [x] `ordenarEscuadras` — `escuadronIds` (orden de combate) · panel de la columna del mapa
- [x] `pasarAViveres` — ver Caravanas

### Residencia, capital y Facción

- [x] `dejarResidencia` — `{ heroeId }` · Centro urbano › Residencia (`ui/panelResidencia.ts`)
- [x] `designarCapital` — `{ faccionId, asentamientoId }` · Centro urbano › Residencia
- [x] `solicitarIngreso` — `faccionId` · pestaña Facción (la Facción puede exigir solicitud)
- [x] `responderSolicitud` — `faccionId`, `heroeId`, `aceptar` · pestaña Facción (quien tiene el cargo)
- [x] `admitirOtrasFacciones` — `faccionId`, `admitir` · `ui/panelAdmision.ts`

### Diplomacia (Doc 2.4)

- [x] `declararGuerra` — `{ faccionAId, faccionBId }` · Facción › Diplomacia (`ui/panelDiplomacia.ts`)
- [x] `proponerPaz` — `{ relacionId, faccionId }` · Facción › Diplomacia, en cada guerra (`ui/panelDiplomacia.ts`)

### Gestión local

- [x] `alternarReceta` — `asentamientoId`, `recurso`, `pausada` · Centro urbano › Recetas (`ui/vistaCiudad.ts`)
- [x] `comprarMirada` — `origen` (`{ tipo: 'asentamiento' \| 'campamento', id }`), `centro` · pestaña Taberna (Doc 5.12.10)
- [x] `comprarInformePlaza` — `origen`, `asentamientoId` · pestaña Taberna

### Ejércitos en campo

- [x] `organizarEjercito` — `heroeId`, `politicaDeUnion` (`aceptar` \| `preguntar`) · formación en campo
- [x] `cancelarFormacion` — `heroeId`

### Tecnología y Aedas (Doc 6)

Sin ninguna interfaz. La proyección trae `tecnologia` (era, logros y `propias`: `aparecidas`, `adoptadas`, `reveladas`); hoy solo se lee `adoptadas` para filtrar el reclutamiento.

- [x] `adoptarTecnologia` — `{ faccionId, tecnologiaId }` · barra del jugador › Tecnología › Tus tecnologías
- [x] `comprarTecnologiaAeda` — `{ asentamientoId, tecnologiaId }` · Tecnología › Aedas itinerantes en tus plazas
- [x] `empezarEpica` — `{ asentamientoId, aedaId, tecnologiaId }` · Tecnología › Aedas residentes
- [x] `abandonarEpica` — `{ asentamientoId, aedaId }` · Tecnología › Aedas residentes

### Presencia (no se usan como comando)

`conectarse` y `desconectarse` (`heroeId`) los sustituye el WebSocket de presencia: abrirlo conecta, cerrar el último socket desconecta.

## Comandos retirados del backend

No implementar: se retiraron en el Paso 11 del movimiento de ejércitos, sustituidos por encuentros que
dispara la geometría durante el tick (ver `src/engine/combate.ts` en el backend). Estuvieron listados en
versiones anteriores de este documento.

- `combateCampoAbierto`
- `interceptarCaravana`
- `atacarCampamentoBandidos` (ahora `atacar` con `objetivo: { tipo: 'campamento' }`)
- `fundarAsentamiento` (ahora `fundar`)
- `comprarCasa` y `fijarPoliticaDeAcceso` (descartados; la puerta es `fijarPuerta`)
- `alternarFaccionNpc` (las Facciones NPC las crea el admin)

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

### Sesión y partidas

- [x] `GET /v1/jugador/partidas` — partidas abiertas con `membresia` y el héroe propio (`nombre`, `nivel`, `faccion` con emblema) · pantalla «Partidas» tras el login (backend 02bd153); entrar = unirse si aún no eres miembro (`POST …/membresia`)
