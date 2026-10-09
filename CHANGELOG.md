# Changelog — Cliente de jugador

Formato: cada entrada anota la **fecha de sincronización con el backend** (`BronzeAgeFase0`) y contra qué
commit suyo se midió. La brecha detallada vive en `docs/Analisis_Brecha_Backend.md` y `docs/COMANDOS.md`.

## [0.27.0] — 2026-10-09 · paneles más grandes, Mercado unificado, trueques con emblema y interfaces limpias (texto tras «ⓘ»)

Segunda tanda de bloques en paralelo (detalle y mediciones en `docs/bloques/`). **Infraestructura:** `ui/ayuda.ts`: el texto explicativo vive tras un botón ⓘ que lo muestra y lo oculta; el estado abierto o cerrado sobrevive a los repintados y a las recargas (`localStorage`).

### Bloque G1 — emblema de la Facción en el mapa
- **Mapa**: cada asentamiento (propio, avistado y recordado) se dibuja con el **emblema de su Facción** (relleno con el color de emblema del sigilo, halo que contrasta) sobre un disco de su **color primario**; el recordado va con el disco tenue y el aro del color. Sin sigilo (Facción neutral o sin datos) sigue el punto de siempre. El tamaño es de lienzo, así que escala con el zoom como el punto; el radio de agarre de `asentamientoCercaDe` (unidades de mundo) no cambia.
- Los marcadores de jugadores (columnas, ejércitos, caravanas) y las zonas de influencia usan siempre `faccionColor` (primario del sigilo); las caravanas y columnas propias sin plaza de origen ya no caen en un ocre/color de reserva sino en el de TU Facción.
- `sigilo/emblemas.ts`: `pathDeEmblema(id)` devuelve el `Path2D` del emblema, cacheado.

### Bloque G2 — aprovechar el espacio de pantalla (plaza y campamento)
- Plaza y campamento en tres columnas: columna izquierda nueva (`.asent-izq`) con lo que antes flotaba sobre el mapa (tira de recursos, «Ejércitos»/«Salir al mundo», ficha del edificio elegido, leyenda del campamento), mapa cuadrado centrado (el mayor cuadrado que cabe, sin deformarse) y columna derecha más ancha (`clamp(360px, 27vw, 560px)`, texto +15 % desde 1700 px). La columna izquierda se oculta sola si no tiene nada visible. En ≤ 900 px se apila: mapa arriba, luego izquierda y derecha, con scroll de la pantalla (antes la columna derecha desaparecía a ≤ 820 px).
- Panel del jugador (`.jugador-panel`) más ancho (hasta 560 px); scrollbars oscuros; sin hueco vacío en la barra de la plaza.

### Bloque G3 — Mercado: una sola pestaña «Caravanas»
Mercado queda en **Órdenes · Caravanas · Trueques**. «Caravanas» reúne en UNA tarjeta por caravana lo que antes estaba en tres pestañas: estado como etiqueta (parada, preparándose, en camino, de vuelta, enganchada, aparcada), carros y animales, reservar, preparar viaje y cancelar, y la **escolta integrada** (cupo de Liderazgo con barra, escuadras cedidas con «Retirar» y botón «Añadir escolta» que despliega en la tarjeta las escuadras que se pueden ceder con «Ceder»; apagado con el motivo si no se puede). Las caravanas **aparcadas** en la plaza salen en la misma lista tras las de la flota («Aparcada en esta plaza · origen: X»), con su carga, cargar/descargar y «Enviar al origen». Los párrafos explicativos de Órdenes y Caravanas pasan detrás de un botón ⓘ (`mercado:ordenes`, `mercado:caravanas`). Se eliminan `ui/panelEscolta.ts`, `ui/panelAparcadas.ts`, la subpestaña Aparcadas de `ganchos.ts` y la entrada fija Escolta de `main.ts`.

### Bloque G4 — Trueques: etiqueta de ciudad y ayuda ⓘ
- Pestaña Trueques del Mercado: junto al nombre de cada ciudad va el emblema (con el color) de la Facción dueña y, debajo, más pequeño y tenue, «Facción · Nivel N». Se ve en los dos lados de cada trueque y en la elección de destino del formulario, que pasa de `<select>` a una lista de botones de radio con la etiqueta. Módulo reutilizable `ui/etiquetaCiudad.ts` (`etiquetaCiudad(p, asentamientoId, escapar)`, `datosCiudad`).
- Regla «ⓘ»: las reglas del canon (caducidad, plazo, reputación) y la nota de líneas por lado pasan tras botones de información (`mercado:trueques`, `mercado:trueques-proponer`).

### Bloque H1 — Interfaz limpia en la plaza (texto tras «ⓘ»)
- Plaza más limpia: el texto explicativo de Tesorería, Fundación, Recetas y ficha de edificio, Residencia, Puerta, Aliados, Muralla, Reclutamiento, Taberna e intel, y de las secciones Producción, Subida de nivel, Nombre de la ciudad, Cargos y pestañas bloqueadas de Centro urbano vive ahora detrás de un botón «ⓘ» (`ui/ayuda.ts`) junto al título de cada sección. Datos, estados, errores y motivos cortos de botones apagados siguen visibles. Texto visible de las 15 subpestañas medidas (proyección fabricada): 10 776 → 8 296 caracteres (-23 %); sin contar Tesorería (casi todo datos) e Información (no tocada): 6 405 → 4 252 (-34 %).
- La muralla comparte HTML con `#/legacy`: la ayuda se añadió en `pestanaMuralla.ts` y `panelMuralla.ts` ya no deshabilita el botón ⓘ al apagar los de acción.

### Bloque H2 — Interfaz limpia: mapa, ejércitos y salida al mundo
- Los paneles del mapa, de los ejércitos y de la salida al mundo muestran sobre todo datos y controles: las explicaciones, reglas y avisos largos viven tras un botón «ⓘ» (`ui/ayuda.ts`) que se abre y se cierra y sobrevive al sondeo. Claves: `mapa:ficha-plaza`, `mapa:ficha-bandidos`, `mapa:ficha-mercenarios`, `mapa:ficha-alijo`, `mapa:fundar`, `mapa:mercado-plaza`, `ejercito:dentro|formacion|lider|integrante|personal|otros|ficha`, `caravanas:columna`, `columna:tropa`, `ajeno:persecucion|motivos`, `plaza:unirse`, `plaza:salir-ajena`, `salida:modo`, `salida:carga`, `convocatoria:espera|visita|tropa`, `batalla:formacion`.
- Los motivos de botón apagado de una línea (≤ 70 caracteres) siguen visibles; los largos van en el `title` del botón y en la ayuda. El motivo general del Mercado de la plaza sale una vez, no en cada orden.

### Bloque H3 — Interfaz limpia: campamento y paneles del jugador
- Interfaz limpia en el campamento de mercenarios y en los paneles del jugador: el texto explicativo (introducciones, reglas, avisos largos, notas al pie) vive ahora detrás de un botón «ⓘ» (`ui/ayuda.ts`) junto al título de cada sección; datos, estados, errores y motivos cortos de botón apagado siguen visibles.
  - Campamento: Resumen (`camp:resumen`), Salir (`camp:salir`), Tropa (`camp:reclutar`, `camp:prestamo`), Mercado (`camp:mercado`), Fondo (`camp:fondo`), Taberna (`intel:taberna`, `intel:mirada`, `intel:informe`, `intel:foto`). El Resumen gana un dato «Resides aquí: Sí/No».
  - Paneles: Tecnología (`jugador:tec-era`, `jugador:tec-adoptar` con la tarifa de adopción, `jugador:tec-residentes`, `jugador:tec-itinerantes`), Carro (`jugador:carro`, `jugador:botin`), Héroe (`jugador:heroe-escuadras`, `jugador:heroe-loadouts`), Avisos (`jugador:avisos`), Asentamientos (`jugador:fundar`, `jugador:asent-produccion`, `jugador:asent-militar`).
  - Facción: `faccion:elegir`, `faccion:crear`, `faccion:creditos`, `faccion:cargos`, `faccion:diplomacia` (con los costes de romper alianza / liberar vasallo, que además van en el `title` de su botón), `faccion:anexion`, `faccion:fusion`, `faccion:admision`, `faccion:abandonar`.
  - Pantalla «Tu héroe» (crear héroe): `heroe:crear`.

## [0.26.2] — 2026-10-09 · el sigilo completo en el mapa

### Cambiado
- **Mapa del mundo:** cada asentamiento se dibuja con el **sigilo completo** de su Facción (escudo, campo, orla y emblema), como lo muestra el cliente de administración, y no solo con el símbolo sobre un disco. El sigilo se rasteriza una vez desde su SVG (`sigilo/lienzo.ts`, `imagenDeSigilo`) y el mapa se repinta al cargar; mientras tanto, y sin sigilo, queda el punto de siempre. El asentamiento recordado va tenue.

## [0.26.1] — 2026-10-09 · tope de la flota, enfriamiento de residencia y filtro por partida

### Añadido
- **Tope de la flota del Mercado** (backend `1e5351c`, Doc 3.13.2): Mercado › Caravanas dice cuántas caravanas y cuántos carros tiene la plaza frente al tope de su nivel de Mercado (`cupoCaravanas` 2/4/6, `cupoCarros` 3/9/18, leídos del balance) y apaga «Crear caravana» y «＋ Carro» con el motivo cuando la flota está llena. Mover un carro no gasta cupo.
- **Ficha de orden ajena:** si la plaza a la vista no tiene Mercado activo (las avistadas traen sus edificios activos), lo dice en vez de ofrecer tomar la orden.

### Cambiado
- **Residencia:** el aviso de «dejar la residencia» dice cuántos días de mundo hay que esperar para volver a mudarse, leídos del balance (`CIUDADANIA.cooldownCambioResidenciaDias`), en vez del aviso genérico.
- **Tiempo real:** se ignora un evento cuyo `gameId` no es el del socket (el servidor ya lo manda, backend `9ab4e62`).

## [0.26.0] — 2026-10-09 · pendientes del cliente construidos por bloques · sync con `BronzeAgeFase0@02bd153` (`main`, sin push)

Once bloques en paralelo sobre los ganchos de `ui/ganchos.ts` (subpestañas de la plaza, fichas y selectores del mapa). El detalle de cada uno, con sus comandos y lo que quedó sin verificar en vivo, está en `docs/bloques/`.

### Bloque A1 — Plaza › Centro urbano: Muralla, Puerta y Residencia
- Plaza › Centro urbano: tres subpestañas nuevas.
  - **Muralla**: trazar/ampliar (`comprometerRecinto`), mejorar (`mejorarRecinto`) y abandonar (`abandonarRecinto`) recintos desde la plaza, con el mismo HTML que `#/legacy`. Los botones se desactivan con el motivo cuando no resides o la plaza no llega al nivel mínimo.
  - **Puerta**: cerrar la plaza por grupos (neutrales, aliados, enemigos, aedas) con `fijarPuerta` (Gobernador o Rey de la Facción) y vetar / levantar el veto a jugadores concretos con `vetarJugador` (solo Gobernador; no se ofrece vetar a residentes).
  - **Residencia**: `dejarResidencia` con confirmación (dice qué se pierde) y `designarCapital` (solo al Rey; explica Palacio activo y enfriamiento de 14 días de mundo).
- Tipos: `Asentamiento.puertaCerradaA / vetadosIds / capitalDeFaccionId`, `Faccion.capitalDesignadaEn`.

### Bloque A2 — Tesorería y Caravana de Fundación desde la plaza
- Plaza › Centro urbano › **Tesorería**: el Tesorero calibra la reserva de recursos de la plaza (0–999 por recurso, `calibrarReservaManual`); y cada cargo (Gobernador, Tesorero, Maestro de Obras, General, Sacerdote) activa las políticas de su pool (`activarPolitica`), con su efecto, los slots usados/máximos, lo que expira cada una en vigor y el motivo cuando no se puede (cargo vacante, otro titular, sin slots, ya activa, no estás presente). El catálogo, los slots y la duración salen de `GET /v1/balance`.
- Plaza › Centro urbano › **Fundación**: lanzar la Caravana de Fundación desde la plaza (`lanzarCaravanaFundacion`) y desarmarla (`desarmarCaravanaFundacion`). Enseña el coste completo con lo que falta en rojo, los cinco requisitos con su motivo (residente presente, nivel 2, enfriamiento compartido con las comerciales, cupo del Cap de Fundación, coste en el almacén) y las caravanas de fundación de esa plaza con su estado, caducidad y botón de desarmar.
- Riel «Fundar» del mapa: el texto y la detección de la caravana valen también para la lanzada desde una plaza (antes asumía siempre un campamento).
- `apiCliente.ts`: accesores del balance `costoCompletoDeCaravanaDeFundacion`, `cooldownDeCaravanaMinutos`, `capDeFundacion`, `catalogoDePoliticas` (`costoDeRefundacion` ahora parte del primero).

### Bloque B — Reclutar y reponer tropa en un campamento de mercenarios
- Campamento › Tropa: nueva sección «Reclutar». Lista las tropas de los edificios militares del campamento (barracón, galería de tiro, caballerizas, al nivel `MERCENARIOS.nivelEdificios`; no la leva del Centro Urbano) con su edificio, hombres, escalón, equipo que se cobra en oro y lo que ya tienes de cada una. Botón «Reclutar» o «Reponer N» (deshabilitado si la escuadra está completa) y selector «Pagar con» (almacén personal o carro de tu columna, con el oro de cada uno). El rechazo del servidor sale tal cual (sin oro, sin reclutas, tropa no desbloqueada por el campamento, columna lejos…). Si no resides en el campamento, la pestaña explica que hay que residir.
- `apiCliente.ts`: accesor `tropasReclutables()` (catálogo `TROPAS_RECLUTABLES` + `MERCENARIOS.nivelEdificios` del balance).

### Bloque C1 — columnas, caravanas y héroes ajenos en el mapa
- **Interacción con lo ajeno en el mapa (Doc 5.12.3).** Un clic cerca de una columna (ejército o columna personal) o de una caravana avistada abre su ficha, sin mandar marchar a tu columna. La ficha enseña la facción, la distancia a tu columna, los héroes que van con su ficha pública (clase, nivel, herida, escuadras y equipo) y los botones del canon: **Inspeccionar** (desde 40; lo que se ve —composición de una columna, carga de una caravana— queda en la ficha con su antigüedad), **Perseguir** / **Dejar de perseguir**, **Atacar** (a una caravana suelta, **Interceptar**). Los botones se apagan con su motivo: lejos, herido, sin columna, ejército contra columna personal, aliado, solo héroes heridos, caravana adjunta a un ejército, un ejército no persigue caravanas, formación que no se mueve, sin soldados, junto a un campamento de mercenarios.
- **«Te persiguen» con respuesta.** El aviso rojo de la barra abre (en el mapa) la ficha de quien te persigue, con las dos respuestas del canon: huir (marchar a otro sitio o entrar en una plaza/campamento) o **Plantar cara** (atacar al perseguidor a 15).
- Tipos de la proyección: `CaravanaAvistada`, `ProyeccionJugador.caravanasAvistadas`, `Ejercito.persiguiendo`.

### Bloque C2 — persistir la vista del mapa (Features_Pendientes 2.1.6)
- El mapa recuerda su vista: zoom, desplazamiento, panel del riel abierto (Lo que llevas / Mis cosas) y la selección. Se conserva al ir a la plaza o al campamento y volver, y al recargar la página. Se guarda en `localStorage` con una clave por partida, así que no se mezcla entre partidas ni al cerrar sesión; sin `localStorage` el mapa funciona igual, sin memoria.
- La selección guardada solo se restaura si lo seleccionado sigue existiendo (si no, se descarta en silencio) y restaurarla no manda ninguna orden. El zoom y el desplazamiento guardados se vuelven a acotar al tamaño del mapa. La previsualización de Fundar no se restaura.
- Regla del centrado: con vista guardada manda ella; la primera vez (sin vista), el mapa se centra en tu columna.

### Bloque C3: salir de una plaza ajena y reabastecer a los aliados
- Plaza donde NO resides: el botón de la barra pasa a «Salir» y abre un panel que explica que tu columna quedó aparcada a la puerta y que salir la retoma tal cual (tropa y carro), sin pantalla de equipamiento (`salirDeAsentamiento`). En tu residencia sigue siendo «Salir al mundo» (`salirAlMundo`, con tropa y carga). Antes, en una plaza ajena el panel ofrecía `salirAlMundo`, que el servidor rechaza («Solo se sale al mundo desde la propia residencia»).
- Centro urbano › subpestaña «Aliados»: interruptor para abrir o cerrar el almacén de la plaza a los ejércitos aliados que pasan (`alternarReabastecerAliados`). Muestra el estado actual y avisa de quién puede cambiarlo (Gobernador o Tesorero residente y presente); el rechazo del servidor se enseña tal cual.

### Bloque D1 — Trueques y caravanas aparcadas (plaza › Mercado)
- **Mercado › Trueques** (plaza): lista los acuerdos de trueque de la plaza (en curso y cerrados) con sus líneas (varias por lado, con progreso entregado/pactado cuando está en vigor), estado, plazo y a quién le toca contestar. Los recibidos sin contestar se aceptan o rechazan (`aceptarTrueque`/`rechazarTrueque`, solo residentes del lado que contesta). Formulario para proponer un trueque a otra plaza conocida (hasta 3 líneas por lado, recurso + cantidad). Texto breve con la regla del canon: una propuesta sin contestar caduca sin castigo; el plazo corre desde el sí; vencer sin cumplir resta reputación en proporción a lo no entregado (Doc 2.7).
- **Mercado › Aparcadas** (plaza): las caravanas `aparcada` de tu Facción que hay en esta plaza, con su carga; cargar/descargar un recurso entre su carro y el almacén de la plaza anfitriona, y enviarla a su origen. Se apagan, con el motivo, si no eres residente del origen de la caravana.
- Tipos: `AcuerdoTrueque` con `lineasA`/`lineasB` (`LineaTrueque`) como el servidor (antes tenía la forma antigua de un solo recurso); `Caravana.contenido`.
- `.asent-subtabs` ahora hace salto de línea (con cinco subpestañas en Mercado se cortaba).

### Bloque D2 — Caravanas adjuntas a la columna
- **Caravanas de tu columna** en el panel «Lo que llevas» (riel del mapa, ⚔): lista de las caravanas enganchadas con su estado y lo que cargan, y botón **Soltar**; lista «Para enganchar» con tus caravanas sueltas o aparcadas, ordenadas por cercanía, y el motivo cuando no se pueden enganchar (otra Facción, ya va con otro ejército, la lleva su titular, ya despachada, demasiado lejos); **Cargar** desde una plaza de tu Facción a tu alcance (plaza, recurso y cantidad); **Entregar** por cada trueque activo en que tu Facción debe algo, con lo que falta y el aviso de por qué no (caravana vacía, lejos de la plaza que recibe). Los rechazos del servidor se ven bajo el bloque.
- Panel «Ejército»: avisa cuántas caravanas lleva la columna y dónde se gestionan.
- Tipos: `Caravana` gana `contenido` y `caducaEn`; `AcuerdoTrueque` pasa a `lineasA`/`lineasB` (`LineaTrueque`), que es lo que manda el servidor.

### Bloque D3: tomar una orden de mercado ajena en persona
- **Mercado de la plaza** en la ficha del mapa de un asentamiento: lista las órdenes activas de esa plaza que trae la proyección (compra/venta, recurso, pendiente, precio, caducidad) y, por cada una, un campo de cantidad y el botón «Comprar» (orden de venta de la plaza) o «Vender» (orden de compra). Se avisa con el motivo cuando no se puede: sin columna en el mundo, a más de 10 de la puerta, no eres el Líder de la columna u orden caducada. Al servirse, el aviso del mapa dice cuánto se sirvió, por cuánto oro y la comisión; si el servidor rechaza, el mensaje sale en la ficha.

### Bloque E1 — Pestaña Facción: cargos, abandono y diplomacia
- Pestaña **Facción**: el Rey puede **traspasar el trono** y **designar al Embajador** (selectores entre los ciudadanos, con confirmación al traspasar), y cualquier ciudadano puede **dejar la Facción** (confirmación que explica la sucesión del trono, la embajada libre, la pérdida de casa y cargos locales y el enfriamiento de 7 días para crear otra Facción).
- Nueva sección **Diplomacia** en la pestaña Facción: lista las relaciones activas de tu Facción (alianza, vasallaje como señora o como vasalla con su tributo, guerra con el estado de la paz) y ofrece a Rey y Embajador solo lo que cada relación permite: romper la alianza (avisa de −12 de reputación), liberar a un vasallo (+6), rebelarse siendo vasalla (confirmación explícita: guerra al señor y a sus vasallos, trueques cancelados, −10 de reputación al señor), ofrecer o aceptar la paz. Formulario para proponer alianza, imponer vasallaje (recurso y cantidad de tributo por minuto) o declarar guerra (confirmación: se arrastra a señor y vasallos del rival).

### Bloque E2 — Tecnología y Aedas
- Nuevo panel **Tecnología** en la barra del jugador (junto a Héroe, Carro, Facción, Avisos): Era del mundo y logros cumplidos; tus tecnologías (aparecidas, con botón *Adoptar*; adoptadas; reveladas por un Aeda con su hito y qué parte ya cumples); quién adopta y cuánto cuesta según la Era; Aedas residentes de tus plazas con su épica (capítulo, hechos, enfriamiento), *Empezar épica* para una tecnología revelada y *Abandonar*; y *Comprar* una tecnología revelada a un Aeda itinerante detenido en una plaza tuya. Los botones se deshabilitan con el motivo (no eres Rey/Gobernador/Sacerdote, no estás en la plaza); el rechazo del servidor se muestra tal cual.

### Bloque F — Vista de la ciudad
- **Plaza › lienzo de la ciudad:** clic en un edificio abre una ficha flotante (tipo, nivel, estado, producción por minuto, recetas del nivel con sus insumos por unidad) con las acciones que el backend permite de verdad: **Mejorar** (con su coste, requisitos y obra, sacados de `EDIFICIO_CATALOGO`) y **Quitar de la cola** (si está en cola), solo para Gobernador / Maestro de Obras. No hay pausa ni prioridad por edificio en el backend, así que no se ofrecen.
- **Resaltado cruzado:** elegir una fila de Centro urbano › Edificios resalta en el lienzo todos los edificios de ese tipo (el elegido con trazo fuerte; repetir el clic recorre los de un tipo); elegir uno en el lienzo marca su fila.
- **Tooltip:** ahora lleva la producción por minuto del edificio (la proyección la da por tipo: se reparte entre los activos, «≈» si hay varios) y avisa de que el consumo por edificio no lo publica el servidor.
- **Centro urbano › Recetas:** lista las recetas de los talleres activos (una por recurso) con taller, ritmo máximo, insumos por unidad y bloqueo por tecnología; `alternarReceta` para parar/reanudar.
- **Centro urbano › Información:** el glosario de `#/legacy`, ahora dentro de la plaza.
- **Escala del lienzo:** el radio de la vista se deriva del extremo real de edificios y murallas (pasos de 20, mínimo 60, sin tope en 220), así una plaza pequeña no se ve diminuta y una grande no se recorta.

## [0.25.0] — 2026-10-08 · la plaza por edificio, reclutar, mercado y caravanas, y pantalla de partidas · sync con `BronzeAgeFase0@02bd153` (`main`, sin push)

### Añadido
- **Pantalla de partidas** (`ui/pantallaPartidas.ts`): el login ya no pide el ID de partida. Tras entrar con la cuenta se ve la lista de partidas abiertas (`GET /v1/jugador/partidas`), y en cada una el héroe del jugador —nombre, Facción con su emblema y nivel— o «aún no has entrado»; se elige una y el botón de abajo entra (si aún no eres miembro, antes te une). «Cambiar de partida» en el menú de la esquina vuelve a la lista sin cerrar sesión.
- **Reclutamiento** (`ui/reclutamiento.ts`, `reclutarTropa`): una pestaña con todas las tropas militares juntas por edificio. Solo salen las que la Facción puede formar ya (tecnología adoptada y edificio activo del nivel pedido); cada fila dice cuántos hombres, de qué población salen, el coste de equipo (en rojo lo que falta) y por qué no se puede ahora (escuadra al completo, fuera del campamento, no resides). Reclutar o reponer.
- **Mercado** (`ui/panelMercado.ts`): *Órdenes* (colocar compra/venta con precio opcional y ver las de la plaza, `colocarOrdenMercado`), *Caravanas* (crear casco, añadir carros, comprar animales, mover carros, reservar, preparar viaje con destino y carga, cancelar la preparación) y *Escolta* (el panel que ya existía).

- **Cambiar el nombre de la ciudad** (`renombrarAsentamiento`): en Centro urbano › Resumen, para los residentes; el nombre de la barra se actualiza al momento.

### Cambiado
- **La plaza se organiza por edificio** en la columna derecha: *Centro urbano* (resumen, edificios, producción, cola, cargos y «Hacer de esta plaza mi base»), *Reclutamiento*, *Taberna* (intel) y *Mercado*. Taberna y Mercado salen desactivadas con «necesitas construir …» hasta tener el edificio activo. La barra superior queda con «Ejércitos» y «Salir al mundo».

### Pendiente (backend)
- El balance no publica el coste de carros/animales ni el oro por soldado del reclutamiento: se enseña lo que el servidor rechaza, no el precio de antemano.

## [0.24.0] — 2026-10-08 · repintado mínimo de los paneles y cambiar tu base a una plaza

### Añadido
- **«Hacer de esta plaza mi base»** en la barra de la plaza (`cambiarResidencia`, que el backend ya tenía y el cliente no usaba): solo en una plaza de tu Facción donde no resides. Pide confirmación diciendo qué pierdes (la tropa prestada del campamento anterior, la guarnición) y el backend valida puerta y enfriamiento. En un campamento ya estaba «Residir aquí» (pestaña Resumen).

### Cambiado
- **Repintado mínimo de todos los paneles** (`ui/repintado.ts`, `pintar`): cada panel que se rehacía con el sondeo de 3 s pasa por una sola función que (1) **no toca el DOM si el HTML no cambió** —los botones siguen siendo los mismos nodos— y (2) si cambió, devuelve al jugador lo suyo: el valor de los controles que **tocó** (casillas, cantidades, listas, texto), el foco con su cursor y el scroll; lo que no tocó toma el valor nuevo del servidor. Cada pestaña o panel es un «ámbito» y empieza limpio. Cubre fichas de selección del mapa, panel del jugador (héroe, carro, avisos, Facción), riel del mapa (lo que llevas, ejército, mis cosas, fundar), barra de víveres, las pestañas del campamento, los paneles flotantes de la plaza (cargos, intel, salida, escolta, ejércitos), la columna de edificios, los recursos de la ciudad y la lista de ejércitos en preparación. Se retiran los parches `dataset.pintado*` y las reglas «no repintes mientras hay un campo con foco».

## [0.23.0] — 2026-10-08 · un ejército entra entero en un campamento o plaza, y tu tropa en la preparación · sync con `BronzeAgeFase0@e26f167` (`main`, sin push)

### Añadido
- **Entrar con el ejército**: en la ficha de un campamento de mercenarios o de una plaza de tu Facción, el Líder pulsa «Entrar con el ejército» (`entrarEnCampamento` / `guarnecer`): el ejército se desarma en la puerta, los que residen entran con su tropa y su carro y los demás, de visita. Un no Líder lo ve desactivado con el motivo; la ficha avisa de que las caravanas adjuntas tienen que ser del lugar. Aviso a todos los del ejército.
- **Ejército en preparación**: se ve la tropa de **cada integrante** (nombre, nivel, moral, hombres) y la tuya es editable: casillas para elegir qué escuadras salen y flechas para su orden de combate, con «Guardar cambios» / «Descartar» (`cambiarSeleccionDeConvocatoria`). Las de los demás, solo lectura. Aviso a los demás cuando alguien cambia su tropa.

### Corregido
- El rechazo de una acción de la ficha de selección (entrar en un campamento o plaza, etc.) se borraba al siguiente sondeo y el botón parecía no hacer nada: ahora el mensaje se conserva mientras la ficha siga abierta.

## [0.22.0] — 2026-10-08 · ejército en preparación y sin destino fijo · sync con `BronzeAgeFase0@468c47b` (`main`, sin push)

### Añadido
- **Ejército en preparación dentro de un campamento o una plaza** (`ui/convocatoria.ts`): en «Salir» / «Salir al mundo», «Ejército» → convocas (abierto o decide el Líder) y los héroes de tu Facción que estén en ese lugar ven «Ejércitos que se están preparando aquí» y se unen con la tropa y la carga que marquen. Espera sin límite de tiempo: el Líder ve a los integrantes y las peticiones (Aceptar/Rechazar) y pulsa **«Salir con el ejército»** (salen todos juntos) o **«Cancelar la salida»** (nadie se mueve); un integrante puede **separarse** sin salir. Avisos por evento a todos los implicados.

### Cambiado
- **Sin destino fijo**: el ejército sale quieto en la puerta y su **Líder lo dirige con clics en el mapa**, las veces que quiera. Quitado el selector de destino de las pantallas de salida y el mapa de elegir destino. Un miembro que no es Líder recibe «Solo el Líder decide a dónde va el ejército» al hacer clic; una formación sin 3 héroes avisa de que no se mueve. Textos de «destino que no podrás cambiar» corregidos.
- «Unirse desde la plaza» respeta la política del ejército: con «cerrado» sale desactivado con el motivo.
- El HTML de la pestaña Salir ya no depende de lo elegido (modo, política): el sondeo no la repinta ni borra la tropa y la carga marcadas.

## [0.21.1] — 2026-10-08 · los plazos de ejército en tiempo real y el aviso de la formación

### Corregido
- Reproducido con dos cuentas en la partida viva: «el ejército se destruye» porque una **formación** (con menos de 3 héroes) se deshace a los 10 min de MUNDO, y ese mundo corre a ~114×: dura unos 6 s reales. Es un plazo del backend (pedida su corrección); desde el cliente, los plazos (formación, petición de unión) se enseñan ahora en **segundos reales**, midiendo el ritmo del mundo entre sondeos (`medirRitmoDeMundo`).
- Al unirte a una formación el aviso decía «ahora sigues su destino»; ahora dice que aún no es un ejército, que hacen falta 3 héroes y cuánto queda.
- El panel ⚑ de una formación avisa de que con menos de 3 héroes no se mueve.

## [0.21.0] — 2026-10-08 · formar y unirse a ejércitos · sync con `BronzeAgeFase0@74413b0` (`main`, sin push)

### Añadido
- **Panel ⚑ «Ejército»** en el riel del mapa (`ui/ejercitos.ts`), con lo que toca según tu columna: personal (organizar un ejército o unirte), formación (cancelar / separarme), ejército (Líder: responder peticiones, acampar, replegar, ceder el mando; el resto: separarme). Lista los ejércitos y formaciones de tu Facción con Líder, héroes, estado, política de unión y distancia; «Unirme» se desactiva con el motivo (lejos, columna no personal, cerrado, sin Facción, petición ya enviada).
- **Unirse a un ejército ya formado** (antes solo se podía a las formaciones): desde el panel o seleccionándolo en el mapa (ficha). Con política «decide el Líder» el solicitante ve «Petición enviada» y el **Líder recibe el aviso al momento** (evento `columna.union_pedida` con `liderId`, y sondeo de respaldo) con Aceptar/Rechazar y cuenta atrás. Avisos de aceptada/rechazada al solicitante.
- **Salir como ejército** desde un campamento (`salirDelCampamento` con política y destino) y desde tu plaza (`movilizarEjercito`, con `carga` del carro): «Columna personal / Ejército», política (abierto, decide el Líder; cerrado solo desde la plaza) y destino elegido con un clic en el mapa del mundo (`ui/salidaComoEjercito.ts`).
- **Unirse desde tu plaza** (`unirseAEjercito`): botón «Ejércitos» en la plaza, con la tropa que aportas y los ejércitos de tu Facción a ≤ 60 de ella (`ui/unirseDesdePlaza.ts`). El backend aún no aplica la política de unión desde la plaza, y el cliente tampoco la oculta.

### Cambiado
- «Mi columna» sale de «Mis cosas» y vive en el panel ⚑.

## [0.20.0] — 2026-10-08 · víveres · sync con `BronzeAgeFase0@b7c097a` (`main`, sin push; BALANCE_VERSION 13)

### Cambiado
- **La barra de comida es ahora la de VÍVERES**: `heroe.viveres` frente a lo que cabe a un héroe (`LOGISTICA.capacidadViveresPorHeroe`, 350, del balance público). Los víveres son el trigo que come la columna (en marcha, media ración; acampada, una décima parte de eso: `factorConsumoEstacionado`), van siempre contigo y no se descargan. En un ejército el backend suma los de todos, pero la proyección solo trae los tuyos: se enseñan los tuyos.
- **«＋ desde el carro»** al final de la barra: abre un selector (barra y número, hasta el menor entre el trigo del carro y el hueco de tus víveres) y envía `pasarAViveres { cantidad }`. Se desactiva, con el motivo en el tooltip, si no eres el Líder, el carro no lleva trigo o los víveres están llenos.
- El carro ya no se come: es solo carga, y todo su trigo se puede guardar (desaparece la «ración gratis» no guardable, `Ejercito.racion`). Textos de moral, deserción y salida de campamento hablan de víveres.
- Las escuadras prestadas salen completas: el tamaño sale de `unidadesPorDefecto` del balance, no del «15 hombres» fijo.

## [0.19.1] — 2026-10-08 · «Aceptar» una solicitud no hacía nada

### Corregido
- Los avisos de error de los botones de Facción (aceptar/denegar solicitudes, anexión, fusión, admisión…) solo se pintaban en el mapa: en campamento y plaza se perdían en silencio y el botón parecía muerto. Ahora salen en un aviso flotante en cualquier pantalla.
- El escudo de la Facción generaba un id nuevo en cada pintado, así que el panel se reconstruía en cada sondeo (3 s) y se llevaba por delante clics y mensajes. El id depende ahora de la forma.
- Backend (causa): al hacerse ciudadano de una Facción por cualquier vía (crearla, fundar una plaza, ser aceptado) se cancelan todas sus solicitudes de ingreso vivas en las demás, y el tick borra las que ya estuvieran caducadas en partidas guardadas; antes quedaban en la lista del Rey y aceptarlas daba `faccion.invalida`. **Hace falta reiniciar el servidor.**

## [0.19.0] — 2026-10-08 · escolta de caravanas · sync con `BronzeAgeFase0@3d884fd` (`main`, sin push)

### Añadido
- **Panel «Escolta»** en la plaza (`ui/panelEscolta.ts`): por cada caravana comercial de tu plaza, una barra de Liderazgo de la escolta («64/100 pts · quedan 36»; `escoltaLiderazgo { usado, cupo }` lo da el backend, no se calcula aquí), tus escuadras cedidas con «Retirar» y las que puedes ceder con «Ceder» (desactivada, con el motivo, si su coste no cabe). Solo con la caravana parada en su origen y siendo residente; el resto, en solo lectura. Ceder no gasta tu Liderazgo (regla del backend). Comandos `asignarEscolta` y `quitarEscolta`.
- **Coste de Liderazgo** (♛ N) como marca pequeña junto al nombre de cada escuadra en «Lo que llevas», las listas del campamento (resumen, Tropa, Salir) y la salida de la plaza.

## [0.18.1] — 2026-10-07 · el fondo de refundación enseña el precio y lo que falta

### Cambiado
- **Fondo del campamento**: muestra el precio de la Caravana de Fundación (derivado del balance público: materiales iniciales + granja + viviendas + madera extra, por el porcentaje de refundación), una barra total y una por material con lo reunido por tu Facción, «faltan N» y lo que has puesto tú. «Aportar» enseña lo que tienes y lo que falta de cada material, y tiene «Lo que falta». «Comprar caravana» solo se activa con el precio completo y dice qué falta.

## [0.18.0] — 2026-10-07 · carga del carro al salir (campamento y plaza) y oro de botín separado

### Añadido
- **Salir al mundo desde tu plaza** ya no sale «en seco»: el botón abre un panel donde eliges la tropa que sacas y lo que cargas en el carro del almacén de la plaza (`salirAlMundo.carga`; el backend reserva el trigo que necesita la tropa que se queda).
- Cargar el carro al salir de un campamento y de una plaza comparte módulo (`ui/cargaDeSalida.ts`): cada recurso con lo que hay, cantidad, botón «Todo» y el total contra la capacidad del carro (500). Explica que al volver a entrar a un campamento el carro regresa a tu almacén personal.

### Cambiado
- El **oro de botín** va en su propio recuadro, fuera del carro y del almacén, con la explicación de para qué sirve y que nunca se pierde.

## [0.17.1] — 2026-10-07 · el oro de botín y el carro, explicados

### Cambiado
- Los textos de bandidos decían que su botín iba al carro: es falso. El oro va a `oroDeBotin`, aparte del carro y del almacén, y el backend nunca lo quita al perder (solo se pierde la mitad del carro). El panel del carro lo dice.

## [0.17.0] — 2026-10-07 · barra de comida en el mundo abierto

### Añadido
- **Barra de comida** abajo en el mapa: el trigo que queda en el carro de tu columna, que baja con la marcha (se vacía respecto al máximo que has llevado en el viaje y se pone roja por debajo del 25 %). Con el cursor encima explica qué pasa si se acaba.

## [0.16.2] — 2026-10-07 · «sin membresía» con salida · sync con `BronzeAgeFase0@501459d` (`main`, sin push)

### Cambiado
- Entrar a una partida donde tu cuenta no tiene membresía vigente ya no deja un callejón: el mensaje explica el motivo y hay un botón «Unirme a esta partida».
- Backend: unirse reabre una membresía terminada (p. ej. la cerró el borrado de una partida que luego se recreó con el mismo id) en vez de dar 409; antes el cliente ignoraba ese 409 y el 403 siguiente no tenía salida. **Hace falta reiniciar el servidor** para que lo aplique.

## [0.16.1] — 2026-10-07 · campamentos de mercenarios como en el cliente admin

### Cambiado
- Los campamentos de mercenarios se dibujan como en el cliente admin: cuadrado azul con el anillo de la zona de protección (radio 60, donde nadie inicia un combate).

## [0.16.0] — 2026-10-07 · lo que llevas, errores con motivo, botín en el informe y mercado nuevo · sync con `BronzeAgeFase0@a0945dd` (`main`, sin push)

### Añadido
- **«Lo que llevas»** (⚔ en el riel del mapa, `ui/panelColumna.ts`): la tropa de tu columna en su orden de combate, con hombres, moral y si es prestada,
  flechas para cambiar el orden (comando nuevo del backend `ordenarEscuadras`: la primera entra primero, en la batalla de Unity y en el combate con
  números) y debajo el carro y el almacén personal.
- **Mercado del campamento rediseñado**: lista de bienes en venta (con su precio por unidad) y, del elegido, en venta, lo que ya tienes (almacén o carro),
  el cupo de hoy, tu oro, la cantidad (número y barra) y, en vivo, cuánto pagas, cuánto te queda y cuánto tendrás; después, «Comprar N por T de oro». Tras
  comprar dice lo que se sirvió de verdad. Precio y cupo los manda el backend (`mercadoCampamento`).
- **Botín y pérdida en el informe contra bandidos**: si cae, el oro de botín que ganas; si aguanta, lo que pierdes del carro (backend `oroPorHeroe` /
  `carroPerdido`).
- **Aviso de deserción por hambre**: agrupado por tanda («Desertan por hambre: Milicia −2…»). El backend no le mandaba ese evento a nadie en una columna
  salida de un campamento; ahora lleva el `heroeId`.

### Cambiado
- **Los errores dicen el motivo real**: el backend manda `detalleError` (p. ej. «La columna no lleva soldados con los que atacar.») y es lo que se enseña;
  el texto genérico de `combate.invalido` ya no sugiere distancia o herida.
- «Atacar» avisa antes de enviar si tu columna no lleva soldados vivos o estás a menos de 60 de un campamento de mercenarios.

### Investigado: «no me deja atacar a menos de 15 y sin estar herido»
Reproducido el mismo recorrido (crear Facción, préstamo, salir, ir a 6 del campamento, atacar) contra el backend actual: el ataque se acepta. Tu partida ya no
existía para leer su rechazo, y el backend solo devolvía el código, así que no se puede saber cuál de sus causas fue (columna sin soldados vivos —p. ej.
por deserción—, escuadras de un héroe herido…). Desde ahora el mensaje dice el motivo exacto. Encontrado de paso: una columna sin ración deserta hasta 0
sin avisar (corregido arriba), y tras reiniciar el servidor la recuperación de ticks puede dejarla así.

## [0.15.0] — 2026-10-07 · tiempo real, estados activos y Facción estable · sync con `BronzeAgeFase0@4bf2ac6` (`main`, sin push)

### Añadido
- **Tiempo real**: el WebSocket, que antes solo servía para la presencia, se suscribe a `mapa/general`, a `heroe/<tuId>` (canal personal nuevo del
  backend) y a `asentamiento/<id>` de cada plaza de tu Facción que conoces; las suscripciones se rehacen al reconectar y se ajustan con cada
  proyección. Un evento solo avisa: el cliente pide al momento la proyección y el cursor de eventos (agrupando ráfagas en 250 ms). Verificado: el
  briefing de un ataque llega en ~0,5 s en vez de hasta 3 s. El sondeo de 3 s se mantiene, porque el avance de las columnas no genera eventos.
- **Estados activos** («debuffs») en la barra superior, en el mapa, el campamento y el asentamiento (`ui/estados.ts`): icono pequeño y nombre, con la
  descripción en un tooltip al pasar el cursor (o con el foco). Herido, Saliendo del mundo, Moral baja / Deserción de tu columna, Plaza ocupada y
  Hambre / Hambruna de la plaza donde estás. Todo sale de la proyección.

### Cambiado
- **El menú de sesión (avatar) vuelve a verse y a pulsarse**: desde 0.14.0 la barra superior se pintaba encima del avatar (z-index), así que «Cerrar sesión»,
  «Refrescar» y el resto del menú quedaban tapados en todas las pantallas.
- **Sin atajo de teclado para el mapa**: se quita la tecla `M` (y `Esc`); el mapa desde dentro se abre y se cierra solo con el botón «Mapa» y «Volver».
- **El panel de Facción ya no cambia solo**: el selector de escudo generaba un sigilo al azar en cada pintado, así que el HTML cambiaba en cada
  refresco y el panel se repintaba entero, llevándose el nombre y el escudo elegidos. Ahora el sigilo propuesto es fijo y, mientras creas una
  Facción o buscas a cuál pedir ingreso, el panel no se repinta salvo al cambiar de modo.

## [0.14.1] — 2026-10-07 · con los arreglos del backend · sync con `BronzeAgeFase0@60b0939` (`main`, sin push)

### Cambiado
- **El briefing de combate ya llega**: el backend entrega por `GET /eventos` los eventos que nombran a tu héroe (hallazgo 1 de 0.14.0). Verificado en vivo: un
  ataque fallido a un campamento de bandidos de nivel 3 abre su briefing, el toast y el contador de Avisos.
- **Tropa prestada retirada**: se avisa con el evento del backend `mercenarios.prestamo_retirado` (hallazgo 2b). Se quita la detección por diff de proyecciones
  (`vigilarProyeccion`), que con los eventos ya solo duplicaba avisos.
- **Carro**: enseña la ocupación del carro y del almacén personal contra su capacidad (`ejercitos[].capacidadCarga`, `heroe.capacidadAlmacenPersonal`; hallazgo 3).
- Los solicitantes de ingreso salen por nombre (el backend los añade a `nombresDeCompaneros`).
- Revisión de 0.14.0: el panel Carro ya no se repinta mientras escribes una cantidad (en marcha la ración cambia cada tick); Crear Facción no enseña los motivos
  hasta que se toca algo (solo apaga «Crear»); el resumen del combate pone tu poder primero.

### Sigue pendiente en el backend
- El canal `mapa/general` no lleva los eventos de «ninguna plaza» (`asentamientoId: ''`): solo el cursor. Hace falta un canal por héroe cuando el cliente use el tiempo real.
- Trazado de los campamentos de bandidos (el plano de la ficha sigue siendo esquemático).

## [0.14.0] — 2026-10-07 · barra del jugador, campamento por subpestañas, avisos de combate y carro · sync con `BronzeAgeFase0@main` (`d1ae802`, `7680bd3`, `90c0caf`)

### Añadido
- **Barra superior del jugador** común al mapa, al campamento y al asentamiento (`src/ui/barraJugador.ts`): Héroe, Escuadras, Carro, Facción y Avisos. Antes el héroe y la Facción
  vivían en el riel del mapa y en la barra del asentamiento, y el campamento no tenía ni héroe. El riel del mapa conserva solo lo del mapa (Mis cosas, Fundar); la barra del
  asentamiento, lo de la plaza (Cargos, Taberna e intel, Salir al mundo).
- **Campamento de mercenarios por subpestañas**, como el asentamiento (`pantallaCampamento.ts`): planta a la izquierda y, a la derecha, Resumen · Salir · Tropa · Mercado · Fondo (solo sin
  plaza) · Taberna. Ya no hay una columna infinita ni el flujo de Facción metido dentro. Sondeo de 3 s con diff del DOM.
- **Mapa desde dentro**: tecla `M` o botón «Mapa» de la barra superponen el mapa del mundo (zoom y arrastre, la visión que se tiene dentro, solo para mirar) sobre el campamento o la plaza;
  `M` o `Esc` vuelven. No se sale de donde se está.
- **Planta del campamento como la del admin** (`planoCampamento.ts`): suelo, calles, empalizada y rótulos con la paleta de `drawCampamento`, encuadrada sobre la empalizada.
- **Ficha del campamento de bandidos**: nivel (1-3) bien visible, poder, defensores y botín por héroe (de `GET /v1/balance`, `internas.CAMPAMENTOS_BANDIDOS.niveles`), a quién acosa, y un plano
  esquemático (`planoBandidos.ts`). Tipo `CampamentoBandido` con `nivel`, `bosqueId`, `asentamientoId`, `campamentoMercenariosId`.
- **Briefing de combate** (`informeCombate.ts`): ganador, poder de cada bando y bajas por escuadra para `combate.resuelto`, `combate.campamento_destruido` y `combate.ataque_campamento_fallido`,
  filtrado por `heroesIds`. Avisos de eventos (`avisos.ts`) con **historial consultable** (panel Avisos, localStorage por partida y héroe) y contador de no leídos.
- **«Te persiguen»**: banda roja en la barra con la Facción y los héroes de cada columna con `teSigue`.
- **Carro personal** (`panelCarro.ts`): contenido del carro de la columna (la ración gratis de trigo aparte), almacén personal y oro de botín, con *Guardar* (`guardarEnAlmacenPersonal`) y
  *Al carro* (`sacarDelAlmacenPersonal`) para el Líder. Tipos `Ejercito.suministro/racion`.
- **Crear Facción**: valida antes de enviar y enseña **todos** los motivos detectables (nombre vacío o repetido, colores del fondo iguales, sigilo repetido, ya perteneces) con su remedio, y
  apaga el botón. Cada `codigoError` del backend se traduce (`erroresServidor.ts`), en toda la interfaz.
- **Nombres de dirigentes**: Rey, Embajador, solicitantes de ingreso, Rey de cada Facción en «Pedir ingreso» y Gran Rey de la Liga salen por nombre (`nombresDeCompaneros` +
  `nombresDeDirigentes`, `ui/nombres.ts`).
- **Presencia**: el cliente abre el WebSocket de tiempo real y lo cierra al cerrar sesión (cualquier camino: `cerrarSesion` lo hace) o la pestaña (`pagehide`). El servidor desconecta al héroe
  cuando cierra el último socket; hasta ahora este cliente no abría ninguno, así que nunca figuraba conectado. Verificado: tras cerrar sesión el héroe queda con `desconectaEn`.
- **Bajas vistas en la proyección** (`vigilarProyeccion`): una escuadra que mengua, que desaparece o un héroe que pasa a Herido generan aviso aunque el backend no mande el evento (ver abajo).

### Cambiado
- **Se quita «Taberna e intel» del mapa**: la intel solo se compra dentro de una taberna (plaza propia con taberna o campamento de mercenarios), como ya exigía el backend. El panel de intel
  ya no tiene «elegir punto en el mapa».
- Residir en otro campamento con tropa prestada pide confirmación: el backend retira esa tropa al dejar de residir en el campamento que la prestó (D45), sin ningún evento.
- El campamento enseña TODA la tropa del héroe con su sitio real («en el campamento», «en tu columna, aparcada en la puerta»…): quien entra en un campamento donde no reside deja su columna
  aparcada y sus escuadras NO pasan a `contenedor: campamento`, y la pantalla anterior filtraba solo esas.
- La ficha de Selección del mapa se desplaza si no cabe.

### Hallazgos del backend (no se edita el repo del servidor)
1. **Los eventos de combate no llegan a ningún jugador.** `combate.*`, `ejercito.llega` y otros salen con `asentamientoId: ''` (cadena vacía); `eventosVisiblesParaJugador`
   (`session/proyecciones/jugador.ts`) y `canalDeEvento` (`session/canales.ts`) solo tratan `undefined` como «global», así que `GET .../eventos` los descarta para todos y el canal `mapa/general` no los
   lleva. Reproducido: `combate.campamento_destruido` (v386) y `combate.ataque_campamento_fallido` aparecen en el log de admin y no en `GET /eventos` de ninguna cuenta. El doc 02 §4.1b dice que sí
   viajan. Arreglo propuesto: tratar `''` como `undefined` en esos dos sitios (o no emitir `''` desde el contexto del evento). El cliente ya filtra por `heroesIds`, así que no hace falta más.
2. **Caso del usuario (0/0/0 tras volver a casa)** — reproducido contra el servidor; no es una emboscada ni un bug de bajas: (a) `entrarEnCampamento` en un campamento donde NO resides deja la columna
   aparcada y las escuadras con `contenedor: ejercito`, y la pantalla las enseñaba como «sin tropa» (corregido aquí); (b) `residirEnCampamento` no exige estar allí y el tick **borra** (`sinPrestamosAjenos`)
   la tropa prestada por el campamento anterior, sin evento ni aviso: 3 escuadras de 14 pasan a 0 en un tick. Si el usuario pulsó «Residir aquí» (o se mudó por conquista/ruina), es eso. El backend
   podría emitir un evento al retirarla. (c) Si su cliente no mantenía el WebSocket y otro sí, un cierre desconecta al héroe y a los 2:30 sale del mundo con la columna (`contenedor: fuera`).
3. **El tope del almacén personal y la capacidad del carro no viajan** en la proyección ni en `/v1/balance` (`ALMACEN_PERSONAL.capacidad`, `capacidadCargaDe`): el panel Carro muestra existencias y deja
   que el backend rechace («el almacén personal está lleno»).
4. **Los campamentos de bandidos no tienen trazado publicado** (solo plazas y campamentos de mercenarios): el plano de la ficha es esquemático. Propuesta: un `layoutBandidos(id, nivel)` en el motor.
5. `/v1/balance` no publica `MERCENARIOS.prestamo.unidades` (15): el cliente lo repite en el texto de la pestaña Tropa.

### Pendiente
- Sin verificar en vivo la vista de asentamiento con la barra nueva (no hay plaza en la partida de prueba): comprobada solo por tipos y por el campamento y el mapa, que comparten estructura.
- «Fuiste atacado» y el briefing solo funcionan con el arreglo 1 del backend; mientras tanto avisan las bajas vistas en la proyección (sin saber quién).
- Los solicitantes de ingreso que no son de tu Facción salen por id: `nombresDeDirigentes` solo trae Rey y Embajador.

## [0.13.0] — 2026-10-07 · batallas con héroes y ejércitos en campo · sync con `BronzeAgeFase0@101c035` (rama `claude/elegant-shirley-2ce6d7`, sin push)

### Añadido
- **Batallas en el mapa** (backend Doc 5.15.1b, doc 02 §4.1): las batallas de Unity a la vista salen como un círculo con espadas cruzadas (verde la tuya).
  Al pulsarla se abre su ficha en el panel de Selección (`src/ui/panelBatalla.ts`): qué es (asedio, batalla campal, persecución, asalto a una caravana o
  evento contra bandidos), los bandos con su Facción y sus héroes sobre la capacidad, y **Unirse**. En una **persecución** el bando se elige («Con quien
  persigue» / «Con el perseguido»), porque es libre; en las demás lo deduce el backend; una batalla campal no admite a nadie de fuera. El botón avisa
  de la distancia (a 15) y la herida; el rechazo del backend sale en la propia ficha. Comando `unirseABatalla` con `lado` opcional.
- **Formar un ejército en campo** (backend Doc 5.14.4): «Mi columna» en «Mis cosas» ofrece *Organizar ejército* (unión abierta o «decido yo») a una columna
  personal que va sola; en una formación, el progreso (n/3 y los minutos que quedan) y *Cancelar la formación* (Líder) o *Separarme*; y con tres, «haz clic en el
  mapa para fijar el destino», que es el clic de siempre (`marcharA`) y vale una sola vez. Las formaciones se dibujan con un anillo discontinuo y se pulsan para
  **unirse** a ellas (`unirseEnCampo`). Comandos `organizarEjercito`, `cancelarFormacion`, `separarseDelEjercito`.
- **Ajuste del Rey** «Ataques abiertos a otras Facciones» en la pestaña Facción (`src/ui/panelAdmision.ts`): activa que en vuestros asedios y asaltos de caravana se
  unan al ataque héroes de Facciones neutrales o enemigas del defensor. Comando `admitirOtrasFacciones`.
- Tipos: `Faccion.admiteOtrasEnAtaques`, `Ejercito.tipo/liderId/formacion/destinoPendiente`, `EjercitoAvistado.tipo/enFormacion` y `columnas` en el contexto de una batalla.

### Cambiado
- **Solo un ejército abre un asedio**: *Atacar* una plaza queda deshabilitado para una columna personal, con el motivo.
- El panel lateral del mapa ya no aplasta sus bloques cuando hay mucho contenido: se desplaza. Las secciones de Anexión y Fusión de la pestaña Facción salían a altura
  cero cuando había más de una.

### Verificado
- Contra el backend real (`npm run server` con `SERVIDORES_BATALLA`), con tres cuentas: formar un ejército entre tres, fijar su destino siendo Líder, el rechazo de
  un integrante que no lo es; abrir una persecución entre dos Facciones y unirse a ella desde la ficha como un tercero sin Facción; y activar el ajuste del Rey.

### Pendiente
- No hay aviso en pantalla de que una batalla se abre, termina o cambia: el cliente no usa todavía el canal `batalla/<id>` (WebSocket); la ficha se actualiza con el sondeo.
- Tampoco hay menú para atacar o perseguir a otra columna, ni la ficha de una columna ajena: solo se atacan plazas y campamentos.

## [0.12.0] — 2026-10-06 · fusión con aceptación · sync con `BronzeAgeFase0@6aced64` (rama `claude/keen-chandrasekhar-c37099`, sin push)

### Añadido
- **Fusión entre Facciones** (backend Doc 2.6 opción 2, modelo en `Docs/Coordinacion/01` §26): sección «Fusión» en la pestaña Facción (`src/ui/panelFusion.ts`).
  El Rey de la Facción que propone elige la otra, el **nombre** de la Facción nueva y quién será su **Rey** (él o el de la otra) y puede retirar la propuesta; solo el
  Rey de la otra **acepta o rechaza**, con la caducidad a la vista. Comandos `proponerFusion`, `responderFusion` y `retirarFusion`; `fusionar` ya no existe.
- Tipo `PropuestaFusion` y el campo opcional `propuestasFusion` de `ProyeccionJugador`.

### Cambiado
- `ui/panelAnexion.ts` exporta `caduca` y `crearEnvio` (envío de comando con el rechazo del backend en el propio panel), que comparten anexión y fusión.

### Pendiente
- Como en la anexión: no hay aviso al Rey cuando le llega una propuesta (los eventos `diplomacia.fusion_*` son públicos y sin plaza). Tras aceptarse, **las dos** Facciones
  desaparecen y nace una con id nuevo (`diplomacia.fusion`, payload `faccionNuevaId`): el cliente se limita a refrescar la proyección.

## [0.11.0] — 2026-10-06 · anexión con aceptación · sync con `BronzeAgeFase0@8a4eae5` (`main`)

### Añadido
- **Anexión entre Facciones** (backend Doc 2.6, modelo en `Docs/Coordinacion/01` §25): sección «Anexión» en la pestaña Facción
  (`src/ui/panelAnexion.ts`). El Rey o el Embajador proponen anexionar a otra Facción (selector) y pueden retirar la propuesta; solo el Rey
  de la absorbida **acepta o rechaza** las que recibe, con la caducidad a la vista. Quien valida es el backend: su rechazo (`anexion.invalida`,
  `anexion.caducada`…) sale en el propio panel. Comandos `proponerAnexion`, `responderAnexion` y `retirarAnexion`; `anexionar` ya no existe.
- Tipo `PropuestaAnexion` y el campo opcional `propuestasAnexion` de `ProyeccionJugador`.

### Pendiente
- Aviso al Rey cuando le llega una propuesta: los eventos `diplomacia.anexion_*` son públicos (sin plaza) y no dicen a quién tocan; hoy solo se ve
  abriendo la pestaña Facción. Tras aceptarse una anexión la Facción absorbida desaparece: el cliente se limita a refrescar la proyección.
- El desarme del señor (sus vasallos quedan libres) no necesita cliente: llega por `relaciones`.

## [0.10.1] — 2026-10-05 · planta del campamento, avisos y cupo de la proyección · sync con `BronzeAgeFase0@cbe7ffa` (rama `claude/gracious-sinoussi-5b2ee7`)

### Añadido
- **Planta del campamento** en su pantalla (backend D73, `escenaCampamento`): calles, empalizada con su puerta y los edificios con la taberna
  en el centro, con leyenda. `src/ui/planoCampamento.ts`. La planta solo viaja estando dentro del campamento.
- **Avisos de «alguien te ha mirado»** (`src/ui/avisos.ts`): el cliente pide `GET .../eventos?desde=<version>` tras cada proyección y muestra
  un aviso global con el mensaje de `asentamiento.informe_pedido` (el plano de tu plaza, sin decir quién) y de las inspecciones
  (`asentamiento.observado`, `columna.observada`, `caravana.observada`). El primer refresco solo fija el cursor: no avisa de lo viejo.

### Cambiado
- El **cupo de Miradas** de una taberna ya no se deduce en el cliente: viaja en `tarifasIntel.cupoMiradas` (por nivel de la de plaza y fijo en
  campamento). `docs/COMANDOS.md` apunta los dos comandos de intel.

## [0.10.0] — 2026-10-05 · taberna e intel · sync con `BronzeAgeFase0@c6dda58` (rama `claude/gracious-sinoussi-5b2ee7`, sin fusionar a `main`)

### Añadido
- **Panel Intel** (backend Doc 5.12.10, modelo en `Docs/Coordinacion/01` §24, comandos en `02` §4.2c): la taberna vende **Miradas** (un ojo de
  150 de radio durante 2 h sobre cualquier punto, en vivo y sin interiores) e **Informes de plaza** (foto con fecha del layout y la defensa
  de una plaza ajena que conoces). Está en tres sitios: el riel del mapa (🔭), la barra de la plaza (**Intel**) y la pantalla Campamento.
  `src/ui/panelIntel.ts`.
  - Se compra en la taberna de una plaza propia (estando dentro; Rey, Embajador o Gobernador) o en la de un campamento de mercenarios
    (dentro, o con la columna a la puerta; cualquier héroe con Facción, con su oro de botín). El selector ofrece las que tengas a mano.
  - **Cotiza antes de comprar** con `tarifasIntel` (la misma cuenta que el backend: base más un tanto por la distancia a tus ojos propios
    más cercanos para la Mirada; por nivel de la plaza para el Informe). Quien valida es el backend: su rechazo (`intel.invalida`) sale tal cual.
  - **Punto de la Mirada**: «Elegir punto en el mapa» (un clic lo fija, sin mandar marchar a la columna), una lista de plazas conocidas y
    campamentos, o coordenadas a mano. La previsualización sale discontinua sobre el mapa.
  - **Mapa**: las Miradas abiertas se pintan como círculo con su cuenta atrás y, tras caducar, un anillo tenue mientras la zona sigue vedada
    (`pintarMiradas`, `render.ts`). Lo que dejan ver llega por las listas de avistados de siempre, así que no hay otra capa.
  - **Informes**: lista con su antigüedad y detalle con mini plano del layout, edificios por tipo, guarnición, héroes y murallas. Es una foto:
    no se actualiza.
- La **Taberna** en el catálogo de edificios (nombre, color) y en el selector «Añadir a la cola» del Gobernador.
- Tipos `MiradaIntel`, `InformePlaza`, `EdificioInforme`, `TarifasIntel`, `OrigenDeIntel` y los campos `miradasIntel`, `informesPlaza` y
  `tarifasIntel` de `ProyeccionJugador`.

### Pendiente
- **Aviso al espiado**: el backend emite `asentamiento.informe_pedido` a la Facción espiada, sin decir quién. Este cliente no consume el canal
  de eventos todavía, así que no se ve.
- El cupo de Miradas de una taberna de plaza se lee del `nivelInterno` (1/2/3, `cupoMiradas` del backend): si cambia el catálogo, hay que
  ajustarlo en `tabernasDisponibles`.
- Verificado a mano contra un servidor local (comprar Mirada e Informe desde el campamento y desde la plaza, elegir punto con clic); falta
  probarlo con dos jugadores reales y con la Mirada de un aliado.

## [0.9.0] — 2026-10-05 · sigilo de Facción · sync con la rama `claude/gracious-sinoussi-5b2ee7` de `BronzeAgeFase0` (sin fusionar a `main`)

### Añadido
- **Sigilo de Facción** (backend Doc 2.8.1): al crear la Facción se elige forma del escudo, fondo (18), dos colores, emblema (56)
  y su color, y orla opcional con su color, con vista previa (`crearFaccion` manda `sigilo`; se elige una vez y no se cambia
  nunca). El halo del emblema cambia a claro u oscuro según su color. La ficha de la Facción lo dibuja.
- `src/sigilo/`: copia del catálogo (`catalogoSigilos.json`, recopiar del backend cuando crezca), el dibujo SVG del
  escudo (`svgSigilo`) y los 56 emblemas de época (micénicos, minoicos, hititas, mesopotámicos, fenicios, egipcios y helénicos)
  con iconos de **game-icons.net** (CC BY 3.0; `emblemas.json`, autores en `src/sigilo/CREDITOS.md` y citados bajo el
  selector), con halo oscuro y relleno crema para leerse sobre cualquier campo. `galeria-sigilos.html` (solo en `npm run dev`) los muestra todos a 96 y a 24 px:
  es la herramienta del paso 0 del backend (probar el catálogo a tamaño de mapa).
- Tipos `Sigilo` y `Faccion.sigilo`.

- **Imperios y títulos** (backend Doc 2.8.1), todo derivado de la proyección (`relaciones` y `titulos`), sin dato nuevo:
  la **corona dorada del Gran Rey** sobre su estandarte, la **Liga** de tu Facción en su ficha (sigilo de la señora si es
  por vasallaje, fila con los de sus miembros si es una alianza) y la lista de **títulos del servidor** con su insignia por
  `tituloId` (castillo, oro, cuartel, corona y lira) y quién los tiene. `src/sigilo/imperio.ts`, `insignias.json`.

### Cambiado
- El territorio y los marcadores de cada Facción en el mapa usan el **color principal de su sigilo** (antes, un color de una
  paleta fija por orden).

### Pendiente
- La crónica de los Aedas no tiene pantalla en este cliente, así que sus insignias de título no se ven ahí.
- Probar el catálogo a ~24 px sobre el mapa (`galeria-sigilos.html`). Faltan iconos de escudo en ocho, Puerta de los Leones,
  águila bicéfala, toro alado, árbol sagrado, casco de colmillos y sol de Vergina: no hay en game-icons.net y hay que
  encargarlos (por eso no están en el catálogo).

## [0.8.0] — 2026-10-04 · campamentos de mercenarios · sync con `BronzeAgeFase0@cb7f343` (`main`)

### Añadido
- **Nacer en un campamento** (Doc 1.3, 1.9b): la pantalla Héroe lista los campamentos de `sinHeroe.campamentos`
  (con cuántos lo eligieron y cuántos residen) y `crearHeroe` manda `campamentoId`.
- **Pantalla Campamento**, cuando `heroe.ubicacion.tipo === 'mercenarios'`: salir al mundo eligiendo tropa y carga
  (`salirDelCampamento`), almacén personal y oro de botín, tropa prestada gratis (`pedirPrestamo`,
  `reponerPrestamo`), mercado (`comprarEnCampamento`), residir (`residirEnCampamento`), crear Facción o pedir ingreso
  y, para una Facción sin asentamiento, el fondo de refundación (`aportarARefundacion`, `retirarDeRefundacion`,
  `comprarCaravanaDeRefundacion`).
- **Mapa**: campamentos de mercenarios (tienda parda) con ficha y «Entrar» (`entrarEnCampamento`), y alijos (punto
  dorado) con «Abrir» (`abrirAlijo`). El panel de Facción del riel ya crea y pide ingreso.
- **Rey**: la ficha de su Facción lista las solicitudes y las acepta o deniega (`responderSolicitud`).
- Tipos `CampamentoMercenarios`, `CampamentoParaElegir`, `Alijo`; `heroe.almacenPersonal`, `heroe.oroDeBotin`,
  `Escuadron.prestada`, contenedor `fuera`, `Faccion.solicitudesIds`, `Caravana.titularId`/`origenCampamentoId`,
  `Ejercito.caravanasAdjuntasIds`.

### Cambiado
- **Fundar** (panel ⌂): solo con la Caravana de Fundación de la que eres titular, enganchada a tu columna
  (`adjuntarCaravana`), y con `fundar` donde estás. `fundarAsentamiento` ya no existe.
- `unirseAFaccion` → `solicitarIngreso`: decide el Rey. Ya no hay pantalla Facción obligatoria: sin Facción se juega
  desde el campamento o el mapa.

### Pendiente
- Los rechazos del campamento llegan solo con el código (`mercenarios.invalido`): el backend no manda el motivo.

## [0.7.1] — 2026-10-02 · red de caminos · sync con `BronzeAgeFase0` `main` (red de caminos, aún sin commit)

### Cambiado
- **Caminos** (Doc 1.6): `proyeccion.caminos` son ahora tramos fusionados de la red de caminos,
  `CaminoProyectado { id, escalon, puntos }` (sustituye a `CaminoComercial`). Se pintan con grosor por escalón:
  sendero, camino, calzada. Contra un servidor anterior, sin `escalon`, se pintan como antes.

## [0.7.0] — 2026-09-26 · subida de nivel y asedio · sync con `BronzeAgeFase0@8091638` (rama `ritmo-crecimiento`)

### Añadido
- **Subida de nivel** (Doc 4.5): la pestaña Resumen enseña la evaluación del servidor (`ascensoDeAsentamiento`:
  coste, obra, déficit de mantenimiento y bloqueos) y el Gobernador la pide con «Subir a nivel N»
  (`solicitarAscenso`). Con una obra en curso (`Asentamiento.ascenso`), su cuenta atrás.
- **Asediar una plaza** (Doc 5.12.4): la ficha de una plaza de otra Facción ofrece «Atacar» (`atacar` con
  `objetivo: asentamiento`), apagado si estás herido o a más de 15. El aviso dice si cae, aguanta o empieza una
  batalla, mirando la proyección.
- **Mejoras con duración**: `Edificio.mejora`; la pestaña Edificios no ofrece mejorar lo que ya se mejora y la Cola
  lista las mejoras en curso. Las cuentas atrás salen en horas.
- Tipos `EvaluacionAscenso`, `BatallaVisible` (`proyeccion.batallas`, sin interfaz) y `Recinto.siguienteCeldaEn`.

### Cambiado
- Los botones del panel de Selección pasan a la línea siguiente si no caben.

### Backend que lo habilita
- El nivel ya no sube solo; `atacar` asedia plazas (llegar solo acampa); +`unirseABatalla`, +`cancelarBatalla`
  (opt-in `SERVIDORES_BATALLA`): 77 comandos, 76 de jugador.

### Documentación
- `COMANDOS.md` (23 de 76), `API_CONTRACT.md`, `Analisis_Brecha_Backend.md`, `Features_Pendientes.md` §1.4 y §1.5,
  README.

## [0.6.0] — 2026-09-15 · Herido y bandidos con columna · sync con `BronzeAgeFase0@3602f71` (rama `heroe-dominio`)

### Añadido
- **Atacar campamentos de bandidos** (Doc 1.9): clic en un campamento abre su ficha en el panel de Selección
  (poder, distancia a tu columna) y marcha hacia él; «Atacar» manda `atacar` con `objetivo: campamento`. Se apaga
  si estás herido o a más de 15 (`RADIO_ATAQUE`, copia de `LOGISTICA.radioEncuentro`), y al terminar avisa de si
  cayó o aguantó.
- **Herido** (Doc 5.16.4): `heridoHasta` en `HeroeProyectado` y `HeroePublico`. La Ficha del panel Héroe enseña los
  minutos que quedan, y el loadout de un herido deja de marcarse como que defiende.
- `CampamentoBandido.poder`.

### Backend que lo habilita
- La Tregua de columna se sustituye por el Herido del héroe; sale `atacarCampamentoBandidos` (desde una plaza):
  74 comandos, 73 de jugador. Al caer una plaza, quien estaba dentro queda fuera en una columna (el router ya
  lleva a Mapa).

### Documentación
- `COMANDOS.md` (22 de 73, `atacar` cableado para campamentos), `API_CONTRACT.md`, `Analisis_Brecha_Backend.md`,
  `Features_Pendientes.md` §0.2 y §1.4, README.

## [0.5.0] — 2026-09-14 · panel del héroe · sync con `BronzeAgeFase0@52498a2` (rama `heroe-dominio`)

### Añadido
- **Panel Héroe** (`src/ui/panelHeroe.ts`), en el riel del Mapa (🛡) y en la barra del Asentamiento, con tres
  pestañas:
  - **Ficha**: clase, dónde está, nivel, experiencia, Liderazgo, monedas y atributos; con puntos sin gastar,
    reparte (`repartirPuntos`).
  - **Escuadras**: cada una con hombres, nivel, moral, coste de Liderazgo, dónde está y si defiende; guarnición
    ocupada frente al cupo, y `asignarGuarnicion`/`retirarGuarnicion` (el botón se apaga si no cabe).
  - **Loadouts**: lista con su Liderazgo; activar, editar, borrar y crear (`guardarLoadout`, `borrarLoadout`),
    con la suma de Liderazgo en vivo y Guardar apagado si no cabe o no tiene nombre.
- El sondeo de 3 s no repinta el panel si nada cambió, ni mientras hay un loadout a medio editar.
- `aplicarYRefrescar` en `src/main.ts`: lo mismo que `ejecutarYRefrescar` para una petición ya lanzada.

### Documentación
- `COMANDOS.md`: los cinco comandos del héroe cableados (21 de 74). `Features_Pendientes.md` §0.2 queda en lo
  que falta (equipo, perks, héroes ajenos). README, `API_CONTRACT.md`, `Analisis_Brecha_Backend.md`.

## [0.4.0] — 2026-09-14 · escuadras en el héroe · sync con `BronzeAgeFase0@6d43688` (rama `heroe-dominio`)

Fases 2 y 3 del modelo de Héroe en el backend: las escuadras viven en el héroe, y tu héroe viaja completo en la
proyección. Sigue necesitando el backend de esa rama.

### Cambiado
- `Ejercito.escuadrones` → `escuadronIds` (solo ids), y `participantes` pasa a obligatorio: los rombos de una
  columna y "tu columna" se leen solo de `participantes`. Fuera `EscuadronEnCampana` y `Asentamiento.escuadrones`
  (la guarnición son ahora escuadras del héroe marcadas `enGuarnicion`).
- Las iniciales del menú de esquina y la cabecera del panel de Facción usan el nombre del héroe, no el nick. El
  selector de cargos enseña el nombre de cada compañero de Facción (`nombreDeHeroe`).

### Añadido
- `ProyeccionJugador.heroe` (`HeroeProyectado`, con `costeLiderazgo` en cada escuadra y `guarnicionOcupada`),
  `heroesVisibles` (`HeroePublico`), `nombresDeCompaneros` y `EjercitoAvistado.heroeIds`, y los tipos `Escuadron`,
  `Loadout`, `ItemInstancia`, `AtributoHeroe` y `SlotEquipo`.
- Wrappers tipados de `repartirPuntos`, `guardarLoadout`, `borrarLoadout`, `asignarGuarnicion` y
  `retirarGuarnicion` en `apiCliente.ts`, sin pantalla todavía.

### Backend que lo habilita
- Catálogo 70 → 75 (74 de jugador). Guarnición con cupo por residente; una plaza la defienden su guarnición y el
  loadout activo de los residentes que están dentro.

### Documentación
- `docs/Features_Pendientes.md` §0.2: la pantalla del héroe (ficha, atributos, escuadras, loadouts, guarnición,
  equipo y héroes ajenos).
- `docs/COMANDOS.md`, `docs/API_CONTRACT.md`, `docs/Analisis_Brecha_Backend.md`, `docs/Panel_Asentamiento.md` y
  README.

## [0.3.0] — 2026-09-14 · héroe · sync con `BronzeAgeFase0@6281527` (rama `heroe-dominio`)

El backend pasa a jugar con un **Héroe** (fase 1 del modelo: doc 01 §12 y doc 02 §4 de `Docs/Coordinacion/`).
**Necesita el backend de esa rama**: contra `main`, la proyección todavía trae `jugadorId`.

### Cambiado
- `jugadorId` → `heroeId` en `ProyeccionJugador`, en los tipos locales (dueño de escuadrón, `participantes` de
  columna, `jugadoresFundadoresIds` → `heroesFundadoresIds`) y en los `params` que se mandan (`marcharA`,
  `entrarEnAsentamiento`, `salirAlMundo`, `asignarCargoLocal`). Cargos, Rey y columna propia se comparan contra
  `proyeccion.heroeId`.
- `ejecutarAccionMuralla` → `ejecutarYRefrescar`: la usan la muralla y el héroe.

### Añadido
- La respuesta `sinHeroe` de la proyección (`PartidaSinHeroe` en `apiCliente.ts`, `estadoCliente.sinHeroe`) y la
  pantalla **Héroe** en el router, que con `sinHeroe` es la única. `crearHeroe(params: ParamsCrearHeroe)` manda
  el comando y refresca.
- Pantalla **provisional**: solo el nombre; clase `Spear`, género y avatar van fijos (`HEROE_PROVISIONAL`). La
  definitiva está descrita en `docs/Features_Pendientes.md` §0.

### Backend que lo habilita
- `crearHeroe`: el héroe aparece en el mundo con su columna. Sin héroe, la proyección es
  `{ gameId, instante, version, mapaId, sinHeroe: true }` y cualquier comando salvo `crearHeroe` es `403`.
- Catálogo 69 → 70: entran `crearHeroe` y `crearFaccionNpc` (solo admin: una Facción de jugador ya no se cede a
  la IA) y sale `alternarFaccionNpc`.

### Documentación
- `docs/COMANDOS.md`: params `heroeId`, sección Héroe, y los cableados al día (16 de 69, con los 9 que
  trajeron las pantallas nuevas y no se habían marcado).
- `docs/API_CONTRACT.md`, `docs/Analisis_Brecha_Backend.md`, `docs/Panel_Asentamiento.md` y
  `docs/Features_Pendientes.md` §0.

## [0.2.0] — 2026-09-09 · login con cuenta local (nick + contraseña)

Playtest: los jugadores se registran ellos mismos. Antes el login era `dev <nick>` sin contraseña, con
chips `ana / bruno / carla / jefa` como atajo.

### Cambiado
- Pantalla de login: nick + **contraseña** + casilla "No tengo cuenta — crear una" (revela el campo de
  **código de invitación**, si el backend lo exige). Fuera los chips de usuario.
- `apiCliente.ts`: `loginConUsuario(nick)` → `loginConClave(nick, clave)` (manda `Authorization: clave
  <nick>:<contraseña>`); nueva `registrarCuenta(nick, clave, codigo?)` contra `POST /v1/registro`.
- En un 401 la sesión se cierra y la UI vuelve al login — ya no hay re-autenticación en silencio (no
  guardamos la contraseña).
- `style.css`: `.user-chips` / `.chip-btn` (sin uso) → `.form-check`.

### Backend que lo habilita — `BronzeAgeFase0`
- Proveedor de identidad `clave` (nick + contraseña, hash scrypt en `partidas/identidad.json`) y endpoint
  `POST /v1/registro` (`{nick, clave, codigo?}` → 201 / 400 / 403 / 409). Variable `CODIGO_REGISTRO` opcional.
- El proveedor `dev` sigue vivo solo para el cliente de administración (local).

## [0.1.1] — 2026-09-09 · sync con `BronzeAgeFase0@1b52862` (main)

Alineación de contrato con los cambios del backend del 2026-09-08 → 09-09. **No se cablearon comandos nuevos**
— sigue en 6 de 69; esto es contrato, no funcionalidad.

### Backend nuevo, reflejado en los docs
- **+3 comandos (66 → 69):** `guarnecer` (Doc 5.12.4 — un ejército vuelca su tropa en una plaza propia y se
  consume; sus caravanas adjuntas pasan a `'aparcada'`), `moverCargaCaravanaAparcada` y `enviarCaravanaAlOrigen`
  (operar esas caravanas aparcadas, Doc 3.13.7). `adjuntarCaravana` acepta ahora una caravana `'aparcada'`.
- **Niebla Paso 4 (`f20d64e`):** la visión se comparte EN VIVO con aliados / señor / vasallo. Se suma a las
  capas "viéndolo ahora" (`asentamientosAvistados`, `ejercitosAvistados`, `caravanasAvistadas`,
  `campamentosBandidos`, la máscara `visibles` de la niebla), nunca a lo explorado ni a la memoria. **Sin
  campos ni tipos nuevos** — el cliente ya pinta esas capas, solo que ahora traen también lo que ven tus
  aliados. Al romperse la relación, desaparece en la proyección siguiente.

### Añadido
- `Caravana.estado?` en el tipo local (`src/tiposDominio.ts`), con el enum completo incl. `'aparcada'`. El
  tipo ni siquiera modelaba `estado` antes.

### Documentación
- `docs/COMANDOS.md`, `docs/Analisis_Brecha_Backend.md`, `docs/API_CONTRACT.md`: 66 → 69 comandos, medido
  contra `1b52862` (main), niebla Paso 4 anotada en §3.

## [0.1.0] — 2026-09-08 · sync con `BronzeAgeFase0@4fe611b`

Sincronización con los cambios del backend del 2026-09-05 → 09-08 (jugador situado ya estaba, economía del
oro, comando `cambiarResidencia`, revamp de caravanas, ocupación post-conquista). **No se cablearon comandos
nuevos** — el bloque grande (60 de 66 sin interfaz) sigue igual; esto es alineación de contrato, no
funcionalidad.

### Corregido
- **`fundarAsentamiento` ya no manda `posicion`** (backend `76d7e9b`/`4fe611b`, "se funda DONDE SE ESTÁ",
  Doc 1.3). El comando pasó a `{ faccionId }`; el backend deriva la posición de la columna del fundador.
  `confirmarFundacion` (`src/main.ts`) dejó de enviarla. El punto que se elige en el mapa es ahora **solo la
  vista previa de recursos** — el flujo real de fundación necesita `salirAlMundo`, aún sin cablear.
- **Typo `Asentamiento.mantenimiento` → `medidorMantenimiento`** (`src/tiposDominio.ts`). El campo local no
  correspondía a ningún campo del dominio, así que la pestaña "General" mostraba "No disponible" en silencio.
  `pestanaAsentamientos.ts` lee ya el nombre correcto.

### Añadido
- Tipos locales de la **ocupación post-conquista** (backend Doc 5.12.9): `Edificio.danado` y
  `Asentamiento.ocupacionHasta`. La pestaña Asentamientos muestra "· dañado" en los edificios afectados y un
  aviso de ocupación con los minutos restantes en el detalle "General".

### Documentación
- `docs/COMANDOS.md`: 59 → 66 comandos (`cambiarResidencia` + 6 del revamp de caravanas), `fundarAsentamiento`
  sin `posicion`, medido contra `4fe611b`.
- `docs/Analisis_Brecha_Backend.md` y `docs/API_CONTRACT.md`: cifras y fecha de medición al día.

## [0.1] — 2026-09-04

Estado del `git log` antes de este changelog: mapa del mundo (terreno, niebla de guerra, fronteras propias y
ajenas, ejércitos, caravanas, campamentos), vista de asentamiento, panel de interacción con Facción,
Asentamientos, Información y Muralla. 6 de los comandos del backend cableados.
