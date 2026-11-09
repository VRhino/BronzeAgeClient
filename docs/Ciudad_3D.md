# Plaza 3D

La vista de la plaza (la tuya, o la de otra Facción en la que estás dentro) pasa de la vista de trazado en 2D a una escena 3D con three.js. El 2D
de siempre no se va: queda de minimapa arriba a la izquierda. Desde 0.92.0 la escena llena toda la pantalla y lo demás flota encima (ver
`docs/Diseno_Interfaz.md` §5). No hay modelos de fuera: todo se monta en código con unas pocas
formas, reutilizando del mundo 3D el cielo, la luz y la manera de pintar miles de piezas en pocas llamadas de dibujo. El código vive en
`src/ciudad3d/`.

## Decisiones del autor (2026-11-02)

- **Se respeta el trazado.** Nada se mueve, ni gira, ni sale de su huella. Cada edificio se monta dentro de la huella que manda el motor
  (`trazado.huellas`), y la muralla, celda a celda, en las celdas de su recinto. Las calles y los caminos son los del trazado. Una prueba
  (`pruebas/ciudad3d.test.ts`) monta todos los edificios de tres ciudades reales en los cinco estilos y los tres estados, y falla si una
  pieza asoma más de 0,2 ul (60 cm, un alero) fuera de su huella.
- **Escala**: 1 ul = 3 m (una celda del trazado, 3 ul, son 9 m). Una planta mide algo más de 1 ul.
- **El estilo va con el nivel de la plaza**:
  - 1, chozas redondas de zarzo y paja y casas largas;
  - 2, casas largas de barro, alguna con ábside;
  - 3, casas de adobe de techo plano con patio, pérgolas, hornos y tinajas;
  - 4, enlucido sobre zócalo de piedra, dos plantas, ventanas, y casas en L, en hilera o de azotea;
  - 5, el palacio de patio central con columnas rojas y franjas rojas, ocres o azules, con escaleras de fuera, toldos y cuernos de
    consagración.
- **No todas las casas cambian a la vez.** Cada casa tiene un umbral fijo (sale de su id). Mientras la plaza sube de nivel, cambian primero
  las de umbral más bajo, así la ciudad se transforma por partes. Las de umbral más alto (el 18 %) se quedan un nivel atrás para siempre: la
  ciudad no es uniforme. Los edificios de gobierno (centro urbano, palacio, sala del consejo, maravilla y plaza) van siempre con el nivel, y
  cambian al acabar el ascenso.
- **Dentro se ve todo lo que se vería con los ojos**: el trazado, la muralla, las obras. En la plaza propia, la cola de obras sale como
  estacas y cuerdas en el suelo. En la ajena no hay cola: la quita el motor (pendiente en el motor; hasta entonces se ven las estacas también
  allí).
- **Las celdas libres se llenan.**
  - Cerca de las casas (a 2 celdas o menos): huertos vallados, patios, árboles, rediles redondos, hornos, leña y almiares, según lo que hay al
    lado.
  - Más lejos: campo con árboles en bosquecillos, algún redil y algún almiar.
  - Nada de esto ocupa sitio en el trazado: solo pinta lo que el trazado deja libre.
- **Fuera de esta tanda**: gente y animales que se mueven, y el cerro decorativo.

## Lo que se ve

- **Edificios** (`modelos.ts`): uno por tipo del catálogo y por estilo.
  - Ejemplos: vivienda, centro urbano y palacio (de la gran choza del jefe al palacio de Cnosos), sala del consejo, maravilla, almacén,
    granero (silos en cúpula desde el 3), granja (surcos en el suelo), leñera, corral, caballerizas, talleres con su patio (fundición, curtiduría,
    armería, carpintería, taberna), barracón, galería de tiro, mercado (estoa desde el 4), plaza, plaza de armas, patio de gremios, pozo y
    parque.
  - **Los talleres de la comida y la estatua** (desde 0.189.0, tanda 69 del motor): talleres con su patio delante.
    - El **molino** (2 × 2) tiene en el patio la muela de sangre: el camino redondo, la solera, la muela, el eje y la vara. Con su buey
      (`Edificio.buey`, `EdificioEnVista.buey`) el buey va uncido a la vara; sin él, la vara está apoyada. Al lado, los sacos de harina y el
      trigo por moler.
    - El **horno** (2 × 1) tiene dos hornos de cúpula con la brasa en la boca, la leña y la mesa con los panes.
    - La **quesera** (2 × 1) tiene el caldero de bronce al fuego, las tinajas de la leche y el estante con los quesos.
    - La **bodega** (2 × 2) tiene el lagar con el mosto bajo una parra y las tinajas grandes del vino en filas.
    - La **prensa** (2 × 1) es una prensa de viga: la viga metida en el muro, los capachos de aceituna sobre la piedra de prensar, la piedra
      colgada, las tinajas del aceite y los cestos.
    - La **estatua** (1 × 1, solo en la capital) es una figura con lanza y escudo sobre un pedestal de dos gradas, de piedra hasta el estilo 3 y
      de bronce desde el 4, con dos braseros delante.
  - **Viñas y olivares** (desde 0.189.0): en una aldea de vid o de olivo (`Pueblo.cultivo`, que `puebloEnVista` pasa a sus granjas como
    `EdificioEnVista.cultivo`), cada granja es una viña o un olivar.
    - La viña tiene hileras de cepas en su espaldera, con algún racimo, y los cestos de la vendimia.
    - El olivar tiene olivos en tresbolillo, la escalera de varear y los cestos.
    - Las dos van con la cerca de la granja de su estilo. En la planta de minimapa y al pasar el ratón se llaman «Viña» y «Olivar».
  - Variedad: cada edificio tiene una semilla (de su id) que decide sus variaciones (orientación de la puerta, plantas, patio, pérgola,
    tono...), siempre las mismas para el mismo edificio.
  - **Puestos de mercado** (desde 0.117.0): en una plaza de nivel 1 son tenderetes al aire, uno por celda. Del nivel 2 en adelante son
    tiendas (un puesto puede ir un estilo atrás, como las casas, pero nunca vuelve al tenderete): un cuerpo cerrado al fondo de la parcela (de barro y paja en el 2; de adobe, piedra o palacio, con una o dos plantas, del 3 al 5),
    con su portal, el hueco del mostrador con las tablas sacadas a la calle y lo que se vende encima, un toldo sobre postes y tinajas o cestos
    delante. Un puesto de varias celdas es una tienda por celda, cada una con su puerta, o (a suertes, fijo por puesto) una tienda grande con el
    portal en medio, dos mostradores y un pórtico corrido (de columnas en el 4 y el 5). La tienda abre al lado largo que da a una calle o un
    camino (`EdificioEnVista.frente`, de las celdas vecinas del trazado); si hay calle a los dos lados o a ninguno, lo echa a suertes.
  - **Albergue de caravanas** (desde 0.128.0; motor b5e27ace, 2 × 3 celdas junto al Mercado): un patio cerrado, como un caravasar o el
    barrio de mercaderes de Kanesh, con el portón en medio del lado largo que da a la calle (`frente`) y las hojas abiertas hacia dentro.
    - El estilo pone los materiales: valla de zarzo, postes y dintel, y cobertizos de paja en el 1; tapia de barro y tejadillo de paja sobre
      el portón en el 2; adobe con pilares, dintel y cabezas de viga en el 3; enlucido sobre zócalo de piedra con un zaguán cubierto en el 4;
      lo mismo con franja roja y columnas rojas en el 5.
    - El nivel del albergue pone lo de dentro. En el 1, la casa de los arrieros arrimada al fondo de un lado, un cobertizo con tres carros
      en el otro, el abrevadero con dos asnos y un carro con la lona puesta. En el 2, la casa más larga, el cobertizo de los carros (cuatro)
      a un lado y la cuadra al otro, con su pesebre y cuatro bestias (bueyes y asnos), el abrevadero y un carro en el patio. En el 3, la
      casa de dos plantas con su pórtico (pérgola hasta el 3, columnas en el 4 y el 5), cinco carros en el cobertizo, seis bestias, el pozo
      en medio y un carro largo de cuatro ruedas.
    - Carros de dos ruedas macizas con su lanza, yugo y taco; vacíos, con fardos, con tinajas o con la lona puesta, por su semilla.
- **Estados**:
  - en obra, el armazón: postes, muros que suben con el avance, vigas y el montón de material;
  - en cola (solo la propia), estacas y cuerdas;
  - mejorándose, andamios;
  - dañado, ruina quemada.

  El avance de la obra sale de `completaEn` y de lo que dura según el catálogo y las políticas (`minutosDeObra`, el mismo de la pestaña de
  obras). Las obras llevan un rótulo con su cuenta atrás.
- **Murallas** (`murallas.ts`), por el nivel de cada celda:
  - 1, empalizada sobre talud con foso y torres de madera;
  - 2, zócalo de piedra con muro de adobe, almenas y bastiones semicirculares;
  - 3, ciclópea de bloques, con adarve y una puerta de los Leones.

  Puertas y torres van donde dice la clase de la celda. Las celdas planificadas salen como zanja, y las que se están mejorando, con andamio.
  El motor manda las celdas en el orden de sus obras, que no siempre es el del anillo (puede llevar una torre al final de la lista). Lo
  levantado y lo mejorado sigue ese orden, pero el dibujo encadena las celdas de vecina en vecina (`anillosDe`, como la empalizada del
  campamento) cuando hacen un solo anillo; si no, se queda con el orden del motor.
- **Las puertas, entre dos torres** (desde 0.117.0): las celdas de muro que tocan el paso, una a cada lado, llevan la torre de la puerta, más
  alta que el muro y las otras torres. En la empalizada son dos torres de madera unidas por una pasarela con su baranda (si falta una, la
  puerta lleva su tejadillo); en el nivel 2, torres cuadradas de piedra y adobe que salen del muro, con almenas y una aspillera, y el paso
  con jambas de piedra, dintel, hojas abiertas y el muro corrido por encima; en el nivel 3, torres macizas que suben por encima de la puerta
  de los Leones. Van alineadas con la celda, así que en una esquina del anillo tampoco salen de ella; el motor no cambia. Si el anillo salta a
  una celda que no toca el paso (un recinto a medio comprometer), ese lado va sin torre.
- **La puerta resalta del muro** (desde 0.189.0; Víctor, 2026-11-08: «en la maqueta la puerta casi no se distingue del resto del muro»).
  - En los tres niveles: las hojas entreabiertas hacia dentro, con sus travesaños; un pendón rojo con franja ocre en cada torre de la puerta;
    y fuego a los lados del paso.
  - En la empalizada: antorchas en los postes, el bucráneo en el dintel y un puente de tablas sobre el foso.
  - En el nivel 2: el umbral enlosado, el marco enlucido de las jambas, el dintel pintado de rojo, bandas de bronce en las hojas y dos
    braseros.
  - En el nivel 3: las jambas y el dintel de piedra clara, más claros que el muro, y el paso enlosado. Las hojas van chapadas de bronce, con
    dos braseros, y el triángulo de descarga lleva su relieve claro: la columna roja entre dos leones.
  - Nada sale de las celdas de la puerta y de sus dos vecinas más que un alero.
  - En el mundo, la maqueta de una plaza amurallada lleva un dintel de madera entre las dos torres de la puerta y una bandera de la Facción
    en cada una.
- **Suelo** (`suelo.ts`): una textura pintada una vez, con:
  - el color del terreno del mapa donde está la plaza;
  - la tierra pisada alrededor de lo poblado y bajo las calles y los caminos;
  - la tierra apisonada bajo cada edificio;
  - los surcos de las granjas, el césped de los parques y las losas de plazas y mercados.
- **Calles** (`calles.ts` y `calzada.ts`). El motor manda las calles en tiras de una celda de alto; aquí se vuelven a juntar en una red, celda
  a celda, y cada celda sabe con qué vecinas se une. De ahí sale:
  - **su forma**: tramo recto, esquina (redonda), cruce en T, cruce en X, final (con la vuelta del carro) o suelta;
  - **su clase**, según cuánto se pasa por ella. Se cuentan los recorridos de cada edificio (los que no son viviendas, el triple) y de cada
    puerta de la muralla hasta el centro urbano. Las más usadas son **principales** (más anchas, con rodadas), las demás **callejones** (más
    estrechos, con una senda de pisadas en medio). Un bloque de 2 × 2 celdas de calle es una **explanada** (tierra abierta, sin rodadas). Los
    caminos de fuera son **sendas** que serpentean, con dos rodadas y hierba en medio.
  - **Cómo se pinta**: cada celda lleva su tesela, pintada según la forma, la clase y la de sus vecinas:
    - las rodadas siguen la calle (rectas en los tramos, en curva en las esquinas, girando en las T, cruzándose en las X);
    - los cruces se ensanchan y se gastan en el centro, a veces con un charco;
    - en el borde con la vecina, la anchura es la media de las dos y las rodadas van en el mismo sitio, así no se notan las juntas.
  - **Losas**: en el nivel 4 se enlosan las principales y las explanadas; en el 5, todas las calles. Van en hiladas que siguen la calle, con
    bordillo y un rosetón en los cruces en X. En el 5, las principales llevan en medio la calzada de losas grandes (como la de Cnosos) y las
    explanadas, losas grandes.
  - **Guardacantones**: una piedra en las esquinas de los cruces que dan a una casa.

  Las teselas iguales se pintan una vez (unas 140 distintas en una ciudad de 480 celdas de calle) en un atlas, y todas las calles van en una
  sola malla.

## Campamentos de mercenarios

Desde 0.97.0, la pantalla del campamento donde estás lleva la misma vista 3D en el centro, con la planta en SVG de siempre como minimapa
(`campamento.ts`). Solo es cliente: el motor ya manda la planta entera estando dentro (`EscenaCampamento`: las piezas con su centro y sus
lados, las calles y la empalizada celda a celda).

- **Se dibuja como una plaza de nivel 1**: casas de madera y paja, calles de tierra con rodadas, empalizada de estacas sobre talud con su foso.
  Cada pieza va en su huella exacta: el centro y los lados del motor.
- **Las viviendas son tiendas** (`tienda` en `modelos.ts`), una por celda y de tres maneras, siempre las mismas para la misma pieza:
  - una tienda grande de lona o de pieles a dos aguas, con la entrada en un testero, los postes de la cumbrera y las estacas de los faldones;
  - dos tiendas pequeñas, una al lado de la otra;
  - una tienda redonda de pieles sobre varas.

  Cada una lleva su lumbre (cerco de piedras, brasas y troncos para sentarse) y, a veces, un armero con lanzas y un escudo, o unas tinajas.
- **La empalizada**: el motor manda sus celdas sueltas; se ordenan de vecina en vecina para hacer el anillo. Dos celdas de puerta seguidas son
  una sola puerta ancha, con un poste a cada lado y el dintel de lado a lado. Esto vale también para las empalizadas de las plazas.
- **El suelo de dentro** está despejado y pisado: leña, heno, algún horno y algún árbol que se dejó; ni huertos, ni patios, ni rediles. Fuera,
  el campo de siempre.
- **Clic**: elige la pieza y abre la pestaña de lo que se hace en ella (la taberna, la Taberna; el mercado y los puestos, el Mercado; el
  barracón, la plaza de armas y las caballerizas, la Tropa). Al pasar por encima, su nombre. Un clic en el minimapa lleva la vista ahí.
- **Sin WebGL**: la planta en SVG se queda en grande, como antes.

## Pueblos extractores y aldeas

Desde 0.101.0, dentro de un pueblo (cantera o mina) o de una aldea agrícola, el centro de la pantalla es la misma vista 3D, con la planta en
SVG como minimapa (`pueblo.ts`, `ui/planoPueblo.ts`). La planta la manda el motor solo a quien está dentro, sea de su Facción o ajeno
(`Pueblo.planta`, `trazado` y `nivel_madre`, motor 61366539; `EscenaPueblo` en el cliente): el ancla, las casas, el almacén, el corral del buey
y, en la aldea, sus granjas y corrales, cada uno con su centro y sus lados, más las calles y los caminos.

- **El estilo es el de la plaza madre, hasta el 3**: madera y paja en el nivel 1, piedra y paja en el 2, adobe con terrado en el 3 y
  siguientes. Cada pieza va en su huella exacta.
- **El ancla de una mina es su bocamina** (`bocamina` en `modelos.ts`): un cerrillo de peñas medio hundidas, el frente cortado con la entrada
  apuntalada (dos postes, el dintel y, desde el estilo 2, su tejadillo) y la senda que sale de ella; delante, la escombrera, el mineral en un
  montón y en cestos, el yunque de piedra y los puntales de repuesto. La roca, la escombrera y las vetas llevan el color de su metal: ocre y
  oro (oro), gris y verde (cobre), oscuro y negro (estaño), pardo y rojizo (hierro).
- **El ancla de una cantera** (`cantera`): un crestón de peñas con el frente cortado en dos gradas de piedra clara recién sacada; delante, el
  suelo de polvo de piedra, los bloques sacados (uno sobre su rastra), los cascotes y la palanca. Desde el estilo 3, una caseta de adobe.
- **Clic**: elige la pieza; al pasar por encima, su nombre. Un clic en el minimapa lleva la vista ahí. Si lo están atacando, una franja roja
  arriba lo dice.
- **Sin planta** (fuera de él, o un motor anterior) **o sin WebGL**: el anillo de huecos de siempre.

## Avanzadas (atalaya, fuerte y ciudadela)

Desde 0.174.0 se entra en una avanzada como en un pueblo (`entrarEnAvanzada`) y el centro de la pantalla es la misma vista 3D. El motor no
manda planta de una avanzada: el recinto y lo de dentro salen de su etapa (`ciudad3d/avanzada.ts`), iguales en todas las de la misma etapa,
con la planta en SVG como minimapa (`svgPlanoAvanzada`).

- **Atalaya**: empalizada cuadrada de 6 × 6 celdas con torres de madera en las esquinas, la torre de vigía en medio (`torreVigia` en
  `modelos.ts`: cuatro pies arriostrados, la plataforma con baranda, tejadillo de paja, la escala y el fuego), un pozo y la leñera.
- **Fuerte**: muro de adobe de 10 × 10 celdas; la torre del homenaje (`torreHomenaje`: adobe sobre zócalo de piedra, almenas y bandera), el
  barracón, el almacén, la leñera y el pozo.
- **Ciudadela**: muro ciclópeo redondo de radio 9 celdas con torres; la torre del homenaje de piedra en su patio cercado, el barracón, el
  almacén, el granero, el patio de armas y el pozo.
- **En ruinas**: los edificios son escombro y la muralla queda en pie solo en parte.
- La calle va de la puerta (abajo, dos celdas) a la torre, y el camino sale de la puerta hacia fuera. Sin WebGL, la planta en 2D.
- Banco: `pruebas/avanzadas/` (`?etapa=1|2|3`, `&ruinas=1`, `&parte=…`). Prueba: nada pisa la muralla ni la calle (`pruebas/avanzadas.test.ts`).

## Manejo

- **Ratón**:
  - arrastrar con el botón izquierdo desplaza;
  - con el derecho, o con Mayúsculas, gira e inclina;
  - la rueda acerca y aleja.
- **Teclado**: WASD o las flechas desplazan, Q/E giran, R/F inclinan y + y − acercan.
- **Táctil**: con dos dedos, pellizco.
- **Clic en un edificio**: lo elige, igual que antes en el 2D (la ficha de la izquierda y el resalte dorado; los demás de su tipo, en tenue).
  Al pasar por encima, el mismo tooltip de siempre. El Barracón, la Galería de tiro y las Caballerizas abren además Reclutamiento, y la
  Taberna y el Mercado, la suya (0.98.0).
- **Clic en la muralla** (desde 0.99.0): un muro o una torre abren la ventana Defensa en Muralla, y la puerta, en Puerta (en una plaza ajena
  no se abre, como desde el riel). Al pasar por encima, un tooltip con lo que es y su nivel, o «Sin levantar todavía».
- **Elegir en la lista de edificios** (en la ventana Construcción, desde 0.98.0): la ventana se cierra y la cámara va a él.
- **Minimapa** (el 2D): dibuja en dorado lo que abarca la cámara. Un clic en él lleva la vista ahí (en el minimapa, el clic ya no elige).
- **Al entrar**: la cámara encuadra lo construido (el 90 % de los edificios más cercanos y la muralla), no el radio entero de la plaza.
- **Sin WebGL**: queda el 2D de siempre a pantalla entera, entre la barra y el almacén.

## Banco de pruebas

`npm run ciudad3d` abre `pruebas/ciudad3d/` sin servidor ni cuenta.

- **Ciudades**: tres ciudades reales del motor (`pruebas/ciudad3d/ciudades/*.bin`, la proyección del interior en binario), una aldea de
  nivel 1, un pueblo de nivel 3 con empalizada y una ciudad de nivel 5 con muralla que se está mejorando a ciclópea. Se sacan con una prueba
  local del motor que funda una plaza, la deja crecer días con recursos de sobra y vuelca `proyeccion::interior::asentamiento`.
- **Mandos**: cambian lo que se dibuja sin tocar el trazado:
  - el estilo y el nivel de la muralla;
  - el avance de las obras;
  - la plaza vista como ajena, saqueada o subiendo de nivel.
- **Campamentos**: tres campamentos de mercenarios del motor (`ciudades/campamento-*.bin`, el `pb.CampamentoMercenarios` que llega estando
  dentro, con su planta), con la planta en SVG de minimapa.
- **Pueblos**: la cantera, una mina de cada metal y una aldea de cada nivel (`pueblos/*.json`, la salida de `urbanismo::planta_de_pueblo`
  del motor), con el estilo del mando «Estilo» como nivel de la madre (2 si no se elige).
- **Albergue de caravanas** (desde 0.128.0): el muestrario «Albergue de caravanas: estilos × niveles» del mando «Plaza» pone los quince,
  estilo del 1 al 5 de izquierda a derecha y nivel del 1 al 3 de arriba abajo, cada uno con su calle delante; y el mando «Albergue» pone
  uno del nivel elegido en la aldea, el pueblo o la ciudad (las del motor no lo tienen): en el hueco libre de 2 × 3 celdas con calle a un
  lado largo más cerca del Mercado, dentro de la muralla si cabe.
- **Tanda 69** (desde 0.189.0):
  - «Talleres de la comida y estatua: tipos × estilos» pone, de arriba abajo, el molino, el molino con buey, el horno, la quesera, la
    bodega, la prensa y la estatua, del estilo 1 al 5.
  - «Muralla con puertas rectas» es un anillo cuadrado con las puertas de la `LAYOUT_VERSION` 7 (una de una celda al sur y otra de dos al
    norte, con dos celdas de muro recto a cada lado), del nivel del mando «Muralla».
  - El mando «Cultivo» hace de vid o de olivo las aldeas, sin más corral que el del buey.
- `window.banco.mirar({ x, y, distancia, giro, inclinacion })` mueve la cámara para las capturas, y `window.banco.huella(id)` dice dónde
  está un edificio.
- La dirección pone los mandos al abrir: `?plaza=muestra-comida`, `?plaza=muestra-muralla&muralla=3` o
  `?plaza=pueblos/aldea-3&estilo=3&cultivo=vid`. Así las capturas abren directamente una escena ligera; la ciudad de nivel 5 es demasiado para
  el Chromium sin GPU de la nube.

## Rendimiento

- **Piezas**: una ciudad de nivel 5 con 244 edificios son unas 8.000 piezas de edificios, 1.700 de muralla y 17.500 de relleno.
- **Dibujo**: van en una malla instanciada por forma (una docena de llamadas de dibujo).
- **Cuándo se rehace**: solo lo que cambia (edificios, muralla, relleno, suelo y calles, cada uno con su clave). Las obras se rehacen a
  saltos del 5 % de avance.
- **Coste**: en el Chromium sin GPU de la nube, 10-30 ms por fotograma y unos 70 ms para montar la ciudad entera, más medio segundo para
  pintar las teselas de las calles (una vez por ciudad, o al cambiar la red o el nivel).
