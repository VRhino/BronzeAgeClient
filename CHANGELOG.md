# Changelog — Cliente de jugador

Formato: cada entrada anota la **fecha de sincronización con el backend** (`BronzeAgeFase0`) y contra qué
commit suyo se midió. La brecha detallada vive en `docs/Analisis_Brecha_Backend.md` y `docs/COMANDOS.md`.

## [0.49.0] — 2026-10-29 · mapa, territorio, avisos y experiencia de Facción · sync con `VRhino/BronzeAge@fd9cd58`

### Añadido
- **Modo mapa**: en el mundo, un clic sobre una plaza, un campamento (de mercenarios o de bandidos), un pueblo, una avanzada, un alijo, una
  batalla o un ejército lo selecciona y marcha hacia él, como en el modo mundo, y vuelve al mundo. Un clic en el suelo no mueve a nadie, y desde
  dentro de una plaza el mapa sigue siendo solo para mirar.
- **Avanzadas en el mapa** (atalaya, fuerte y ciudadela, propias y ajenas a la vista), con su ficha. En el mundo, un clic en un pueblo o una
  avanzada también lleva tu columna hacia él.
- **Círculo de fundar**: las parcelas de bosque de la zona inicial, en verde las libres (una Leñera cada una) y en rojo las ocupadas o en la
  zona de otra plaza conocida, y en el panel cuántas Leñeras cabrían.
- **Plaza → «Territorio»** (antes «Pueblos»): arriba, lo que hay ahora en su zona de influencia, nodos por tipo y parcelas de bosque, libres y
  ocupados; debajo, sus pueblos como antes.
- **Barra de experiencia** de la Facción en el panel de la izquierda, con los umbrales de nivel de los datos del motor.

### Cambiado
- **Confirmaciones con un cuadro del juego** en vez del `confirm` del navegador: hacer de una plaza tu base, residir en un campamento, dejar la
  residencia o la Facción, traspasar el trono, replegar el ejército, borrar un loadout, destruir un pueblo, desarmar la Caravana de Fundación y
  la diplomacia (guerra, vasallaje, romper, rebelarse). Escape cancela e Intro acepta.

## [0.48.0] — 2026-10-29 · Facción sin Resumen y con Plazas · sync con `VRhino/BronzeAge@fd9cd58`

### Añadido
- **Facción → pestaña «Plazas»**: las plazas de tu Facción, la capital primero, con su nivel, dónde están, cuántos ciudadanos residen en cada
  una y «Ver en el mapa» (cierra la ventana y centra el mapa en ella).

### Cambiado
- **Fuera la pestaña Resumen**: lo suyo (nivel, reputación, ciudadanos, Rey, Embajador, aviso de solicitudes, Liga y títulos del servidor) pasa
  al panel fijo de la izquierda. La ventana abre en Miembros.

## [0.47.0] — 2026-10-29 · lista híbrida de Facciones · sync con `VRhino/BronzeAge@fd9cd58`

### Cambiado
- **Lista de Facciones híbrida**, en la pestaña Facciones y en «Pedir ingreso» (sin Facción): las **conocidas** (la tuya, las de tu Liga, con
  las que tienes relación activa o de las que conoces alguna plaza en el mapa) salen con escudo, lo público, miembros y plazas; las **sin
  contacto**, solo con el nombre (y el botón «Pedir ingreso» si no tienes Facción). Es presentación del cliente: el motor sigue mandando la
  forma pública de todas.

## [0.46.0] — 2026-10-29 · misiones sin leer y ventana de Facción · sync con `VRhino/BronzeAge@fd9cd58`

### Añadido
- **Facción → pestaña «Facciones»**: la lista pública de todas las Facciones, con su escudo completo a la izquierda, el nombre y lo público
  (nivel, reputación, Rey, Embajador, capital, Liga, si admite a otras en sus ataques, si fue derrotada y qué es para la tuya) y, a la derecha
  del todo, sus miembros y sus plazas. Las plazas son las que conoces (vistas o recordadas en el mapa): el motor no publica el total.

### Cambiado
- **Misiones**: las nuevas o sin leer se marcan en color (borde y texto terracota) hasta que las abres, también en las tarjetas de la plaza y
  la Facción; cada grupo (Mías, Mi plaza, Mi Facción) se pliega y lleva cuántas tiene sin leer.
- **Ventana de Facción**: un panel fijo a la izquierda (un cuarto de la pantalla) con el escudo grande y centrado, el nombre debajo y, abajo,
  el número de plazas, los títulos de tu Facción y «Dejar la Facción»; las pestañas, a la derecha. Resumen ya no repite el escudo ni el
  nombre, y «Dejar la Facción» sale de Ajustes del Rey.

## [0.45.0] — 2026-10-29 · ventana de misiones · sync con `VRhino/BronzeAge@fd9cd58`

### Cambiado
- **Misiones** en una ventana centrada, como el diario de misiones de WoW pero en bronce y arcilla: a la izquierda los nombres por grupo
  (Mías, Mi plaza, Mi Facción) con su estado (cumplida, seguida, nueva) y las hechas plegadas; a la derecha, más ancha, la misión abierta con
  su descripción, objetivos, detalles y recompensas, y abajo los botones «Seguir» / «Dejar de seguir» y «Reclamar». Pulsar una misión del
  rastreador abre la ventana en esa misión. La subpestaña de la plaza y la pestaña de la Facción siguen con sus tarjetas.

## [0.44.0] — 2026-10-29 · gestionar pueblos y aldeas desde dentro · sync con `VRhino/BronzeAge@fd9cd58`

Contrato regenerado (`src/contrato/REVISION` = fd9cd584; cambio aditivo, no hace falta mundo ni partida nueva).

### Añadido
- **Dentro de un pueblo o una aldea**, para los ciudadanos de la Facción de la plaza madre y con la columna con la que entraste:
  - **Guarnición**: dejar escuadras de tu columna («Dejar») y recogerlas («Retirar») dentro de tu cupo de Liderazgo (30 en nivel 1 y 15 más
    por nivel de la aldea), con su barra; se ve también lo que han dejado otros héroes (`guarnecerPueblo`, `retirarDePueblo`).
  - **Carga**: del almacén del pueblo al carro de tu columna y dejarle lo que produce, con la barra del carro (`cargarDePueblo`, `dejarEnPueblo`).
  - **Escolta del carro de acarreo** con escuadras de tu columna, con el carro parado en el pueblo (`asignarEscolta` / `quitarEscolta`).
  - **Mejorar la aldea** desde dentro (el Gobernador o el Maestro de Obras de la madre).
- Las escuadras en la guarnición de un pueblo aparecen como «Guarneciendo un pueblo» en Héroe y en el campamento.
- Mensajes de los rechazos nuevos (`pueblo.escuadra_fuera_de_tu_columna`, `pueblo.recurso_ajeno`, `pueblo.almacen_sin_sitio`…).

## [0.43.0] — 2026-10-28 · pueblos por dentro, tablón y mapa · sync con `VRhino/BronzeAge@14e49ae`

Sin cambios en el contrato.

### Añadido
- **Entrar en pueblos y aldeas** (`entrarEnPueblo` / `salirDePueblo`): botón «Entrar» en la ficha del pueblo con tu columna a su puerta (un
  ejército entra por orden de su Líder). Dentro, una pantalla con su almacén, el rebaño y su tope, la guarnición de serie, el carro de acarreo y
  quién hay dentro, y «Salir al mapa». Por ahora dentro solo se mira: el motor aún no tiene órdenes que se den desde el pueblo (pedidas).
- **Escolta del carro de acarreo** desde la plaza madre (pestaña Pueblos), con el carro parado en el pueblo, como la de las caravanas comerciales.

### Cambiado
- **Modo mapa**: vuelve el detalle de antes de cerca; solo con mucho mundo a la vista (más de 600 u de ancho, `ANCHO_VISTA_GENERAL` en
  `render.ts`) ríos, vados y nodos van en una capa hecha una vez.
- **Tablón**: tarjetas que no se desbordan: título con su estado, descripción, etiquetas, avance y al pie la recompensa en etiquetas y un
  botón corto («Aceptar» / «Reclamar»); la explicación y quién aporta, plegados.

## [0.42.0] — 2026-10-28 · mejoras del cliente de jugador · sync con `VRhino/BronzeAge@14e49ae`

Sin cambios en el motor ni en el contrato.

### Añadido
- **Aldea agrícola: dónde hay tierra fértil.** Al elegir el sitio en el mapa se pintan en verde los puntos donde cabe (tierra firme, dentro de la
  zona, fertilidad mínima y separación de plazas y pueblos) y en gris los fértiles demasiado cerca de algo. La pestaña Pueblos dice si la zona
  tiene sitio y su mejor fertilidad, y el panel de Fundar avisa antes de fundar si la plaza nueva tendrá tierra para una aldea. El camino
  hasta la plaza no se puede comprobar aquí: un punto verde aún puede salir rechazado por eso.
- **Vados** en el mapa del mundo: una franja de piedras atravesando el río.
- **Carro con barra de llenado**: capacidad, lo que llevas y el porcentaje (verde, ámbar desde el 80 %, rojo lleno), también en el almacén personal.
- **Carga del carro al preparar un ejército**: dentro del panel de preparación eliges qué cargas del almacén de la plaza (o de tu almacén
  personal en un campamento) y lo guardas con «Guardar carga» (`cambiarSeleccionDeConvocatoria.carga`).
- **Facción a pantalla completa** con pestañas: Resumen, Miembros, Tablón, Misiones, Diplomacia y Ajustes del Rey. Sustituye al panel lateral.

### Cambiado
- **Producción**: lo producido en verde, lo consumido en rojo y el neto con su color.
- **Almacén personal**: solo aparece dentro de tu residencia o con tu columna a su puerta, que es donde lo deja usar el motor. Dentro de la
  residencia ya se puede sacar al carro.
- **Tesorería**: tabla con solo los recursos que la plaza produce o guarda (hay, producción por minuto y reserva), «+ Añadir recurso» para
  otros, un único «Guardar reserva» y las políticas de cargo en una sección plegable.
- **Modo mapa más ligero**: ya no se repinta 5 veces por segundo si nada se mueve, junta los repintados del arrastre y el zoom en uno por
  fotograma y, de cerca, usa la imagen del mundo ya hecha en vez de árboles sueltos y nombres de nodo.

## [0.41.1] — 2026-10-28 · elegir en el tablón · sync con `VRhino/BronzeAge@14e49ae`

### Corregido
- **Tablón**: «Elegir las de la semana que viene» se cerraba al marcar una casilla en el panel de la Facción y no dejaba guardar.
  Probado contra el motor con el mundo nuevo: aceptar una individual y guardar la elección funcionan, y el aviso de bosque cerrado al
  fundar coincide con lo que rechaza el motor.

## [0.41.0] — 2026-10-28 · tablón de misiones, participación y cambios del motor del 28-10 · sync con `VRhino/BronzeAge@14e49ae`

Contrato regenerado (`src/contrato/REVISION` = 14e49ae4). Hace falta el mundo nuevo y partida nueva (lo pide el motor).

### Añadido
- **Tablón de misiones recurrentes** (mecánica 55): pestaña «Tablón» en el Centro urbano y sección en la Facción. Diarias y semanales con lo
  que falta para renovarse; aceptar las individuales (con su tope semanal y el cargo que piden), avance, quién aporta a las grupales y
  reclamar. El Gobernador y el Rey eligen hasta 7 diarias y 7 semanales para la semana que viene (`aceptarMision`, `elegirTablon`,
  `reclamarRecompensa`). Los avisos de una recurrente cumplida llevan su título y mandan al Tablón.
- **Participación** (mecánica 54): en «Cargos», los residentes de la plaza con su cargo y sus puntos (y quien sumó sin residir); en la
  Facción, los miembros con cargos, residencia y su suma.
- **Producción**: por recurso, lo producido y lo consumido en el último minuto además del neto (mecánica 60).
- **Misiones**: «Más» con la explicación de cada misión que publica el motor.
- **Fundar**: aviso en rojo si el punto está en bosque cerrado (`FUNDACION.densidadBosqueMaximaParaFundar`) y mensaje para
  `fundacion.bosque_denso`.
- Mensajes para los rechazos nuevos `mision.*` y `tablon.*`.

### Cambiado
- **Alijos**: traen una sola cosa (oro, madera, piedra o trigo); la ficha dice qué y cuánto.
- **Subida a nivel 2**: los requisitos enseñan la Granja a nivel 2 (`edificiosConNivel`).
- El radio de la zona inicial (vista previa de Fundar) se lee de `reglas.territorio` de `/v1/datos`.
- F1 «Una capital»: «Funda la primera plaza de tu Facción».
- Los plazos largos se dicen en horas o días («3 h», «2 d»), no en cientos de minutos.

## [0.40.2] — 2026-10-28 · cifras de producción · sync con `VRhino/BronzeAge@f4585ac`

### Corregido
- **Producción**: las cifras enteras salen sin decimales («0/min», no «0.0/min»), y los negativos pequeños con un decimal.
- El neto de un recurso con el almacén lleno lo dice («almacén lleno»): lo que se produce de más se pierde y el neto sale 0.

## [0.40.1] — 2026-10-28 · suelo de la plaza, error de reclutar en unidades y borrar avisos · sync con `VRhino/BronzeAge@f4585ac`

### Cambiado
- **Vista de asentamiento** sin rejilla: el fondo toma el color del terreno donde está la plaza en el mapa (llano, colina, costa…),
  moteado, con bosquecillos en los bordes.
- **Reclutar sin trigo de reserva**: el mensaje da unidades («la reserva de 70 y hay 21»), no milésimas.

### Añadido
- **Avisos urgentes**: cada tarjeta lleva a su derecha una × para borrarla.

## [0.40.0] — 2026-10-28 · Centro urbano reordenado · sync con `VRhino/BronzeAge@f4585ac`

### Cambiado
- **Subida de nivel** fuera de las subpestañas, entre las pestañas de edificio y las del Centro urbano: el botón arriba (apagado si no se
  cumple o no eres Gobernador) y los requisitos debajo en un panel plegable.
- **Producción** y **Recetas** en una sola pestaña, cada elemento plegable. La producción enseña ahora los extractores y granjas activos
  por tipo (el motor no publicaba la producción por edificio y salía vacía), con el neto real de cada recurso (la tendencia del almacén),
  la base del catálogo y la mano de obra.
- **Cargos**: cada cargo con quien lo ocupa (o «vacante») y un botón «Cambiar» al lado; el combo ocupa el sitio del nombre y el botón pasa
  a «Asignar». Se ven aunque no puedas nombrar.
- **Muralla** oculta hasta que la plaza llega a nivel 2; cada anillo dice el nivel que pide (empalizada 2, piedra 3, adarve 4; antes ponía 3).
- **Aliados** deja de ser pestaña: va al final de «Puerta». **Información**, la última pestaña.
- **Fundación**: los requisitos en verde si se cumplen y en rojo si no.

## [0.39.3] — 2026-10-28 · carro al salir, víveres al entrar, carro del ejército y círculo de Fundar · sync con `VRhino/BronzeAge@f4585ac`

### Arreglado
- **Carga del carro al salir**: el oro del almacén no salía en la lista (se excluía desde que había oro de botín aparte); si solo tenías
  oro decía que no había nada que cargar. Ahora se carga como cualquier recurso.
- **Círculo de Fundar**: pintaba la zona inicial con 30 u (el radio del TypeScript) y contaba los nodos y bosques de ese círculo. El motor
  funda con 6 u (`ReglasTerritorio.radio_inicial`); el círculo y la lista de recursos usan ahora 6, con los nombres de los recursos.

### Añadido
- **Víveres al entrar en tu residencia**: al entrar en tu campamento, el cliente pide `repostarEnCampamento` (gratis) si no los tienes al
  máximo, así la siguiente salida sale llena aunque la ración de salida aún no toque.
- **Carro en el panel Ejército** del mapa (⚑): el mismo bloque de carro y almacén que en «Lo que llevas», cuando vas en un ejército.

## [0.39.2] — 2026-10-28 · nodos de hierro en el mapa · sync con `VRhino/BronzeAge@f4585ac`

### Arreglado
- Los **nodos de hierro** salían como un círculo blanco enorme: el mapa no conocía el hierro (ni icono ni color). Ahora se pintan como
  el cobre y el estaño, con el icono de mena en gris acero y la palabra «Hierro». Añadidos también los nombres, colores e iconos de
  hierro, lingote, armas de hierro, armadura de bronce de calidad, carro de guerra y chatarras.

## [0.39.1] — 2026-10-28 · fuera el «oro de botín» · sync con `VRhino/BronzeAge@f4585ac`

### Quitado
- El **oro de botín** como bolsa aparte (ya no existe en el motor): el oro de los bandidos y de los alijos es oro normal y va al carro de
  la columna (lo que no cabe se pierde). Fuera la línea del panel Carro, la casilla del Resumen del campamento y los textos de ayuda.
  En el mercado y la taberna del campamento se paga con el oro del almacén (si resides) o del carro (si no).

## [0.39.0] — 2026-10-27 · pueblos y aldea agrícola · sync con `VRhino/BronzeAge@7086ebc`

### Añadido
- **Pestaña «Pueblos»** del Centro urbano: cupo por nivel de la plaza, lista de pueblos (almacén, rebaño, fertilidad, carro) y de obras
  (pendiente de materiales, levantándose), con **Mejorar** la aldea, **Reponer carro**, **Destruir** y **Cancelar** obra. Con cupo libre,
  el Gobernador o el Maestro de Obras residentes marcan una **aldea agrícola** (eligiendo el sitio en el mapa, con la zona de la plaza
  resaltada) o un **extractor** sobre un nodo libre de piedra o mineral de la zona (desde el nivel 2). El coste que se enseña incluye el
  carro de acarreo con su buey.
- **Obras y pueblos en el mapa**: icono de aldea, de pueblo y de obra. La ficha de una obra dice qué pide, qué falta y cuándo termina, y
  trae **«Entregar materiales»**, que entrega lo que lleve la columna (primero el carro, luego las caravanas) si está a la puerta; si no,
  «Ir» la lleva hasta ella.
- **Subida de nivel** en el Resumen: requisitos del nivel siguiente (pesants, edificios activos, aldea activa, coste en el almacén) con
  ✓/✗ y el botón para pedirla.

## [0.38.5] — 2026-10-27 · contrato de la aldea agrícola y la cría · sync con `VRhino/BronzeAge@7086ebc`

### Cambiado
- Contrato regenerado de 7086ebc (foto BAN47: hace falta partida nueva y el artefacto de mundo nuevo, sin nodos de ganado). Mensajes para
  los rechazos nuevos: `ascenso.falta_aldea` (el nivel 2 pide una aldea agrícola activa), `obra.solo_en_aldea` (el Corral va en la aldea) y
  los de marcar y mejorar la aldea (`pueblo.*`). La interfaz de pueblos y de la aldea aún no está en el cliente.

## [0.38.4] — 2026-10-27 · fundar con la Caravana de Fundación enganchada · sync con `VRhino/BronzeAge@52fb7d4`

### Arreglado
- **Fundar** (panel ⌂ del mundo): con la Caravana de Fundación enganchada no salía «Fundar aquí», porque se buscaba en
  `caravanasAdjuntasIds` (las comerciales) y la de fundación viene ahora en `Ejercito.caravanaFundacionId`. Funda el Líder de la columna;
  a los demás se les dice quién. Si el sitio no vale, se explica por qué (cerca de un campamento o de otra plaza, agua, cima…) en vez de
  enseñar solo las coordenadas.

## [0.38.3] — 2026-10-27 · rastreador de misiones arriba a la derecha · sync con `VRhino/BronzeAge@52fb7d4`

### Cambiado
- En el mundo, el **rastreador de misiones** pasa de arriba a la izquierda a arriba a la derecha, para no chocar con los menús de ese lado.
  La ficha de Selección, que abre en la misma esquina, queda por encima. En la plaza y el campamento sigue al principio de la columna izquierda.

## [0.38.2] — 2026-10-27 · marcha forzada junto a los víveres · sync con `VRhino/BronzeAge@52fb7d4`

### Cambiado
- **Marcha forzada** también en la barra de víveres del mundo, a su izquierda: botón «» Marcha forzada», encendido (terracota) cuando está
  puesta y apagado cuando no. Solo el Líder lo pulsa; los demás ven el estado. Sigue también en el panel ⚑.

## [0.38.1] — 2026-10-27 · la Caravana de Fundación espera dentro y se la lleva el ejército · sync con `VRhino/BronzeAge@52fb7d4`

### Cambiado
- **Caravana de Fundación** (motor d8ef09c): ya no sale al mapa al lanzarla o comprarla; espera dentro de su plaza o campamento. Al preparar
  un ejército allí, el Líder ve «¿Os lleváis la Caravana de Fundación?» (No / Sí, llevar car-N con lo que lleva) y, al pulsar «Salir con el
  ejército», se manda con `partirConvocatoria.caravanaFundacionId`. La que espera dentro no se pinta en el mapa; la enganchada va detrás de
  su ejército por `Ejercito.caravanaFundacionId`, también en los ejércitos ajenos avistados. Textos del Fondo del campamento y de la pestaña
  Fundación de la plaza al día; mensajes para `fundacion.no_esta_aqui`, `caravana.desconocida`, `caravana.faccion_ajena` y
  `columna.personal_sin_caravanas`.
- **Textos de las misiones** del catálogo del motor (`GET /v1/datos`, `Misiones_Textos.TEXTOS_MISIONES`): títulos, textos y nombres de las
  barras. Los del cliente quedan de reserva.

## [0.38.0] — 2026-10-27 · misiones · sync con `VRhino/BronzeAge@7b949f7`

### Añadido
- **Misiones** (mecánica 49 del motor; hace falta partida nueva, foto BAN46). Botón **Misiones** en la barra con pestañas Mías, Mi plaza y
  Mi Facción: cada misión con su texto, su recompensa y una barra por condición. Las siguientes son sorpresa: solo se ven al activarse, con
  un aviso «Nueva misión» y la marca «nueva». **Reclamar** (`reclamarRecompensa { duenoId, misionId }`) cuando está cumplida, solo quien
  puede: las tuyas tú, las de la plaza su Gobernador (o un residente si no hay), las de la Facción el Rey; a los demás se les dice quién.
- **Rastreador** de hasta 3 misiones seguidas (Seguir / Dejar de seguir, guardado en este navegador): flota arriba a la izquierda en el
  mundo y va al principio de la columna izquierda en la plaza y el campamento; se pliega, y al pulsar una abre el panel en su pestaña. Las
  tuyas nuevas entran solas mientras haya hueco; las reclamadas salen.
- Contador de cumplidas por reclamar en el botón Misiones; avisos `mision.cumplida` (urgente) y `mision.reclamada`.
- Subpestaña **Misiones** en el Centro urbano de la plaza y lista de misiones al final de la pestaña Facción.
- Textos: los publicará el motor en un catálogo de `GET /v1/datos` (se usa en cuanto llegue); mientras, el cliente lleva los del diseño.

## [0.37.1] — 2026-10-27 · el ejército con la Caravana de Fundación la lleva pegada detrás · sync con `VRhino/BronzeAge@6bf35ee`

### Añadido
- **Caravana enganchada, pegada detrás de su columna en el mapa**: un carromato (`delapouite/caravan`, icono `caravanaFundacion`) si es la
  Caravana de Fundación, un triángulo pequeño si son comerciales; va al lado contrario de hacia donde marcha y se mueve con ella. Ya no se
  pinta encima de la columna como una caravana suelta. La de fundación no viene en `caravanasAdjuntasIds`: se reconoce por estar `adjunta`
  con su titular en la columna. La de fundación suelta también se pinta con el carromato.

## [0.37.0] — 2026-10-27 · marcha forzada · sync con `VRhino/BronzeAge@6bf35ee`

### Añadido
- **Marcha forzada** en el panel Ejército (⚑) del mundo: el Líder de la columna (también la personal) la pone o la quita con un botón
  (`marchaForzada { ejercitoId, activa }`). Va ×1,5 de rápido y, solo mientras marcha, come ×2 de víveres; se queda puesta hasta que se quita.
  Los demás integrantes ven si está puesta. El plan y el ritmo de víveres ya llegan recalculados del motor.

### Contrato
- Regenerado desde `6bf35ee` (`Orden.marcha_forzada`, `Ejercito.marcha_forzada`).

## [0.36.2] — 2026-10-27 · solo se ve la tropa desbloqueada · sync con `VRhino/BronzeAge@3edba48`

### Cambiado
- **Campamento de mercenarios**: la pestaña Tropa ya no enseña las tropas que el campamento no ha desbloqueado (antes salían apagadas).
  Si no tiene ninguna, lo dice.
- **Asentamiento**: el reclutamiento escondía lo no adoptado solo si el servidor mandaba la tecnología, y el motor la manda en otra entidad
  (`TecnologiasFaccion` del ámbito FACCION), así que salía todo. Ahora la proyección lleva `tecnologiasAdoptadas` y se esconde lo que tu
  Facción no ha adoptado.

## [0.36.1] — 2026-10-27 · nombres de héroes en vez de ids · sync con `VRhino/BronzeAge@3edba48`

### Corregido
- **Salían ids de héroe (`heroe-59`) en vez de su nombre** en la Facción (Rey, Embajador, solicitudes), las convocatorias (Líder,
  integrantes, peticiones), las columnas, los cargos y los avisos. Cada mensaje del servidor trae ahora `nombres_heroes` con el nombre de
  los héroes que nombra; el cliente los junta en el almacén (`Almacen.nombresHeroes`, solo se añaden) y `nombreDeHeroe` los usa. Un héroe
  sin nombre (creado antes de c5c6111) sale como «Héroe N», nunca como su id.

### Contrato
- Regenerado desde `3edba48` (`MensajeDeServidor.nombres_heroes`, campo 12).

## [0.36.0] — 2026-10-27 · árboles y bosques como el admin · sync con `VRhino/BronzeAge@f3b8226`

### Cambiado
- **Árboles y bosques pintados como el admin web**: de cerca, cada árbol es una copa redonda de verde variable con su sombra y un brillo
  (antes, triángulos oscuros), ni en el agua ni en las cimas; el suelo del bosque se oscurece según la densidad y, de lejos, el bosque se
  mezcla con el verde del admin (hasta un 85 %, con la luz de la altura).
- **Nodos como el admin**: de lejos, su icono pequeño (antes, un punto); la piedra en gris piedra. El anillo de protección de los
  campamentos de mercenarios, con la misma opacidad que el admin.

## [0.35.2] — 2026-10-27 · iconos de pueblo y avanzada · sync con `VRhino/BronzeAge@f3b8226`

### Añadido
- `src/mundo/iconosMapa.json` lleva también `pueblo` (`delapouite/hut`) y `avanzada` (`delapouite/watchtower`), para que el admin web use los
  mismos iconos. Este cliente aún no pinta pueblos ni avanzadas.

## [0.35.1] — 2026-10-27 · aviso del mundo abajo a la izquierda y víveres del ejército · sync con `VRhino/BronzeAge@f3b8226`

### Corregido
- **El aviso del mundo quedaba debajo de la barra de víveres** (los dos abajo en el centro). Ahora sale abajo a la izquierda.
- **Víveres de un ejército: «700 / 350» con dos héroes.** El tope es `capacidadViveresPorHeroe` por cada héroe de la columna, como en el
  motor (`racion::capacidad_viveres`): ahora sale «700 / 700» y baja a medida que comen.

## [0.35.0] — 2026-10-27 · convocar ejército funciona, y una cuenta en dos pestañas ya no parpadea · sync con `VRhino/BronzeAge@f3b8226`

### Corregido
- **«Convocar ejército» dejaba el botón apagado y no salía nada.** El motor sí creaba la convocatoria, pero el cliente no leía las
  `Convocatoria` del contrato (salían siempre vacías). Ahora se proyectan: la tuya (`miConvocatoriaId`) y las de tu Facción en el lugar donde
  estás, con sus integrantes, peticiones y política. De las escuadras de otro héroe se dice cuántas son; sus hombres, solo si se conocen.
- **Una cuenta abierta en dos pestañas se echaban una a la otra sin parar.** El motor admite una sola sesión por cuenta y cierra la vieja
  (`sesion.reemplazada`); el cliente reconectaba solo y echaba a la otra, en bucle. En cada vuelta se vaciaban los ámbitos: la pestaña
  Facción saltaba a «sin Facción», las convocatorias aparecían y desaparecían. Ahora la pestaña sustituida se queda quieta y lo dice, con
  un botón «Jugar en esta pestaña».
- La sesión ya no procesa lo que llega por una conexión vieja tras reiniciarla (su secuencia se tomaba por un hueco y volvía a reiniciar).

## [0.34.3] — 2026-10-27 · recargar la página no se queda en «Cargando partida» · sync con `VRhino/BronzeAge@f3b8226`

### Corregido
- **Al recargar con la sesión abierta, «Cargando partida…» para siempre.** Desde la 0.34.2 la primera proyección llega en cuanto está el
  héroe, y el ámbito `CAMPAMENTO` viene justo detrás. Si el héroe estaba en un campamento, se montaba su pantalla sin él: caía en
  «Cargando» pero quedaba marcada como montada y ya no se volvía a montar. Ahora, mientras falte el campamento, la pantalla es «Cargando» y
  se monta el campamento en cuanto llega.

## [0.34.2] — 2026-10-27 · la pantalla de partidas ve tu héroe · sync con `VRhino/BronzeAge@c5c6111`

### Corregido
- **«Eres miembro, aún sin héroe» con héroe.** Nada más iniciar sesión se proyectaba antes de que llegase el ámbito `HEROE` (su foto viene
  justo detrás de la Bienvenida). Si la Bienvenida trae `heroe_id`, ahora se espera a ese ámbito (como mucho 5 s) antes de listar las
  partidas o de proyectar.

## [0.34.1] — 2026-10-27 · la pestaña Facción no salta a «sin Facción» · sync con `VRhino/BronzeAge@c5c6111`

### Corregido
- **La pestaña Facción alternaba entre tu Facción y las opciones de quien no tiene.** No se reprodujo aquí; la causa posible es que el
  ámbito `FACCION` falte un momento (una incoherencia lo tira hasta que vuelve como foto, o una reconexión). Ahora la proyección conserva la
  última ficha de la Facción propia, y si aun así falta, la pestaña dice «Cargando tu Facción…» en vez de ofrecer crear una o pedir
  ingreso. Si vuelve a pasar, la consola dirá `[sesion] incoherencia` con el motivo.

## [0.34.0] — 2026-10-27 · nombre del héroe, Facciones para quien no tiene y precios del campamento · sync con `VRhino/BronzeAge@c5c6111`

### Corregido (con el motor c5c6111)
- **El héroe sale con su nombre**, no «Héroe N». El campo admite de 1 a 24 caracteres (`heroe.nombre_invalido` si no). Los héroes creados
  antes de c5c6111 no tienen nombre en el motor y siguen saliendo «Héroe N».
- **«Pedir ingreso» lista todas las Facciones** a quien no tiene Facción: el motor las manda en la VISTA, con sigilo, integrantes y nivel.
  El Rey solo se nombra si se conoce su nombre (el id no dice nada).
- **Mercado del campamento con precio**: «Pagas», «Te queda» y el precio por unidad salen de `precios_mercado` (millonésimas de oro; n
  unidades cuestan ⌈n·p⌉), con la reputación ya aplicada.
- **Reclutar ya no se queda en «Cargando las tropas…»**: las tropas, su precio por soldado y si están desbloqueadas salen de `reclutables`;
  los reclutas, de `poblacion` (tope = `maximo`).

## [0.33.1] — 2026-10-27 · la lista de Facciones enseña el sigilo y los integrantes · sync con `VRhino/BronzeAge@79a754b`

### Cambiado
- **«Pedir ingreso»**: cada Facción de la lista lleva su sigilo y cuántos integrantes tiene, además del nivel y el Rey.
  La lista seguirá vacía para un héroe recién creado hasta que el motor mande todas las Facciones (pedido al motor);
  tampoco el nombre del héroe sale aún (el motor lo descarta y proyecta «Héroe N»; pedido también).

## [0.33.0] — 2026-10-27 · iconos en el mapa del mundo · sync con `VRhino/BronzeAge@79a754b`

### Cambiado
- **El mapa del mundo pinta iconos de game-icons.net** (la misma librería y licencia CC BY 3.0 que los emblemas del sigilo; trazados en
  `src/mundo/iconosMapa.json`, se pintan con `mundo/iconosMapa.ts`):
  - campamento de bandidos: una capucha oscura con halo rojo (`lorc/hood`), en lugar del rombo rojo;
  - campamento de mercenarios: una tienda de campaña azul (`delapouite/barracks-tent`), con su anillo de protección;
  - columnas propias y avistadas: un casco con cresta en el color de su Facción (`lorc/crested-helmet`) y, si marchan varios, cuántos son;
    la mira de tu columna rodea el casco sin taparlo;
  - nodos de recurso de cerca: mena para cobre, estaño y oro (`faithtoken/ore`), vaca para el ganado y montón de piedras para la piedra,
    con su nombre en castellano;
  - alijos: un cofre dorado (`skoll/open-treasure-chest`).
- Los autores nuevos (Faithtoken) están en `src/sigilo/CREDITOS.md`.

## [0.32.5] — 2026-10-27 · mercado del campamento sin «—» · sync con `VRhino/BronzeAge@79a754b`

### Corregido
- **«Pagas» y «Te queda» salían con «—» en el Mercado del campamento.** El motor no manda el precio por unidad de lo que vende el campamento:
  lo calcula al comprar con el stock de todas las plazas del mundo (precio de referencia × `margen`), que el cliente no ve. Mientras no lo
  publique, esas dos casillas no se pintan y una nota explica que el precio se cobra al comprar. La compra ya funcionaba.
- **El cupo de hoy no salía.** Se calcula del contrato: `cupo_diario` del campamento menos lo que el héroe compró hoy (`Heroe.cupo_campamento`,
  que vuelve a cero al cambiar el día de mundo), solo para el residente.

## [0.32.4] — 2026-10-27 · el fondo de refundación cuenta lo aportado · sync con `VRhino/BronzeAge@2150620`

### Corregido
- **Aportar al fondo no movía la barra.** El motor manda el fondo ya sumado por Facción (`fondos` por `f-N`), y el cliente lo buscaba por héroe,
  así que siempre lo veía vacío. Como lo de cada héroe no viaja, se quita el «tú: N».
- **El Fondo no veía el carro.**
  - Se aporta del almacén si resides aquí, o del carro de tu columna si la tienes (de visita). Cada opción dice de dónde sale y el `lado`
    de la orden va con ella.
  - El carro que traes dentro de tu residencia el motor no lo deja aportar directamente. El Fondo lo enseña con el botón «Pasar al almacén».

## [0.32.3] — 2026-10-27 · el carro dentro de tu campamento · sync con `VRhino/BronzeAge@2150620`

### Corregido
- **Dentro del campamento el carro salía vacío, aunque fuera llevaba el oro del botín.** En el motor, al entrar en tu residencia el carro sigue
  contigo (`Heroe.fuera_carro`) y no pasa solo al almacén. El cliente no leía ese campo.
  - El panel Carro enseña ahora «Tu carro» con lo que traes y un botón «Pasar al almacén» (orden `vaciarCarro`). Lo que no cabe en el
    almacén se queda en el carro.
  - La carga de salida, del campamento o de una plaza, cuenta lo que ya llevas en el carro: «132 / 500» y «Ya llevas en el carro, y sale
    contigo: 132 Oro».

## [0.32.2] — 2026-10-27 · vuelven los avisos y el informe de combate · sync con `VRhino/BronzeAge@2150620`

### Corregido
- **No salía ningún aviso ni el informe al atacar un campamento de bandidos.** Los avisos leían los eventos con el cursor del REST
  (`consultarEventos`), y en el paso al motor esa función se quedó devolviendo siempre una lista vacía. Ahora los eventos que llegan en las
  `Delta` de la sesión se guardan al llegar, se cuentan una sola vez aunque lleguen por dos ámbitos, y los avisos los recogen en cada refresco.
- El informe contra bandidos usa la forma del motor:
  - El poder y el oro llegan en milésimas.
  - Las bajas llegan en total, no por escuadra.
  - Los héroes que iban salen del `heroes_ids` del evento.

## [0.32.1] — 2026-10-27 · sin parpadeos y el mundo con niebla · sync con `VRhino/BronzeAge@2150620`

### Corregido
- **Los campamentos titilaban en el modo mundo.** Al seguir a la columna, la cámara movía el mundo fracciones de píxel en cada fotograma.
  El borde suavizado de lo pequeño (campamentos, nodos) cambiaba de uno a otro. Ahora el desplazamiento va a píxel entero.
- **La planta del campamento de mercenarios desaparecía y volvía.**
  - Si en un refresco la planta no está, se deja la que hay en vez de vaciar el lienzo.
  - Se elige la del campamento donde estás, por su id.
  - Si un ámbito llega incoherente, la sesión tira solo ese ámbito y lo pide de nuevo. Antes vaciaba el almacén entero hasta reconectar,
    y por un momento no había nada que pintar.
  - Al reconectar, la `VISTA` anterior se conserva hasta que llega la nueva.

### Cambiado
- **Modo mundo:** se pinta todo lo que cabe en pantalla y la niebla de guerra tapa lo que no ves, como en el resto del juego. Se quita el
  recorte en círculo de 1,5 veces la visión. El suelo sigue por baldosas.
- Contrato regenerado desde el motor 2150620. Los cambios son aditivos: escuadras en avanzadas, almacén de la avanzada por recurso,
  héroes de campo en `HEROE` y `TAMANOS_MAPA` en los datos de juego.

## [0.32.0] — 2026-10-27 · modo mundo y modo mapa, ruta discontinua · sync con `VRhino/BronzeAge@e11979e`

### Cambiado
- **Modo mundo** (la pantalla donde está tu columna, la de mover con clic e interactuar):
  - Tiene dos zooms: tu visión llenando la pantalla y 1,5 veces tu visión. La rueda y los botones +/− saltan de uno a otro.
  - La vista va siempre pegada a tu columna y no se arrastra.
  - Solo se pinta el círculo de 1,5 veces tu visión a tu alrededor. De lo que cae fuera no se recorre nada: terreno, ríos ni nodos.
  - El suelo se hace por baldosas fijas de 8 u, con los árboles dentro, y se guardan. Al marchar solo se calculan las que entran por
    delante. Antes se volvía a muestrear la vista entera y se trazaban los árboles uno a uno en cada fotograma.
- **Modo mapa**: el botón «Mapa» de la barra sale ahora en todas las pantallas, también en el mundo. Abre el mapa grande con zoom libre
  (desde el mundo entero hasta tu visión) y arrastre, solo para mirar: un clic no manda marchar. Mientras está abierto, el mundo de debajo
  no se pinta. «Mis cosas» y el panel de ejército abren el modo mapa en el sitio elegido, en vez de mover la vista del mundo.
- **La ruta de las columnas y las caravanas es discontinua.** Su grosor, el trazo y el glifo de la columna (racimo, mira, aspa del destino)
  se escalan con el zoom entre un mínimo y un máximo (`factorDeGlifo`). Antes iban en px fijos, y la columna quedaba enorme al lado de su
  ruta.

## [0.31.2] — 2026-10-27 · atacar a los bandidos y la marcha fluida · sync con `VRhino/BronzeAge@e11979e`

### Corregido
- **No se podía atacar un campamento de bandidos.** Había cuatro causas:
  - La orden llegaba al motor sin objetivo. El `oneof` de los objetivos se llama `tipo`, igual que el `{ tipo, id }` del REST, y el
    traductor no lo reconocía. Por lo mismo, tampoco funcionaba marchar a una plaza por su id. Lo cubre `pruebas/ordenes.test.ts`.
  - La protección de los campamentos de mercenarios era de 60, la del backend TypeScript. El motor usa 10 (`MERCENARIOS.radioProteccion`).
    Los bandidos están a 30-50 de su campamento, así que el botón salía siempre desactivado.
  - El radio de ataque era 15. El motor exige `LOGISTICA.radioEncuentro`, que hoy vale 3.
  - Se pedían soldados en la columna. Contra bandidos y columnas el héroe suma su poder y puede atacar solo. Solo el asedio pide soldados.
- **La columna avanzaba a saltos.** El motor manda el plan de marcha y nada más mientras se anda, y el mapa solo se repintaba con un cambio o
  con el sondeo de 3 s. Ahora, mientras algo tuyo marcha, se repinta a ~30 fps con la posición del plan en ese instante
  (`proyeccionAlInstante`). Si no has movido la vista, la cámara sigue a tu columna.
- La ruta de una columna empieza en su posición actual. Antes, en el último tramo no se dibujaban la ruta ni el aspa del destino.

### Cambiado
- El «balance» del cliente sale ahora de los datos de juego del motor (`GET /v1/datos`): niveles de bandidos, logística, catálogos y demás.
  Antes iba vacío y se usaban cifras copiadas del backend TypeScript.

## [0.31.1] — 2026-10-27 · el clic del mapa mueve, víveres de la columna y contrato al día · sync con `VRhino/BronzeAge@e11979e`

### Corregido
- Con el mapa a escala de visión, un clic no movía al héroe: los radios de agarre (20 a 45 unidades) cubrían media pantalla y el clic caía
  sobre tu propia columna o el campamento, así que la orden iba a donde ya estabas. Ahora el radio se mantiene en los px que medía antes
  (`ui/agarre.ts`). Un destino al otro lado del río sigue saliendo como «no hay ruta por tierra hasta el destino», como lo decide el motor.
- Los víveres salían 0/350 al salir al mundo: el motor los lleva en la columna (`Ejercito.viveres`) y la interfaz los leía del héroe.

### Contrato (paridad P7 del motor)
- Regenerado desde `e11979e`, sin cambios que rompan nada.
- La planta del campamento llega del motor (`CampamentoMercenarios.planta`, `trazado` y `empalizada`) y se dibuja con el plano de siempre.
- Los caminos del mapa usan los tramos ya fundidos (`RedCaminos.tramos`).
- La muralla en mejora cuenta las celdas ya mejoradas (`Recinto.mejoradas`).

## [0.31.0] — 2026-10-26 · el mapa a la escala de visión del jugador · sync con `VRhino/BronzeAge@49e285f`

El mapa del mundo pasa de escalar por CSS una imagen del mundo entero (zoom 1 a 4) a una cámara que repinta la vista. Mismo modelo que
el cliente de administración (pedido por el autor el 2026-10-26).

### Cambiado
- Cámara `{ escala, cx, cy }` en unidades (`ui/geometriaVista.ts`, `ui/pantallaMapa.ts`). El zoom va del mundo entero llenando la pantalla
  a la **escala de visión**: el diámetro de lo que ve el héroe ocupa el lado corto. El mapa arranca ahí, centrado en tu columna. El radio
  sale de los datos de juego del motor (`GET /v1/datos`, `Movimiento_Ejercitos.VISION.jugadorSolo`, 15 hoy). Rueda: zoom hacia el cursor.
- Terreno del artefacto (`mundo/pintarArtefacto.ts`). De lejos, una celda por píxel con relieve, bosque y ríos. De cerca (10 px por celda o
  más), la vista muestreada a media resolución: relieve continuo, bordes de clase orgánicos, árboles sueltos a escala real, ríos con su
  anchura (1,5 u, 3 navegables) y orilla, parcelas como círculo de 4 u, piedra como roca, y metales y ganado como rombo con nombre.
- Los marcadores (columnas, plazas, caravanas...) siguen en px fijos. La niebla se compone una vez por proyección.
- La vista guardada del mapa pasa a `bronze.vistaMapa.v2.<partida>`. La vieja (zoom y pan en px) se ignora.

## [0.30.2] — 2026-10-26 · dependencias sin vulnerabilidades conocidas

### Seguridad
- `npm audit` daba 7 avisos (2 críticos en `vitest` 2 por `tinypool`, 2 altos en `vite` 5 y `source-map-js`), todos de herramientas de
  desarrollo. Ahora van `vite` 6.4.4 y `vitest` 4.1.12, fijados sin `^`, y `npm audit` da 0 vulnerabilidades. Las dependencias que llegan
  al navegador (`@bufbuild/protobuf` 2.16.0, `fzstd` 0.1.1) no tenían avisos y no cambian.
- El lock se regeneró con `npm install --before=2026-10-19`: ninguna versión tiene menos de una semana publicada, para no instalar una
  versión recién publicada que pudiera estar comprometida.
- `.npmrc`: `ignore-scripts=true` (ninguna dependencia ejecuta scripts al instalarse), `save-exact=true` y `legacy-peer-deps=true`
  (npm 10 se cuelga con los peers opcionales de `vitest` 4).

## [0.30.1] — 2026-10-26 · alta de cuenta con las reglas del motor · sync con `VRhino/BronzeAge@49e285f`

### Corregido
- El formulario pedía una contraseña de 6 caracteres, pero el servicio de acceso del motor exige de 8 a 128 (y un nick de 3 a 32: letras,
  cifras, «_», «-» o «.»); con menos, el registro fallaba con `datos_invalidos`. Ahora el campo pide 8 (`minlength`), al marcar «crear
  una» se ven los requisitos, y si el motor devuelve solo el código, la interfaz lo explica (`datos_invalidos`, `nick_repetido`,
  `credenciales_invalidas`, `codigo_incorrecto`).

## [0.30.0] — 2026-10-26 · fase 7, tanda C3: la interfaz juega contra el motor en Rust · sync con `VRhino/BronzeAge@164235d`

La interfaz de siempre ya no habla con el REST del backend TypeScript: `apiCliente.ts` conserva su superficie y por debajo va por la
sesión del contrato 05, con un adaptador (decisión del autor del 2026-10-26). Probado en el navegador contra `bronzeage-servidor`:
registro, entrar, crear el héroe, el campamento, salir al mundo con la columna y el mapa del artefacto.

### Añadido
- **Adaptador de lectura** (`src/motor/proyeccion.ts`): el almacén por ámbito a la `ProyeccionJugador` de siempre (Facciones, la plaza
  donde estás con su interior y su trazado, plazas avistadas y recordadas, columnas propias y ajenas con su posición evaluada del plan
  con el reloj sincronizado, caravanas, héroe con escuadras, campamentos, bandidos, alijos, niebla, zonas, caminos, relaciones, títulos,
  órdenes de mercado y trueques). Pasa unidades (milésimas → unidades) e instantes (desde 2026-01-01 → época Unix).
- **Adaptador de escritura** (`src/motor/ordenes.ts`): `ejecutarComando(tipo, params)` → `Orden` del contrato por el descriptor
  generado: el `tipo` es el caso del `oneof` (`marcharA` ↔ `marchar_a`), cantidades y coordenadas a milésimas, instantes al cero del
  contrato y los objetivos `{ tipo, id }` al caso de su `oneof`. Un comando que el contrato no tiene responde `comando_desconocido`.
- La VISTA se pide sola (el mundo entero; el servidor filtra por la niebla) en cuanto hay héroe.
- Mapa con la proporción del mundo (2.667 × 2.000): el lienzo y el zoom ya no suponen un mundo cuadrado.
- En `npm run dev`: `?sinNiebla` quita la niebla del mapa y `sesionBronzeAge` en la consola es la sesión.

### Cambiado
- `apiCliente.ts`: login y registro contra el servicio de acceso del motor; una sola partida («Mundo»); la proyección se calcula del
  almacén sin viaje de red; el «tick» del tiempo real es cada cambio que llega por la sesión. El servidor se busca en el mismo host,
  puerto 7878 (`VITE_API_BASE` lo cambia); sin proxy de Vite.

### Pendiente (C4+)
- El motor no publica el balance (`/v1/balance`): los paneles usan sus valores por defecto.
- Sin traducir aún: batallas, convocatorias, informes de inspección y de plaza, propuestas diplomáticas, Aedas, tecnología propia,
  pueblos, avanzadas y obras de mapa. La planta del campamento no viaja en el motor.
- Revisar panel a panel los parámetros de cada comando contra `Comandos_Parametros.md` del motor.

## [0.29.1] — 2026-10-26 · fase 7, tanda C2: el mapa desde el artefacto de mundo · sync con `VRhino/BronzeAge@164235d`

### Añadido
- **Artefacto de mundo** (`src/mundo/artefacto.ts`): lo baja por hash de `InfoMundo.url_artefacto`, lo guarda en IndexedDB (solo el vigente) y lo convierte al `MapaGenerado` de siempre en unidades estratégicas, con sus rasters (`terreno`, `altura`, `densidad_bosque`), bosques, nodos y ríos.
- **Render**: con rasters, `pintarBiomas` pinta la clase de terreno del artefacto (una celda por píxel) y el sombreado sale de la altura del artefacto con interpolación bilineal; sin ellos sigue el camino viejo del ruido (`src/terreno/`), que se irá con el REST.
- Prueba con el artefacto real del motor (`generador/salida/mundo/`, si se ha generado).
- Contrato regenerado desde `164235d` (el proto no cambia; el almacén de este cliente ya guardaba `NodoRecurso` y `MemoriaFaccion`, el hueco que el motor cerró en el suyo).

## [0.29.0] — 2026-10-26 · fase 7, tanda C1: la sesión del contrato 05 · sync con `VRhino/BronzeAge@c7f4e60` (`main`, tras la 7B)

El cliente vuelve como cliente del motor en Rust (fase 7). Esta tanda pone solo la capa de transporte nueva, `src/contrato/`, al lado de
`apiCliente.ts`; la interfaz todavía habla con el REST viejo y pasará a la sesión nueva por un adaptador (decisión del autor del 2026-10-26).

### Añadido
- **Contrato generado** con `buf generate` desde `proto/` del motor (`src/contrato/gen/`, `npm run contrato`; la revisión usada queda en `src/contrato/REVISION`).
- **Acceso** (`src/contrato/acceso.ts`): `POST /v1/registro`, `POST /v1/sesiones` y la descarga del artefacto de mundo por hash.
- **Sesión** (`src/contrato/sesion.ts`): WebSocket binario con `Hola`/`Bienvenida`, zstd, secuencia sin huecos, `ordenar()` con respuesta causal, crónica por páginas, `VISTA`, reloj de mundo sincronizado por `Ping`/`Pong` y reconexión con reanudación por versión. Abre como `CLIENTE_UNITY` hasta que el contrato tenga un tipo para el cliente web de jugador.
- **Almacén por ámbito** (`src/contrato/almacen.ts`, `plaza.ts`, `niebla.ts`): puerto del almacén de referencia del motor (`crates/contrato`), con la plaza parcial por máscara y la niebla parcial por tramos.
- **Pruebas** (`npm test`, vitest): los 88 dorados del contrato, el almacén y, con `BRONZEAGE_URL`, una partida contra un `bronzeage-servidor` real (registro, login, `crear_heroe`, artefacto de mundo, `VISTA` con niebla y reanudación sin novedad).

### Notas
- El motor ignora por ahora el nombre de `crear_heroe`: el héroe nace como «Héroe N» (valores por defecto hasta el catálogo de Conquest).

## [0.28.2] — 2026-10-09 · sigilo completo en la lista de partidas (cuando el backend lo mande)

### Cambiado
- **Partidas:** la tarjeta de tu héroe dibuja el sigilo completo de su Facción si `GET /jugador/partidas` trae `heroe.faccion.sigilo` (pedido al backend: solo el de tu propia Facción, ~100 bytes por partida); mientras no llegue, sigue el símbolo suelto.

## [0.28.1] — 2026-10-09 · sigilo completo en la etiqueta de ciudad de los trueques

### Cambiado
- **Trueques:** la etiqueta de cada ciudad (`ui/etiquetaCiudad.ts`) dibuja el **sigilo completo** de su Facción —escudo, campo, orla y emblema, como en la pestaña Facción y en el mapa— y no solo el símbolo.

## [0.28.0] — 2026-10-09 · lo que entregó el backend (aceptación de relaciones, balance, tecnología, comodidades de la proyección y tick por WebSocket), avisos agrupados y barra de materiales abajo · sync con `BronzeAgeFase0@4e037c4` (`main`, sin push)

Tercera tanda de bloques en paralelo (detalle en `docs/bloques/`). El backend contestó a la petición de `docs/Peticion_Backend.md` (A0 a A5): el cliente deja de copiar constantes a mano y usa lo publicado.

### Bloque J1 — Aceptación de alianza y vasallaje
- **Alianza y vasallaje ya no se imponen: son propuestas** (backend 2026-10-09, como la anexión). En la pestaña Facción, sección Diplomacia: al proponer sale «Propuesta enviada: caduca en X si su Rey no responde» y la propuesta aparece en **Propuestas enviadas** con Retirar (Rey o Embajador de quien propone). En **Propuestas recibidas** el Rey de la Facción destino ve Aceptar y Rechazar (los demás lo leen, con «solo tu Rey responde»); aceptar un vasallaje pide confirmación explicando tributo y consecuencias. La caducidad se muestra en tiempo real (`textoEnTiempoReal`) cuando el mundo va acelerado y en horas o días de mundo si no.
- Corregidos los textos que decían que se pacta «al instante»/«se impone sin consentimiento» (ayuda ⓘ de Diplomacia y confirmación de proponer vasallaje).
- Avisos de `diplomacia.relacion_propuesta` (aviso que pide decisión, solo a la Facción destino), `relacion_aceptada` (a las dos), `relacion_rechazada` (a quien proponía) y `relacion_retirada` (a la destino). Los eventos llegan a todos los jugadores, así que se filtran por Facción.
- Errores `relacion.propuesta_no_existe` y `relacion.propuesta_caducada` traducidos; las reglas rotas (`diplomacia.invalida`) enseñan el `detalleError` del servidor.
- `Rebelarse` sigue siendo lo único que ve la vasalla y `Liberar vasallo` lo único que ve la señora (coherente con `romperRelacion` solo para la señora).

### Bloque J2 — usar lo nuevo del balance y la proyección, y quitar copias a mano
- **Reclutar en el campamento** usa `mercadoCampamento.reclutamiento`: precio real por soldado (ya con recargo, reputación y descuento), oro del escuadrón = `ceil(precio × lo que falta)`, reclutas del campamento `N/tope`, y las tropas sin desbloquear salen marcadas y apagadas con su motivo. «Reclutar»/«Reponer» se apaga con motivo si faltan reclutas o no te llega el oro del origen elegido (almacén personal o carro). Al cambiar el origen se repinta. Se quitaron `tropasDeCampamento` y el filtro por edificios del cliente.
- **Reclutar en una plaza** muestra el oro por soldado como el motor: `RECLUTAMIENTO_ORO_POR_ESCALON[escalón] + caballos × ORO_POR_CABALLO`; la tropa del Centro Urbano no paga oro (accesor `oroPorSoldado`).
- **Caravanas**: precio en «＋ Carro básico/reforzado» y en las opciones de «Comprar animal» (carga y velocidad del animal), apagados con motivo si no llega el almacén o falta la Carpintería; capacidad, velocidad y tiempo de preparación de cada caravana derivados de sus carros con animal (con `carga_ampliada` y `rutas_rapidas` si la plaza los tiene activos); cupo de escolta por caravana según el nivel del Mercado (también como respaldo si la caravana no trae `escoltaLiderazgo`).
- **Copias a mano eliminadas** (ahora del balance, con el mismo valor por defecto mientras no llega): `MOVIMIENTO.radioPuerta` (panelIntel, panelFundacionDePlaza, mercadoDePlaza), `MOVIMIENTO.radioInspeccion` (interaccionAjena), `CAPITAL.cooldownDias` (panelResidencia), `PUERTA.cerradaAPorDefecto` (panelPuerta), `CIUDADANIA.cooldownCreacionFaccionDias` (panelCargos).

### Bloque J3 — Panel «Tecnología» con el catálogo del balance
- **Panel «Tecnología» sobre el catálogo del servidor.** Lee `tecnologia.{TECNOLOGIAS, ERAS, TARIFA_ADOPCION, AEDAS, EPICAS, TITULO_CAPITULO}` de `GET /v1/balance` (accesor `catalogoDeTecnologia` en `apiCliente.ts`; con `null` mientras no llega el balance, y entonces se muestra el id legible como antes). Desaparecen las tarifas, el precio de los Aedas y las 6 h de enfriamiento copiadas a mano.
  - Nombres reales y acentuados de tecnologías y Eras, la Era de cada aparecida/adoptada/revelada (`eraDe`) y el coste real de adoptar cada una (`TARIFA_ADOPCION` de su Era). Bonus de producción y Era en el ⓘ de cada tecnología.
  - «Adoptar» explica el motivo exacto: sin Facción, no eres el Rey, la Facción no tiene capital (`capitalId` nulo) o no estás en la capital (se nombra la plaza).
  - Reveladas con su progreso real: cada condición del hito con ✓/✗ según `cumplidas[]` (se quita la comprobación a mano de edificios y tecnologías).
  - Épicas: «Empezar épica» ofrece solo `epicasPosibles` (con el nombre del canto), el capítulo en curso usa `TITULO_CAPITULO` y el enfriamiento sale de `AEDAS.epica.enfriamientoMinutos`.
  - Aedas itinerantes: cada tecnología revelada se lista con lo que cobraría el Aeda (oro de la tarifa de su Era × `AEDAS.venta.factorOro`); no se ofrecen las de Eras por encima de `ordenEraMaximo`.
- Tipos nuevos en `tiposDominio.ts`: `eraDe`, `capitalId`, `epicasPosibles` y `cumplidas` en `reveladas[]`.

### Bloque J4 — Avisos agrupados
- **Avisos agrupados:** los avisos repetidos del mismo tipo y origen (te observaron, pidieron tu plano, movimientos de ejército…) se funden en una línea con contador y rango de horas; los de baja urgencia no hacen toast y solo suman a la insignia de «Avisos» (que ahora cuenta grupos sin leer); los urgentes (ataques, combates, deserción, peticiones de unirse a tu ejército) siguen con toast propio —varios a la vez se funden en un toast con «+N más»— y salen arriba y destacados. El panel «Avisos» tiene grupos plegables por categoría (Combate, Diplomacia, Movimientos, Inteligencia, Economía y tropas) con «Marcar leído» por grupo y ayuda ⓘ.

### Bloque J5 — Tira de recursos otra vez abajo
- La tira de recursos del almacén (`.asent-recursos`) vuelve a la parte inferior de la pantalla de la plaza: barra horizontal centrada bajo el mapa, con salto de línea ordenado si hay muchos recursos. La columna izquierda queda solo para «Ejércitos»/«Salir al mundo» y la ficha de edificio, y se oculta sola si no tiene nada. En pantallas estrechas (≤ 900 px) la barra queda tras el mapa.

### Bloque J6 — Comodidades de la proyección (backend 2026-10-09)
- **Informes de inspección que sobreviven**: la ficha de una columna o caravana ajena y la de una plaza ajena leen siempre `informesDeInspeccion` de la proyección (vigentes por `expiraEn`, «visto hace X»), así que el resultado de Inspeccionar no se pierde al recargar ni al cerrar la ficha. La ficha de plaza ajena del mapa gana el botón «Inspeccionar» (a 40, avisa a su Facción) y muestra la defensa (guarnición y héroes dentro).
- **`escoltada` con su significado nuevo**: «lleva escolta» (adjunta a un ejército o con escuadras cedidas). Ya no se apaga Perseguir/Interceptar por estar «escoltada»: solo cuando va adjunta, que se deduce de ir pegada a un ejército avistado.
- **Almacén a la puerta**: en «Lo que llevas › Caravanas», al cargar se ve el stock del almacén de la plaza propia a cuya puerta está la columna (`asentamientosAvistados[].almacen`).
- **Partidas con nombre**: la tarjeta de la pantalla de partidas y la cabecera usan el `nombre` de la partida (con el `gameId` pequeño debajo en la tarjeta).

### Tiempo real: el tick del reloj de mundo avisa (backend `4e037c4`)
- Por el WebSocket llega a todos los conectados un mensaje `{ tipo: 'tick', gameId, version, instante }` en cada tick del reloj de mundo, sin datos: es la señal para pedir la proyección. El cliente (`alTickDeMundo`, `tiempoRealVivo` en `apiCliente.ts`) pide la proyección al recibirlo y el sondeo de 3 s de mapa, plaza y campamento pasa a ser solo de reserva (a los 30 s sin noticias, o en cuanto se cae el socket). Comprobado en vivo: con el reloj a 8 s, 4 peticiones en 27 s en vez de unas 9.

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
