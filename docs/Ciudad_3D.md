# Plaza 3D

La vista de la plaza (la tuya, o la de otra Facción en la que estás dentro) pasa de la vista de trazado en 2D a una escena 3D con three.js. El 2D
de siempre no se va: queda de minimapa en la esquina de abajo a la derecha. No hay modelos de fuera: todo se monta en código con unas pocas
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
  - Variedad: cada edificio tiene una semilla (de su id) que decide sus variaciones (orientación de la puerta, plantas, patio, pérgola,
    tono...), siempre las mismas para el mismo edificio.
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
- **Suelo** (`suelo.ts`): una textura pintada una vez, con:
  - el color del terreno del mapa donde está la plaza;
  - la tierra pisada alrededor de lo poblado;
  - las calles de tierra con rodadas, enlosadas desde el nivel 4;
  - los caminos y la tierra apisonada bajo cada edificio;
  - los surcos de las granjas, el césped de los parques y las losas de plazas y mercados.

## Manejo

- **Ratón**:
  - arrastrar con el botón izquierdo desplaza;
  - con el derecho, o con Mayúsculas, gira e inclina;
  - la rueda acerca y aleja.
- **Teclado**: WASD o las flechas desplazan, Q/E giran, R/F inclinan y + y − acercan.
- **Táctil**: con dos dedos, pellizco.
- **Clic en un edificio**: lo elige, igual que antes en el 2D (la ficha de la izquierda y el resalte dorado; los demás de su tipo, en tenue).
  Al pasar por encima, el mismo tooltip de siempre.
- **Elegir en la lista de edificios**: la cámara va a él.
- **Minimapa** (el 2D): dibuja en dorado lo que abarca la cámara. Un clic en él lleva la vista ahí (en el minimapa, el clic ya no elige).
- **Al entrar**: la cámara encuadra lo construido (el 90 % de los edificios más cercanos y la muralla), no el radio entero de la plaza.
- **Sin WebGL**: queda el 2D de siempre a pantalla entera.

## Banco de pruebas

`npm run ciudad3d` abre `pruebas/ciudad3d/` sin servidor ni cuenta.

- **Ciudades**: tres ciudades reales del motor (`pruebas/ciudad3d/ciudades/*.bin`, la proyección del interior en binario), una aldea de
  nivel 1, un pueblo de nivel 3 con empalizada y una ciudad de nivel 5 con muralla que se está mejorando a ciclópea. Se sacan con una prueba
  local del motor que funda una plaza, la deja crecer días con recursos de sobra y vuelca `proyeccion::interior::asentamiento`.
- **Mandos**: cambian lo que se dibuja sin tocar el trazado:
  - el estilo y el nivel de la muralla;
  - el avance de las obras;
  - la plaza vista como ajena, saqueada o subiendo de nivel.
- `window.banco.mirar({ x, y, distancia, giro, inclinacion })` mueve la cámara para las capturas.

## Rendimiento

- **Piezas**: una ciudad de nivel 5 con 244 edificios son unas 8.000 piezas de edificios, 1.700 de muralla y 17.500 de relleno.
- **Dibujo**: van en una malla instanciada por forma (una docena de llamadas de dibujo).
- **Cuándo se rehace**: solo lo que cambia (edificios, muralla, relleno, suelo, cada uno con su clave). Las obras se rehacen a saltos del 5 %
  de avance.
- **Coste**: en el Chromium sin GPU de la nube, 10-30 ms por fotograma y unos 70 ms para montar la ciudad entera.
