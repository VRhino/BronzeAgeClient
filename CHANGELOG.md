# Changelog — Cliente de jugador

Formato: cada entrada anota la **fecha de sincronización con el backend** (`BronzeAgeFase0`) y contra qué
commit suyo se midió. La brecha detallada vive en `docs/Analisis_Brecha_Backend.md` y `docs/COMANDOS.md`.

## [0.155.0] — 2026-11-06 · Cancelar obras en curso, nombre de héroe en uso y avisos de la tanda del motor · contrato 87f74932

Lo del cliente de la tanda del motor del 2026-11-06 (main 87f74932, contrato 0.15.0):

- **Cancelar una obra o una mejora en curso** (orden `cancelar_construccion`, 183). En la ficha del edificio sale «✕ Cancelar la obra»
  o «✕ Cancelar la mejora», y en cada fila en marcha de «Obras» del panel izquierdo un ✕ que aparece al pasar el ratón. Solo lo ve quien
  tiene el cargo (gobernador o maestro de obras) y solo en obras, reconstrucciones o mejoras en curso. Pide confirmación antes de mandarla
  y avisa de que no se devuelve nada de lo pagado.
- **Nombre de héroe en uso**: si `crear_heroe` responde `heroe.nombre_en_uso`, el campo del nombre dice «ya hay un héroe con ese nombre.
  Elige otro nombre.» y queda seleccionado para escribir otro.
- **Avisos nuevos**: `bandidos.campamento_vencido` (vencéis a los bandidos que os emboscaron, el campamento cae y os lleváis su oro) y
  `construccion.obra_cancelada` (obra o mejora cancelada).
- La Vía Rápida en pueblos, aldeas y avanzadas no pide nada al cliente: `completa_en` ya llega acortado.

## [0.154.0] — 2026-11-06 · Mundo 3D: carteles sobre columnas, ejércitos y caravanas · sin cambio de contrato

Petición de Víctor (2026-11-06), en la vista del mundo 3D:

- Sobre cada columna personal, un cartel HTML con el escudo de su Facción y el nombre de su héroe, con el nombre de la Facción más pequeño
  debajo. El héroe es el líder de la columna (o el primero que va en ella): el tuyo de tu ficha, el de otro de su ficha pública.
- Sobre cada ejército, el escudo y el nombre de la Facción.
- Sobre cada caravana suelta, el escudo y el nombre de la Facción (la de su plaza de origen).
- Como los de las plazas, más pequeños, y se pulsan como la columna o la caravana. Sin Facción ni héroe conocido no hay cartel. El escudo se
  dibuja una vez por sigilo y tamaño (`svgSigiloGuardado`), porque los carteles se rehacen en cada fotograma.
- Banco: un ejército ajeno y los carteles de la columna propia, la ajena y las caravanas.

## [0.153.0] — 2026-11-06 · Construcción con la barra de construidos y Territorio a ventana completa · sin cambio de contrato

Petición de Víctor (2026-11-06):

- Construcción (el cajón del riel): abajo, una barra con los edificios ya construidos, un cuadrito por tipo junto a otro con su icono, su nombre,
  cuántos hay (×N) y su nivel más alto; ámbar si alguno se está mejorando y rojo si alguno está dañado. Un clic elige uno de ese tipo en la vista
  3D (y el siguiente clic, el siguiente). Por tipo y no uno a uno: una plaza grande tiene cientos de viviendas. El cajón crece 64 px.
- Territorio pasa a ventana completa: la zona, los pueblos y «Marcar un pueblo nuevo» a la izquierda y las avanzadas a la derecha (en una ventana
  de 1000 px o más; más estrecha, una debajo de otra). Banco: `pruebas/hud/?ventana=territorio&obrasMapa=1`.

## [0.152.0] — 2026-11-05 · Panel de rendimiento con F3 · sin cambio de contrato

Petición de Víctor (2026-11-05, hilo del motor: «visibilidad de rendimiento en cliente y servidor, que se pueda encender y apagar»):

- **F3** abre y cierra un panel abajo a la derecha. Solo mide mientras está abierto (cerrado no cuesta nada):
  - fotograma: fps y ms por fotograma (media, p95 y máximo de los últimos ~4 s);
  - dibujo de cada vista 3D en pantalla (mundo y plaza): llamadas, triángulos, geometrías y texturas (`renderer.info`; las vistas se apuntan en
    `src/rendimiento.ts`);
  - memoria JS (solo en Chrome);
  - red: ping, bytes y mensajes recibidos por segundo, lo que tarda en aplicarse cada foto o cambio, y cada orden por tipo (desde que sale hasta su
    ResultadoOrden) con media y p95.
  - «Copiar» deja todo en el portapapeles como JSON.
- Los contadores de red (`src/contrato/medidas.ts`) van siempre: son sumas y colas cortas de 120 muestras. Prueba: `pruebas/medidas.test.ts`.

## [0.151.0] — 2026-11-04 · Fronteras de lo que solo se recuerda: recortadas donde chocan · sin cambio de contrato

Víctor (2026-11-04): en la vista de mundo las fronteras se ven bien en lo que ves ahora, pero en la segunda capa de la niebla (lo explorado)
se dejan de ver bien; y en el modo mapa, «debería mostrar la frontera cuando chocan las áreas de influencia». De una plaza que ya no se ve, el
servidor da solo el radio (`radioPotencial`), y su zona se pintaba como un círculo entero de rayas cortas que se metía en las vecinas.

- `mundo/zonasRecordadas.ts`: la zona de cada plaza recordada se recorta como lo hace el motor (`territorio::zona::poligono`): contra cada
  disco de otra Facción que la toca, por la recta perpendicular a la que une los centros, a d · r_yo / (r_yo + r_otro) de su centro. Los discos
  son los que se conocen: los que se ven (con el radio de su silueta) y los recordados. Las de la misma Facción no se recortan y se funden al
  pintar, como las que se ven.
- Su frontera va con el trazo de lo que se ve (la raya corta del recuerdo se va) y su relleno con la misma forma.
- Igual en el mundo 3D (`estado.ts`) y en el modo mapa (`render.ts`).

## [0.150.0] — 2026-11-04 · Las obras de avanzada en «Obras» del panel izquierdo · sin cambio de contrato

Petición de Víctor (2026-11-04, 18:48): debajo de «Pueblos y aldeas», una sección «Avanzadas» con las obras de avanzada de la plaza (atalaya
nueva, mejora o reparación), igual: esperando materiales con el % entregado o levantándose con lo que le falta al ritmo del mundo.

## [0.149.1] — 2026-11-04 · El tiempo de las obras de pueblos y aldeas en «Obras», al ritmo del mundo · sin cambio de contrato

Arreglo pedido por Víctor (2026-11-04, 17:59): «Pueblos y aldeas» del panel izquierdo contaba el tiempo de mundo (2 h 7 min) en vez del real
al ritmo del mundo (13 min) que enseña la tarjeta de Territorio; ahora usa lo mismo que ella (`textoEnTiempoReal`).

## [0.149.0] — 2026-11-04 · El mapa a toda la ventana y las obras de pueblos y aldeas en «Obras» · sin cambio de contrato

Petición de Víctor (2026-11-04, 17:54):

- El mapa «desde dentro» (botón Mapa) ocupa toda la ventana, encima de la barra y del HUD; antes dejaba la franja de la barra. Se cierra con «Volver».
- «Obras» del panel izquierdo de la plaza, debajo del blasón, enseña también las obras de sus pueblos y aldeas agrícolas en el mapa: esperando
  materiales (con lo entregado en %) o levantándose (con lo que le falta). Banco: `pruebas/hud/?obrasMapa=1`.

## [0.148.0] — 2026-11-04 · Cupos de plazas por nivel en la Facción y avanzadas desde la plaza · contrato del motor 2484be46

Peticiones de Víctor (2026-11-04), con el motor 2484be46 (contrato 0.14.0; hace falta partida nueva):

- Facción → resumen: el cap de plazas («Plazas 2 + 1 caravana · 3/4») y, de nivel 2 a 5, las plazas que ocupan cada nivel (en él o subiendo a él)
  frente a las que caben a la vez, con barra; debajo, lo que abre el nivel siguiente de la Facción. Datos de `Faccion.capFundacion` y
  `Faccion.cuposDeNivel` (solo la propia); las curvas del nivel siguiente, de `/v1/datos`.
- Avanzadas como la aldea: en Territorio → Avanzadas, el Gobernador o el Maestro de Obras residente ve «🗺 Elegir el sitio de la atalaya», elige
  el punto en el mapa y queda la obra, a la que se llevan los materiales con una columna. Se quita «Colocar avanzada aquí» de «Lo que llevas».

## [0.147.0] — 2026-11-04 · Gobierno → Políticas, la reserva en el Almacén, la obra del mundo sin desbordar y «Lo que llevas» sin «Para enganchar» · sin cambio de contrato

Petición de Víctor (2026-11-04, 15:54):

- Gobierno: la pestaña «Tesorería» se llama «Políticas» y solo lleva las políticas de cargo, a la vista (sin plegar).
- La reserva de recursos del Tesorero pasa a la ventana del Almacén, debajo de la extracción (`htmlReservaRecursos` en panelTesoreria.ts).
- Mundo: la ficha de una obra de pueblo o aldea sin empezar se salía de su caja (280 de ancho): cada material va ahora en dos renglones,
  nombre y cifra arriba, barra y lo que falta (con lo que lleva tu columna) abajo. Banco: `pruebas/hud/?obra=1&sinEmpezar=1`.
- «Lo que llevas» ya no tiene el apartado «Para enganchar»; quedan las caravanas enganchadas a tu columna.

## [0.146.1] — 2026-11-04 · Detener ruta y cancelar encargo con el diálogo del juego · sin cambio de contrato

Petición de Víctor (2026-11-04): «Detener ruta» y «Cancelar encargo» ya no sacan el `confirm` del navegador, sino el diálogo
del juego (título, explicación, «Seguir» y el botón rojo de la acción).

## [0.146.0] — 2026-11-04 · Facción → Plazas: la barra sin letreros y con el almacén entero · sin cambio de contrato

Petición de Víctor (2026-11-04):

- La barra de cada plaza va sin los letreros (Población, Almacén, Estado, Obras y Guarnición); el detalle sigue al pasar el ratón.
- El almacén de la barra enseña todo lo que tiene la plaza, no los recursos elegidos para la barra de arriba de la plaza (eran 5 como mucho en
  la elección de Víctor). Al pasar el ratón, lo que hay, lo que cabe y el neto por minuto.

## [0.145.0] — 2026-11-04 · Propuestas diplomáticas a la vista y encargo con botones de recurso · sin cambio de contrato

Petición de Víctor (2026-11-04):

- **Las propuestas diplomáticas no salían nunca**: el cliente no leía del motor las `Propuesta` (alianza o vasallaje, anexión, fusión) de
  `FACCION`. Ahora van a `propuestasRelacion`, `propuestasAnexion` y `propuestasFusion`, y se ven en «Propuestas activas» de la Facción elegida
  y en la vista de tu Facción (recibidas y enviadas).
- **Encargo con botones de recurso.** En cada parada, «Recoge» enseña un botón con el icono de cada recurso que hay (en el origen, su almacén;
  en el destino, el de esa plaza si es tuya y llega; si no, todos, y en una plaza ajena sin oro). Al pulsarlo sale su fila con la cantidad (y el
  precio máximo en una plaza ajena). «Deja» solo ofrece lo que se recoge en la otra parada, con el tope (vacío = todo) y, en una ajena, el precio
  mínimo. Quitar un recurso de «Recoge» lo quita también de «Deja» en la otra parada. El borrador se guarda por caravana mientras el formulario
  está abierto.

## [0.144.0] — 2026-11-04 · Diplomacia: propuesta por botones, propuestas activas y panel derecho plegable · sin cambio de contrato

Petición de Víctor (2026-11-04):

- **Nueva propuesta** en la ficha de la Facción elegida: una barra de botones con lo que tu héroe puede proponerle ahora (Alianza, Vasallaje,
  Anexión, Fusión y Guerra; lo que no se puede, no sale). Lo pulsado se añade a la propuesta con sus términos (tributo y cantidad por minuto en el
  vasallaje; nombre y Rey de la nueva en la fusión) y «Proponer» la manda entera. El motor admite una cosa por propuesta: otra opción sustituye a
  la que había. El borrador se guarda por Facción mientras dura la sesión.
- **Propuestas activas** al elegir una Facción: todas las que hay en curso entre las dos (alianza, vasallaje, anexión y fusión), recibidas o
  enviadas, con Aceptar, Rechazar o Retirar según quién seas.
- **Panel derecho:** botón para ocultar o mostrar las Facciones de bots (nunca se ocultan la elegida ni las que tienen relación con la tuya), y
  Conocidas y Sin contacto se pliegan.
- En la vista de tu Facción, el formulario de proponer da paso a «elige una Facción en la lista».

## [0.143.0] — 2026-11-04 · Mundo 3D: los carros de las caravanas, de dos en dos · sin cambio de contrato

Petición de Víctor (2026-11-04): en el mundo, los carros de una caravana (o los que arrastra una columna) iban uno detrás de otro. Ahora van en
filas de dos, cada uno con su animal; si son impares, el último va solo en el centro. El carrito del héroe sigue solo, delante de ellos.
Banco: la caravana de prueba lleva cinco carros.

## [0.142.0] — 2026-11-04 · Facción → Plazas a todo el ancho y con la barra de la plaza · sin cambio de contrato

Petición de Víctor (2026-11-04):

- La pestaña Plazas ocupa todo el ancho de la ventana (antes, 960 px como las demás).
- En la vista reducida, debajo del nivel y las coordenadas, va la barra de la plaza en 3D: Población, Almacén (los recursos elegidos para la
  barra) y Estado, más dos placas con lo que se mueve: Obras (subida de nivel, obras y mejoras, recursos a la baja, parados y dañados) y
  Guarnición. Al pasar el ratón, el detalle de cada pieza. «Detalle» y «Ver en el mapa» suben junto al nombre.
- La auto-construcción apagada sale de la vista reducida: queda como nota en el detalle, bajo el almacén.

## [0.141.0] — 2026-11-04 · Caravanas en casa, «Detener ruta» y las plazas propias en la ventana de Facción · contrato 0.13.0 (motor 5776ab69)

Petición de Víctor (2026-11-04), con lo que el motor añadió para ello (`motor/aviso-plaza-propia-y-rutas.md`):

- **Barra del paso exacta.** La barra de la descarga y la carga usa `Encargo.inicio_paso_ms`: ya no arranca cuando el cliente ve empezar el paso.
- **«⏹ Detener ruta»** en las rutas (Caravanas y Mercado → Rutas), solo en las rutas sin detener (`OrdenDetenerEncargo`, `detenerEncargo`): la
  caravana acaba la ida y vuelta comerciando y se queda sin ruta. Detenida, sale «⏹ Última vuelta: vuelve y se queda sin ruta» y se oculta «Cambiar».
- **Descargar al almacén** una caravana en casa (disponible, o esperando en su origen aunque tenga ruta), a quien reside y está dentro: recurso,
  cantidad (vacía = todo ese recurso) y «⬇ Todo» (`moverCargaCaravanaAparcada` con `descargar`). Entra lo que el almacén admite y cabe.
- **Facción → Plazas** con lo de dentro de cada plaza propia (`ProyeccionJugador.plazasPropias`, de `FACCION`): mantenimiento y nutrición en barra,
  población, subida de nivel, obras, recursos a la baja, almacén lleno, edificios parados o dañados, guarnición y auto-construcción apagada en
  chips; con «Detalle», el almacén con lo que entra y sale por minuto, la población por escalón, las obras y mejoras con su barra y la guarnición
  por dueño. La capital, desplegada de entrada.
- El paso de minuto de esas plazas llega parcial en `FACCION` (se aplica como el de `ASENTAMIENTO`), y al reconectar el `Hola` declara su
  `version_interior` con la clave `PROPIA:as-N`.
- Los talleres de fabricación del motor están a 5 minutos de prueba: hace falta partida nueva.

## [0.140.0] — 2026-11-04 · Caravanas: barra de tiempo de la carga y la descarga, y lo que lleva · sin cambio de contrato

Petición de Víctor (2026-11-04):

- En Caravanas y en Rutas, la descarga y la carga de una caravana con encargo salen como una barra de tiempo con lo que queda (azul al descargar,
  oro al cargar), y la píldora de la fase ya no repite el tiempo. El motor solo manda el fin del paso: hasta que mande el inicio (pedido), la barra
  arranca cuando el cliente ve empezar el paso (`Encargo.inicioPaso` ya se usa si llega).
- La ficha de una caravana en la plaza enseña lo que lleva (recurso y cantidad, y el total sobre la capacidad), con ruta o sin ella.
- Pedido al motor: descargar al almacén de la plaza una caravana de la flota que está en casa (todo o una parte) y «Detener ruta» (acaba la ida y
  vuelta comerciando y se queda sin encargo). Los botones llegan cuando esté.

## [0.139.0] — 2026-11-04 · De visita en una plaza de tu Facción: guarnición y escolta con tu columna · contrato del motor 7a6a0c48 (contrato 0.12.0)

Pedido de Víctor (2026-11-04), con la parte del motor ya en main (aviso `motor/aviso-tropas-de-visita.md`):

- **Defensa → Guarnición de visita**: dentro de una plaza de tu Facción donde no resides, el «+» ofrece las escuadras de la columna con la que
  entraste (`asignarGuarnicion`); las tuyas salen «Tuya · de visita» con ✕ para recogerlas a la columna (`retirarGuarnicion`, solo desde dentro).
  El cupo es el de la plaza (`Asentamiento.cupoGuarnicion`, el mismo por héroe que el de un residente).
- **De quién es cada escuadra**: la guarnición llega con `Asentamiento.guarnicion` (tropa, hombres y héroe); las de otros salen con su icono, su
  tropa y «de <héroe>».
- **Escolta de visita**: en Caravanas, con la caravana en casa, el «+» de la escolta ofrece la tropa de tu columna (`asignarEscolta`); la nota de
  la flota lo dice. Lo demás de la flota sigue siendo de residentes.
- `Escuadron.contenedor` admite `{ tipo: 'plaza', asentamientoId }` (campo 7): lo que dejas no vuelve a salir en «Salir al mundo».
- Rechazos nuevos traducidos: `guarnicion.faccion_ajena`, `guarnicion.no_estas_dentro`, `escuadra.fuera_de_tu_columna`.

Bancos: `pruebas/hud/?ventana=defensa&visita=1`, `?ventana=caravanas&visita=1`.

## [0.138.0] — 2026-11-04 · Cupo de Fundación, Guarnición en Defensa, Rutas del Mercado y obras con barras · sin cambio de contrato

Petición de Víctor (2026-11-04, seis puntos):

1. **Cupo de Fundación**: contaba solo la plaza de dentro (`asentamientos`); ahora cuenta todas las plazas de la Facción (también las de
   `asentamientosAvistados`) más las Caravanas de Fundación vivas, como el motor (`plazas_de + fundaciones_de`).
2. **Escolta y guarnición con la tropa de la columna estando de visita**: el motor solo las admite a residentes, desde su campamento. Pedido al
   motor (solo en plazas de tu Facción). Lo que dejas en escolta o guarnición ya no sale en «Salir al mundo» (contenedor escolta / `enGuarnicion`).
3. **Defensa → Guarnición** (nueva subpestaña, `panelGuarnicion.ts`): las escuadras de la guarnición en huecos (las tuyas con ✕ para sacarlas, las de
   otros residentes como «De otro residente» hasta que el motor mande su dueño), tu cupo en Liderazgo con su barra y «+» para dejar escuadras del
   campamento (`asignarGuarnicion` / `retirarGuarnicion`). `Asentamiento.guarnicionIds` llega de `guarnicion_ids`.
   `heroe.guarnicionOcupada` pasa a contarse en Liderazgo (antes sumaba hombres contra un cupo en Liderazgo).
4. **Mercado → Rutas** (nueva pestaña): las caravanas de la flota con ruta o envío, cada una con su dibujo y «✎ Cambiar» / «Cancelar encargo».
5. **Detalle de la ruta** (`htmlRutaVisual`): origen y destino como placas, la carreta sobre el camino donde va, la fase en una píldora de color,
   ruta o envío y las vueltas; en cada parada, «Deja/Vende» y «Recoge/Compra» en fichas con icono, cifra y precio. «Cambiar» y «Cancelar» solo
   salen a quien puede (Gobernador, Tesorero o Maestro de Caravanas, residente y dentro).
6. **Obra de pueblo en el mapa**: lo que pide en filas con icono, barra de lo entregado, «faltan N» y lo que lleva tu columna de ese material
   (verde si alcanza, ámbar si en parte), con la barra y el % del total arriba.

Bancos: `pruebas/hud/?ventana=defensa`, `?ventana=caravanas&sub=rutas`, `?obra=1`.

## [0.137.0] — 2026-11-04 · Mundo 3D: todo lo de encima pisa el suelo que se pinta · sin cambio de contrato

Víctor probó la 0.136.1 (2026-11-04): soldados, héroes y caravanas ya iban bien, pero caminos, la línea de frontera, los nodos, los árboles y lo
demás seguían flotando o hundidos. Era lo mismo: se ponían sobre el relieve fino, y lejos (teselas de 1 o 2 u) o junto al agua el suelo
pintado no va ahí.

- `VistaMundo3D.alturaU` es ahora la del suelo pintado (`Terreno.alturaPintada`; donde aún no hay tesela, el relieve). La usan todos: árboles,
  matas, nodos y rocas, ríos, orillas y vados, caminos, fronteras, zonas y anillos, maquetas, humo, aros, rutas, la rejilla, los nombres, la
  cámara y el clic.
- Lo que se pone una vez se recoloca cuando cambia el suelo de debajo. `Terreno.firma(caja)` resume las teselas bajo una caja y cambia cuando se
  rehace una (otro detalle) o se pone la que faltaba; el contrato es `SueloPintado` (altura, firma y versión).
  - Árboles y matas, por trozo: solo se vuelven a asentar (las mismas mallas; no se rehacen).
  - Ríos, orillas, vados y rocas de nodo: se rehace la tesela del paisaje.
  - Caminos, fronteras, zonas y anillos: se rehace la cinta cuyo suelo cambió.
  - Maquetas: se vuelven a asentar al cambiar el suelo.
  - Rutas, aros, marcas, humo y la rejilla: se rehacen.
- Pruebas: la firma cambia con las teselas de su caja y no con nada más; los árboles de un trozo suben con su suelo sin rehacerse.

## [0.136.2] — 2026-11-04 · Tras cerrar sesión y volver a entrar se pide otra vez la VISTA · sin cambio de contrato

Caso de Víctor (2026-11-04): Víctor no veía en el mundo a Jorge, de su misma Facción, aunque pasaba a su lado; Jorge sí lo veía a él. Con una
copia de la partida (`partidas/mundo3d`) el motor manda bien la columna de Jorge a la sesión de Víctor (por la VISTA, en cuanto sale del
campamento). El fallo era del cliente: la VISTA se pedía una vez por héroe en toda la vida de la página (`vistaPedidaPara`) y no por sesión.
Víctor había cerrado sesión y vuelto a entrar sin recargar: la sesión nueva nunca pidió su VISTA, y sin ella solo llegaba lo propio (su héroe,
su columna y lo de su Facción), nada de las demás columnas. Pasaba igual al cambiar de partida y volver, o al retomar una pestaña reemplazada.
Ahora se pide una vez por cada `Sesion` y héroe.

## [0.136.1] — 2026-11-04 · Mundo 3D: las columnas pisan el suelo que se pinta · sin cambio de contrato

Arreglo de lo que vio Víctor (2026-11-04): en el mundo 3D había columnas y caravanas que andaban por encima del suelo (junto a la costa, con la
sombra muy abajo) y otras medio hundidas (cerca de Alepo). Las figuras se ponían a la altura del relieve fino (0,5 u), pero el suelo que se
pinta no es siempre ese: lejos del héroe las teselas van cada 1 u (desde 80 u) o 2 u (desde 160 u); en el relieve del mundo (semilla 42), las
de 2 u se apartan más de 0,28 u en el 1 % de los puntos y casi 3 u en lo más abrupto (en lomas quedan por debajo y en vaguadas por encima). Y
junto al agua la tierra baja hacia ella (`sueloJuntoAlAgua`), unos metros en una costa alta.

- `Terreno.alturaPintada(x, y)`: la altura de la malla tal como se pinta, por los mismos dos triángulos de cada cuadro, con la tierra bajada
  junto al agua y, en el agua, la lámina. Cada tesela guarda la suya al construirse.
- Columnas y caravanas usan esa altura (`VistaMundo3D.alturaPisada`); donde no hay tesela, la de antes. `Terreno.version` sube cuando se pone o
  se quita una tesela, y una columna quieta se recoloca entonces (al cambiar el detalle de su tesela no se queda flotando).
- Pruebas: la altura coincide con un rayo sobre la malla cerca, lejos y en la costa.

## [0.136.0] — 2026-11-04 · Caravanas: mover un carro, la lista por disponibles y el «!» de Fundación · sin cambio de contrato

Petición de Víctor (2026-11-04):

- En Caravanas de la plaza, con una caravana elegida, un clic sobre un carro de la barra abre una ficha pequeña en el mismo sitio que la de «añadir»
  (son excluyentes): tipo y animal, capacidad, velocidad y factor de carga, la compra de animal si no lo tiene y «Pasarlo a» otra caravana con
  «⇄ Mover» (`moverCarroCaravana`). Si no hay otra caravana comercial disponible en la plaza, lo dice y apunta a «＋ Crear».
- La lista de caravanas de la izquierda pone primero las que están en la plaza; luego las aparcadas de otro origen y al final las que andan fuera.
- Cuando ya se puede lanzar una Caravana de Fundación (residente presente, plaza de nivel 2+, sin enfriamiento, cupo y coste completo en el almacén)
  sale el «!» sobre el botón Territorio del riel y sobre la subpestaña Fundación; se quita al lanzarla (el cupo o el coste dejan de cumplirse).
  Los requisitos son los mismos que pinta la subpestaña (`fundacionLista` en `panelFundacionDePlaza.ts`).

## [0.135.0] — 2026-11-04 · «Pedir ingreso»: primero las Facciones de jugadores · sin cambio de contrato

Petición de Víctor (2026-11-04), en la lista de «Pedir ingreso» sin Facción:

- Las Facciones de bots van detrás de las de jugadores, en cada grupo (con contacto y sin contacto).
- Junto al buscador, la casilla «Ocultar las de bots», marcada de serie: con ella marcada no salen; al quitarla salen, al final.
  Se recuerda mientras dura la sesión.

## [0.134.0] — 2026-11-04 · «Pedir ingreso» usa todo el alto · sin cambio de contrato

Petición de Víctor (2026-11-04): sin Facción, la lista de «Pedir ingreso» se cortaba a 330 px, a media pantalla. Ahora llega hasta abajo de
la ventana y se desplaza ella sola, con el buscador siempre a la vista. Banco: `pruebas/diplomacia/?sinFaccion=1`.

## [0.133.0] — 2026-11-04 · El nombre de cada edificio en el cajón de Construcción · sin cambio de contrato

Petición de Víctor (2026-11-04): en cada botón del cajón de Construcción de la plaza, entre el icono y el coste, el nombre del edificio
(hasta dos líneas; la rejilla pasa de 70 a 84 px por botón para que quepa).

## [0.132.0] — 2026-11-04 · La ventana Ejército del mundo · sin cambio de contrato

Petición de Víctor (2026-11-04):

- **Ventana en vez de panel lateral.** El ⚑ del riel del mapa abre una ventana centrada como la de Misiones (`.mapa-panel-ventana`),
  del alto de lo que lleva.
- **Integrantes con su tropa.** El Líder primero; de cada uno, sus escuadras con hombres y nivel (lo tuyo con su nombre y si es
  prestada; lo de los demás, lo que deja ver el servidor; si no se ve, se dice). Arriba, cuántos héroes y hombres van y si marcha.
- **La carga y las caravanas.** La ocupación del carro y lo que lleva, y de cada caravana enganchada (también la de Fundación) sus
  carros, su escolta y su carga. Cargar y descargar sigue en «Lo que llevas» (⚔).
- **Fuera la marcha forzada** de aquí: se pone junto a los víveres, abajo en el mapa, como hasta ahora.
- **«Ejércitos y formaciones de tu Facción» pasa a la Facción**, en una pestaña «Ejércitos» nueva (tras Plazas), con «Ver en el mapa» y
  «Unirme».
- Banco: `pruebas/ejercito/` (`?lider=1`, `?solo=1`, `?faccion=1`).

## [0.131.0] — 2026-11-04 · La fertilidad del suelo, también en el mundo 3D · sin cambio de contrato

Petición de Víctor (2026-11-04): «agregar el filtro de fertilidad a las capas del mapa para que se apague y se encienda como el nombre de los
nodos».

- El botón de capas del modo mundo tiene ahora «Fertilidad del suelo», con su leyenda (yerma, el corte de la aldea y fértil), igual que el modo
  mapa; las dos pantallas comparten la casilla. Puesta, el suelo del mundo 3D toma la misma rampa de colores que el modo mapa, mezclada antes
  de la luz para que siga el relieve (`mundo3d/capaFertilidad.ts`). Solo sobre lo explorado y nunca en el agua. La textura se hace una vez
  por mundo; poner y quitar la capa no rehace nada.

## [0.130.0] — 2026-11-04 · «Salir al mundo» el doble de grande · sin cambio de contrato

Petición de Víctor (2026-11-04): el botón de abajo a la izquierda, en la plaza, el campamento de mercenarios, el pueblo y la aldea, al doble
(324 × 56 px; antes 163 × 30). Por debajo de 1240 px de ancho no cabe al lado del riel centrado y sube encima de él (la columna izquierda se
acorta para dejarle sitio); en el móvil (≤ 900 px), ×1,4 para no pisar el minimapa. El banco `pruebas/hud/` lleva ya el `id` del botón.

## [0.129.0] — 2026-11-04 · Campamento de mercenarios: solo lo que se usa, y Tropa y Mercado en ventana centrada · sin cambio de contrato

Petición de Víctor (2026-11-04): al empezar la partida hay poco que poner en las ventanas del campamento.

- **El riel solo enseña lo que se puede usar.** Mercenarios sale solo si alguien se ofrece en el tablón del campamento; la Taberna, solo si el
  jugador tiene Facción (`seccionesDeCampamento(p, c)`). Elegir en 3D una pieza cuya parte no está no abre nada.
- **Tropa y Mercado, en una ventana centrada** como la de Misiones (`data-ancho="centrada"`: hasta 960 px de ancho, del alto de lo que lleva,
  entre la barra de arriba y el riel). Mercenarios y Taberna siguen a pantalla completa (`anchoDeParteCampamento`).
- La plaza y el pueblo no cambian: el ancho nuevo solo lo pide el campamento.
- Banco: `pruebas/hud/?camp=resumen|tropa|mercado|mercenarios|taberna` (`&faccion=1`, `&tablon=1`).

## [0.128.1] — 2026-11-03 · Lo que anda en el mundo 3D, en todos los fotogramas · sin cambio de contrato

Petición de Víctor (2026-11-03), sin probar aún en la partida (se prueba al día siguiente):

- **Sin el límite de 15 ms.** Mientras algo marcha, la vista 3D recolocaba las columnas y caravanas como mucho cada 15 ms, de cuando rehacer
  la proyección entera costaba ~1 ms. A 60 Hz no se notaba (16,7 ms entre fotogramas), pero en una pantalla de 120 o 144 Hz lo ajeno se movía
  un fotograma sí y otro no. Desde la 0.126.1 recolocar lo que anda es barato (`moverAlInstante`), así que ahora se hace en cada fotograma
  (`estadoDeLaVista3D`, `main.ts`).

## [0.128.0] — 2026-11-03 · El Albergue de caravanas · contrato del motor b5e27ace (0.11.0), sin cambio

Pedido de Víctor (2026-11-03), pasado por el hilo del motor: el edificio nuevo que da cupo de caravanas y carros (motor b5e27ace,
`albergueCaravanas`, 2 × 3 celdas junto al Mercado), con su modelo 3D en todos los niveles de la plaza y en «añadir edificio».

- **Modelo 3D** (`albergueCaravanas` en `ciudad3d/modelos.ts`), dentro de su huella: un patio cerrado con el portón a la calle (`frente`), la
  casa de los arrieros al fondo, el cobertizo de los carros contra una tapia y, desde el nivel 2, la cuadra contra la otra. El estilo de la
  plaza pone los materiales (valla de zarzo y paja; barro; adobe; enlucido sobre piedra con zaguán; franja y columnas rojas) y el nivel del
  albergue lo de dentro: más carros y bestias, la casa de dos plantas con pórtico y el pozo en el 3. Carros de ruedas macizas, bueyes y
  asnos (`carroParado`, `bestia`); `pozo` se puede poner en cualquier sitio de la huella.
- **Construir**: sale en Gobierno, junto al Mercado, con su icono, solo con un Mercado activo (`motivoParaConstruir` mira el `requiereEdificio`
  del nivel 1). El rechazo nuevo `obra.falta_edificio` tiene su texto.
- **Flota**: el tope de caravanas y carros del Mercado suma el del Albergue activo a su nivel, y la «Ampliación de Flota»
  (`cupoDeFlota(nivelMercado, nivelAlbergue, extra)`); la cabecera dice «Mercado nivel N · Albergue nivel K». Su ficha dice lo que suma. Un
  clic en él en la vista 3D abre el Mercado en Caravanas.
- Pruebas: huella en los cinco estilos, tres niveles, los dos giros y los tres estados; más carros y bestias con el nivel; el portón a la
  calle (`pruebas/ciudad3d.test.ts`); Construir, el rechazo y el cupo (`pruebas/albergueCaravanas.test.ts`). Banco: el muestrario de estilos ×
  niveles y el mando «Albergue» para ponerlo en la aldea, el pueblo o la ciudad. Docs en `Ciudad_3D.md` y `Panel_Asentamiento.md`.

## [0.127.0] — 2026-11-03 · La producción de verdad, también con el almacén lleno · contrato del motor b5e27ace (0.11.0)

Pedido de Víctor (2026-11-03), pasado por el hilo del motor: con el almacén lleno, la ficha del recurso salía a la baja aunque los edificios
siguieran rindiendo, porque `producido_por_minuto` baja a lo que entra.

- Contrato regenerado desde b5e27ace: `Existencia.produccion_por_minuto` (campo 5), lo que rinden los edificios quepa o no. Llega como
  `almacen[r].produccion` (con un servidor anterior, el mismo valor que `producido`).
- La ficha del Almacén dice «produce» con `produccion` y «consume» con `consumido`. Con el almacén LLENO, la flecha y la cifra son el balance
  producción − consumo, no el neto del almacén: ya no sale ▼ por estar lleno. El ▼ del resumen cuenta igual.
- La reserva del Tesorero usa también la producción de verdad para decidir qué recursos enseña.

## [0.126.1] — 2026-11-03 · El mundo 3D, sin reservar memoria en cada fotograma · sin cambio de contrato

Petición de Víctor (2026-11-03): quitar los tirones sueltos de la vista 3D del mundo. Medido en la partida real, en camp-1 con unas 52 columnas
a la vista, con un perfil de reservas de memoria (Chrome sin ventana con la tarjeta, por el protocolo de depuración):

- **La proyección del instante, sin rehacerla entera.** Mientras algo marcha, la vista pedía en cada fotograma (cada 15 ms) la proyección
  completa del juego solo para mover las columnas: unos 75 MB/s de basura. Ahora (`moverAlInstante`, `motor/proyeccion.ts`) se parte de la
  última proyección y solo se recolocan las columnas y caravanas que andan, propias y ajenas. Las ajenas siguen moviéndose en cada fotograma
  con tu columna parada (lo de la 0.105.0). El modo mapa mira si algo anda en la última proyección, sin rehacerla.
- **La niebla** comparaba lo explorado juntando sus dos cadenas enormes en cada fotograma (6 MB/s); ahora las compara tal cual.
- **Los trozos de árboles, matas, suelo y paisaje** rehacían su lista (cientos de claves) en cada fotograma; ahora solo si falta algo, el
  héroe se movió un cuarto de unidad o cambió el alcance, la carga o los claros.
- **Las figuras de las columnas:** sin claves de texto por pieza, sin copias de matrices, y una columna quieta no se recoloca.
- **Antes → después:** memoria reservada en reposo 145 → 17 MB/s; estado por fotograma 0,7-1,5 → 0,13-0,32 ms; JS por fotograma (media)
  5,8-9 → 4,3-5,4 ms; fotogramas con más de 10 ms de JS, de 46-135 a 25-69 de cada 600. Detalle en `docs/Mundo_3D.md`, «Rendimiento (0.126.1)».

## [0.126.0] — 2026-11-03 · La vista de caravanas, rehecha: lista y ficha · sin cambio de contrato

Petición de Víctor (2026-11-03), en Mercado → Caravanas:

- **Lista y ficha.** A la izquierda (un cuarto del ancho) la lista de la flota con lo mínimo: dónde está o adónde va, el candado si está reservada,
  los carros que tiran y la barra de carga. Un clic la abre a la derecha (tres cuartos). La lista se queda a la vista al bajar por la ficha.
- **Solo se maneja la que está en la plaza.** De las que andan fuera se ve dónde están («En aldea agrícola», «En pueblo Cantera», «Hacia Cnosos»,
  «Volviendo a…», «Con un ejército») y nada de dentro. Las aparcadas aquí por un ejército siguen con su carga y «Enviar al origen».
- **Carros en huecos**, como la tropa de «Salir al mundo»: tipo, animal y lo que carga. «+» abre debajo la elección del carro y su animal (con
  su coste; lo que no llega, en rojo) y «Agregar» compra los dos a la vez (`agregarCarroCaravana` y `comprarAnimalCaravana` del carro nuevo); hecho,
  el panel se cierra. Un clic en un carro sin animal deja comprárselo, y en uno con animal, pasarlo a otra caravana parada.
- **Escolta en huecos**: las escuadras tuyas (con ✕ para retirarlas), las de otros residentes, «+» para ceder una y la barra del Liderazgo de
  escolta con lo que han puesto los demás.
- **Viaje o Encargo**: dos pestañas, y solo se ve la elegida. Con encargo en marcha, solo el encargo; sin cargo para dar encargos, solo el viaje.
- **Fuera lo que no se puede usar**: el carro reforzado no sale sin Carpintería, ni el «+» con la flota al tope de carros, ni los controles a
  quien no reside en la plaza.
- Banco: `pruebas/hud/?ventana=caravanas`, con una flota de mentira (en la plaza, de camino, en una aldea y un casco vacío).

## [0.125.1] — 2026-11-03 · Las columnas del mundo 3D, en mallas instanciadas · sin cambio de contrato

Petición de Víctor (2026-11-03): mejorar el rendimiento de la vista 3D del mundo. Medido en la partida real, en camp-1, con unas 50 columnas
de bots a la vista (RTX 4080 SUPER):

- **Una llamada de dibujo por pieza, no por figura.** Cada soldado, jinete o carro eran de 4 a 10 mallas sueltas, todas con sombra: con 50
  columnas, unas 1.000 piezas y unas 2.100 llamadas de dibujo por fotograma. Ahora todas las figuras van en una malla instanciada por pieza y
  material (`Tropel`, `mundo3d/figuras.ts`), que se rellena en cada fotograma. Se ven igual.
- **Antes → después**, zoom normal y carga 320: llamadas de dibujo 2.100 → 224; mandar el dibujo (CPU) 13 → 3 ms; tarjeta 10 → 3,2 ms
  (mediana); de 37-60 FPS con tirones de 45-85 ms a un fotograma que cuesta unos 3,5 ms. Detalle en `docs/Mundo_3D.md`, «Rendimiento (0.125.1)».

## [0.125.0] — 2026-11-03 · El blasón avisa de la subida y la barra del Almacén va sola · sin cambio de contrato

Peticiones de Víctor (2026-11-03):

- **La subida, a la vista.** Cuando la plaza cumple todo lo del nivel siguiente, el medallón del nivel en el blasón parpadea con un halo dorado
  y lleva un «!» ámbar que late (antes, un brillo suave y una flecha verde que no se notaban). Solo lo ve quien puede pedir la subida, el
  Gobernador; los demás de la Facción ven el medallón quieto.
- **La barra del Almacén va sola** mientras el jugador no elija: enseña lo que tiene la plaza (más de 0), hasta 8, en el orden en que llegó. Un
  recurso nuevo entra al final si hay sitio (comprar cobre lo pone el quinto), uno que se acaba sale, y con 8 a la vista el noveno espera a que
  salga otro. En cuanto el jugador pone o quita uno en la ventana del Almacén, manda su elección (la misma en todas sus plazas) y la barra deja
  de cambiar sola; «Que vaya sola» la devuelve al modo automático. La elección se guarda en otra clave
  (`bronzeage:barra-almacen-elegida`), así que todos empiezan en automático. Prueba en `pruebas/barraAlmacen.test.ts`.

## [0.124.0] — 2026-11-03 · El territorio sobre el relieve, solo caminos de tierra y el camino por la plaza · sin cambio de contrato

Peticiones de Víctor (2026-11-03), en el mundo 3D:

- **El territorio se nota.** Las zonas de influencia llevan un relleno suave del color de su Facción sobre el suelo (`mundo3d/territorio.ts`),
  como el del 2D: la tuya al 18 % con su zona fusionada, las ajenas al 13 %, con una franja de 4 u algo más marcada por dentro del borde. El
  suelo lo mezcla antes de la luz, así sigue las laderas. Un color oscuro (el negro) tiñe hasta 1,6 veces más, para que no parezca la sombra de
  una nube. Árboles, matas y agua quedan con su color.
- **Solo caminos de tierra.** En la Edad del Bronce no había calzadas: el escalón más alto de la red de caminos se pinta como camino de tierra
  (dos rodadas), del mismo ancho. Se quitó la textura de adoquines.
- **El camino pasa por la plaza.** Dos caminos que se encuentran en una plaza llegan del servidor como un solo tramo, y el suavizado le cortaba
  la esquina por dentro de la ciudad, sin tocar la maqueta. Ahora el tramo se parte en cada plaza, pueblo o campamento y cada trozo se suaviza
  aparte (`suavizarCamino(puntos, fijos)`).
- **Fronteras más finas.** La raya discontinua de la frontera pasa de 0,24 a 0,12 u y la de tu zona de 0,36 a 0,18 u.

Docs: `docs/Mundo_3D.md` («Territorio y caminos (0.124.0)»).

## [0.123.0] — 2026-11-03 · Respuesta inmediata al construir, Tecnología en la Facción y aviso al guardar el loadout · sin cambio de contrato

Peticiones de Víctor (2026-11-03):

- **Construir responde al momento.** Pasaban segundos entre pulsar un botón de construcción y ver algo en la interfaz. El motor atiende la orden en
  cuanto llega; en el cliente, los paneles esperaban a que se rehicieran el plano 2D y la vista 3D (las mallas de los edificios), y el botón no
  decía nada mientras tanto. Ahora:
  - el botón pulsado (construir, mejorar en la ficha, mover o quitar de la cola, pedir la subida) late en dorado hasta que llega la respuesta;
  - los paneles se pintan primero y la plaza se dibuja en el fotograma siguiente (`programarDibujoPlaza`; varios refrescos seguidos se juntan
    en un solo dibujo);
  - la consola dice cuánto tardó cada parte (`[plaza] anadirEdificioManualmente: motor … ms · proyección y paneles … ms · vista 3D … ms`), para
    saber dónde mirar si sigue tardando.
- **Tecnología, en la ventana de la Facción.** Las tecnologías afectan al jugador a través de su Facción: el botón «Tecnología» de la barra de
  arriba se quita y su contenido pasa a ser una pestaña de la Facción, entre Plazas y Tablón, con las filas como tarjetas y los botones a su tamaño.
- **«Loadout guardado».** En la ventana de salir al mundo, «Guardar loadout» no decía nada cuando salía bien: ahora sale el aviso. Y al guardar ya
  no se arrastran del loadout viejo las escuadras que el héroe ya no tiene (tropa prestada devuelta), que hacían que el motor lo rechazara entero.

## [0.122.0] — 2026-11-03 · Pagar a un mercenario desde dentro del campamento, con el almacén personal o el carro · contrato 2b2c2a58

Petición de Víctor (2026-11-03): poder pagar un contrato de mercenario desde dentro del campamento con el almacén personal o el carro. El motor
lo hace desde 2b2c2a58 (contrato 0.10.0): `OrdenContratarMercenario.pagar_con` y `OrdenProrrogarContrato.pagar_con`.

- **Contrato regenerado** desde el motor 2b2c2a58 (`src/contrato/REVISION`): solo cambia `orders_pb.ts` (los dos `pagarCon`).
- **El tablón de mercenarios elige con qué se paga**, como el mercado del campamento (`fuentesDePago` en `ui/columnaQuePaga.ts`): quien reside
  en el campamento paga con su almacén personal o con el carro que lleva (el de su columna, a la puerta, o, dentro sin columna, el que trajo al
  entrar); de visita, con el carro de su columna. Si hay dos, la píldora de arriba del tablón es un selector «Pagar con» con el oro de cada uno;
  sin elegir, va lo que el motor usa por defecto. Las tarifas que no alcanzan y el motivo del botón miran el oro de lo elegido. Se acaba el
  «sin columna» dentro de tu residencia.
- **La firma manda `pagarCon`** con lo elegido. La prórroga (Facción › Mercenarios) va sin él: el motor cobra del carro de la columna o, dentro
  del campamento donde resides, del almacén personal; su ayuda lo dice.
- Pruebas: `pruebas/mercenariosPago.test.ts` (con qué se paga dentro, a la puerta y de visita) y `pruebas/ordenes.test.ts` (`pagarCon` en la
  orden). El banco de mercenarios lleva `?residente=1`.
- Docs: `COMANDOS.md`.
## [0.121.1] — 2026-11-03 · El humo, en bocanadas suaves · sin cambio de contrato

- Las bocanadas de humo del mundo 3D (0.120.0) parecían piedras grises: ahora son bolas más redondas, más claras y con el borde desvaído.

## [0.121.0] — 2026-11-03 · El tooltip de los recursos de arriba se abre hacia abajo · sin cambio de contrato

Petición de Víctor (2026-11-03): en la barra de Población, Almacén y Estado (arriba desde 0.112.0), el tooltip de cada recurso se abría hacia
arriba y se salía de la pantalla; ahora se abre hacia abajo.

## [0.120.0] — 2026-11-03 · El mundo 3D con vida: nubes, viento, humo y pájaros · sin cambio de contrato

Petición de Víctor (2026-11-03): «mejorar la vista de mundo en general».

- **Sombras de nubes** que pasan despacio sobre el suelo, el agua y los bosques.
- **Viento**: las copas de los árboles se mecen un poco, cada una a su ritmo.
- **Humo** que sube de las plazas (más columnas cuanto más nivel), los pueblos, las avanzadas en pie y los fuegos de los campamentos.
- **Pájaros**: bandadas que dan vueltas cerca del héroe, aleteando y planeando.
- Todo se mueve en el sombreado: el JS de cada fotograma no cambia y son dos mallas más.
- Código: `mundo3d/vida.ts` (nuevo), `niebla.ts` (las nubes), `especies.ts` y `arboles.ts` (el viento). Pruebas en `pruebas/vegetacion.test.ts`.
  Documentado en `docs/Mundo_3D.md`, «El mundo con vida».

## [0.119.0] — 2026-11-03 · Arreglo: el almacén de los pueblos extractores salía vacío · sin cambio de contrato

Fallo que vio Víctor (2026-11-03) en una partida local: el almacén de la cantera de Ugarit salía siempre «Vacío», aunque en el motor tenía
380 de piedra.

- El motor manda el almacén de un extractor en `Pueblo.almacen_local`, sin el nombre del recurso (solo la aldea llega por recurso, en
  `almacen_por_recurso`). La proyección lo guardaba con la clave vacía, y la placa del almacén, el resumen y el acarreo del pueblo quitan las
  claves vacías: lo daban por vacío. Ahora se guarda con el recurso del extractor (`recursoDeExtractor` en `motor/proyeccion.ts`: cantera,
  piedra; mina, oro; minaCobre, cobre; minaEstano, estaño; minaHierro, hierro; el `produccionBase<Recurso>` de cada uno en el catálogo).
- Pruebas en `pruebas/almacenPueblo.test.ts`.
## [0.118.0] — 2026-11-03 · Suelo con vegetación y siete especies de árbol en el mundo 3D · sin cambio de contrato

Petición de Víctor (2026-11-03): «mejorar el piso, con vegetación y diferentes tipos de árboles».

- **Suelo**: verde de pasto donde el suelo es fértil (la fertilidad del artefacto), pajizo donde no, por manchas; un grano fino que de cerca
  quita lo liso.
- **Siete especies de árbol**: encina, olivo, pino piñonero, ciprés, abeto, palmera y álamo, según la altura y el agua cercana (álamos y
  palmeras en las riberas, pinos en la costa, abetos en la montaña). Los bosques van por manchas de una especie con otras sueltas.
- **Vegetación baja** cerca del héroe (hasta 48 u): hierba por matojos, flores por manchas en los prados, matas de monte bajo, juncos en la
  orilla y piedras en las laderas. La hierba, las flores y los juncos se mecen con el viento.
- Coste en el banco: 1,30 M triángulos frente a 0,95 M y 622 mallas frente a 438; el JS de cada fotograma no cambia. De lejos, las copas
  redondas de cuatro especies van en una sola malla.
- Código: `mundo3d/especies.ts`, `matas.ts` y `ruido.ts` (nuevos); `arboles.ts` (una malla por especie, agua cercana), `terreno.ts` (color
  por fertilidad y grano), `fuente.ts` (`fertilidadEn`). Pruebas en `pruebas/vegetacion.test.ts`. Documentado en `docs/Mundo_3D.md`.

## [0.117.0] — 2026-11-03 · Los puestos del mercado como tiendas y las puertas de muralla entre dos torres · sin cambio de contrato

Peticiones de Víctor (2026-11-03): que los puestos de mercado de más allá del nivel 1 sean tiendas (los de varias celdas, varias tiendas con
varias puertas o una tienda grande), y que las puertas de muralla sean puertas de verdad con una torre a cada lado, también en la empalizada.

- **Puestos de mercado** (`ciudad3d/modelos.ts`): en una plaza de nivel 1 siguen siendo tenderetes. Del nivel 2 en adelante, cada celda es una
  tienda con su cuerpo al fondo, su portal, el mostrador sacado a la calle, el toldo sobre postes y tinajas o cestos delante; de barro y paja en
  el 2 y de adobe, piedra o palacio (una o dos plantas) del 3 al 5. Un puesto de varias celdas puede ser, fijo por puesto, una tienda grande
  con el portal en medio, dos mostradores y un pórtico corrido (de columnas en el 4 y el 5).
- **Abren a la calle**: `ciudadEnVista` mira las celdas vecinas del trazado a cada lado largo del puesto y apunta en `EdificioEnVista.frente` el
  que da a una calle o un camino (si no se sabe, a suertes).
- **Puertas de muralla entre dos torres** (`ciudad3d/murallas.ts`): las celdas de muro que tocan el paso llevan la torre de la puerta, más alta
  que el muro. En la empalizada, dos torres de madera unidas por una pasarela; en el nivel 2, torres cuadradas de piedra y adobe que salen del
  muro, y el paso con jambas, dintel, hojas y el muro por encima; en el nivel 3, torres macizas más altas a los lados de la puerta de los Leones.
  Van con los ejes de la celda (en una esquina no salen de ella) y solo donde la celda toca el paso. El motor no cambia.
- **Un puesto de mercado de una plaza de nivel 2 o más nunca se queda en tenderete** (`estiloDe`): puede ir un estilo atrás, como las casas,
  pero no por debajo del 2.
- **Arreglo: la muralla de una plaza se dibuja de vecina en vecina** (`ciudadEnVista`). El motor manda las celdas en el orden de sus obras y
  puede llevar una torre al final de la lista; el cliente las encadenaba en ese orden, así que el anillo salía abierto, con un muro tendido de
  punta a punta por dentro de la plaza y la puerta con una sola torre. Ahora el dibujo las encadena como la empalizada del campamento
  (`anillosDe`, que pasa a `estado.ts`) si hacen un solo anillo; lo levantado y lo mejorado sigue el orden del motor.
- Pruebas en `pruebas/ciudad3d.test.ts`: las tiendas no salen de su huella en ninguna forma, estilo ni lado; el toldo cae del lado de la calle;
  en la ciudad del banco, el frente de cada puesto da a una calle; un puesto de nivel 2 o más no es tenderete; la muralla de la ciudad del
  banco sale cerrada y de vecina en vecina; y en el pueblo y la ciudad, en cada nivel de muralla, una torre a cada lado del paso, más alta que
  el muro y dentro de su celda.
- Docs: `Ciudad_3D.md`.
## [0.116.0] — 2026-11-03 · Sin velo sobre el blasón y la barra de arriba, con sus letreros debajo · sin cambio de contrato

Peticiones de Víctor (2026-11-03):

- El degradado oscuro del borde de arriba de la plaza (la barra del jugador) queda por detrás del blasón y de la barra de Población, Almacén y
  Estado, que ya no se leen con velo (`.plaza-3d > .jugador-barra`, z-index 2).
- En la barra de arriba, los letreros «Población», «Almacén» y «Estado» van por debajo de cada placa, y la raya de color también abajo. La barra
  sube a la altura del blasón.

## [0.115.0] — 2026-11-03 · Construcción sin la pestaña «Todos» · sin cambio de contrato

Petición de Víctor (2026-11-03): en el cajón de Construcción ya no está la pestaña «Todos». Siempre hay un tipo elegido; al abrir, el primero que
tiene algo que construir (`grupoConstruir`, ui/panelObras.ts).

## [0.114.0] — 2026-11-03 · La plaza sin «Ejércitos», con el blasón arriba del todo y «Salir al mundo» abajo a la izquierda · sin cambio de contrato

Petición de Víctor (2026-11-03, 13:29):

- **La barra del jugador, sin el nombre del héroe ni «Dentro de…»** en la plaza, el campamento y el pueblo: el blasón ya dice dónde estás. Lo que
  avisa de peligro (te persiguen, estados) sale bajo la barra de Población, Almacén y Estado.
- **El blasón y lo que cuelga debajo** (obras, subida) suben arriba del todo.
- **Población, Almacén y Estado** a la altura del blasón, a su tamaño (ya no estiran) y centrados en el hueco hasta los botones del jugador. Si no
  caben, el Almacén pasa a dos filas y, más estrecho, a una fila suya debajo. Se mide dónde acaba (`--pie-fin`) y lo que ocupan los botones
  (`--botones-ancho`) para que ventanas, ocupación y avisos vayan debajo.
- **Fuera el botón «Ejércitos»** y su panel. Lo que hacía (unirse con tropa del campamento a un ejército de tu Facción que pasa cerca,
  `unirseAEjercito`) sale ahora como icono del riel **solo cuando se puede** (`ejercitosParaUnirse`: resides, tienes tropa libre, la columna
  admite y está a `radioReabastecimiento` o menos), y su ventana enseña solo esos ejércitos.
- **«Salir al mundo», abajo a la izquierda** (en móvil, encima del riel). El misiones sube a ras de la barra del jugador. El cajón de
  Construcción queda entre el botón y el minimapa.

## [0.113.0] — 2026-11-03 · Agua de verdad en el mundo 3D · sin cambio de contrato

Petición de Víctor (2026-11-03): «hay que mejorar la vista del agua, q no solo sea el piso pintado de azul».

- **Mar y lagos**: una lámina de agua transparente a su nivel, sobre un fondo que baja desde la orilla (nada junto a ella, 31 m a 6 u). Turquesa
  donde cubre poco, azul hondo mar adentro, con olas que se mueven, brillo del sol, el cielo reflejado al mirar de lado y espuma en la orilla.
- **Orilla suave**: la costa ya no sigue los dientes de las muestras de agua; la tierra baja hacia el agua sin hundirse.
- **Ríos**: la misma agua, somera en los bordes y honda en medio, con la corriente bajando río abajo; la orilla de tierra mojada se desvanece
  hacia fuera en vez de ser una raya marrón.
- El clic y lo que se pone encima del agua van a la altura de la lámina; todo sigue bajo la niebla de guerra.
- Junto al mar, unos 0,1 M triángulos más (0,81 M frente a 0,71 M); el mismo tiempo de construcción y el mismo coste por fotograma.
- Código: `mundo3d/agua.ts` (nuevo), `terreno.ts` (fondo y lámina por tesela), `paisaje.ts` (ríos), `niebla.ts` (`parchear`, para los materiales
  que ya cambian su sombreado). Pruebas en `pruebas/agua.test.ts`. Documentado en `docs/Mundo_3D.md`, «El agua».

## [0.112.0] — 2026-11-03 · La barra de Población, Almacén y Estado, arriba al centro · sin cambio de contrato

Petición de Víctor (2026-11-03): la barra de Población, Almacén y Estado sube arriba y ocupa el hueco entre el blasón y el panel de misiones.

- **Arriba al centro** (`.plaza-3d .asent-pie`): de la columna del blasón a la de las misiones (`--der-ancho`), en una sola fila: Población y Estado a
  su tamaño y el Almacén estira lo que sobra; si sus recursos no caben en una fila (pantallas medianas), van en dos iguales (`--n`, `--n2`, consulta
  de contenedor). En móvil va a todo lo ancho bajo la barra del jugador y el blasón y «Salir al mundo» bajan.
- **Lo demás se pone debajo**: su alto se mide (`vigilarPieArriba`, ui/hudPlaza.ts, en `--pie-arriba`) y las ventanas, la franja de ocupación, el
  aviso de batalla del pueblo y los avisos flotantes empiezan bajo ella. Abajo solo queda el riel (o el cajón de Construcción). Vale también para el
  campamento y el pueblo, que usan el mismo esqueleto.

## [0.111.0] — 2026-11-03 · Distancia de carga del mundo, ajustable · sin cambio de contrato

Petición de Víctor (2026-11-03): que el mundo no se cargue entero, sino hasta una distancia que sea un valor de configuración.

- **Distancia de carga** en el botón de capas del modo mundo, apartado «Vista»: un deslizador de 100 a 480 u que se recuerda en el navegador.
  De serie, 320 u, lo que se cargaba antes.
- Hasta ahí se construyen el suelo, el paisaje, los árboles y las rayas, como antes, y ahora también las maquetas (plazas, pueblos, avanzadas,
  campamentos…), las columnas y caravanas ajenas con sus rutas y los nombres, que antes se ponían en todo el mundo conocido.
- La bruma acaba justo donde acaba lo cargado: alejado ya no se ve el borde del suelo.
- Con menos carga, el suelo fino llega menos lejos. En el banco, con el héroe solo: 0,93 M triángulos y 11.800 árboles con 320 u; 0,61 M y
  10.400 con 160 u; 0,47 M y 7.700 con 100 u. Con la cámara a 30° apenas cambia lo que se ve.
- El banco del mundo 3D acepta `?carga=N`.

## [0.110.0] — 2026-11-03 · Construcción en un cajón bajo la barra, mejorar en la ficha y solo lo que se puede hacer · sin cambio de contrato

Peticiones de Víctor (2026-11-03, 12:55), con la premisa «si no lo puedo hacer, para qué lo muestro»:

- **Construcción sale del riel como cajón** (`htmlCajonConstruir`, main.ts): al pulsarla, el riel se esconde y en su sitio sale el cajón con
  «← Volver», la auto-construcción y la rejilla de construir por tipos; la barra de Población, Almacén y Estado sube con él (`.plaza-3d.construyendo`,
  `--riel-alto`). Ya no hay ventana de Construcción.
- **Solo quien puede tocarla ve la construcción**: el botón de Construcción, el cajón y la auto-construcción salen solo al Gobernador o al
  Maestro de Obras de la plaza (el motor autoriza `AlternarAutoConstruccion` y la cola con `Cargo(GOBERNADOR_O_MAESTRO)`; el Rey sin uno de
  esos cargos no puede).
- **Obras bajo el blasón con su barra**: el panel de obras en marcha (`htmlObrasHud`) lleva la barra de avance estimada y el tiempo que queda de
  cada obra, y la cola en casillas numeradas; con cargo, al pasar por una casilla salen ◀ ✕ ▶. Ya no abre Construcción.
- **Mejorar, en la ficha del edificio** (`ui/vistaCiudad.ts`): con cargo, «Mejorar a N+1» con el coste en chips (en rojo lo que falta) y el tiempo
  de obra; si la plaza, el edificio que pide o la tecnología no llegan, no sale. Durante la obra o la mejora, su barra y lo que queda. Sin cargo,
  la ficha ya no dice «es cosa del Gobernador»: solo informa. La lista de Edificios de Construcción desaparece.
- **Solo lo que se puede hacer**: en el riel ya no salen Taberna ni Mercado con candado (salen al tener el edificio activo), y en construir no
  salen los edificios que el cliente sabe que no se pueden pedir (único ya levantado, nivel de plaza, tecnología, nivel de Facción, capital).
  Lo que no se puede pagar todavía sí sale, con el coste en rojo.
- Bancos: `pruebas/hud/?construir=1` (el cajón) y `?ficha=mejora|activo|obra` (la ficha); `pruebas/plaza/` enseña la rejilla de construir.

## [0.109.0] — 2026-11-03 · Botón de capas: quitar los nombres de los nodos, fertilidad y parcelas de bosque en el modo mapa · sin cambio de contrato

Petición de Víctor (2026-11-03): que los nombres de los nodos se puedan quitar en el mapa de mundo, y que el modo mapa tenga una capa de
fertilidad y otra de parcelas de bosque que se pongan y quiten, solo sobre lo que ya se vio alguna vez.

- **Botón de capas** encima del zoom, en el modo mundo y en el modo mapa: abre una lista de casillas. Lo marcado se recuerda en este navegador
  y vale en las dos pantallas.
- **Nombres de los nodos** (puestos de serie). Quitados, el mundo 3D no pone los de los nodos cercanos (la vista previa de fundar sigue
  nombrando los de su zona) y el modo mapa no los escribe bajo los iconos.
- **Fertilidad del suelo** (modo mapa): de óxido a ocre donde no llega a la fertilidad que pide la aldea agrícola, y de paja a verde hondo
  desde ella; el salto de color marca dónde cabe una aldea. Leyenda con la rampa y el corte.
- **Parcelas de bosque** (modo mapa): cada parcela con su círculo de 4 u, más llena cuanto más densa; verde libre, ámbar con Leñera, rojo en
  la zona de otra Facción.
- Las dos capas van encima de la niebla pero solo sobre las celdas exploradas alguna vez; lo no explorado sigue tapado.

## [0.108.0] — 2026-11-03 · El campamento y el pueblo a pantalla completa, y pagar mercenarios con el carro de la columna · sin cambio de contrato

Peticiones de Víctor (2026-11-03): el campamento de mercenarios, los pueblos y las aldeas con la vista 3D a pantalla completa como la plaza, y
mercado, tropa, mercenarios y taberna a pantalla completa; y un fallo: al pagar a un mercenario no se veía el oro del carro.

- **Campamento, pueblo y aldea con el esqueleto de la plaza** (`.plaza-3d`): la escena 3D llena la pantalla; arriba a la izquierda, un blasón
  con el icono del sitio (`ui/hudInterior.ts`); al borde derecho, el rastreador de misiones; abajo, el pie y el riel (como la plaza desde 0.104.0);
  el minimapa en la esquina. Las pestañas de antes son ventanas del riel, con el mismo contenido: en el campamento Resumen, Tropa, Mercado,
  Mercenarios, Fondo y Taberna (Tropa, Mercado, Mercenarios y Taberna a pantalla completa); en el pueblo Resumen, Guarnición, Acarreo y Carga.
  Un clic en una pieza del campamento abre su parte; Esc o ✕ cierra la ventana. Ninguna abierta al entrar.
- **El pie del campamento**: tu almacén personal (si resides allí) y el carro que llevas, cada uno solo si lleva algo. El del pueblo, su almacén.
- **Pagar a un mercenario**: el tablón leía el carro propio del héroe (`heroe.carro`), pero el motor cobra la tarifa del carro de la columna en la
  que vas (`columna_que_lleva`). Ahora el tablón cuenta el oro de esa columna (`ui/columnaQuePaga.ts`), dentro de visita o a la puerta. Dentro de
  tu residencia no vas en columna y el motor no deja contratar: el tablón lo dice («sin columna») y el botón explica que hay que salir a la puerta
  con la columna. Pruebas en `pruebas/mercenariosPago.test.ts`; el banco de mercenarios lleva el oro en la columna.
- `ui/pueblos.ts` separa las partes del pueblo (`pestanasDePueblo`) de lo que va dentro (`htmlCuerpoPueblo`).
- Docs: `Diseno_Interfaz.md`.
## [0.107.0] — 2026-11-03 · La barra del Almacén con 8 recursos elegidos y su ventana con la producción · sin cambio de contrato

Petición de Víctor (2026-11-03): que la barra de abajo enseñe como mucho 8 recursos, elegidos por el jugador en un panel de Almacén que se
abre con un clic en esa barra, a pantalla completa, y que se lleve la producción.

- **La placa Almacén de la barra de abajo lleva como mucho 8 recursos**, los que elijas y en tu orden, también si están a 0. De partida:
  trigo, madera, piedra, cobre, estaño, oro, lingote de bronce y ganado. Ahora cabe en una fila también a 1280 px.
- **Un clic en la placa (o Intro con el foco en ella) abre la ventana Almacén**, a pantalla completa como Mercado y Taberna. A la izquierda,
  «En la barra de abajo», con todos los recursos de la plaza para poner o quitar, con un contador «5/8» (con 8, avisa de que hay que
  quitar uno antes), el almacén con su neto por minuto y la extracción. A la derecha, los talleres.
- **La producción sale de Construcción**: el plegable Producción ya no está allí, solo en el Almacén.
- La elección se guarda en el navegador (`localStorage`), igual para todas tus plazas. El motor no guarda nada de esto.
- El banco `pruebas/hud/?ventana=almacen` abre la ventana de verdad.

## [0.106.0] — 2026-11-03 · Mercado y Taberna de la plaza a pantalla completa · sin cambio de contrato

Petición de Víctor (2026-11-03, tercer punto del frente de interfaces): mercado, tropa, mercenarios y taberna a pantalla completa. Aquí van los
dos de la plaza. Tropa y Mercenarios son del campamento y llegan cuando pase al esqueleto de la plaza.

- **Las ventanas Mercado y Taberna ocupan toda la pantalla**, de la barra de arriba al riel, que se queda a la vista para cambiar de ventana.
  Mientras están abiertas tapan el blasón, la barra de Población, Almacén y Estado y el minimapa. Se cierran como siempre (✕, Esc o su icono).
- **Con 1000 px de ancho o más, el contenido va en dos columnas**: en Órdenes, la boleta a la izquierda y las órdenes en pie a la derecha; en
  Trueques, los trueques en curso y cerrados a la izquierda y el formulario de proponer a la derecha; en la Taberna, Mirada e Informe a la
  izquierda y tus Miradas e Informes a la derecha. Las caravanas van en rejilla, una tarjeta al lado de otra.
- En una ventana más estrecha nada cambia: las columnas son `display: contents` y se apilan como antes (vale para cuando estos paneles se usen
  en el campamento o en otra ventana).
- El banco `pruebas/hud/` abre Mercado y Taberna a pantalla completa (`?ventana=mercado`).
## [0.105.0] — 2026-11-03 · El mundo sin saltos y el acarreo dentro hasta que sale · sin cambio de contrato

Fallos que vio Víctor (2026-11-03): con 40-50 héroes en marcha, tras un rato las columnas y caravanas iban a saltos; y las miniaturas de
acarreo se veían en el mundo mientras estaban dentro de su pueblo.

- **Lo ajeno anda sin saltos.** Con tu columna parada, las columnas y caravanas de otros solo se recolocaban cuando llegaba algo del servidor
  (medido con 45 cuentas de prueba: 1,5 veces por segundo, a saltos de casi 1 u). Ahora, mientras van por su plan (`enMarcha`), se recolocan
  en cada fotograma como las tuyas.
- **Las rutas no se vuelven a trazar cada vez que algo avanza**: se trazan una vez y se acortan por delante. Con 30 carros de acarreo en marcha,
  el peor fotograma baja de 50 a 20 ms. Las rutas de lo que está más allá de lo que se carga no se pintan.
- **El carro de acarreo no está en el mapa mientras carga dentro de su pueblo**: solo se ve cuando sale lleno, y a la vuelta. En general, de
  tus caravanas solo se ven las que van de camino o están aparcadas en el campo; las que esperan dentro de su plaza o de una parada, no. En
  el mundo 3D y en el modo mapa.
- Los nombres sobre el mundo se colocan sin recolocar la página en cada fotograma; los refrescos por cambios del servidor ya no se retrasan
  sin fin cuando llegan muchos seguidos; el almacén guarda solo los últimos 500 hechos.
- Banco del mundo 3D: `?acarreo=N` pone N carros de acarreo en marcha, para medir. Pruebas de lo que anda, de qué caravanas se ven y del
  trazado de las rutas.

## [0.104.0] — 2026-11-03 · El riel de la plaza, debajo de la barra de abajo · sin cambio de contrato

Petición de Víctor (2026-11-03, segundo punto del frente de interfaces): mover el riel de botones de la izquierda debajo de la barra central
inferior (Población, Almacén y Estado).

- **El riel es ahora una fila de iconos al pie de la pantalla**, centrada con la barra de Población, Almacén y Estado, que sube para dejarle
  sitio. El nombre de cada ventana sale encima del icono al pasar el ratón. La ventana elegida se marca con una raya dorada abajo.
- **Debajo del blasón solo quedan las obras en marcha** (y la subida en curso).
- Las ventanas y la columna izquierda descuentan la altura del riel para no meterse debajo.
- Va con las clases comunes `asent-*`: el campamento y los pueblos lo tendrán igual cuando pasen al esqueleto de la plaza.
- Banco nuevo `pruebas/hud/` con el esqueleto de la plaza (`?ventana=mercado` abre una ventana, `?3d=1` pone la ciudad en 3D, `?fondo=<url>`
  una imagen de fondo).

## [0.103.0] — 2026-11-03 · La ventana de Diplomacia se adapta a la pantalla · sin cambio de contrato

Petición de Víctor (2026-11-03, primer punto del frente de interfaces): que la diplomacia se adapte al tamaño de la pantalla.

- **Ocupa todo el ancho de la ventana de la Facción.** Antes el centro se quedaba en 960 px aunque sobrara pantalla. Ahora la ficha va en el
  centro y la lista de Facciones a la derecha, a toda la altura, y cada columna se desplaza por su cuenta.
- **El formulario de proponer** va en una rejilla con un rótulo sobre cada campo (A, Qué, Tributo, Por minuto). El tributo solo aparece al
  elegir vasallaje. Los campos de anexión y fusión son más bajos.
- **Pantallas medianas y bajas** (afecta a toda la ventana de la Facción): por debajo de 1280 px el panel de la izquierda se estrecha y el
  escudo se achica; por debajo de 1100 px los datos de la Facción pasan a filas «rótulo … cifra» y la Liga se apila. Con menos de 800 px de
  alto, escudo y pestañas más bajos. Por debajo de 900 px todo va en una columna, con la lista de Facciones arriba en una franja.
- Banco nuevo `pruebas/diplomacia/` (`?elegida=fac-2` para ver otra Facción), sin servidor.

## [0.102.0] — 2026-11-02 · Pantallas de carga con consejos · sin cambio de contrato

Petición de Víctor (2026-11-02): pantallas de carga entre la vista del mundo y las de dentro, con consejos del juego e imágenes tomadas de la
mesa. Es todo del cliente: el motor no guarda ni sirve nada de esto.

- **Al pasar del mundo a una plaza, un campamento o un pueblo, al volver al mundo y al entrar en la partida**, sale una pantalla de carga:
  la imagen del consejo a pantalla completa, el consejo centrado en el cuarto inferior sobre un fondo opaco que se aclara hacia las orillas,
  y abajo lo que se está haciendo («Entrando en Pesinunte», «Saliendo al mundo») con la barra de carga.
- Dura lo que tarde en pintarse la vista nueva (el mundo en 3D baja el relieve y arma el terreno) y como poco 2,2 s, para leer el consejo.
  No repite el mismo consejo dos veces seguidas, tampoco al recargar.
- **Los consejos están en un archivo del cliente**, `public/carga/consejos.json`, con sus imágenes en `public/carga/img/`. Se lee al jugar,
  así que se cambia sin recompilar. Cada consejo dice en qué vistas sale (mundo, plaza, campamento o pueblo) y se puede apartar sin borrarlo.
  Lo editará una página nueva del cliente de administración, como la de misiones.
- De salida, 19 consejos y 12 imágenes: seis de la mesa de escalas 3D del motor y seis de la vista 3D de la plaza.
- Código en `src/ui/pantallaCarga.ts`; la abre el router de pantallas. Formato del archivo en `docs/Pantallas_De_Carga.md`. Pruebas de la
  elección del consejo y de que el catálogo que va con el cliente vale (ids únicos, vistas válidas, imágenes que existen).

## [0.101.0] — 2026-11-02 · Los pueblos y las aldeas en 3D · contrato 0.9.0 (`VRhino/BronzeAge@61366539`)

Petición de Víctor (2026-11-02): la vista 3D también dentro de los pueblos extractores y las aldeas agrícolas. El motor manda ahora su
planta a quien está dentro (`Pueblo.planta`, `trazado` y `nivel_madre`).

- **Dentro de un pueblo o una aldea, el centro es la vista 3D** y la planta en SVG queda de minimapa abajo a la derecha (un clic lleva la
  vista ahí). Cada pieza en su huella exacta; las casas, con el estilo de la plaza madre hasta el 3.
- **Modelos nuevos**: la bocamina de cada metal (un cerrillo de peñas con la entrada apuntalada, la escombrera y el mineral de su color) y
  la cantera (un crestón con dos gradas cortadas en piedra clara, los bloques sacados y su rastra).
- Al pasar el ratón, el nombre de la pieza; si lo están atacando, una franja roja arriba.
- Sin planta (un motor anterior) o sin WebGL, el anillo de huecos de siempre.
- Contrato regenerado desde el motor 61366539 (encima del e4923d4d de 0.100.0: solo añade la planta del pueblo).
- Banco: la cantera, una mina de cada metal y las aldeas de nivel 1 a 3; pruebas de las huellas y de que los modelos no salen de su parcela.

## [0.100.0] — 2026-11-02 · Nombre de caravana y carro en el campamento · contrato 0.8.0 (`VRhino/BronzeAge@e4923d4d`)

Tanda del motor del 2026-11-02 (aviso en `motor/aviso-tanda-2026-11-02.md`). Contrato regenerado desde e4923d4d.

- **Las caravanas tienen nombre** (`renombrar_caravana`, `Caravana.nombre`): en Mercado › Caravanas, un lápiz ✎ junto al nombre (para quien
  reside en su origen y está dentro). Intro o ✓ lo guarda; vacío la deja sin nombre; Esc o ✕ lo deja como estaba. Hasta 32 caracteres. El
  nombre sale también en «Lo que llevas», en la escolta y al mover un carro de una caravana a otra.
- **La Granja sale del menú de construir**: la ciudad solo tiene la de la fundación, que se sigue mejorando (el motor responde `obra.unico`).
- **Mercado del campamento: «Pagar con»** (`pagar_con`): el residente elige su almacén personal o el carro que lleva aquí (el de su columna o,
  dentro y sin columna, el suyo). Con el carro no se vende trigo y lo comprado va al carro. El visitante, como antes, con el carro.
- **Fondo de refundación**: el lado carro vale también dentro del campamento, con el carro que llevas; ya no hace falta pasarlo antes al almacén.
- El nombre de la plaza se corta en 32 caracteres, como el motor (antes el campo dejaba 40).
- Sin cambios: el ascenso de prueba de 10 minutos y los diez campamentos de bandidos por plaza ya se leen del motor.

## [0.99.0] — 2026-11-02 · Clic en la muralla para abrir Defensa · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **Un clic en la muralla de la vista 3D abre la ventana Defensa**: un muro o una torre, en su subpestaña Muralla; la puerta, en Puerta.
  Hasta ahora solo se abría desde el riel. En una plaza ajena no se abre (Defensa no está de visita).
- Al pasar el ratón por la muralla, un tooltip con lo que es (Muralla, Puerta, Torre de la muralla) y su nivel, o «Sin levantar todavía».
- La vista 3D elige la pieza más cercana que toca el rayo, sea de un edificio o de la muralla (`MurallaElegida`, `alElegirMuralla`,
  `alPasarMuralla`); si no toca ninguna, la celda de muralla donde da en el suelo.

## [0.98.0] — 2026-11-02 · La plaza repartida por los bordes · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

Petición de Víctor (2026-11-02): la interfaz del asentamiento metía demasiado en muy poco espacio. Se reparte por los bordes de la
pantalla y cada parte va en su propia ventana (`src/ui/hudPlaza.ts`).

- **El pie de la pantalla, en tres grupos separados por color**: **Población** (total frente al techo del nivel y cada clase frente a su
  sitio), **Almacén** y **Estado** (nutrición y mantenimiento en verde, ámbar o rojo). El detalle, al pasar el ratón.
- **El minimapa, abajo a la derecha y pegado a los bordes.**
- **El blasón lo reúne todo de la plaza**: el nombre se cambia ahí mismo con el lápiz ✎ (si resides en ella); la casa dice si resides
  aquí y abre la tarjeta de la residencia; la corona marca la capital y, al Rey, le deja designarla. El medallón del nivel abre «Subir de
  nivel» y brilla con una ⬆ cuando la plaza ya puede subir.
- **Un riel de iconos bajo el blasón**, cada uno con su ventana: Construcción (con las obras en marcha en una insignia), Gobierno (Cargos y
  Tesorería), Defensa (Muralla y Puerta), Territorio (Pueblos y aldeas, Fundación), Reclutamiento, Taberna y Mercado. Con candado si falta
  el edificio.
- **Las ventanas, una a la vez y a media pantalla** junto al riel, con ✕ o Esc para cerrar; la ciudad sigue a la vista. Reclutamiento y
  Mercado, más anchas.
- **Un clic en el Barracón, la Galería de tiro o las Caballerizas abre Reclutamiento**; en la Taberna o el Mercado, la suya.
- **El Resumen desaparece**: la auto-construcción pasa a Construcción y la ocupación militar, a una franja roja arriba al centro.
- **Las obras en marcha, bajo el riel**: hasta tres con su cuenta atrás, y un clic abre Construcción.
- **El rastreador de misiones y la ficha del edificio, al borde derecho.**
- **Misiones y Tablón de la plaza, en el botón «Misiones» de la barra**, en dos pestañas. Información, en el «?» de la barra.
- Se quita el botón «Asentamiento» de la barra y su ventana a pantalla completa (0.92.0).
- Pantallas pequeñas: el pie se compacta bajo 1440 px, el riel encoge con poca altura y, bajo 900 px, la ventana ocupa todo el ancho.

## [0.97.0] — 2026-11-02 · El campamento de mercenarios en 3D · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **La pantalla del campamento lleva la vista 3D en el centro** (`src/ciudad3d/campamento.ts`), con la planta en SVG de minimapa en la
  esquina. Un clic en él lleva la vista ahí. Se dibuja como una plaza de nivel 1, con cada pieza en la huella exacta que manda el motor.
- **Las viviendas del campamento son tiendas**: una grande de lona o pieles, dos pequeñas o una redonda de pieles, cada una con su lumbre y, a
  veces, un armero con lanzas y escudo.
- **La empalizada**, celda a celda en el orden de su anillo, con una sola puerta ancha. Dentro, el suelo despejado y pisado, con leña y heno.
- **Clic en una pieza**: abre la pestaña de lo que se hace en ella (Taberna, Mercado o Tropa). Al pasar por encima, su nombre.
- La planta del campamento trae también los caminos y el radio del trazado (`EscenaCampamento.caminos`, `radio`).
- En la plaza, dos celdas de puerta seguidas en una empalizada son ahora una sola puerta ancha.
- **Banco** (`npm run ciudad3d`): tres campamentos reales del motor.

## [0.96.1] — 2026-11-02 · Arreglo: la barra de la subida de nivel · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **La placa «Subiendo a nivel N» de la plaza contaba mal**: salía al 0 % y con años por delante. El reloj que la mueve cada segundo
  (`instanteDeMundo` en `apiCliente.ts`) daba el instante de mundo sin la época del contrato (`EPOCA_CONTRATO`), y los plazos de la proyección
  la llevan. Ahora va en la misma escala: con una obra de 8 h empezada hace 2, marca 25 % y «faltan 6 h».

## [0.96.0] — 2026-11-02 · Cerrar sesión saca al héroe del mundo en el acto · sync con `VRhino/BronzeAge@a17f8536`

- **Contrato regenerado** (orden nueva `cerrar_sesion`, campo 180). Sin rechazos nuevos ni cambios de foto.
- **«Cerrar sesión» y «Cambiar de partida»** mandan `cerrar_sesion` con tu héroe, esperan el resultado (4 s como mucho) y luego cierran la conexión: el héroe sale del mundo en el acto, aunque le persigan; si está en batalla, en cuanto acaba (`salirDelMundo` en `apiCliente.ts`).
- Cerrar la pestaña sin más sigue siendo una caída (2:30, hasta 5 min si le persiguen). El servidor ya lleva la presencia por la conexión, así que el cliente no manda `conectarse` ni `desconectarse`.

## [0.95.0] — 2026-11-02 · La subida de nivel a la vista en la plaza · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **Mientras la plaza sube de nivel**, en la vista de la plaza aparece bajo el blasón, colgando de él y encima del minimapa, una placa con
  «Subiendo a nivel N», el porcentaje, la barra de la obra y lo que falta. Avanza cada segundo, sin esperar al servidor, y desaparece al
  terminar. Sin obra de ascenso, no está.

## [0.94.0] — 2026-11-02 · Las calles de la plaza 3D · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **Las calles, celda a celda** (`src/ciudad3d/calles.ts`, `src/ciudad3d/calzada.ts`). El motor las manda en tiras de una celda de alto, y
  antes las rodadas iban todas de este a oeste y los cruces eran iguales. Ahora se juntan en una red y cada celda sabe con qué vecinas se une:
  tramo, esquina, cruce en T, cruce en X o final.
  - Las rodadas siguen la calle: rectas en los tramos, en curva en las esquinas, girando en las T y cruzándose en las X. En los finales, la
    vuelta del carro.
  - Los cruces se ensanchan y se gastan en el centro, a veces con un charco. Llevan un guardacantón de piedra en las esquinas que dan a una
    casa.
  - **Principales y callejones**: se cuentan los recorridos de cada edificio y de cada puerta hasta el centro urbano. Las más usadas son
    principales (más anchas, con rodadas) y las demás, callejones (con una senda de pisadas). Los bloques de 2 × 2 celdas son explanadas.
    Los caminos de fuera serpentean, con dos rodadas y hierba en medio.
  - **Losas**: en el nivel 4, las principales y las explanadas; en el 5, todas. Van en hiladas que siguen la calle, con bordillo y un rosetón
    en los cruces en X. En el 5, las principales llevan en medio la calzada de losas grandes de Cnosos.
  - Las juntas no se notan: en el borde, la anchura es la media de las dos celdas y las rodadas van en el mismo sitio. Las teselas iguales se
    pintan una vez, en un atlas (unas 140 en una ciudad de 480 celdas de calle), y todas las calles van en una sola malla.
- El trazado no se toca: solo cambia cómo se pinta cada celda que el motor da por calle.
- **Banco publicado**: las ciudades ya no se leen con `fetch` (la página publicada no lo deja con un `data:` y salía vacía).

## [0.93.0] — 2026-11-02 · El mundo 3D: zoom de cerca, caminos, carros y la lista bajo el clic · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **Zoom de cerca**: un tercer zoom a 0,6 veces el normal (9 u en pantalla el héroe solo, 18 con soldados), además del normal y el alejado.
  La rueda y los botones + y − pasan de uno en uno.
- **Caminos que parecen caminos**: el trazado que manda el servidor nodo a nodo (una escalera cada 4 u) se suaviza (puntos medios, sin los
  vértices que no doblan y con las curvas redondeadas; los cruces no se mueven), y cada escalón lleva su textura con los bordes fundidos con
  el suelo: el sendero, una huella de tierra pisada; el camino, tierra con dos rodadas; la calzada, adoquines con bordillo. Son más anchos
  (0,4 / 0,65 / 0,9 u) y los árboles se apartan del trazado nuevo.
- **Carros**: si tu columna lleva algo en el carro, un carrito pequeño sin animal va justo detrás de la formación. Los carros de caravana
  (sueltas, enganchadas y el de fundación) van a 1,5 veces y siempre con su animal: el de la caravana (buey, caballo o camello) o un buey.
  Una caravana suelta pinta un carro por cada uno de los suyos (hasta tres).
- **Escolta**: una caravana suelta lleva delante su escolta, las escuadras cedidas (hasta tres); una ajena escoltada, una.
- **Varias cosas bajo el clic**: en el mundo y en el modo mapa, si el clic cae sobre dos o más cosas, antes de hacer nada sale arriba al
  centro, donde salen los avisos, una lista para elegir con cuál (símbolo, qué es y de quién). Elegir una hace lo de un clic sobre ella sola;
  Esc, un clic fuera o un clic en el mapa la cierran.

## [0.92.0] — 2026-11-02 · La plaza en 3D a pantalla completa · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **Toda la pantalla es la plaza en 3D**, también bajo la barra del jugador, que en la plaza pasa a transparente y de iconos, como en el
  mundo. Lo demás flota encima:
  - **arriba a la izquierda**, el **blasón** de la plaza: el escudo completo de la Facción dueña, con el medallón del nivel en su esquina,
    el nombre de la ciudad y la Facción (y «rinde como N» si el mantenimiento la baja). Debajo, el **minimapa** de antes, la ficha del
    edificio elegido y el rastreador de misiones;
  - **arriba a la derecha**, bajo la barra, «Ejércitos» (su panel se abre debajo) y «Salir al mundo»;
  - **abajo al centro**, el almacén, flotando.
- **Botón «Asentamiento»** en la barra, el primero por la derecha, en oro y con su nombre. Abre a pantalla completa la **ventana
  «Asentamiento»** con todo lo que iba en la columna derecha. Tiene el aire de la de Facción: en el lateral, el escudo grande, el nombre,
  la Facción y el nivel, y las pestañas de los edificios en vertical con su icono; a la derecha, el contenido de cada pestaña, igual que
  antes. Se cierra con ✕, Esc, el mismo botón o un clic fuera del marco; al elegir un edificio en su lista, se cierra y la cámara va a él.
- Pantalla estrecha: la columna de la izquierda se estrecha, «Asentamiento» queda en icono y la ventana pasa a una sola columna; en el
  móvil, la barra deja el nombre del héroe y sus botones se desplazan de lado. Sin WebGL, el 2D vuelve al centro a pantalla entera.
- El campamento y el pueblo no cambian.

## [0.91.0] — 2026-11-02 · La plaza en 3D · sin cambios de contrato (`VRhino/BronzeAge@a17f8536`)

- **La plaza en 3D** (`src/ciudad3d/`, `docs/Ciudad_3D.md`): la vista de la plaza (la tuya o la ajena desde dentro) pasa a una escena 3D con
  three.js, con el cielo y la luz del mundo 3D. El 2D de siempre queda de minimapa en la esquina, con lo que abarca la cámara en dorado; un
  clic en él lleva la vista ahí. Sin WebGL, el 2D a pantalla entera, como antes.
- **El trazado manda**: cada edificio se monta en código dentro de su huella, la muralla en sus celdas y las calles y caminos son los del
  trazado. Una prueba comprueba que ninguna pieza asoma más de 60 cm fuera de su huella.
- **El estilo va con el nivel de la plaza**:
  - del 1 al 5: chozas y casas largas de paja; barro; adobe de techo plano con patio; enlucido de dos plantas; y el palacio de Cnosos, con
    columnas y franjas rojas;
  - la muralla, por su nivel: empalizada con foso, piedra y adobe con bastiones, y ciclópea con su puerta de los Leones;
  - al subir de nivel, las casas cambian por partes; algunas se quedan un nivel atrás.
- **Las celdas libres**: huertos, patios, rediles, hornos, leña, almiares y árboles, y bosquecillos en el campo de alrededor.
- **Las obras**: armazón que crece con el avance, con su cuenta atrás. La cola, en estacas (solo en la propia). Andamios al mejorar, y ruina
  si está dañada.
- **El manejo**:
  - arrastrar desplaza; con el botón derecho o Mayúsculas gira e inclina; la rueda acerca. También WASD, Q/E y R/F.
  - el clic elige el edificio, con la misma ficha y el mismo tooltip de antes;
  - elegir en la lista lleva la cámara a él.
- **Banco** `npm run ciudad3d` (`pruebas/ciudad3d/`): una aldea, un pueblo y una ciudad reales del motor. Tiene mandos de estilo, muralla,
  obras, plaza ajena, saqueo y subida de nivel.

## [0.90.0] — 2026-11-02 · Misiones, Tablón y Territorio con aire de juego · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Misiones** (las de la plaza y, con las mismas cartas, las de la Facción): cabecera con 📜 en marcha y 🏆 por reclamar en chips. Cada misión, una carta con su sello (📜 en curso, 🏆 cumplida), sus objetivos en barras doradas y la recompensa en fichas con icono, como en el diario; la cumplida brilla y su «🎁 Reclamar» late. «◇ Seguir» / «◆ Siguiendo» pasa a la cabecera. Las hechas, en fichas verdes plegadas.
- **Tablón**: cada columna con su cabecera (☀️ Diarias, 📅 Semanales), lo que falta para renovarse, una barra de lo que ya pasó del periodo y 🏆 si hay algo por reclamar. Las misiones, en las mismas cartas, con su sello (👥 grupal, 👤 individual, 🏆 cumplida), el estado en una píldora del color de la carta, «✋ Aceptar» y «🎁 Reclamar». Elegir las de la semana que viene, en casillas con su marca y la cuenta (ámbar con el cupo lleno), y «📌 Guardar la elección».
- **Territorio**: la zona de influencia en fichas (una por tipo de nodo y otra para el bosque) con los libres en grande y una casilla por sitio, verde la libre; fuera la tabla. El cupo de pueblos y el de avanzadas, en chips con casillas. Cada pueblo, una tarjeta: emblema (🌾 aldea, el edificio del extractor), escudo de nivel de la aldea (girando si sube), ⚔ ¡Atacado!, fertilidad, granjas y corrales en chips, el almacén y el rebaño en barras (ámbar casi lleno), el carro de acarreo con su carreta, su estado, lo que lleva y su escolta, y «⬆ Nivel N» con lo que pide, «🛒 Reponer carro» con su coste (rojo lo que falta en el almacén) y «✕ Destruir». Cada obra, una tarjeta con lo entregado de cada material en fichas con barra (como un trueque) o, levantándose, lo que le queda, y «✕ Cancelar». Marcar, en dos cartas: la aldea (coste en fichas, su anillo y si hay tierra) y el extractor (los nodos libres como casillas, la más cercana marcada). Las avanzadas, en tarjetas con su icono por etapa, ⚔ o 🏚, y lo que pide la atalaya en fichas.
- Los rechazos de las tres pestañas salen flotando (fuera los errores en línea de misiones, tablón y territorio). El banco `pruebas/centro/` suma Misiones, Tablón y Territorio (misiones de plaza, tablón con catálogo y elección, zona con nodos y parcelas, pueblos, obras y avanzadas).

## [0.89.0] — 2026-11-02 · Muralla, Puerta, Tesorería y Fundación con aire de juego · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Muralla**: el plano de los anillos celda a celda (en pie con el color de su material, la celda que se levanta latiendo, lo que falta punteado, puertas en oro y torres con borde). Cada anillo, una tarjeta con su escudo de nivel, el material (🪵 empalizada, 🪨 muro de piedra, 🏰 muralla con adarve), puertas (cada abertura cuenta una, aunque mida dos celdas), torres y celdas en chips, el multiplicador de defensa (`1 + (bono − 1) × integridad / puertas`, Murallas §9.1), la barra de obra o de mejora, la celda en curso con lo que le falta y el coste por celda (la tarifa acumulada al levantar y la diferencia al mejorar, Murallas §11). ⬆ Mejorar y ✕ Abandonar (ahora con confirmación). Para trazar, los tres anillos como casillas con su bono, su ritmo y su coste por celda, con candado si la plaza no llega.
- **Puerta**: el portón con su estado (abierta, a medias o cerrada; fijada o por defecto) y una casilla por grupo (🕊️ neutrales, 🤝 aliados, ⚔️ enemigos, 📜 aedas) con candado; lo marcado se guarda en un borrador hasta «⚑ Fijar la puerta» (o «Deshacer»). Los vetados, en fichas con ✕ para levantar el veto, y «⛔ Vetar». **Reabastecer a los aliados**, en una tarjeta con interruptor.
- **Tesorería**: la reserva en fichas por recurso con lo que hay frente a lo que cabe y una raya roja donde empieza la reserva (ámbar si la plaza está por debajo); «🔒 Guardar» y «Descartar». Políticas: cada cargo con su emblema, sus slots en casillas, lo que tiene en vigor con la barra de lo que le queda y lo que puede activar como cartas con sus efectos en chips (🔨 −25 %, 💰 +60 %: verde lo que favorece a la plaza, rojo lo que la castiga); las de otros pools que puede activar el Gobernador, plegadas.
- **Fundación**: la carreta con su coste en fichas (lo que hay frente a lo que pide, con su barra; en rojo lo que falta), los requisitos como pilotos con su porqué y «🏕️ Lanzar caravana». Las caravanas de la plaza, en tarjetas como las del Mercado, con su titular, su estado y la barra de lo que les queda antes de caducar.
- Los rechazos de estas pestañas salen flotando (fuera los errores en línea de muralla, puerta, aliados, tesorería y fundación). El banco `pruebas/centro/` suma Muralla, Puerta, Tesorería y Fundación (y anillos de muralla en las escenas).

## [0.88.0] — 2026-11-02 · Mercado (Órdenes, Caravanas y Trueques) con aire de juego · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Órdenes**: una boleta con ▲ Vender / ▼ Comprar (ámbar y azul), el almacén como inventario de casillas con el icono y lo que hay (lo que hay, primero; lo vacío, apagado) para elegir el recurso, cantidad y precio por unidad con lo que cobras o pagas en total, y «Poner a la venta» / «Pedir». El oro de la plaza, en un chip. Las órdenes en pie, en fichas con el icono, ▲/▼, su barra de cumplido, el precio y lo que les queda.
- **Caravanas**: cabecera con el icono del Mercado y su nivel, los cupos de caravanas y carros en casillas (llenas las usadas), el Liderazgo de escolta por caravana y «＋ Crear». Cada caravana, una tarjeta con su carreta, borde y sello del color de su estado (dorado parada, ámbar preparándose, aparcada o esperando; azul en camino o de vuelta), el destino debajo y «Reservada» en interruptor; cuatro cifras grandes (📦 carga, velocidad con el color de ritmo de la columna, ⏱ preparación, 🛞 carros que tiran) y cada carro como una casilla con su animal y B/R (punteada en rojo si no tiene). La aparcada aquí lleva su carga en fichas y una fila recurso · cantidad · ⬆ Cargar · ⬇ Descargar, con «↩ Enviar al origen».
- **Trueques**: cada pacto, con las dos plazas frente a frente (escudo, nombre y lo que da cada una en fichas con lo entregado y su barra), el estado como sello (📜 sin contestar, 🤝 en vigor, ✔ cumplido, ✕ rechazado, ⌛ expirado) y el plazo; si te toca contestar, resaltado y con «✓ Aceptar» y «✕ Rechazar». Para proponer, la plaza en tarjetas y una balanza ▲ Das / ▼ Recibes con tres líneas por lado. Los cerrados, apagados.
- Todos los rechazos de Mercado (órdenes, flota, escolta, encargos, aparcadas y trueques) salen flotando: fuera el error en línea. La carreta pasa a `ui/juegoVisual.ts` (`ICONO_CARRETA`), que comparte con la Caravana de Fundación al convocar. El banco `pruebas/centro/` suma Órdenes, Caravanas y Trueques.

## [0.87.0] — 2026-11-02 · Reclutamiento y Taberna con aire de juego · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Reclutamiento**: la gente libre en chips arriba (🌾 pesants, ⚒️ artesanos, 👑 nobleza; resaltada la clase de la que sale la tropa elegida). La ficha de la tropa es una carta: retrato con su escalón en estrellas, poder y velocidad en barras contra lo mejor del catálogo (la velocidad con el color de ritmo de la columna: rojo, blanco o azul), liderazgo y hombres libres en chips (en rojo si no llegan), tu escuadra con su barra (o «escuadra nueva»), el coste total en chips (en rojo lo que falta en el almacén) y el botón ⚔ Reclutar / ↻ Reponer +N / ✓ Completa. Debajo, una rejilla por edificio militar con su icono y su nivel en rombos; cada casilla, con el icono y el nombre de la tropa y, si ya tienes su escuadra, su barra y la cuenta (✓ completa). El rechazo sale flotando.
- **Taberna**: cabecera con la taberna (su icono, el oro y las Miradas abiertas como ojos encendidos). Dos tarjetas de servicio, 👁 Mirada (radio y duración, «mirar alrededor de…» o 📍 x/y, y el precio en un chip, rojo si no alcanza el oro) y 📜 Informe de plaza (precio por nivel). Tus Miradas en casillas con la barra del tiempo que les queda (azul abierta, gris enfriándose); tus Informes con el nivel en escudo. El Informe abierto: escudo, Facción y antigüedad, chips de héroes, hombres de guarnición y edificios, el plano, los edificios y la guarnición como iconos con su cuenta, y cada recinto de muralla con su barra de celdas levantadas y sus puertas. El mismo panel sirve en la taberna de un campamento de mercenarios. Los rechazos salen flotando (fuera `#intel-error`).
- El banco `pruebas/centro/` suma Reclutamiento y Taberna.

## [0.86.0] — 2026-11-02 · Centro urbano (subida de nivel, Resumen y Cargos) con aire de juego · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Subida de nivel**: tarjeta con el escudo del nivel de ahora ➜ el del siguiente (punteado si aún no se puede, dorado si sí), un piloto por requisito (verde cumplido, rojo no, gris lo que comprueba el servidor), el tiempo de obra en días y el botón ⬆. Los requisitos, plegados, con barras (pesants, artesanos, pueblos), los edificios pedidos como iconos encendidos o apagados, el nivel pedido en rombos y el coste en chips (en rojo lo que falta). Durante la obra, el escudo en obra, la barra y lo que falta. Los requisitos se calculan como antes (`NIVEL_ASENTAMIENTO`, `ASCENSO_ASENTAMIENTO`); `htmlAscensoLocal` sale de `ui/pueblos.ts` y se va el camino del backend TS (`ascensoDeAsentamiento`, que el motor no proyecta).
- **Resumen**: cabecera con el escudo de la Facción, el nombre con un lápiz ✎ para cambiarlo (Intro guarda, Esc cancela; antes era un formulario siempre abierto), etiquetas 👑 Capital y 🏠 Tu base, y el nivel en escudo («rinde como N» si el mantenimiento lo baja). Población por clases (🌾 pesants, ⚒️ artesanos, 👑 nobleza) con barra contra su sitio (Viviendas activas × `capacidadPesants`/`capacidadArtesanos`, `capacidadNobles` del Palacio), rayado lo que no cabe, la marca dorada de lo que pide el nivel siguiente y el techo del nivel (`techoPoblacion`). Mantenimiento y nutrición en medidores de color con una palabra de estado (al día / con retrasos / en ruina; bien comidos / escasea / hambre). La ocupación, en una banda roja con lo que falta. Auto-construcción, en un interruptor.
- **Residencia y capital** (al pie del Resumen), en tarjetas: 🏠 resides aquí (tus cargos y «Dejar»), 🏕️ no resides (con «Hacerla mi base», que sale del Resumen) y 👑 capital (lo es, puedes designarla o por qué no). Sus rechazos salen flotando.
- **Cargos**: una silla por cargo con su emblema (🏛️ Gobernador, 🔨 Maestro de Obras, 💰 Tesorero, 🐂 Maestro de Caravanas, ⚔️ General, 🔥 Sacerdote), vacantes en hueco, la tuya en dorado y cuántos hay ocupados. Lápiz ✎ (o ＋ en una vacante) abre el combo, ✓ nombra y ✕ cancela; el rechazo sale flotando. **Residentes y participación** en ranking: 🥇🥈🥉, emblemas de sus cargos, barra contra el primero; 🧳 quien suma sin residir. El Maestro de Caravanas ya sale entre los cargos del ranking.
- Piezas comunes en `ui/juegoVisual.ts` (tiempos, barras, rombos de nivel, chips de coste, escudos de nivel y medidores), que usa también el panel de obras; `duracion` pasa a días desde 24 h. Resumen y Cargos salen de `main.ts` a `ui/panelCentro.ts`. Banco `pruebas/centro/` (Gobernador y Rey, de visita, y subiendo de nivel bajo ocupación).

## [0.85.0] — 2026-11-02 · «Construir» por tipos · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Construir** lleva pestañas por tipo encima de la rejilla: Todos, Ciudad (vivienda, almacén, granero), Recursos (granja, leñera), Talleres (fundiciones, curtiduría, armería, carpintería), Militar (barracón, galería de tiro, caballerizas) y Gobierno (sala del consejo, palacio, taberna, mercado, maravilla). La elegida enseña solo los suyos y sigue elegida entre repintados; cada pestaña lleva en verde cuántos se pueden poner ya en la cola. Los grupos son solo de la interfaz (el catálogo del motor no los trae): un edificio nuevo cae en «Otros» (`GRUPOS_CONSTRUIR`, `cablearPanelObras` en `ui/panelObras.ts`).

## [0.84.0] — 2026-11-02 · Panel de obras de la plaza con aire de juego de estrategia · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Centro urbano › Edificios** rediseñado (`ui/panelObras.ts`, sacado de `main.ts`): más iconos, estados y barras que texto.
  - **Construir**: casillas con el icono y el coste en chips debajo (en rojo lo que falta en el almacén; más de dos recursos, «+N»), candado si no se puede. Coste, tiempo y motivo en el título.
  - **Edificios**: una tarjeta por tipo con el icono grande, ×N, el nivel en rombos (llenos hasta el nivel, vacíos hasta el máximo del catálogo), insignias 🔨 en obra, ⬆ mejorándose, ⏸ parado por almacén lleno (late) y ⚠ dañado, el botón ⬆ de mejorar (solo si queda nivel) y la barra de la mejora al pie. Las que aún no están en pie salen en fantasma.
  - **Obras** (antes «Cola», ahora antes que Producción): lo que está en obra (construcción, reconstrucción o mejora) con su barra de avance y lo que falta; lo que espera, en casillas numeradas con ◀ ✕ ▶. La barra es una estimación: duración del catálogo (`tiempoConstruccionMinutos`, `obraMinutos` del nivel o `× MEJORA_EDIFICIO.multiplicadorPorNivel`) × `factorTiempoConstruccion` de las políticas activas (× `OCUPACION.fraccionCosteReconstruccion` si se reconstruye).
  - **Producción**: el almacén en fichas (neto ▲▼ en color, lo que hay frente a lo que cabe, tira de lo que entra frente a lo que sale, «LLENO» o ⏳ si se acaba en menos de una hora), la mano de obra en un medidor, los extractores como edificio ➜ recurso y los talleres como insumos ➜ producto con un interruptor ▶ / ❚❚. En la cabecera de cada plegable, avisos en chips (▼ recursos a la baja, 📦 llenos, ⏸ parados; 🔨 en obra, ⌛ en espera).
- Banco `pruebas/plaza/` (una plaza de mentira con los datos de juego del motor, con y sin cargo).

## [0.83.0] — 2026-11-02 · Rechazos de la plaza flotando arriba al centro · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Los rechazos de la gestión de la plaza** (construir, mejorar, la cola, recetas, renombrar, mudarse, pedir ascenso y la ficha de un edificio) ya no se escriben al pie del panel, donde se perdían: salen como el aviso flotante de los combates (`.aviso-global`), arriba al centro, con el borde de peligro. Desaparecen `#asent-lado-error` y `[data-ficha-error]`.

## [0.82.0] — 2026-11-02 · Velocidad de la columna a la vista, caravana de fundación en tarjetas y aviso de madera al fundar · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Velocidad de la columna en «Salir al mundo»** (y con un ejército en preparación): una línea encima de la tropa con la cifra en u/min, un icono de cuatro flechas y quién marca el paso. Se rehace al quitar o añadir escuadras, al cambiar de loadout y al elegir llevarse la Caravana de Fundación; de visita enseña la de tu columna con sus caravanas. **Rojo** por debajo de la infantería ligera, **blanco** igual, **azul** por encima. Sale de las mismas reglas que el motor (`velocidad_de_columna`): `TROPAS_RECLUTABLES.velocidad`, `CARAVANA_CATALOGO`, `ANIMAL_CATALOGO` y `MOVIMIENTO` de `GET /v1/datos`; la «ligera» es la velocidad más común del catálogo de tropas (hoy 30). Nuevo `ui/velocidadColumna.ts`; `velocidadDeColumna` (`mundo/tiempoDeMarcha.ts`) pasa a usarlo.
- **Barra de víveres**: al lado de «Marcha forzada», la velocidad de tu columna solo con el icono (1-2 flechas rojas, 3 blancas, 4 azules); la cifra y quién marca el paso van en el título. Con marcha forzada se enciende en azul.
- **Caravana de Fundación al convocar**: el radio pasa a dos tarjetas («Se queda aquí» con una puerta, «Llevárnosla» con una carreta y su carga en iconos), cada una con el paso al que marcharía el ejército.
- **Fundar asentamiento**: sin parcelas de bosque libres el aviso añade que sin madera no se pueden construir edificios nuevos.
- Banco `pruebas/velocidad/` (salida, ejército en preparación, barra de víveres y aviso de fundar, sin servidor) y prueba `pruebas/velocidadColumna.test.ts`.

## [0.81.0] — 2026-11-02 · Ríos con orilla, cielo en el mundo 3D y aviso a la altura de las misiones · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **El aviso que se va solo** sale centrado a la altura del rastreador de misiones, justo bajo la barra del jugador.
- **Ríos en el mundo 3D**: donde el suelo ya es agua (un lago, el mar) el río se acaba en la orilla, y su agua, del color del lago, se mete un poco en él para fundirse; un cauce que el generador deja a pocas u del agua se alarga hasta ella. Ya **no se pintan vados en medio de un lago** (ni pegados a su orilla). Cada río lleva una orilla de tierra mojada a cada lado que sigue al relieve y una corriente más clara en medio (`tramosEnTierra`, `alargarHastaElAgua` en `mundo3d/paisaje.ts`).
- **Cielo** en el mundo 3D (`mundo3d/cielo.ts`): una bóveda que va con la cámara, del horizonte claro al cénit azul, con el halo del sol donde está la luz de la escena y nubes altas que derivan despacio. La bruma lejana es del color del horizonte, así el suelo se funde con el cielo.

## [0.80.0] — 2026-11-02 · Niebla al elegir campamento, avisos arriba y cámara 3D suave · sin cambios de contrato (`VRhino/BronzeAge@168a3bea`)

- **Elegir campamento**: todo lo que queda fuera de la frontera (250 u) de algún campamento va bajo **niebla de guerra**, nubes oscuras que derivan despacio, en el mapa y en el minimapa; de lejos solo se ven los círculos de tierra de cada campamento. Los yacimientos y bandidos de fuera no se pintan, y fuera del mundo la niebla no se abre.
- **Los avisos que se van solos** (`.aviso-global`) salen centrados en la mitad de arriba de la pantalla, con una entrada corta, en vez de abajo a la derecha.
- **Mundo 3D, cámara**: sigue a la columna con un muelle amortiguado (y el cambio de zoom y lo que se levanta sobre las laderas, también suaves); un salto de más de 60 u se corta. La proyección del instante se rehace en cada fotograma mientras algo marcha (antes, cada 33 ms), para que la columna avance sin tirones.
- **Mundo 3D, lo nunca visto**: deja ver el mapa a media luz (alfa 206, entre el recordado, 158, y el opaco), con su bosque; los nombres de los yacimientos siguen solo en lo explorado. El 2D no cambia.

## [0.79.0] — 2026-11-01 · Recompensas de misión flexibles · sync con `VRhino/BronzeAge@168a3bea`

- **Contrato regenerado** (`RecompensaMision`; `Mision.participacion` y `recompensas`; `DefinicionMisionRecurrente.recompensas`; fuera `Mision.recompensa` y `DefinicionMisionRecurrente.oro`). Hace falta **partida nueva** (cambia la huella de las reglas).
- **La recompensa de cada misión** es la fija de su tipo (plaza → participación, Facción → XP de Facción) y la lista libre (recurso, oro, XP y tropa), con su icono, en la ventana de Misiones, en las listas de la plaza y la Facción, en el botón Reclamar y en el tablón (tarjetas y elección de la semana). La fija va destacada; cada premio dice en su `title` adónde va al reclamar (almacén personal, de la plaza o de la capital; la tropa nace en el campamento donde resides y completa tu escuadra, lo que sobra se pierde; la participación de una grupal se reparte entre los que aportaron) (`ui/recompensasMision.ts`).
- El aviso de **misión reclamada** dice todo lo que se dio: participación, XP, oro, recursos y soldados.
- Mensaje para el rechazo nuevo `mision.sin_capital`, y los de `almacen_personal.lleno`, `mision.almacen_lleno` y `heroe.sin_residencia` explican que reclamar es todo o nada.
- Banco nuevo `pruebas/misiones/`.

## [0.78.0] — 2026-11-01 · Elegir campamento con el mapa · sync con `VRhino/BronzeAge@b57d4b27`, sin cambios en el contrato

- **Pantalla nueva para elegir dónde nace el héroe** (`ui/eleccionCampamento.ts`), como la de elegir punto de partida de un juego de estrategia: el mapa del mundo con cada campamento como un estandarte de color; al elegir uno, la cámara vuela hasta él, marca su zona cercana (150 u) y su frontera (250 u), pinta su suelo de cerca y deja en penumbra lo de fuera. Se arrastra y se acerca con la rueda; un minimapa con todos los estandartes lleva a cualquiera. Lista y mapa van a la par (clic en la tarjeta o en el estandarte, flechas en la lista).
- **Nombre por región:** cada campamento se llama como la región del generador donde cae (con el rumbo si dos comparten región), sin tocar el motor. Es aproximado cerca de las lindes: el artefacto no trae la semilla que las mueve.
- **Ficha de cada campamento:** su edificio militar (derivado como el motor, `edificiosMilitares[huella mod 3]`) con las tropas que recluta desde el primer día y las que se abrirán con la tecnología; la gente que reside y que nació allí; y lo que hay alrededor, leído del artefacto: mezcla de terreno, fertilidad y bosque del foco, yacimientos (cerca y en la frontera, con el más cercano), río, costa o lago, bandidos y el campamento vecino.
- **«Recomendado», «Elegir por mí» y comparar:** una nota del cliente (poca gente, tierra fértil, yacimientos en el foco, pocos bandidos, agua cerca) marca el recomendado y sus razones; «Elegir por mí» sortea entre los tres mejores; marcando «Comparar» en dos tarjetas se ven lado a lado, con lo mejor de cada fila en verde.
- `MapaGenerado` trae ahora los campamentos y los bandidos iniciales del artefacto; `obtenerMapa` sirve sin `mapaId` (antes de tener héroe).
- Banco nuevo `pruebas/eleccion/` (con el artefacto que sirve `/__banco/mundo`) y pruebas de la lectura (`pruebas/eleccionCampamento.test.ts`).

## [0.77.0] — 2026-11-01 · Mercenarios por contrato · sync con `VRhino/BronzeAge@7aa44b90`

- **Contrato regenerado** (contrato 0.5.0): `Faccion.contratos`, `MiembroFaccion.marca`, `Heroe.contrato`, `ficha_mercenario` y `contratado`, `CampamentoMercenarios.tablon` y las órdenes 171-179.
- **Tablón del campamento** (subpestaña «Mercenarios»): cada ofrecido en una tarjeta con su insignia de rango, el renombre hacia el rango siguiente, sus medallas (con la cuenta y el umbral siguiente), su historial y su tropa propia. El plazo se elige pulsando su precio (1, 3, 7 días o permanente), en rojo si no llega el oro del carro; el trabajo, con su icono. Solo se ofrecen los objetivos que tus cargos alcanzan, ordenados por cercanía y con la distancia, y la tarjeta dice con qué puesto firmarás. «Contratar» se apaga con el motivo (sin Facción, herido, sin cargo que firme, falta oro). Se ordena por renombre o por precio.
- **Facción › Mercenarios**: arriba, los contratos acabados por valorar (👍/👎, mientras dura el plazo) y el recuento (a sueldo, temporales, permanentes, sin orden). Una barra de órdenes como la de un RTS: se marcan hasta 16 y solo se encienden las órdenes que admiten todos los marcados y que tus cargos pueden dar; «Guardar» de un defensor o un escolta se limita al objetivo de su contrato, e «Ir a» deja elegir un lugar tuyo o escribir el punto. Cada contrato en una tarjeta: dónde anda (📍 lo centra en el mapa), el trabajo y su objetivo, la barra del plazo (en rojo cuando queda menos de una quinta parte), la orden vigente con quién la dio y cuándo caduca, y Prorrogar, Mudar (permanente, Rey o Embajador) y Despedir, apagados para quien no podría firmarlo. La pestaña lleva una cifra con lo que pide atención.
- **Marca:** chapa ⚔ temporal / 🏛 permanente en Miembros; un marcado no sale para el trono, la embajada ni los cargos locales. La convocatoria de un mercenario dice «Solo mercenarios». El héroe a la vista enseña su marca, rango, renombre y medallas.
- **Héroe mercenario:** en su ficha, su contrato, su orden, su ficha entera y «Reclamar» el premio de rango.
- Mensajes para los rechazos `mercenario.*`, `mercenarios.sin_oro` y `faccion.mercenario_ofrecido`, y avisos para los hechos `mercenarios.*` (urgentes: fin de contrato, orden caducada, rango).
- Banco nuevo `pruebas/mercenarios/` para mirar la interfaz sin partida.

## [0.76.0] — 2026-11-01 · Cantera solo por pueblo, aldeas por anillos, Facciones de bots · sync con `VRhino/BronzeAge@abdebf43`

- **Contrato regenerado** (`es_bot` en `Faccion` y `FaccionDelDirectorio`).
- **Cantera fuera de la plaza** (motor 5907aa6): ya no sale entre los edificios que se pueden construir (como las minas y el Corral); la piedra solo llega de un pueblo de cantera. Rechazo `obra.solo_por_pueblo` con su mensaje. La ayuda del extractor lo explica, y que en el nivel 1 caben dos pueblos (cupo 2/3/4/5/6, leído de los datos). Los requisitos del nivel 2 (200 pesants, Leñera, Granja a nivel 2 y un pueblo activo) salen de `NIVEL_ASENTAMIENTO` como antes.
- **Aldeas por anillos:** Territorio dice en qué anillo va la siguiente aldea (las dos primeras hasta 10 u, la tercera de 10 a 15 u…, con los techos de `reglas.territorio.techos` y el cupo de los datos) y los sitios verdes del mapa solo salen dentro de él. Rechazo `pueblo.fuera_de_su_anillo` con su mensaje.
- **Facciones de bots:** la ficha de Diplomacia dice si la Facción es de bots (su Rey es un bot) y la lista lo marca con 🤖; «Pedir ingreso» no se ofrece en una de bots. Rechazos `faccion.de_bots` y `faccion.no_es_de_bots`.
- `ascenso.falta_aldea` dice ahora «un pueblo activo: una aldea agrícola o un extractor».
- La Leñera a 8 de madera, las costas, el bosque y los metales nuevos del generador no piden cambios: salen de los datos y del mundo.

## [0.75.0] — 2026-11-01 · zonas de una misma Facción fusionadas · sync con `VRhino/BronzeAge@2c4bca63`, sin cambios en el contrato

- Las zonas de influencia de una misma Facción que chocan o se solapan se pintan como una sola: la frontera segmentada solo por fuera y, donde se tocan dos plazas suyas, una línea fina y tenue que separa las provincias del mismo reino. Vale para todas las Facciones (también las recordadas) y para la tuya, cuya frontera exterior sigue siendo la de la zona fusionada. En el mundo 3D y en el modo mapa (`mundo/fronteras.ts`, `partirFronteras`).

## [0.74.0] — 2026-11-01 · fronteras segmentadas, barra del mundo con iconos, maquetas por nivel · sync con `VRhino/BronzeAge@2c4bca63`, sin cambios en el contrato

- **Fronteras** (mundo 3D y modo mapa): raya segmentada y el doble de gruesa, corrida hacia dentro de su zona, de modo que donde chocan dos zonas se ven las dos rayas, cada una de su lado. La zona propia fusionada, igual; la frontera de cada plaza tuya ya no se pinta debajo de ella. La de una plaza que solo se recuerda, en trazos cortos.
- **Barra superior en el mundo:** transparente sobre el terreno; los botones son solo iconos (yelmo, lanzas, rueda, estandarte, tablilla, diana, campana, mapa) en oro sobre un fondo oscuro casi opaco, con el nombre en el `title`. En las demás pantallas, icono y nombre.
- **Maquetas de plaza por nivel:** 1, caserío (casa del jefe, chozas y corral); 2, poblado (casa grande con patio, granero), ambos sin muralla; 3, muralla de piedra con puerta, palacio y templo; 4, muralla con torres, palacio de dos plantas y templo con columnas; 5, doble muralla con torres, ciudadela interior y zigurat.
- **Maquetas de avanzada por etapa:** atalaya (torre de vigía de madera con plataforma y cerca), fuerte (recinto cuadrado de piedra con torres en las esquinas y torre del homenaje) y ciudadela (recinto redondo alto con torres, torre mayor, cuartel y almacén).

## [0.73.0] — 2026-11-01 · encargos de caravana (rutas y envíos automáticos) · sync con `VRhino/BronzeAge@2c4bca63`

- **Contrato regenerado** (órdenes `encargarCaravana`, `cambiarEncargo`, `cancelarEncargo`; `Caravana.encargo`; estado `esperando`; cargo `maestroCaravanas`).
- **Mercado › Caravanas:** cada caravana de la flota tiene su sección «Encargo». Parada en su origen y con algún carro con animal, «Dar encargo» abre el formulario: ruta permanente (solo a plazas tuyas) o envío (también a una plaza ajena, ya o dentro de N minutos), y por parada qué deja (con tope) y qué recoge, con «esperar a que haya todo» y «tirar lo que no quepa». Hacia una plaza ajena cada línea lleva su precio (mínimo al vender, máximo al comprar). Con encargo se ve el modo, el destino, las vueltas, dónde está y qué hace (espera, descarga o carga, con lo que falta), y los botones «Cambiar» y «Cancelar encargo». Solo los usan el Gobernador, el Tesorero o el Maestro de Caravanas de la plaza, residentes y dentro; el resto lo ve con el motivo.
- La escolta se puede ceder o retirar también con la caravana esperando en su origen.
- **Cargo nuevo** «Maestro de Caravanas» en Cargos, la Residencia, el tablón y las misiones.
- **Avisos** (Economía) de los hechos `comercio.encargo_dado`, `caravana_espera`, `caravana_carga`, `caravana_descarga` y `encargo_terminado` (con su motivo, lo volcado y lo perdido).
- **Rechazos** `encargo.*` y `caravana.salida_invalida`, `no_es_comercial`, `no_disponible`, `sin_capacidad` y `sin_ruta` con su mensaje.
- Las órdenes mandan los instantes `sint64` acabados en `Ms` (`salirEnMs`) como instante del contrato, no en milésimas.

## [0.72.0] — 2026-10-31 · tiempo hasta allí en las fichas del mapa · sync con `VRhino/BronzeAge@26a49c8`, sin cambios en el contrato

- **Tiempo hasta allí.** Junto a la distancia, las fichas de plaza, campamento de bandidos, campamento de mercenarios y columna o caravana ajena dicen cuánto tardaría tu columna en llegar, en tiempo de jugador (`mundo/tiempoDeMarcha.ts`). Lo estima el cliente como el motor: el camino más barato por el grafo de navegación del artefacto, con el coste de cada arista, a la velocidad de la columna (el mínimo de su tropa y sus caravanas, el héroe solo a `MOVIMIENTO.velocidadJugador`, ×1,5 con marcha forzada). No cuenta los caminos construidos, que aceleran, así que el motor llega antes o igual. Sin camino por tierra lo dice.

## [0.71.1] — 2026-10-31 · cartel de plaza con el escudo por fuera · sync con `VRhino/BronzeAge@26a49c8`, sin cambios en el contrato

- El escudo de la Facción en el cartel de plaza es más grande que el cartel (40 px de ancho), sobresale por arriba y por abajo y va montado sobre su borde izquierdo, como si el cartel saliera de él.

## [0.71.0] — 2026-10-31 · Diplomacia con las Facciones, Edificios en uno, extractores desde nivel 1, carteles de plaza · sync con `VRhino/BronzeAge@26a49c8`, sin cambios en el contrato

- **Diplomacia y Facciones, en una pestaña.** La lista de Facciones va a la derecha: la tuya, las conocidas y las demás. Al pulsar una, el centro enseña lo que se sabe de ella (escudo, nivel, miembros, plazas conocidas, reputación, Rey, Embajador, capital, Liga, relación con la tuya) y lo que tu Facción puede hacer con ella: proponer alianza, vasallaje o guerra, contestar o retirar sus propuestas, romper, ofrecer la paz o rebelarse. Con la tuya elegida salen todas tus relaciones, la anexión, la fusión y la Liga. Si es de bots no se puede decir: el motor no lo publica.
- **Centro urbano › Edificios** junta Edificios, Producción y Cola, cada una plegable. La **Residencia** (dejar tu casa y designar la capital) pasa al pie de Resumen.
- **Pueblos extractores desde el nivel 1** (motor 057eb7b): el valor por defecto de `nivelMadreMinimo.extractor` es 1, y los requisitos del nivel 2 entienden `pueblosActivos` (un pueblo activo, aldea o extractor). La **Cantera** ya no sale entre los edificios de la plaza.
- **Carteles de plaza en el mundo 3D:** texto en blanco, el escudo completo de la Facción dueña a la izquierda y, bajo el nombre, «Nivel n». Todas las etiquetas van en blanco; el color de la Facción o del campamento queda en el filete de la izquierda.
- **Fundar según la pendiente** (motor 26a49c8): sale el rechazo `fundacion.sobre_cima` y entra `fundacion.pendiente`. La vista previa de fundación avisa cuando la pendiente pasa de `FUNDACION.pendienteMaximaParaFundar` (0,3).

## [0.70.0] — 2026-10-31 · mundo 3D: alijos, ruta punteada, copas y formación del ejército · sync con `VRhino/BronzeAge@ebadcafe`, sin cambios en el contrato

- **Alijos al doble** (`MUNDO3D.alijo = 2`), con su aro de selección y su zona de clic.
- **La ruta de tu columna, punteada**, más marcada que el rastro de las demás; el aro del destino sigue entero.
- **Copas de los árboles de 0,5 u** (antes 0,3). La densidad del bosque va por la copa, así que hay menos árboles para tapar lo mismo.
- **Formación del ejército.** Una columna personal sigue igual: dos filas de tres por escuadra, con un hueco entre escuadras. Un ejército pone una fila de cuatro por escuadra y agrupa por héroe: cada héroe es un bloque con sus filas y el hueco va entre héroes (2 héroes con 3 tropas = 3 filas de 4, hueco, 3 filas de 4). La tropa de cada héroe sale de sus escuadrones (los tuyos) o de `escuadrasQueLleva` (los demás); lo que no se sabe de quién es va con el último. Como mucho 12 escuadras en un ejército y 6 en una columna personal.

## [0.69.0] — 2026-10-31 · columnas ajenas con su tropa y sus caravanas · sync con `VRhino/BronzeAge@ebadcafe`

- **Columnas ajenas con tropa.** En el mundo 3D, una columna ajena que se ve lleva detrás las figuras de las escuadras de sus héroes públicos (`heroesVisibles[].escuadrasQueLleva`), en filas de tres como las propias. Sirve igual para una columna personal que para un ejército de varios héroes.
- **Caravanas enganchadas.** `EjercitoAvistado.caravanasAdjuntasIds` (campo 15 de `Ejercito`, que el motor manda ahora también en lo ajeno). Se pintan como carros detrás de la columna, en el 3D y en el mapa 2D, y ya no salen además como caravanas sueltas. La ficha de la columna ajena dice cuántas lleva y qué recursos (sin cantidades), y una caravana enganchada se reconoce como adjunta por su id y no solo por la posición.
- **Radio de encuentro.** El motor lo baja a 1 u para todo. El cliente ya lo leía de `/v1/datos` (`LOGISTICA.radioEncuentro`); ahora también el valor por defecto mientras no llega es 1 (antes 15), y el aviso de perseguir ya no dice «a 15».
- Contrato regenerado desde `ebadcafe` (solo cambia un comentario).

## [0.68.1] — 2026-10-31 · tarifas de la taberna · sync con `VRhino/BronzeAge@fb64d5b7`, sin cambios en el contrato

- **Intel de la taberna.** Las tarifas iban fijas a cero, así que en la taberna de un campamento salía «Taberna al límite de Miradas» (0 / 0) y los precios y enfriamientos eran falsos. Ahora salen de `/v1/datos`: el bloque `INTEL` (Mirada, Informe y `campamento.cupoMiradas`) y el `cupoMiradas` de cada nivel de la Taberna (`apiCliente.tarifasDeIntel`).

## [0.68.0] — 2026-10-31 · mundo 3D: rejilla, formación, etiquetas y clic · sync con `VRhino/BronzeAge@fb64d5b7`, sin cambios en el contrato

- **Rejilla de movimiento.** Nueva opción «Rejilla de movimiento» en el menú de la esquina (se recuerda en `localStorage`). Pinta sobre el relieve, alrededor del héroe (40 u), las aristas del grafo de navegación del artefacto del mundo: verde el llano, hacia rojo lo caro, azul los vados (`src/mundo3d/rejilla.ts`).
- **Formación de las columnas.** Cada tropa se ve como 2 filas de 3 soldados (6 figuras), con el mismo paso dentro de la tropa y un hueco algo mayor entre tropas. Los carros van detrás de la última fila.
- **Etiquetas flotantes** en un cuadro oscuro con el texto dentro. Las de plazas y campamentos se pueden pulsar: cuentan como clic sobre el elemento.
- **Zona de clic mayor.** Un clic cerca de una plaza, pueblo, avanzada, obra, campamento, alijo, batalla, columna ajena o caravana se lleva a ese elemento (al menos 26 px de pantalla alrededor).

## [0.67.0] — 2026-10-31 · mejoras anotadas por Víctor · sync con `VRhino/BronzeAge@fb64d5b7`

Sin cambios en el contrato.

### Cambiado
- **Subida de nivel de la plaza** (Centro urbano): mientras sube, una barra que se va llenando con lo que falta (`barraDeTiempo` en
  `ui/estadoCliente.ts`), en vez de la línea de texto.
- **Muralla**: cada recinto en obra o en mejora enseña la celda en curso como barra de tiempo y cuánto tarda el anillo entero y cuánto le
  queda (`MURALLA.minutosPorCelda` × `factorTiempoMuralla` de las políticas activas). Si la celda está parada por falta de material o por la
  reserva, lo dice.
- **3D**: los campamentos de mercenarios y de bandidos van al doble de tamaño (`MUNDO3D.campamento`) y llevan cartel flotante como las plazas
  («⛺ Mercenarios», «☠ Bandidos · nivel N»).

### Corregido
- **Títulos del servidor**: la Facción que tiene cada título salía con su id cuando no era una de las que llegan completas; ahora sale con su
  nombre y su escudo, tomados del directorio de Facciones.
- **Avisos de alianza**: decían «acepta el vasallaje» (y «te propone un vasallaje») también en una alianza. El tipo llega del motor como
  número en la propuesta y no viene al resolverla: se traduce, y si no viene se busca en la relación que nace o en la propuesta.
- **Rechazo de cambio de residencia**: «puede volver a hacerlo desde 582300140» pasa a «dentro de 3 h» (lo que falta, en tu tiempo).

## [0.66.0] — 2026-10-31 · el carro frente al almacén de la plaza · sync con `VRhino/BronzeAge@1dad4abf`

Contrato regenerado (`src/contrato/REVISION` = 1dad4abf; cambio aditivo, no hace falta mundo ni partida nueva).

### Añadido
- **Carro ↔ almacén de la plaza** (regla de Víctor), en el panel del carro con el héroe dentro de una plaza:
  - cada recurso del carro tiene «A la plaza» (`dejarEnPlaza`): la Facción dueña y sus aliadas o vasallas;
  - el almacén de la plaza, si es de tu Facción, tiene «Al carro» (`cargarDePlaza`), resida o no; el trigo no baja de la reserva;
  - el Gobernador de la plaza tiene la casilla «Cerrar el almacén a los ciudadanos» (`cerrarAlmacenACiudadanos`;
    `Asentamiento.almacenCerradoACiudadanos`). Cerrado, los demás no sacan al carro, pero dejar sigue abierto.
- **Del carro al almacén personal por recurso**: en tu residencia, cada recurso del carro tiene «Al almacén personal»
  (`guardarEnAlmacenPersonal`); «Todo al almacén personal» sigue vaciándolo entero.
- Textos de los rechazos nuevos: `almacen.solo_ciudadanos`, `almacen.cerrado`, `almacen.ni_faccion_ni_aliada` y `almacen.sin_sitio`.

### Corregido
- En el panel del carro, el mismo recurso en el carro y en el almacén personal compartía el campo de cantidad: cada montón tiene ya el suyo.

## [0.65.0] — 2026-10-31 · mundo 3D, fase 5: cierre · sync con `VRhino/BronzeAge@bfb9eb9`

Termina el paso del modo mundo a 3D (plan en [`docs/Mundo_3D.md`](docs/Mundo_3D.md)). El modo mapa y la plaza siguen en 2D.

### Quitado
- **El pintor 2D del modo mundo**:
  - `controlMapaActivo` y las llamadas a `dibujarPantallaSegunModo` desde la pantalla Mapa;
  - los zooms fijos y `seguir` de la cámara 2D (ahora solo la usa el modo mapa);
  - el parámetro `modoMundo` de `pintarTerreno`;
  - las baldosas del suelo de `pintarArtefacto.ts`.

  `render.ts` sigue para el modo mapa y `#/legacy`.

### Cambiado
- **Rendimiento**: la vista 3D ya no rehace la proyección en cada fotograma. Reutiliza el estado mientras no llega otra proyección o cambia
  la selección o la vista previa de fundar. Mientras algo tuyo marcha, recalcula la proyección del instante como mucho cada 33 ms. En vacío,
  de 1,07 ms a 0,002 ms por fotograma.
- La densidad de píxeles del 3D llega como mucho a 1,5 (antes 2).

### Añadido
- `VistaMundo3D.rendimiento()`: lo que tarda cada parte del fotograma, para medir.

## [0.64.0] — 2026-10-31 · mundo 3D, fase 4: lo ajeno, los nombres y la selección · sync con `VRhino/BronzeAge@bfb9eb9`

El modo mundo en 3D ya pinta todo lo que pintaba el 2D (plan en [`docs/Mundo_3D.md`](docs/Mundo_3D.md)).

### Añadido
- **Columnas.** Las de tu Facción, con su rastro discontinuo, y las avistadas, que no traen ruta ni tropa: se ven sus héroes. Cada una va con
  su color, con un carro por caravana enganchada detrás de la tropa y el de fundación con lona, y un anillo discontinuo si está en formación.
- **Caravanas sueltas**, las tuyas con su ruta y también las avistadas (el 2D no las pintaba aunque se podían seleccionar).
- **Campamentos de bandidos** (más tiendas cuanto más nivel), **alijos** y **batallas** (espadas cruzadas, en verde la tuya), encima de la
  niebla (`src/mundo3d/maquetas.ts`).
- **Miradas**: su círculo, azul abierta y gris discontinuo caducada, con los minutos que quedan (`src/mundo3d/marcas.ts`).
- **Selección**: lo seleccionado lleva un aro que late, a su medida.
- **Vista previa de fundar** (panel ⚑): la zona con que nacería la plaza, los sitios de aldea, las parcelas de bosque y el nombre de cada
  nodo de dentro.
- **Nombres** sobre el mundo (`src/mundo3d/etiquetas.ts`): plazas (tenue la recordada), nodos cercanos ya explorados, minutos de las Miradas
  y «⚑ Facción» bajo tu columna en tierra ajena.
- El banco de pruebas trae lo ajeno de mentira, selecciona con un clic y tiene «Fundar aquí».

## [0.63.0] — 2026-10-31 · mundo 3D, fase 3: el mundo · sync con `VRhino/BronzeAge@bfb9eb9`

El modo mundo en 3D ya pinta lo que hay en el mundo (plan en [`docs/Mundo_3D.md`](docs/Mundo_3D.md)). Cada capa conserva su lado de la
niebla, como en el 2D.

### Añadido
- **Árboles** uno a uno donde el artefacto tiene bosque, con copas de 0,3 u (`src/mundo3d/arboles.ts`). Lejos van menos y más grandes, y solo
  hay donde ya exploraste. Quedan fuera del agua, de los cauces, de los caminos, de las laderas muy empinadas y de los claros de las plazas.
- **Ríos** con su anchura (1,5 u, 3 los navegables), **vados** de orilla a orilla y los **nodos** de piedra y metal como rocas
  (`src/mundo3d/paisaje.ts`).
- **Maquetas** a la escala del juego (`src/mundo3d/maquetas.ts`), con una bandera del color de su Facción:
  - plazas: la ciudad al 10 % del radio de su zona, con su muralla y sus casas;
  - pueblos: la aldea con sus campos, el extractor con su bocamina;
  - avanzadas por etapa y en ruinas;
  - obras, y campamentos de mercenarios.

  Las plazas que solo recuerdas van oscurecidas bajo la niebla.
- **Caminos** (sendero, camino, calzada) y **fronteras** bajo la niebla. Encima van la **zona propia** y el **anillo de protección** de los
  campamentos de mercenarios (`src/mundo3d/trazos.ts`).
- **La mira de tu columna**: un aro en el suelo bajo ella, para no perderla entre los árboles.
- El banco de pruebas (`npm run mundo3d`) trae los campamentos del artefacto y maquetas de mentira junto al héroe (`?sinMaquetas` las quita).

### Cambiado
- La vista 3D construye lo que falta alrededor del héroe con un presupuesto de 8 ms por fotograma: primero el suelo, luego el paisaje y los
  árboles.

### Pendiente (fase 4)
- Columnas ajenas, caravanas, bandidos, alijos, batallas y formaciones; los nombres sobre las maquetas; la vista previa de fundación.

## [0.62.0] — 2026-10-30 · mundo 3D, fase 2: se juega en 3D · sync con `VRhino/BronzeAge@bfb9eb9`

El modo mundo pasa a 3D con three.js (plan en [`docs/Mundo_3D.md`](docs/Mundo_3D.md)). El modo mapa y la plaza siguen en 2D.

### Añadido
- **El modo mundo en 3D** (`src/mundo3d/`): el suelo por teselas de 64 u alrededor del héroe con el relieve fino (0,5 u cerca, 1 y 2 u más
  lejos), color por clase de terreno, roca en las laderas, sotobosque y agua; la niebla de guerra en el sombreado con sus tres estados (la
  rejilla de `proyeccion.exploracion`); tu columna (jinetes al frente y la tropa detrás, a ×2) con su ruta pegada al suelo y el aro del destino.
- **Cámara de juego**: sigue al héroe con 35° de apertura; en pantalla cabe lo que dice la visión de la columna (`VISION` del servidor): 15 u
  (alejada 22) el héroe solo y 30 u (alejada 45) con soldados, con cualquier inclinación. Arrastrar gira e inclina (de 10° a 90°), la rueda y
  los botones ＋/－ cambian entre normal y alejada, y las flechas o WASD giran e inclinan.
- **Clic en 3D**: un rayo toca el relieve y el punto del mapa sigue el camino de siempre (`objetoBajoElClic` y `marcharA`); el radio de agarre
  se ajusta a los píxeles por unidad de la cámara.
- **Banco de pruebas** `npm run mundo3d` (`pruebas/mundo3d/`): la vista con el artefacto y el relieve que haya generado el motor en el
  checkout hermano (o `MOTOR`), sin servidor ni cuenta; una columna que va adonde haces clic y una niebla de mentira.
- Sin paquete de relieve (un servidor viejo) se pinta con el raster de 4 u del artefacto; sin WebGL lo dice en el lienzo.

### Cambiado
- **Cuánto cabe en pantalla sigue a la visión de la columna**, no a la del héroe solo: con soldados se ve el doble.
- Dependencia nueva: `three` 0.170.0.

### Pendiente (fases 3 y 4)
- Aún no se pintan en 3D árboles, ríos, plazas, pueblos, avanzadas, campamentos, caminos, fronteras ni lo ajeno (columnas avistadas,
  caravanas, bandidos…); se ven en el modo mapa. La vista previa de fundación en el modo mundo vuelve en la fase 4.

## [0.61.0] — 2026-10-30 · mundo 3D, fase 1: el relieve fino · sync con `VRhino/BronzeAge@bfb9eb9`

Empieza el paso del modo mundo a 3D (plan y decisiones en [`docs/Mundo_3D.md`](docs/Mundo_3D.md)). Esta fase solo trae los datos: no
cambia nada de lo que se ve.

### Añadido
- **Relieve fino del mundo** (`src/mundo/relieve.ts`, contrato 06 §8): el paquete con la altura cada 0,5 u, el que dibujará el 3D. Se baja
  una vez por mundo por la ruta que anuncia la `Bienvenida` (`InfoMundo.url_relieve`), se comprueba que es el anunciado
  (`hash_relieve`) y se guarda en IndexedDB. Se abre por teselas de 64 u, solo las que se piden: `alturaEn` y `aguaEn` en cualquier punto.
  `obtenerRelieve()` lo da a quien lo pida (aún nadie: lo usará la fase 2).

### Cambiado
- **Contrato** regenerado desde `VRhino/BronzeAge@bfb9eb9`: `InfoMundo.url_relieve` y `hash_relieve`, el mensaje `PaqueteRelieve` y la capa
  `coste` del artefacto.
- La caché del artefacto en IndexedDB pasa a `src/mundo/cacheDeUno.ts`, que comparte con el relieve; guarda lo mismo y en el mismo sitio.

## [0.60.0] — 2026-10-29 · Mercado › Caravanas: arreglos y nueva tarjeta · sync con `VRhino/BronzeAge@bcc90a01`

### Corregido
- **Comprar animal y mover carro** fallaban en cualquier carro que no fuera el primero: el índice del carro (`carroIndice`, `sint64`) se
  mandaba en milésimas (el segundo carro llegaba como 1000). Ahora va como entero, igual que lo lee el motor; `salirEn` va como instante.
- **Barra de Liderazgo de la escolta**: no se movía al ceder escuadras porque el motor no publica lo usado. Ahora suma el coste (por
  escalón) de tus escuadras cedidas; si van escuadras de otros residentes, se dice cuántas (su coste solo lo conoce el servidor).

### Cambiado
- **Tarjeta de caravana compacta**: cabecera con estado y «Reservada» (con aviso de que sin reservar puede salir sola en el reparto),
  cifras en una fila (capacidad, velocidad, preparación, carros con animal), carros en filas cortas con su animal o «Comprar» en línea y
  «Mover…» en un desplegable, «＋ Básico / ＋ Reforzado» con su coste junto al título (el reforzado dice si falta la Carpintería).
- **Viaje**: destino junto al título y la carga en rejilla de dos columnas con una barra de carga contra la capacidad, que no deja lanzar
  si te pasas. El botón dice cuánto tarda en prepararse.
- **Crear caravana** dice cuánto falta para poder crear otra (`CARAVANA_COOLDOWN`) o por qué no se puede.

## [0.59.0] — 2026-10-29 · colocar avanzadas desde el mapa · sync con `VRhino/BronzeAge@bcc90a01`

### Añadido
- **Colocar avanzada** (Víctor: desde el mapa, con la columna): en «Lo que llevas», el Gobernador o el Maestro de Obras de su plaza de
  residencia tiene «Colocar avanzada aquí» (`colocarAvanzada` con la posición de su columna). Si no se puede ahí, dice por qué: fuera de la
  zona, la plaza sin el nivel que pide la atalaya, el cupo lleno o no ser el Líder de la columna. El motor comprueba el resto (la ciudad y
  los otros elementos del mapa).
- **Territorio** enseña las avanzadas de la plaza (etapa, distancia, en ruinas, atacada) y sus obras, el cupo (`AVANZADAS.cupoPorNivelDeLaMadre`)
  y cómo se coloca una, con lo que pide la atalaya.

## [0.58.3] — 2026-10-29 · ids de nodo del motor · sync con `VRhino/BronzeAge@bcc90a01`

### Arreglado
- **Marcar un pueblo extractor** fallaba siempre con el nodo (`piedra-727`): el cliente mandaba el id del artefacto del mundo y el motor
  espera el suyo, `nodo-N` (N = posición del nodo entre los de piedra, ganado y minerales del artefacto). Ahora los nodos del mapa llevan el
  id del motor, así que también cuadra qué nodos están ocupados por un pueblo, una obra o un edificio.

## [0.58.2] — 2026-10-29 · trazado y órdenes de la plaza ajena · sync con `VRhino/BronzeAge@bcc90a01`

### Cambiado
- **De visita dentro de una plaza de otra Facción** el motor (bcc90a0) manda en VISTA su trazado y sus órdenes de mercado abiertas. El
  trazado ya se pintaba desde esa ficha; las órdenes se leían solo de FACCION y ahora se leen de cualquier ámbito, así que la pestaña
  Mercado las enseña y se pueden tomar.

## [0.58.1] — 2026-10-29 · Mercado de una plaza ajena · sync con `VRhino/BronzeAge@3cfd61e5`

### Cambiado
- **De visita en una plaza de otra Facción** vuelve la pestaña Mercado (con su candado si la plaza no tiene Mercado): las órdenes abiertas
  de compra y venta de la plaza, que se toman con el carro de tu columna como desde su ficha en el mapa. Hoy el motor aún no manda las
  órdenes de una plaza ajena, así que sale vacía hasta que lo haga.

## [0.58.0] — 2026-10-29 · plaza de otra Facción, de visita · sync con `VRhino/BronzeAge@3cfd61e5`

### Cambiado
- **De visita en una plaza de otra Facción** solo queda lo que se ve o se usa desde fuera (Víctor): Centro urbano con Resumen (nombre de
  la plaza, su Rey y la Facción dueña con su escudo completo) y Territorio. Fuera la subida de nivel y sus requisitos, la auto-construcción,
  Edificios, Producción, Cola, Cargos, Puerta (su estado no llega a quien no es de la Facción), Residencia, Tesorería, Fundación,
  Misiones, Reclutamiento y Taberna (el motor solo deja reclutar y comprar intel en las plazas de tu Facción). El Mercado tampoco, por
  ahora: el motor no manda las órdenes de una plaza ajena.

## [0.57.2] — 2026-10-29 · de visita en una plaza aliada · sync con `VRhino/BronzeAge@3cfd61e5`

### Arreglado
- **Entrar en una plaza de otra Facción** (aliada): el héroe desaparecía del mapa pero no salía la pantalla de la plaza, así que no había
  cómo salir. El motor solo da el interior de una plaza (ámbito ASENTAMIENTO) a los de su Facción; ahora, si estás dentro de una ajena, el
  cliente monta la pantalla de visitante con su ficha del mapa (VISTA o FACCION) y se sale por la ventana «Salir al mundo» como siempre.

## [0.57.1] — 2026-10-29 · Liderazgo de las escuadras por escalón · sync con `VRhino/BronzeAge@3cfd61e5`

### Arreglado
- **Liderazgo de una escuadra**: el cliente ponía como coste sus hombres (30 lanceros = 30) y sumaba de más (115 / 100 con cuatro escuadras
  que cuestan 35). Ahora va por el escalón de su tropa (`LIDERAZGO.costePorEscalon` y `TROPAS_RECLUTABLES` de `/v1/datos`), como el motor:
  la corona de cada escuadra, el total y el tope ya cuadran.
- **Pasarse del tope**: en la ventana «Salir al mundo» no se sale, ni se convoca, ni se une a un ejército, ni se guarda el loadout si la
  tropa elegida pasa del Liderazgo del héroe; avisa en rojo. En el ejército en preparación no se guardan cambios que se pasen y el Líder no
  parte si su tropa guardada se pasa.

## [0.57.0] — 2026-10-29 · tropa de los demás en el ejército en preparación y almacén del pueblo al día · sync con `VRhino/BronzeAge@3cfd61e5`

### Cambiado
- **Contrato regenerado** contra el motor 3cfd61e5: `SeleccionDeSalida.tropa_ids` (la tropa de cada escuadra elegida, en el orden de
  `escuadron_ids`).
- **Integrantes del ejército en preparación**: las escuadras de los otros héroes se ven con el icono de su tropa (el nombre sale del catálogo
  de `/v1/datos`), en vez de huecos vacíos.
- **Almacén del pueblo por dentro**: el motor ya lo refresca cada minuto a quien está dentro y es de la Facción de la plaza madre; el cliente
  lo pinta sin cambios.

## [0.56.1] — 2026-10-29 · escuadras ajenas del ejército en preparación · sync con `VRhino/BronzeAge@db80cb87`

### Cambiado
- **Integrantes del ejército en preparación**: de las escuadras de otro héroe el motor solo manda el id, no la tropa. En vez de «Sin tropa»
  sale un hueco sin icono por cada escuadra suya, hasta que el motor mande de qué tropa es.

## [0.56.0] — 2026-10-29 · ejército en preparación con el reparto de la ventana de salida · sync con `VRhino/BronzeAge@db80cb87`

### Cambiado
- **Salir como ejército**: con un ejército en preparación, la ventana «Salir al mundo» se reparte como la normal. A la izquierda, donde va
  «Cómo sales», los integrantes con su nombre y debajo los iconos de la tropa que lleva cada uno (más las peticiones y la Caravana); a la
  derecha, la carga de tu carro; abajo, tu tropa en espacios con ✕, «+» y ‹ › para el orden de combate, «Guardar cambios» y los botones
  del Líder (Salir con el ejército, Cancelar) o de Separarme.

## [0.55.1] — 2026-10-29 · ficha del pueblo en el mapa sin almacén · sync con `VRhino/BronzeAge@db80cb87`

### Cambiado
- **Ficha del pueblo en el mapa**: ya no enseña el almacén ni el rebaño. Fuera del pueblo el motor no los refresca cada minuto y se veían
  congelados (Víctor: se quitan de la ventana de interacción). Siguen en la pantalla de dentro del pueblo y en la plaza madre.

## [0.55.0] — 2026-10-29 · tecnología conectada al motor · sync con `VRhino/BronzeAge@db80cb87`

### Arreglado
- **Tecnología**: el panel salía vacío porque el cliente no leía lo que manda el motor. Ahora mapea `EstadoTecnologia` (era y logros, ámbito
  HEROE), `TecnologiasFaccion` (aparecidas, adoptadas, reveladas con su descubridora y épicas posibles, ámbito FACCION), los Aedas residentes
  de tu Facción con su épica (FACCION) y los itinerantes a la vista (VISTA). El hito de cada revelada sale del catálogo y las plazas de tu
  Facción vistas en el mapa cuentan para elegir dónde.

## [0.54.0] — 2026-10-29 · iconos de tropa en todas las listas y escolta de la aldea · sync con `VRhino/BronzeAge@db80cb87`

### Cambiado
- **Icono de la tropa** en toda lista de escuadras: Héroe (escuadras y editor de loadout), columna, ejército en preparación y su lista de
  integrantes, unirse desde la plaza, campamento (toda tu tropa, reclutar y préstamo), escolta del Mercado, guarnición y escolta del pueblo,
  héroes ajenos y tropa inspeccionada, informe de combate y guarnición del informe de Intel (que ahora dice el nombre de la tropa, no su id).
- **Aldea → Acarreo y escolta**: se ve el cupo de escolta (usado / cupo, con su barra). Dentro del pueblo no se está en la madre, así que el
  Mercado se lee de su ficha; «Escoltar» se apaga si la escuadra no cabe.
- **Trazado de la aldea**: el carro de acarreo solo se dibuja cuando está parado en el pueblo.

## [0.53.0] — 2026-10-29 · todas las Facciones en la lista · sync con `VRhino/BronzeAge@db80cb87`

### Cambiado
- Contrato regenerado desde el motor db80cb87: llega en `VISTA` el **directorio ligero de Facciones** (`DirectorioFacciones`), con todas las
  del mundo, también para quien ya tiene Facción.
- **Facción → Facciones**: la parte «Sin contacto» sale ahora del directorio, con todas las Facciones (sin las derrotadas), su escudo, su nivel y
  sus miembros. Las conocidas siguen con su ficha completa; sus miembros salen del directorio si la ficha no los trae.

## [0.52.0] — 2026-10-29 · ventana «Salir al mundo» común y aldea por dentro · sync con `VRhino/BronzeAge@fd9cd58`

### Cambiado
- **Salir al mundo**: una sola ventana, centrada como el diario de misiones, para tu residencia, una plaza ajena, el campamento de mercenarios y
  un pueblo (`src/ui/ventanaSalida.ts`). A la izquierda cómo sales (columna personal o ejército, con las convocatorias abiertas), a la derecha
  la carga del carro y abajo la tropa: 5 espacios (más si el Liderazgo da para ello) con su icono, ✕ para quitar y un «+» que abre la lista de
  escuadras que caben. Sale cargado el loadout activo (todo, si no tiene escuadras); se puede elegir otro loadout y, con **Guardar loadout**,
  dejar en él el cambio. Sin guardar vale solo para esa salida. De visita (plaza ajena, pueblo, campamento donde no resides) los espacios
  enseñan la columna con la que entraste, sin cambios. Con un ejército en preparación, la ventana enseña ese panel. Desaparecen el panel
  «Salir» de la plaza, la pestaña «Salir» del campamento y el botón «Salir al mapa» del pueblo.
- **Dentro de una aldea o un pueblo**: la pantalla toma la forma de la de la plaza. Al centro su trazado, con los huecos de todas las granjas y
  corrales de la aldea (vacíos y con el nivel que los trae los que aún no tiene), el almacén y el carro de acarreo; en un extractor, su
  edificio. Debajo, el almacén como la tira de la plaza. A la derecha, pestañas: Resumen, Guarnición, Acarreo y escolta, y Carga.

## [0.51.1] — 2026-10-29 · Reclutamiento solo con lo desbloqueado · sync con `VRhino/BronzeAge@fd9cd58`

### Cambiado
- **Plaza → Reclutamiento**: vuelven a esconderse las tropas que la Facción aún no puede formar (tecnología, edificio o su nivel), en vez de
  salir apagadas. Los edificios sin ninguna tropa disponible no salen.

## [0.51.0] — 2026-10-29 · fichas de tropa en Reclutamiento · sync con `VRhino/BronzeAge@fd9cd58`

### Cambiado
- **Plaza → Reclutamiento**: la lista de filas pasa a una rejilla de botones por edificio militar, uno por tropa, con un icono dibujado para
  cada una de las 27 (provisional, `src/ui/iconosTropa.ts`). Encendidas las que la Facción puede formar ya; apagadas, con el motivo al pasar el
  ratón, las que piden tecnología, el edificio o más nivel (antes se escondían). Un número en la esquina dice cuántos hombres tienes ya de esa tropa.
- Al elegir una tropa se abre su **ficha** encima de la rejilla: icono grande, escalón, edificio y nivel que pide, hombres, poder, velocidad,
  coste de Liderazgo (bloque `LIDERAZGO.costePorEscalon`), de qué población salen y cuántos libres hay, el coste de lo que falta con lo que no
  alcanza en rojo, y un botón **Reclutar / Reponer** más pequeño que antes.

## [0.50.0] — 2026-10-29 · edificios con iconos y arreglos · sync con `VRhino/BronzeAge@fd9cd58`

### Cambiado
- **Plaza → Edificios**: el desplegable de «Añadir a la cola» pasa a una rejilla de botones, uno por edificio, con un icono dibujado para el
  cliente (provisional). Encendidos los que se pueden construir ahora; apagados, con el motivo al pasar el ratón (nivel de la plaza,
  tecnología, único, cantera ya hecha, Gran Fundición fuera de la capital o sin nivel de Facción). La lista sale del catálogo del motor, así que
  ya aparecen la **Cantera** (una por plaza), las Caballerizas y la Sala del Consejo. Los edificios construidos y la cola llevan también su icono.
- **Pedir ingreso** (sin Facción): todas las Facciones con su escudo, lo público, miembros y plazas.

### Arreglado
- Una columna que entró en una plaza, un campamento, un pueblo o una avanzada ya no se pinta en el mapa encima del lugar (`dentroDe`).
- **Inspeccionar** una plaza (o una columna o una caravana) enseña el informe en su ficha: el cliente no leía los informes del motor.

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
