# Mundo 3D

El modo mundo (la vista pegada al héroe) pasa de Canvas 2D a 3D con three.js. Es el prototipo del cliente final, que sigue siendo Unity. Las
escalas y la cámara se decidieron con la mesa de escalas 3D del motor (`Consideraciones/Escalas_Mundo_3D_Definicion.md` y su artefacto en
`Consideraciones/artefactos/mesa_escalas_3d/`); este documento dice cómo se lleva al cliente.

## Decisiones del autor (2026-10-30)

- **Cambio directo.** Sin interruptor 2D/3D: el 3D se hace en una rama y entra cuando pinta todo lo que pinta el 2D.
- **El modo mapa se queda en 2D**, como mapa estratégico (el mundo entero, zoom libre y arrastre). La vista de la plaza también pasó a 3D
  después (2026-11-02, `docs/Ciudad_3D.md`), con el 2D de minimapa.
- **Solo sobremesa** en el prototipo.
- **No cambian** el contrato, la proyección (`proyeccionAlInstante`), los paneles, ni el clic: lo que hay bajo él lo busca
  `objetosBajoElClic` en coordenadas del mundo y la orden sigue siendo `marcharA`. En 3D el clic toca el relieve con un rayo. Con dos o más
  cosas bajo el clic, primero se elige una en una lista (0.93.0, ver «Selección»).
- **La altura se dibuja tal cual**, la del paquete de relieve. La exageración vive en el generador; así las pendientes que se ven son las que
  usa el servidor para decidir por dónde se anda.
- **La niebla sigue siendo una regla.** Cada capa conserva su lado de la niebla, como en `render.ts`: lo que hoy va debajo (suelo, bosque,
  ríos, caminos, fronteras ajenas, plazas recordadas) se oscurece en el sombreado con los tres estados (sin ver, recordado, visible); lo
  propio y lo que se ve ahora va encima. La rejilla es la de `proyeccion.exploracion` (celdas de 5 u, 534 × 400).

## Valores

| | Valor |
|---|---|
| Copa de árbol | 0,3 u |
| Plazas (maquetas) | ×1: la ciudad es la del juego, al 10 % del radio de su zona; todo ×1,7 de alto (`altoPlaza`) |
| Pueblos, aldeas y avanzadas | ×1,6 (`pueblo`, `avanzada`) |
| Rocas de los nodos | ×0,5 (`nodo`) |
| Héroes y tropa | ×2 (soldado de 3,3 m de Unity, 1 u = 12 m) |
| Apertura de la cámara | 35° |
| Inclinación | libre, de 10° a 90°; arranca a 30° |
| En pantalla, héroe solo (visión 15 u) | de cerca 9 u, normal 15 u, alejada 22 u |
| En pantalla, con soldados (visión 30 u) | de cerca 18 u, normal 30 u, alejada 45 u |
| Zoom de cerca (`ACERCADO`) | 0,6 veces el normal |

La rueda y los botones + y − pasan de un zoom al siguiente, de uno en uno (un gesto del trackpad, que manda muchos eventos, es un solo paso).

«En pantalla» es el diámetro del círculo alrededor del héroe que cabe en la pantalla, con cualquier inclinación (desde arriba, el lado corto).
La visión es la del servidor (`VISION` de `Movimiento_Ejercitos`). **Cambio respecto al 2D:** el modo mundo de hoy fija el zoom con la visión
del héroe solo (`radioDeVision`); el 3D tiene que seguir a la de la columna. El encuadre de la caravana grande (visión 60 u) está abierto.

## Piezas

| Pieza | Módulo | Datos |
|---|---|---|
| Altura y agua | `src/mundo/relieve.ts` (hecho) | Paquete de relieve: `InfoMundo.url_relieve`, una vez por mundo |
| Escena, luz, bruma y bucle de fotogramas | `src/mundo3d/vista.ts` (hecho) | `estado()` en cada fotograma |
| Cámara de juego | `src/mundo3d/camara.ts` (hecho) | Visión de la columna y los valores de arriba |
| Valores | `src/mundo3d/config.ts` (hecho) | Los de la tabla de arriba y los umbrales del generador |
| De dónde sale la altura | `src/mundo3d/fuente.ts` (hecho) | El relieve o, sin él, el raster de 4 u del artefacto |
| Lo que pinta, sacado de la proyección | `src/mundo3d/estado.ts` (hecho) | `proyeccionAlInstante`; el banco le da uno de mentira |
| Terreno por teselas de 64 u alrededor del héroe | `src/mundo3d/terreno.ts` (hecho) | Relieve; color por clase, roca en laderas, sotobosque, fondo bajo el agua |
| Agua: lámina del mar y los lagos, sombreado de olas, espuma y reflejo, el de los ríos | `src/mundo3d/agua.ts` (hecho) | Relieve (bit de agua) |
| Niebla en el sombreado | `src/mundo3d/niebla.ts` (hecho) | `proyeccion.exploracion` |
| Árboles instanciados por trozos | `src/mundo3d/arboles.ts` (hecho) | Densidad de bosque del artefacto (4 u) |
| Especies de árbol: cuál crece dónde, geometrías y material | `src/mundo3d/especies.ts` (hecho) | Altura, agua cercana |
| Hierba, flores, matas, juncos y piedras cerca del héroe | `src/mundo3d/matas.ts` (hecho) | Fertilidad y bosque del artefacto, pendiente, agua |
| Ruido fijo (azar por punto y manchas suaves) | `src/mundo3d/ruido.ts` (hecho) | — |
| Humo de los asentamientos y bandadas de pájaros | `src/mundo3d/vida.ts` (hecho) | Plazas, pueblos, avanzadas y campamentos de la proyección |
| Ríos, vados y nodos de recursos | `src/mundo3d/paisaje.ts` (hecho) | Ríos y nodos del artefacto |
| Plazas, pueblos, avanzadas, obras, campamentos, bandidos, alijos, batallas | `src/mundo3d/maquetas.ts` (hecho) | Proyección |
| Caminos, fronteras, zona propia, anillo de los mercenarios | `src/mundo3d/trazos.ts` (hecho) | Proyección |
| Textura de los caminos (sendero, camino de tierra) | `src/mundo3d/caminos.ts` (hecho) | Escalón del camino |
| Relleno de las zonas de influencia sobre el suelo | `src/mundo3d/territorio.ts` (hecho) | Zonas de la proyección |
| Capa de fertilidad sobre el suelo (botón de capas) | `src/mundo3d/capaFertilidad.ts` (hecho) | Raster de fertilidad del artefacto |
| Columnas (de la Facción y avistadas), sus carros y las caravanas | `src/mundo3d/figuras.ts` (hecho) | Proyección: ruta y posición en el instante |
| Formaciones, Miradas, lo seleccionado, la vista previa de fundar | `src/mundo3d/marcas.ts` (hecho) | Proyección, `seleccionMapa` y el panel Fundar |
| Ruta, destino, mira del héroe; cintas pegadas al relieve | `src/mundo3d/lineas.ts` (hecho) | Proyección |
| Clic, arrastre, rueda y teclas | `src/mundo3d/entrada.ts` (hecho) | El clic acaba en `objetosBajoElClic` y `marcharA` |
| La lista de qué hay bajo el clic | `src/ui/eleccionClic.ts` (hecho) | Proyección |
| Nombres: plazas, nodos, Miradas, tierra ajena (los de los nodos se quitan con el botón de capas) | `src/mundo3d/etiquetas.ts` (hecho) | Proyección y artefacto |

## Fases

1. **Datos (hecho, 0.61.0).** Contrato regenerado con el relieve; descarga del paquete, caché en IndexedDB por su hash y teselas que se
   abren a demanda (`Relieve.alturaEn`, `aguaEn`). No cambia nada de lo que se ve.
2. **Se juega en 3D (hecho, 0.62.0):** escena, cámara, terreno, niebla, tu columna, clic para marchar, ruta y destino. El modo mundo de
   `main.ts` monta `VistaMundo3D` cuando están el mapa y el relieve; lo que aún no pinta el 3D se ve en el modo mapa.
3. **El mundo (hecho, 0.63.0):** árboles, ríos y vados, nodos, maquetas de plazas, pueblos, avanzadas, obras y campamentos; zonas,
   fronteras y caminos.
4. **Lo ajeno y lo que falta (hecho, 0.64.0):** columnas avistadas, caravanas, bandidos, alijos, batallas y formaciones; Miradas; nombres y
   selección; la vista previa de fundación. La elección del sitio de una aldea o de una avanzada sigue en el modo mapa, que es 2D.
5. **Cierre (hecho, 0.65.0):** se retira el pintor 2D del modo mundo (`render.ts` sigue para el modo mapa y `#/legacy`), una pasada de
   rendimiento y la documentación. La rama ya pinta todo lo que pintaba el 2D; su paso a `main` lo decide el autor.

## El paquete de relieve

`PaqueteRelieve` (contrato 06 §8 del motor): la altura cada 0,5 u de todo el mapa (5.335 × 4.001 muestras), con el mismo valor que el raster
`altura` del artefacto (65535 = 1.000 m), y un bit de agua por muestra. Va en 42 × 32 teselas de 64 u, cada una con 129 × 129 muestras que
comparten la última fila y columna con la vecina; cada altura es su diferencia (módulo 2^16) con la predicción izquierda + arriba − diagonal,
y la tesela va con zstd. La semilla 42 ocupa 8,6 MB.

- **Descarga:** `obtenerRelieve()` en `apiCliente.ts` lo pide una vez por mundo; `cargarRelieve` lo lee de IndexedDB
  (`bronzeage-relieve`) si está su hash y, si no, lo baja, comprueba que es el anunciado (sha256 de su serialización con `hash = ""`) y
  lo guarda. Sin `url_relieve` (un servidor sin el paquete) devuelve `null`.
- **Memoria:** el paquete se queda comprimido; `Relieve` abre cada tesela al pedirla y guarda abiertas las 96 últimas (unos 5 MB).
- **Pruebas:** `pruebas/relieve.test.ts` escribe un paquete pequeño según el contrato y comprueba el real del motor contra la ventana de la
  mesa, muestra a muestra; `pruebas/servidor.test.ts` lo baja de un servidor de verdad.

## Cómo se pinta (fase 2)

- **Escena.** Coordenadas: x = x del mapa, z = y del mapa, y = altura en unidades (metros / 12). Luz de cielo y sol con sombras alrededor del
  héroe. El fondo y la bruma lejana son del color de la niebla de guerra: lo que queda lejos se funde con ella.
- **Suelo.** Teselas de 64 u a menos de `min(carga, 7·d)` u del héroe (d, la distancia de la cámara; carga, la distancia de carga del jugador,
  320 u de serie: ver «Distancia de carga»); las más cercanas primero, dos por fotograma. Paso de 0,5 u a menos de 80 u, 1 u a menos de 160 y
  2 u más allá (con menos carga, en proporción); un faldón de 3 u en el borde tapa las grietas entre niveles. Color por la
  clase de terreno según la altura (los umbrales del generador: agua 375 m, costa 420, colina 545, montaña 600, cima 685), roca en las laderas
  y sotobosque donde el artefacto tiene bosque; verde de pasto donde el suelo es fértil y un grano fino en el sombreado (ver «Suelo, vegetación
  y especies de árbol»). Bajo el agua, el fondo: de arena junto a la orilla a oscuro donde cubre mucho; el agua es una
  lámina aparte (ver «El agua»).
- **Niebla.** La rejilla de `proyeccion.exploracion` es una textura (rojo: explorado; verde: se ve ahora) que el sombreado del suelo mezcla con
  el color de `NIEBLA` (`paletas.ts`) con sus tres alfas, igual que `render.ts`. La columna propia, la ruta y el destino van encima.
- **Cámara.** `distanciaDeEncuadre` busca la distancia a la que el círculo de «en pantalla» cabe entero en la pantalla con la inclinación de
  ahora; desde arriba es el lado corto, como en el 2D. La cámara no baja del suelo.
- **Clic.** Un rayo desde la cámara avanza hasta tocar el relieve. La vista da el centro de todo lo que tiene ese punto en su zona de clic (lo
  que ocupa su maqueta, y como poco 26 px de pantalla); `main.ts` busca qué hay en cada centro (`objetosBajoElClic`) y lo junta. Nada: se
  marcha allí; una cosa: se selecciona y se marcha hacia ella; dos o más: la lista para elegir.
- **Lo que ocupa cada maqueta y lo sólido** (`huellas.ts`, 0.175.0). De un solo sitio salen el aro de lo seleccionado (lo que ocupa la
  maqueta y 0,12 u), la zona de clic, el claro sin árboles y el colisionador. Plazas, pueblos, aldeas (su empalizada, sin los campos) y
  avanzadas son sólidas, solo en el cliente: una marcha a ellas o a un punto de dentro va a su borde por el lado de la columna
  (`destinoAlBorde`, en `marcharAObjetivo`), y lo que el servidor pone dentro (columnas, caravanas, Aedas) se pinta por el borde
  (`Colisionador`: sigue el lado por donde está, sin saltos, a no más de 4,5 veces lo que anda), con su ruta, su cartel, su aro y la
  cámara. El servidor sigue andando su línea; vista, puerta y encuentros son los de su sitio.

## Cómo se pinta (fase 3)

Todo lo que va sobre el suelo se construye alrededor del héroe, lo más cercano primero, con **8 ms por fotograma** para construir: primero el
suelo, luego el paisaje, los árboles y la vegetación baja. Lo que se aleja se suelta.

- **Árboles** (`arboles.ts`). Uno a uno donde el raster de densidad del artefacto (4 u, interpolado) pasa de 0,2: 0,55 / 0,3² árboles por u²
  con el bosque al máximo (la cifra de la mesa: las copas casi se tocan). Por trozos de 32 u hasta 200 u del héroe. Cada árbol es de una
  especie (ver «Suelo, vegetación y especies de árbol»): de cerca, una malla instanciada por especie y trozo, con lóbulos, tronco y sombra; de
  lejos, la silueta, con las copas redondas en una sola malla. Por bandas de distancia quedan todos (< 48 u), la mitad (< 80), la cuarta
  parte (< 128) y la octava; las copas crecen lo justo para tapar lo mismo y los que quedan son siempre los mismos, así al acercarse solo
  aparecen más. También crecen en lo que nunca se exploró, que la niebla deja ver a media luz (Víctor, 2026-11-02), pero no en el agua, los
  cauces o los caminos, ni en laderas de más de 1,1 m/m, ni en los claros de las maquetas. Un trozo se rehace solo si cambian su banda, los
  claros o los caminos.
- **Vegetación baja** (`matas.ts`). Hierba, flores, matas, juncos y piedras por trozos de 24 u hasta 48 u del héroe (ver «Suelo, vegetación
  y especies de árbol»).
- **Paisaje** (`paisaje.ts`). Por teselas de 64 u hasta 240 u. Los ríos, suavizados, son una cinta de agua de 1,5 u (3 si es navegable)
  plana a la altura del punto más bajo de su corte, con el agua de los ríos (ver «El agua») y 1,2 u de tierra mojada a cada lado que se
  desvanece hacia fuera. Los vados son un paso de grava de orilla a orilla. Los nodos son rocas: grises las de
  piedra y del color de su metal los afloramientos. Todo bajo la niebla.
- **Maquetas** (`maquetas.ts`). Las piezas de la mesa a ×1. La ciudad tiene muralla al 10 % del radio de su zona (el del contorno si se
  ve, el recordado si no) y casas dentro, compactas (0.175.0): solares justos, calles estrechas y casas que los llenan, de la plaza hacia
  fuera hasta lo que ocupa (el caserío, el 62 % del radio; el poblado, el 80 %; las amuralladas, hasta el pie de la muralla). En una plaza
  de más de 2 u de radio lo de dentro crece con ella. Todo sube ×1,7. El pueblo es una empalizada con casas: la aldea agrícola lleva sus campos y el
  extractor su bocamina. La avanzada es empalizada y torre, más alta en cada etapa, de piedra desde el fuerte, baja y gris en ruinas. La
  obra es un andamio con su montón de material, con muros a media altura cuando ya arrancó. El campamento de mercenarios son tiendas en corro.
  Cada una lleva una bandera del color de su Facción. Una malla instanciada por material. Las plazas recordadas van bajo la niebla; lo
  demás, encima.
- **Rayas** (`trazos.ts`). Cintas pegadas al relieve, recortadas a 240 u del héroe:
  - bajo la niebla: los caminos y las fronteras (0,12 u), con la silueta real de lo que se ve y un círculo discontinuo con el radio
    recordado de lo que no;
  - encima: la zona propia (0,18 u) y el anillo de protección de los campamentos de mercenarios (0,1 u).

  Son más anchas que en la realidad para que se lean desde la cámara. Desde 0.124.0 las zonas llevan además su relleno en el suelo
  (`territorio.ts`, ver «Territorio y caminos»).
- **Caminos** (0.93.0, `caminos.ts`). El servidor manda cada tramo nodo a nodo de su red (cada 4 u, en ocho direcciones): una escalera. Se
  pinta pasando por el punto medio de cada tramo (que sigue sobre la red), sin los vértices que no doblan (se apartan menos de 0,3 u) y con
  las curvas redondeadas (tres vueltas de Chaikin, sin cortar más de 1,5 u por esquina). Los extremos, donde se juntan los caminos, no se
  mueven, ni los vértices que caen en una plaza, un pueblo o un campamento (0.124.0): el camino que la cruza pasa por ella. Los árboles se
  apartan de ese mismo trazado. Cada escalón lleva su textura, pintada una vez píxel a píxel, con los bordes que se funden con el suelo:
  - sendero (cinta de 0,4 u): una huella de tierra pisada, más clara en medio, que serpentea y tiene los bordes deshilachados;
  - camino de tierra (0,65 u): tierra con dos rodadas, algo de hierba entre ellas y la orilla un poco más oscura.

  En el mundo abierto no hay nada más allá del camino de tierra (0.124.0): el escalón más alto del servidor («calzada») se pinta como camino.

  La textura va de lado a lado una vez y se repite a lo largo con la misma escala en los dos sentidos; se cuenta lo andado desde el principio
  del camino, así no se corre cuando el recorte alrededor del héroe empieza en otro vértice.
- **Tu columna** lleva un aro en el suelo, la mira del 2D: entre los árboles se pierde.

## Cómo se pinta (fase 4)

- **Columnas.** Todas las de tu Facción, con su ruta (la tuya entera, con su destino y la mira; las demás, un rastro discontinuo, como en el
  2D) y lo que arrastran detrás de la tropa:
  - el **carrito del héroe** (0.93.0) si el carro de la columna lleva algo (`suministro`): pequeño, de dos ruedas, con sus fardos y sin
    animal, justo detrás de la formación;
  - un **carro de caravana** por caravana enganchada (hasta dos), con el animal de la caravana delante (buey, caballo o camello; sin él, un
    buey), y al final el de fundación, con su lona y su buey. Los carros de caravana van a 1,5 veces el tamaño de las figuras para que no se
    confundan con el carrito.

  Las avistadas van sin ruta y sin tropa, porque ni la una ni la otra viajan en la proyección: se pintan sus héroes y sus carros de caravana
  (de ellas no se sabe si llevan algo en el carro). Túnicas y penachos van del color de su Facción; quien aún no tiene Facción, en rojo. Una
  columna en formación lleva un anillo discontinuo de su color.
- **Caravanas sueltas.** Su **escolta** delante (0.93.0): las escuadras cedidas de la propia (`escoltaIds`, hasta tres), de dos filas de tres
  como la tropa de una columna personal; de la avistada solo se sabe si va escoltada, y se pinta una. Detrás, sus carros: uno por carro de la
  caravana con su animal (hasta tres; la que no dice sus carros, uno con buey), a 1,5 veces, y el de fundación con lona. Las propias llevan su
  ruta, tenue; las avistadas, no. El 2D no pintaba las avistadas aunque se podían seleccionar. De las propias solo están en el mapa las que van
  de camino o están aparcadas en el campo (`caravanaEnElMapa`, 0.105.0): el carro de acarreo que carga dentro de su pueblo, la caravana
  disponible en su plaza o la que espera en una parada no se ven (Víctor, 2026-11-03: el acarreo, hasta que sale lleno). Igual en el modo mapa.
- **Aedas itinerantes** (0.169.0): el que va de camino, a pie (manto claro con banda ocre, la capucha a la espalda, bastón y lira de bronce)
  con su burro de alforjas al lado (`figurasDeAeda`), y encima su cartel «📜 nombre» (el nombre lo pone el cliente, `mundo/aedas.ts`). Andan su
  plan como una columna ajena. El parado en una plaza no se pinta dentro: el cartel de la plaza dice «· 📜 Aeda». En el modo mapa, una lira.
- **Bandidos, alijos y batallas** son maquetas, encima de la niebla:
  - bandidos: tiendas oscuras en corro, más cuanto más nivel, con su hoguera y su bandera roja;
  - alijo: fardos y un cofre con el oro;
  - batalla: dos espadas cruzadas sobre un aro, verde si combates en ella.
- **Miradas.** Un círculo de su radio: abierta, azul; caducada (la zona sigue vedada), gris y discontinuo. Llevan su nombre con los minutos
  que quedan.
- **Selección.** Lo que hay bajo el clic lo busca `objetosBajoElClic`, cada cosa con su radio de agarre. Si son **dos o más** (0.93.0),
  antes de hacer nada sale una lista arriba al centro, donde salen los avisos: cada cosa con su símbolo, qué es y un detalle (de quién es, su
  nivel, si va escoltada…), en este orden: batallas, ejércitos de tu Facción, formaciones, columnas y caravanas ajenas, pueblos, avanzadas,
  obras, alijos, mercenarios, bandidos y plazas; dentro de cada clase, de la más cercana a la más lejana. Elegir una hace lo mismo que un clic
  sobre ella sola (se selecciona y, si toca, la columna marcha hacia ella). Esc, un clic fuera o un clic en el mapa la cierran sin hacer
  nada. Igual en el modo mapa. La vista pone un aro que late a su medida: la ciudad con holgura, un campamento, una columna…
- **Fundar.** Con el panel ⚑ abierto, alrededor de la columna se ven:
  - la zona con que nacería la plaza (discontinua, dorada);
  - los sitios donde cabría una aldea: cuadros verdes, grises si quedan demasiado cerca de algo;
  - las parcelas de bosque: verdes las libres, rojas las ocupadas o de otra plaza;
  - el nombre de cada nodo de dentro, en dorado.
- **Nombres** (HTML encima del lienzo, colocados en cada fotograma):
  - las plazas, tenue la que solo se recuerda;
  - los nodos ya explorados que caben en pantalla;
  - los minutos de cada Mirada;
  - bajo una columna propia que pisa tierra ajena, «⚑ Facción» (lo dice el servidor, `territorioPorEjercito`).

  Lo que cae detrás de la cámara, fuera de la pantalla o en la bruma no se pone.

## Lo que se retiró del 2D (fase 5)

El modo mundo ya no pasa por el lienzo `#mapa` ni por la cámara 2D. Se quitaron:
- `controlMapaActivo` y las llamadas a `dibujarPantallaSegunModo` desde la pantalla Mapa (`main.ts`);
- los zooms fijos (`niveles`) y `seguir` de `ui/pantallaMapa.ts`, que ahora es solo la cámara del modo mapa;
- el parámetro `modoMundo` de `pintarTerreno` (`render.ts`);
- las baldosas del suelo de `mundo/pintarArtefacto.ts`.

`render.ts` sigue pintando el modo mapa y la ruta de depuración `#/legacy` (el mundo entero en 2D).

## Rendimiento (fase 5)

Medido con `VistaMundo3D.rendimiento()`, que da lo que tarda cada parte del fotograma en el hilo principal (ms, media móvil). En este
contenedor el WebGL es por software, así que solo valen las cifras de JS, medidas en vacío, y el tamaño de la escena:

| | Héroe solo, 15 u | Con soldados, alejado (45 u) | Sin niebla, alejado |
|---|---|---|---|
| Triángulos | 0,43 M | 0,88 M | 2,6 M |
| Llamadas de dibujo | 58 | 146 | 169 |
| Árboles | 3.700 | 14.400 | 110.000 |

- **JS por fotograma, en vacío:** árboles 0,24 ms, cámara 0,08, suelo 0,02, paisaje 0,02, maquetas y rayas 0,03. Construir lo nuevo va
  aparte, con los 8 ms de presupuesto.
- **El estado del juego** era lo más caro: `proyectar` rehace la proyección entera desde el almacén (≈1 ms) y la vista la pedía en cada
  fotograma. Ahora (`estadoDeLaVista3D` en `main.ts`) solo se rehace cuando llega otra proyección o cambia la selección, la vista previa de
  fundar o las reglas. Mientras algo marcha (propio o ajeno, desde 0.105.0), la proyección del instante se recalcula como mucho cada 15 ms: a
  0,5 u/s, la columna no avanza ni 0,01 u entre dos. En vacío baja de 1,07 ms a 0,002.
- **Densidad de píxeles** como mucho 1,5 (antes 2): en una pantalla retina, 2 sombrearía cada píxel cuatro veces.
- Lo que falta medir es la tarjeta gráfica de un equipo de verdad. La escena más pesada es la de sin niebla alejada (2,6 M triángulos),
  que en el juego no se da: la niebla quita los árboles de lo que no se ha explorado.

## Lo que anda, sin saltos (0.105.0)

Víctor vio que, tras un rato, las columnas y las caravanas iban a saltos, con 40-50 héroes en marcha (2026-11-03). Con 45 cuentas de prueba en el
servidor local marchando a destinos al azar alrededor de tu columna parada, las ajenas solo se recolocaban 1,5 veces por segundo, a saltos de
casi 1 u.

- **Lo ajeno también anda solo.** La vista solo rehacía la proyección del instante si algo **propio** marchaba; lo ajeno se quedaba donde lo
  dejó la última proyección hasta el siguiente cambio del servidor, que no manda nada mientras una columna sigue su plan. Ahora las columnas y
  caravanas avistadas llevan `enMarcha` mientras van por su plan, y `algoSeMueve` (`mundo3d/estado.ts`) cuenta con ellas. Medido igual: se
  mueven en 590 de cada 600 fotogramas, unos 0,02 u cada uno; el estado cuesta 1,2 ms por fotograma con las 45.
- **Las rutas se muestrean una vez** (`RutaEnSuelo`, `lineas.ts`): el trazado pegado al suelo se hace cuando cambia la ruta y, mientras la cabeza
  anda, solo se acorta por delante (`drawRange`) y se rehace el tramo corto de la cabeza al siguiente vértice. Antes se volvían a muestrear
  todas cada vez que cualquier cabeza avanzaba 0,1 u. Con 30 carros de acarreo en el banco (`?acarreo=30`), esa parte baja de 0,76 a 0,27 ms
  por fotograma y el peor fotograma, de 50 a 20 ms. Las rutas de lo que está más allá de lo que se carga no se pintan.
- **Los nombres se colocan con `transform`**, no con `left`/`top`, y solo se escribe lo que cambió: moverlos no obliga a recolocar la página.
- **Los refrescos por cambios del servidor no se retrasan sin fin**: uno a los 250 ms del primer cambio, y los que lleguen mientras tanto entran
  en él (antes cada cambio volvía a esperar 250 ms).
- El almacén guarda los últimos 500 hechos, no todos.

## Capas que se ponen y quitan (0.109.0)

Pedido de Víctor del 2026-11-03. Encima del zoom hay un botón de capas (`ui/capasMapa.ts`) que abre una lista de casillas; lo marcado se
recuerda en este navegador (`bronzeage.capas`, `mundo/capasDelMapa.ts`) y vale para las dos pantallas.

- **Nombres de los nodos** (modo mundo y modo mapa; puestos de serie). Quitados, en el 3D no se ponen los nombres de los nodos cercanos, salvo
  los de la zona de la vista previa de fundar, que son parte de ella. En el modo mapa se quitan los que salen de cerca bajo cada icono.
- **Fertilidad del suelo** (solo modo mapa). El raster `fertilidad` del artefacto (celdas de 4 u) en una capa de color: de óxido a ocre por
  debajo de la fertilidad mínima de la aldea agrícola (`reglasDeAldea`, 0,3 sin datos) y, desde ella, de paja a verde hondo. El salto de color
  en el corte es a propósito: se ve dónde cabe una aldea. La leyenda lleva la rampa con el corte marcado. El agua va sin color.
- **Parcelas de bosque** (solo modo mapa). Cada parcela del artefacto como su círculo de 4 u, más lleno cuanto más densa (la madera que daría
  su Leñera): verde si está libre, ámbar si tiene una Leñera conocida, rojo si cae en la zona de una plaza de otra Facción (`clasificadorDeParcelas`,
  el mismo criterio que la vista previa de fundar, salvo que ahí también las de tu Facción son ajenas, porque la plaza nueva no las puede tomar).

Las dos capas temáticas van **encima** de la niebla, para que se lean igual en lo que se ve que en lo que se recuerda, pero solo sobre las
celdas exploradas alguna vez: son geografía, y de lo no explorado no se sabe ni eso. La capa de fertilidad se compone una vez por cambio de lo
explorado, no por fotograma; las parcelas van en una pasada por estado y grado de densidad. Medido con las dos puestas, el pintado del modo
mapa tarda lo mismo que sin ellas.

## Distancia de carga (0.111.0)

Pedido de Víctor del 2026-11-03: que el mundo no se cargue entero, sino hasta una distancia que se pueda ajustar. Está en el botón de capas del
modo mundo, apartado «Vista»: un deslizador de 100 a 480 u, de 20 en 20, que se recuerda en el navegador (`bronzeage.distanciaCarga`). De serie,
320 u, lo que se cargaba antes (`DISTANCIA_CARGA` en `mundo3d/config.ts`).

- Lo que se construye llega hasta `min(carga, 7·d)`: suelo, paisaje, árboles y rayas como antes (estos tres, con sus topes de 200 y 240 u en
  proporción a la carga). Y ahora también se limita lo que antes se construía en todo el mundo conocido: las maquetas (plazas, pueblos,
  avanzadas, obras, campamentos, bandidos, alijos y batallas), las columnas y caravanas ajenas con sus rutas, y los nombres. Las maquetas se
  cuentan desde el héroe redondeado a un octavo de la carga, para no rehacerlas a cada paso.
- La bruma acaba donde acaba lo cargado (antes seguía hasta 7·d aunque el suelo acabase en 320 u, y alejado se veía el borde) y empieza a
  `min(2,2·d, 0,4·alcance)`.
- Con menos carga el suelo fino llega menos lejos: el paso de 0,5 u hasta `max(32, 80·k)` u y el de 1 u hasta `max(64, 160·k)` u, con
  k = carga / 320.

Medido en el banco (héroe solo, encuadre normal, a 30°): con 320 u, 0,93 M triángulos (0,54 M del suelo) y 11.800 árboles; con 160 u, 0,61 M y
10.400; con 100 u, 0,47 M y 7.700. A esa inclinación la pantalla no llega más allá de unas 100 u, así que bajar la carga apenas cambia lo que se
ve; con la cámara baja, la bruma se echa antes sobre el horizonte.

## El agua (0.113.0)

Pedido de Víctor del 2026-11-03: «hay que mejorar la vista del agua, q no solo sea el piso pintado de azul». Antes el suelo de las muestras
de agua se pintaba de azul a la altura del relieve y los ríos eran una cinta azul lisa. Ahora (`mundo3d/agua.ts`):

- **Lámina.** El mar y los lagos son una lámina transparente a su nivel, un metro por debajo de la costa (el mar, a 374 m; cada lago, a su
  altura plana menos uno), una malla por tesela con el paso del suelo. Una tesela toda de agua honda es un solo cuadrado.
- **Fondo.** El suelo bajo el agua baja desde la orilla: nada junto a ella y 2,6 u (31 m) de agua a 6 u de la orilla y más allá (el fondo del
  mar del relieve, más hondo, se respeta). Se pinta de arena a oscuro según lo que cubre, y la lámina deja verlo donde cubre poco.
- **Orilla suave.** La costa no sigue los dientes de las muestras de agua: la máscara de agua emborronada (dos pasadas de 3 × 3) da la línea
  donde vale 0,5, y el suelo de alrededor se ajusta para que la lámina lo corte por ahí. La tierra junto al agua baja hacia ella (0,8 u de
  pendiente de la tierra entera al agua entera) sin quedar nunca bajo la lámina.
- **Sombreado.** Turquesa donde cubre poco y azul hondo mar adentro, más opaca cuanto más honda. Olas que se mueven: seis ondas cruzadas,
  de largas a cortas, que a ratos se calman, y que de lejos se alisan (si no, harían rayas). Brillo del sol, el cielo reflejado cuando se
  mira de lado y espuma donde cubre poco, que va y viene.
- **Ríos.** La misma agua en la cinta del río: somera en los bordes y honda en medio, con las olas corriendo río abajo (la cinta lleva lo
  recorrido desde la fuente, así la corriente sigue de una tesela a otra). Su orilla de tierra mojada se desvanece hacia fuera.
- Todo va bajo la niebla de guerra como el resto de la geografía; el clic y lo que se pone encima del agua usan la altura de la lámina.

Medido en el banco junto al mar (1163, 1690; carga 320, encuadre normal): 0,81 M triángulos frente a 0,71 M sin la lámina, el mismo tiempo de
construcción y el mismo coste de JS por fotograma.

## Suelo, vegetación y especies de árbol (0.118.0)

Pedido de Víctor del 2026-11-03: «mejorar el piso, con vegetación y diferentes tipos de árboles». Solo se ve: el juego no distingue una
especie de otra ni cuenta la hierba.

- **Suelo** (`terreno.ts`). Sobre el color de la clase, verde de pasto según la fertilidad del artefacto (la de la aldea agrícola): pajizo
  donde no hay, verde desde 0,15 y verde hondo desde 0,55. Va por manchas de unas 12 u (la fertilidad baila ±0,15), más ralo junto al mar y
  nada en la montaña. Encima, un grano fino en el sombreado (manchas de 0,1 a 1 u más claras u oscuras, y a trozos más amarillas o verdes)
  que de cerca quita lo liso y de lejos se apaga.
- **Especies de árbol** (`especies.ts`), las del Mediterráneo oriental y el Creciente Fértil en la Edad del Bronce:

  | Especie | Cómo es | Dónde |
  |---|---|---|
  | Encina | Copa redonda | Llanos (la que más) |
  | Olivo | Bajo y ancho, verde plata | Llanos, colinas y costa |
  | Pino piñonero | Tronco alto, copa en sombrilla | Costa (el que más) y colinas |
  | Ciprés | Alto y estrecho, casi negro | Suelto en todas partes |
  | Abeto | Conos apilados | Montaña (el que más) |
  | Palmera | Estípite curvo y palmas | Ribera baja y costa |
  | Álamo | Alto, de verde claro | Riberas |

  La zona sale de la altura (costa hasta 420 m, llano hasta 545, colina hasta 600, montaña desde ahí; los cortes bailan ±15 m por manchas)
  y del agua: a menos de 2,5 u de un lago, el mar o un río, y por debajo de la colina, es ribera. Los bosques van por manchas de unas 22 u de
  borde irregular: en cada una manda una especie de la zona (el ciprés nunca), que es la de siete de cada diez árboles; el resto, cualquiera
  de la zona según su peso. Cada árbol varía su color y su alto.
- **Vegetación baja** (`matas.ts`). Cada 0,5 u hay una candidata, movida al azar en su celda, que es como mucho una cosa:
  - hierba en matojos, más espesa y verde cuanto más fértil (pajiza en lo pobre), menos bajo los árboles y en las laderas;
  - flores por manchas en los prados fértiles (amapolas, amarillas, blancas o malvas; cada mancha de un color);
  - matas de monte bajo donde el suelo es pobre y en el borde de los bosques;
  - juncos a menos de 1,2 u del agua en lo bajo;
  - piedras sueltas, más cuanto más empinado y en la montaña.

  Quedan todas a menos de 20 u, la mitad hasta 34 y la cuarta parte hasta 48 (un poco más grandes). La hierba, las flores y los juncos se
  mecen con el viento en el sombreado. Ni en el agua, los cauces, los caminos ni los claros de las maquetas.

Medido en el banco (héroe solo, encuadre normal, a 30°, carga 320): 1,30 M triángulos (0,42 M de árboles y 0,24 M de matas) frente a 0,95 M
antes; 622 mallas frente a 438; el JS del fotograma, igual (0,5 a 0,65 ms).

## El mundo con vida (0.120.0)

Pedido de Víctor del 2026-11-03: «mejorar la vista de mundo en general». Cosas que no son del juego y se mueven solas, todas en el
sombreado (en cada fotograma solo cambia el reloj; el JS del fotograma no cambia y son dos mallas más):

- **Sombras de nubes.** Manchas de unas 15 u, un 20 % más oscuras, que el viento arrastra a 0,6 u/s. Van en el parche de la niebla de guerra
  (`niebla.ts`), así caen sobre toda la geografía (suelo, agua, árboles, matas, ríos, lo recordado); lo que va encima de la niebla (lo propio,
  lo que se ve ahora) no las lleva.
- **Viento en las copas.** Las copas de los árboles se mecen un poco, más arriba que abajo y cada árbol a su ritmo; el tronco no
  (`especies.ts`). La hierba, las flores y los juncos ya se mecían (0.118.0).
- **Humo** (`vida.ts`). Columnas de bocanadas grises (bolas de borde desvaído) que suben 3 u en 10 s, crecen, se las lleva el viento y se deshacen: en las plazas que
  se ven (de 2 a 4 columnas según el nivel, dentro de la ciudad), en cada pueblo, en las avanzadas en pie desde el fuerte y en el fuego de
  los campamentos de mercenarios y de bandidos. Cada columna en un sitio fijo del asentamiento.
- **Pájaros** (`vida.ts`). Bandadas de 3 a 7 que dan vueltas de 4 a 11 u de radio a unas 4 u sobre el suelo, unos detrás de otros, a ratos
  aleteando y a ratos planeando. Hay bandada en un tercio de las celdas de 24 u alrededor del héroe (hasta 60 u), siempre la misma en cada
  celda, así al moverse no aparecen ni desaparecen las de cerca.

## Territorio y caminos (0.124.0)

Peticiones de Víctor del 2026-11-03:

- **El territorio sobre el relieve** (`territorio.ts`): «una capa con un opacity suave sobre el interior de la zona de influencia, para que se
  note bien el territorio». Las zonas se pintan en un lienzo de 1024 px que cubre 1200 u alrededor del héroe (se vuelve a centrar al cruzar
  una celda de 128 u: siempre cubre más que la distancia de carga más larga) y el suelo lo mezcla con su color antes de la luz, así el tinte
  sigue las laderas. Como en el 2D: uno por Facción ajena con sus zonas juntas (vistas y recordadas) al 13 %, y el tuyo con la zona fusionada
  (respeta los huecos) al 18 %. Por dentro del contorno, una franja de 4 u algo más marcada que se desvanece hacia el centro. Un color oscuro
  va hasta 1,6 veces más opaco: un tinte negro solo oscurece, y con la misma opacidad se confundiría con la sombra de una nube. Solo el
  suelo: árboles, matas y agua quedan con su color.
- **Solo caminos de tierra**: «los caminos en mundo abierto nunca pueden ser más allá de camino de tierra, dado que en esta época histórica no
  estaban ni las calzadas romanas aún». Se quitó la textura de adoquines; el escalón «calzada» del servidor se pinta como camino de tierra,
  del mismo ancho.
- **El camino pasa por la plaza**: el servidor funde en un solo tramo dos caminos del mismo escalón que se encuentran en una plaza (el del
  pueblo y el de la otra plaza, por ejemplo), y el suavizado le cortaba la esquina por dentro de la ciudad, sin pasar por la maqueta. Ahora
  el tramo se parte en cada plaza, pueblo o campamento que cruza y cada trozo se suaviza aparte.
- **Rayas más finas**: la frontera ajena pasa de 0,24 a 0,12 u, la de tu zona de 0,36 a 0,18 u y la línea entre provincias de 0,08 a 0,06 u.

## Rendimiento (0.125.1)

Medido en la partida real (`localhost:5174`, cuenta de prueba en camp-1, unas 50 columnas de bots a la vista), en un equipo con RTX 4080
SUPER, 1649×1266 px, densidad 1. «Antes» con fotogramas de verdad (`requestAnimationFrame`); «después», con la ventana oculta, moviendo los
fotogramas a mano (`bucle`): mismos ms de CPU, de tarjeta (`EXT_disjoint_timer_query_webgl2`) y llamadas, pero sin FPS.

| | Llamadas | Triángulos | Mandar el dibujo (CPU) | Tarjeta (mediana) | FPS / tirones |
|---|---|---|---|---|---|
| Antes, normal, 320 | 2.097 | 0,77 M | 13,9 ms | 11,2 ms | 45 FPS, p99 60 ms |
| Antes, alejado, 480 | 2.110 | 0,84 M | 13,1 ms | 11,3 ms | 45 FPS, p99 59 ms |
| Antes, marchando, normal, 320 | 1.760 | 0,78 M | 14,3 ms | 9,5 ms | 37 FPS, p99 71 ms |
| Después, normal, 320 | 224 | 0,80 M | 3,2 ms | 3,2 ms | fotograma de 3,5 ms (mediana) |
| Después, alejado, 480 | 269 | 0,91 M | 2,7 ms | 3,8 ms | 4,1 ms |
| Después, marchando, alejado, 480 | 270 | 0,90 M | 3,3 ms | 3,7 ms | 4,7 ms |

- **El cuello eran las llamadas de dibujo** de las figuras de las columnas: unas 1.000 piezas (mallas sueltas de 4 a 10 por figura), cada una
  dos veces (escena y sombra). No la tarjeta: bajar la resolución a la cuarta parte no cambiaba nada. Ahora van en `Tropel`: una malla
  instanciada por pieza y material para todas las columnas, rellenada en cada fotograma (≈1 ms de CPU con 50 columnas, dentro de
  `columnasYMarcas`).
- **Lo que queda:** tirones sueltos de 15-25 ms (p99) que caen en cualquier fase (estado, cámara, suelo, dibujo), con saltos de 15-18 MB en el
  montón: recogida de basura. La vista reserva unos 0,7 MB por fotograma, la mayor parte dentro de `renderer.render` y del estado con los bots
  marchando. La tarjeta tiene picos de 15-20 ms (p95) con la escena quieta, que apuntan a otra cosa usando la misma tarjeta.

## Rendimiento (0.126.1)

Los tirones sueltos de la 0.125.1, buscados con un perfil de reservas de memoria. Medido en la partida real (cuenta de prueba en camp-1, unas
52 columnas a la vista, RTX 4080 SUPER) en un Chrome sin ventana con la tarjeta, por el protocolo de depuración (`HeapProfiler`, `Profiler`), 600
fotogramas por caso. «Antes» es la 0.125.1.

| | Memoria reservada | Estado | JS por fotograma (media) | JS p99 | Fotogramas > 10 ms de JS | FPS |
|---|---|---|---|---|---|---|
| Antes, quieto (4 casos) | 145 MB/s | 0,7-1,4 ms | 5,8-7,6 ms | 24-26 ms | 46-66 | 59,3-59,5 |
| Antes, marchando (2 casos) | | 0,9-1,5 ms | 8,9-9,0 ms | 30-31 ms | 87-135 | 55,5-56,3 |
| Después, quieto | 17 MB/s | 0,13-0,32 ms | 4,3-5,1 ms | 22-23 ms | 25-35 | 59,3-60,1 |
| Después, marchando | | 0,15-0,23 ms | 5,0-5,4 ms | 24-30 ms | 67-69 | 57,8-58 |

- **De dónde salía la basura:** el 55 % era rehacer la proyección entera del juego cada 15 ms mientras algo marcha (con 50 bots, siempre),
  solo para mover las columnas. Ahora `moverAlInstante` (`motor/proyeccion.ts`) parte de la última proyección y solo recoloca, con su plan, lo
  que anda. Lo demás: la clave de la niebla (sus dos cadenas de lo explorado, juntas en cada fotograma), las listas de trozos de árboles,
  matas, suelo y paisaje (ahora solo se rehacen si falta algo, el héroe se movió ¼ u o cambió lo que las decide: `hayQueMirar` en
  `vista.ts`), y las claves de texto y copias de `Tropel`.
- **Lo que queda:** unos 25-35 fotogramas largos de cada 600, casi todos dentro de `renderer.render` (15-23 ms): esperas al controlador o
  a la tarjeta, no a la recogida de basura, que ya apenas sale en el perfil de CPU. En el FPS no se notan (59-60 quieto).

## Lo que anda, en todos los fotogramas (0.128.1)

Mientras algo marcha, `estadoDeLaVista3D` (`main.ts`) rehace el estado de la vista en cada fotograma, con lo que anda recolocado por su plan
(`moverAlInstante`). Hasta la 0.128.0 lo hacía como mucho cada 15 ms (`CADA_PROYECCION_MS`), que en pantallas de 120 o 144 Hz dejaba lo ajeno
quieto un fotograma de cada dos. Queda por medir en camp-1 cuánto JS añade por fotograma (antes, el estado costaba 0,13-0,32 ms con unos 2 de
cada 3 fotogramas rehechos).

## Capa de fertilidad (0.131.0)

Petición de Víctor del 2026-11-04: la fertilidad del suelo se pone y se quita en el botón de capas del modo mundo, como los nombres de los
nodos (la casilla es la misma que en el modo mapa). La rampa es la del modo mapa (`pixelesDeFertilidad`: rojiza la yerma, amarilla en el corte
de la aldea agrícola, verde la fértil), en una textura del raster de fertilidad que se hace una vez por mundo. El suelo la mezcla antes de la
luz, encima del tinte del territorio. Solo sobre lo explorado (lo lee de la textura de la niebla, en el mismo sombreado) y nunca en el agua.

## El suelo que se pisa (0.136.1 y 0.137.0)

Arreglo de lo que vio Víctor el 2026-11-04 (columnas que flotaban junto a la costa y otras hundidas; luego, lo mismo en caminos, fronteras,
nodos y árboles). Todo lo que va sobre el suelo se pone sobre la malla tal como se pinta (`Terreno.alturaPintada`, que es `alturaU` de la
vista), no sobre el relieve fino: lejos la malla va cada 1 o 2 u y en terreno abrupto se aparta del relieve, y junto al agua la tierra baja
hacia ella. Cada tesela guarda las alturas de sus vértices (la lámina donde hay agua) y se interpola por los mismos dos triángulos que la malla.

Como el detalle de una tesela cambia con la distancia al héroe, lo que se pone una vez se recoloca cuando cambia su suelo (`SueloPintado`):

- `Terreno.firma(caja)` resume las teselas bajo la caja; cambia cuando una se rehace o se pone la que faltaba. `Terreno.version` sube con
  cualquier cambio y sirve de atajo: si no subió, ninguna firma cambió.
- Árboles y matas guardan la firma de su trozo y, si cambia, solo se vuelven a asentar. Las teselas del paisaje (ríos, orillas, vados y rocas
  de los nodos), con 4 u de margen, se rehacen. Cada cinta de caminos y fronteras guarda la de su caja y se rehace sola. Las maquetas se
  vuelven a asentar con cada versión. Columnas, rutas, aros, marcas, humo y la rejilla se rehacen.

## Carros de dos en dos (0.143.0)

Petición de Víctor del 2026-11-04: los carros de caravana de una columna o de una caravana suelta van en filas de dos, cada uno con su animal,
a 0,13 unidades de figura (×`MUNDO3D.tropa`) a cada lado del rastro; con un número impar, el último va solo en el centro. El carrito del
héroe va solo, delante.

## Fronteras de lo que solo se recuerda (0.151.0)

Petición de Víctor del 2026-11-04. De una plaza que se vio y ya no se ve, el servidor guarda el radio y no la silueta (`AsentamientoConocido`);
como círculo entero, su zona se metía en las vecinas. El cliente la recorta como el motor (`mundo/zonasRecordadas.ts`, el mismo corte que
`territorio::zona::poligono`) contra los discos de otras Facciones que conoce: las plazas que se ven, con el radio de su silueta, y las
recordadas. Donde chocan dos zonas sale la frontera. Se pinta con el trazo de lo que se ve; vale también para el relleno del territorio y
para el modo mapa.

## Carteles de columnas, ejércitos y caravanas (0.154.0)

Petición de Víctor del 2026-11-06. Sobre cada columna personal, un cartel HTML (`etiquetas.ts`, tipo `columna`) con el escudo de su Facción,
el nombre del héroe que la lleva y el de la Facción debajo; sobre cada ejército (`ejercito`) y cada caravana suelta (`caravana`), escudo y
Facción. Van 0,55 u sobre el suelo de la cabeza de la columna, siguen a la columna en cada fotograma y se pulsan como ella. Los datos salen
de `estadoDesdeProyeccion`: `ColumnaEnVista.faccionId` y `heroe` (líder o primer participante; su `displayName`) y `CaravanaEnVista.faccionId`.

## Banco de pruebas

`npm run mundo3d` abre `pruebas/mundo3d/` con el artefacto y el relieve que haya en `generador/salida/mundo/` del motor (el checkout hermano
`../BronzeAgeFase0` o `../BronzeAge`, o la variable `MOTOR`); el servidor de Vite los sirve en `/__banco/mundo` y `/__banco/relieve` solo en
desarrollo. Una columna propia va en línea recta adonde haces clic, a 30 u/min, y una niebla de mentira explora lo que se ve. Los campamentos
de mercenarios son los del artefacto, y junto al héroe hay maquetas de mentira:
- una plaza propia de nivel 3 con su zona, dos pueblos, tres avanzadas (una en ruinas) y dos obras;
- una plaza ajena que se ve y otra que se recuerda;
- caminos (en escalera como los manda el servidor) con el trazado suavizado del juego: uno de tierra que sale del héroe, cruza la plaza propia
  y sigue hasta la ajena, y un sendero a la aldea;
- el relleno del territorio de cada zona;
- tu columna con su carrito y un carro tirado por un caballo;
- una columna ajena en formación, una caravana propia que va y viene (dos escuadras de escolta y dos carros, de buey y de camello) y otra
  ajena con una de escolta;
- un campamento de bandidos, un alijo, una batalla y dos Miradas, con sus nombres.

Un clic cerca de algo lo selecciona; en el suelo, la columna va allí. «Fundar aquí» enciende la vista previa de fundar alrededor del héroe.

Parámetros:
- `?x=…&y=…` pone el héroe en otro sitio;
- `?raster` pinta con el raster de 4 u en vez del relieve;
- `?sinMaquetas` quita las maquetas de mentira;
- `?acarreo=N` pone N carros de acarreo que van y vienen entre un pueblo cerca del héroe y una plaza a entre 40 y 220 u, para medir con muchas
  caravanas en marcha.
- `?carga=N` fija la distancia de carga en N u.

En desarrollo, el juego deja la vista en `window.__vista3d` y `?sinNiebla` la quita.
