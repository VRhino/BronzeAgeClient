# Guía de interfaz — "bronce y arcilla"

Sistema visual del **cliente-jugador** (pantallas nuevas: login, facción, mapa, asentamiento).
Léelo antes de diseñar o maquetar cualquier pantalla nueva. La interfaz anterior vive en `#/legacy`
y **no** sigue esta guía — no la toques.

## Índice

1. [Dirección](#1-dirección)
2. [Referencias](#2-referencias)
3. [Tokens](#3-tokens)
4. [Componentes](#4-componentes)
5. [Estructura de pantalla](#5-estructura-de-pantalla)
6. [Reglas al añadir UI](#6-reglas-al-añadir-ui)
7. [Dónde vive en el código](#7-dónde-vive-en-el-código)

---

## 1. Dirección

**Juego de estrategia de la Edad de Bronce.** Placas de bronce, tablillas, oro pulido, terracota;
nada de "glassmorphism" azul ni neón. Warm-dark: negros cálidos (`#0c0a08`) en vez de azul marino.
El mapa es el héroe; la UI es un marco de bronce a su alrededor, con profundidad (sombras, filetes,
biseles) pero sin ruido.

Tono: sobrio, "arqueológico". Titulares en versales serif (como una inscripción). Datos en sans,
legibles. El oro es para lo importante (acción principal, valores destacados), el bronce para el
chasis, la terracota para avisos.

## 2. Referencias

- **Total War: Rome** — HUD de mármol + bronce, cornisas, serif imperial, minimapa enmarcado en
  bronce. → [Total War Wiki — User interface](https://totalwar.fandom.com/wiki/User_interface)
- **Total War Saga: Troya** — la referencia más cercana en tema (Egeo micénico, Edad de Bronce).
  Barra de recursos arriba con icono + reserva + renta por recurso; paleta bronce/terracota,
  motivos geométricos egeos. Es el modelo de la tira de recursos del asentamiento.
  → [Total War Wiki — A Total War Saga: Troy](https://totalwar.fandom.com/wiki/A_Total_War_Saga:_Troy)
- **Nebuchadnezzar / Pharaoh / Zeus** (Impressions city-builders) — paneles de piedra, recursos
  sobredimensionados y legibles de un vistazo, iconografía clara.
  → [PC Gamer — Nebuchadnezzar](https://www.pcgamer.com/nebuchadnezzar-channels-classic-city-builders-like-pharaoh-and-zeus/)
- **Game UI Database** — catálogo de HUDs de estrategia para pescar patrones concretos.
  → [gameuidatabase.com](https://www.gameuidatabase.com/index.php?plat=2)
- **Bronze Age** (Commodore Shawn) — 4X/city-builder de la Edad de Bronce, mismo tema.
  → [itch.io](https://commodoreshawn.itch.io/bronze-age)
- Técnica CSS: marcos ornamentales con **bordes concéntricos** apilados y **elementos de esquina**
  absolutos; 9-slice / `border-image` si algún día hay assets. (No hay assets: todo es CSS.)

## 3. Tokens

Definidos en `:root` de `src/style.css`. Úsalos, no metas hex sueltos.

| Token | Valor | Para |
|---|---|---|
| `--tinta` | `#0b0805` | juntas oscuras, sombras de contacto |
| `--marco-bg` / `--marco-bg-alt` | `#191410` / `#221a12` | fondo de panel (gradiente entre los dos) |
| `--marco-panel` | `#14100c` | fondo de columna lateral |
| `--bronce` / `--bronce-osc` | `#a9793f` / `#6b4a29` | bordes, chasis, hilera de dentículos |
| `--oro` / `--oro-claro` | `#d8b878` / `#f1dcae` | acción principal, valores destacados, titulares |
| `--terracota` | `#bf5233` | avisos, notas de estado ("parado", "en obra") |
| `--pergamino` | `#ede0c4` | texto sobre paneles cálidos |
| `--fuente-titulo` | `'Cinzel', serif` | `h1/h2/h3`, `.faction-kicker`, nombres |
| `--placa` / `--placa-sutil` | `box-shadow` multi-capa | el "marco de placa de bronce" (ver abajo) |
| `--denticulo` | `repeating-linear-gradient` | moldura de dentículo (hilera de dientes de bronce) |

Se conservan los tokens viejos (`--accent-gold`, `--radius-*`, `--transition`, …); los nuevos los
complementan.

### El marco de placa de bronce

`box-shadow: var(--placa)` sobre cualquier caja da: filete claro interior → junta oscura → banda de
bronce → junta exterior → sombra proyectada. Combínalo con `border: 1px solid var(--bronce)`,
`border-radius: 2–3px` (esquinas casi rectas, es metal) y fondo
`linear-gradient(180deg, var(--marco-bg-alt), var(--marco-bg))`.

### Dentículo

`background: var(--denticulo)` en una tira de 2–4 px (un `::after` a `top:6px` o pegado a un borde)
remata cabeceras y paneles con la moldura clásica. `opacity: .5` para que sea sutil.

## 4. Componentes

- **Panel flotante** — `.mapa-panel`, `.mapa-seleccion`, `.mapa-menu`, `.asent-panel`, `.login-card`:
  fondo cálido + `border` bronce + `--placa` + tira de dentículo. Sin `backdrop-filter`.
- **Botón primario** (`.btn-primary`) — placa de oro embosada: gradiente `--oro-claro → --oro →
  #b98f4e`, texto `#201509` en versales `--fuente-titulo`, brillo interior arriba, sombra de canto.
  Hover sube 1 px; active baja 1 px. Uno por pantalla (la acción principal).
- **Botón secundario** (`.btn-secondary` y afines: riel, zoom, menú, pestañas de la barra) — bronce
  oscuro `linear-gradient(#241c14, #17110c)`, borde `--bronce-osc`, texto `--pergamino`. Estado
  `.activo`/`.active`: borde `--oro` + glow interior.
- **Kicker** (`.faction-kicker`) — versal serif, `letter-spacing: .22em`, color `--oro`, con una
  barrita de bronce (`::before`, 14×2 px) delante. Es la etiqueta de sección.
- **Ficha de dato** (`.faction-stats div`, `.asent-nivel`, …) — cajita `--marco-bg-alt` con borde
  `--bronce-osc`, `border-radius: 2px`; label en `--text-muted`, valor en `--oro-claro`.
- **Fila de lista** (`.asent-edif-item`, `.mapa-lista-item`) — fondo cálido translúcido, borde
  `--bronce-osc`; si representa algo con color propio (edificio), muesca de 3 px a la izquierda con
  ese color (`--swatch`). Hover: borde `--bronce` + tinte oro.
- **Tooltip** (`.asent-tooltip`) — panel mini con `--placa-sutil`; título en `--fuente-titulo` +
  `--oro-claro`, cuerpo `--text-secondary`. `pointer-events: none`, sigue al cursor, clamp al viewport.
- **Tira de recursos** (`.asent-recursos`) — chips `icono + cifra` flotando abajo-centro sobre el
  mapa, uno por recurso con `floor(cantidad) >= 1`. Cada chip lleva una **barra de llenado**
  (`--llenado: %` sobre `cantidad / capacidad`) en el borde inferior, y un **tooltip** al pasar el
  cursor (`::after` con `data-nombre` + `data-detalle`, dos líneas). Oro por defecto, terracota al
  90 %+. Icono y nombre salen de `RECURSO_ICONO` / `RECURSO_NOMBRE` (`src/paletas.ts`).
- **Avatar** (`.mapa-avatar`) — moneda: `radial-gradient` oro, borde `#6b4a29`, iniciales en serif.
  Abre el menú de esquina (Refrescar · Ver proyección · Interfaz anterior · Cerrar sesión).
- **Botón de capas** (`.mapa-capas`, 0.109.0) — cuadrado de bronce de 40 px con el icono de tres hojas apiladas, encima del zoom.
  Abre a su izquierda una placa con el kicker «Capas» y una casilla por capa (`accent-color: --oro`); la que tiene leyenda la enseña
  debajo mientras está marcada (rampa con su corte, o muestras redondas de color). Se cierra con Esc o con un clic fuera.
- **Lienzo del mapa** (`.mapa-lienzo`, `.asent-lienzo`) — marco `--placa` + `inset` oscuro (viñeta),
  esquinas casi rectas. El canvas lo llena al 100 %.

## 5. Estructura de pantalla

- **Fondo**: siempre `position: fixed; inset: 0`, warm-dark con viñeta radial. El mapa a pantalla
  completa (mundo y plaza en 3D) o centrado (campamento y pueblo).
- **Chrome flotante**: riel de iconos en un borde, menú de esquina (avatar) arriba-derecha, zoom
  abajo-derecha con el botón de capas encima, paneles que se despliegan junto a su disparador.
- **Avisos y elecciones, arriba al centro**: bajo la barra salen los avisos (`.aviso-global`) y, en el mundo y en el modo
  mapa, la lista de qué hay bajo un clic cuando son dos o más cosas (`.eleccion-clic`, 0.93.0): una placa de bronce con una
  fila por cosa (símbolo en un medallón, qué es y un detalle). Mientras está abierta, el aviso que hubiera espera debajo.
- **Vista de la plaza** (`.plaza-3d`; 0.92.0 la llevó a pantalla completa, 0.98.0 la repartió por los bordes a petición de
  Víctor del 2026-11-02, «se siente demasiado en muy poco espacio»): la plaza en 3D (`docs/Ciudad_3D.md`) a pantalla
  completa, también bajo la barra del jugador, que es transparente y de iconos como en el mundo. Encima, como el HUD de un
  juego de estrategia (piezas en `ui/hudPlaza.ts`):
  - arriba a la izquierda, en columna (`.asent-izq`): el blasón (`.asent-blason`: escudo de la Facción dueña con el medallón
    del nivel prendido en su esquina, el nombre con su lápiz ✎ si resides aquí, que lo cambia ahí mismo, y la Facción, con su
    Rey si es ajena). El medallón abre la ventana «Subir de nivel» y brilla con una ⬆ cuando la plaza ya puede subir. Junto al
    nombre, dos iconos: la casa (resides aquí o no; abre la tarjeta de la residencia, con «Hacerla mi base» o «Dejar») y la
    corona (capital; si eres el Rey, la tarjeta para designarla). Las tarjetas cuelgan del blasón (`.asent-blason-pop`) y se
    recogen con Esc o un clic fuera. Debajo, la placa de la subida en curso (`.asent-ascenso-hud`, 0.95.0), el riel de
    ventanas (`.asent-riel`: Construcción, Gobierno, Defensa, Territorio, Reclutamiento, Taberna y Mercado, iconos con su
    nombre al pasar el ratón; con candado si falta el edificio; Construcción lleva en una insignia las obras en marcha) y las
    obras en marcha (`.obras-hud`, hasta tres con su cuenta atrás y «N más · N en cola»; un clic abre Construcción);
  - al borde derecho (`.asent-der`): el rastreador de misiones y la ficha del edificio elegido;
  - arriba a la derecha, bajo la barra: «Ejércitos» (su panel se abre debajo) y «Salir al mundo»;
  - arriba al centro, si la hay, la ocupación militar en una franja roja (`.asent-ocupacion`);
  - abajo (`.asent-pie`), tres grupos separados por color: **Población** (total frente al techo del nivel y cada clase frente a
    su sitio), **Almacén** (cada recurso con su barra, en rojo al llenarse) y **Estado** (nutrición y mantenimiento en verde,
    ámbar o rojo); el detalle, al pasar el ratón;
  - abajo a la derecha, pegado a los bordes: el minimapa 2D (`.asent-minimapa`);
  - las ventanas (`.asent-ventana`): una sola a la vez, a media pantalla junto al riel, con su título, sus subpestañas si las
    tiene y ✕ (o Esc) para cerrar; Reclutamiento y Mercado son más anchas y «Subir de nivel», estrecha. Un clic en el Barracón,
    la Galería de tiro o las Caballerizas abre Reclutamiento; en la Taberna o el Mercado, la suya. El «?» de la barra del
    jugador abre Información. Las Misiones y el Tablón de la plaza van en el botón «Misiones» de la barra, en dos pestañas;
  - el campamento y el pueblo (0.108.0, petición de Víctor del 2026-11-03) tienen el mismo esqueleto (`.camp-screen.plaza-3d`,
    `.pueblo-screen.plaza-3d`; piezas en `ui/hudInterior.ts`): su vista 3D a pantalla completa; arriba a la izquierda un blasón
    con el icono del sitio en vez del escudo (el campamento: «Tu residencia» o «De paso» y sus residentes; el pueblo: su plaza
    madre y si es de tu Facción); al borde derecho, el rastreador de misiones; abajo, el pie y, debajo, el riel con una ventana
    por parte, que son las pestañas de antes. En el campamento: Resumen, Tropa, Mercado, Mercenarios (solo si alguien se ofrece en
    el tablón), Fondo (si tu Facción no tiene plaza) y Taberna (solo con Facción); Tropa y Mercado se abren en una ventana
    centrada como la de Misiones, y Mercenarios y Taberna a pantalla completa (0.129.0). Su pie lleva tu almacén
    personal (si resides allí) y el carro que llevas (el de tu columna o, dentro de tu residencia, el tuyo), cada uno solo si
    lleva algo. Un clic en una pieza (taberna, mercado, barracón…) abre su parte. En el pueblo: Resumen, Guarnición, Acarreo y
    Carga; su pie es el almacén del pueblo; la franja roja de batalla va arriba al centro (`.pueblo-aviso-batalla`). Esc o ✕
    cierra la ventana. El minimapa es la planta en SVG (`.camp-lienzo`, `.pueblo-mini`); sin planta del motor o sin WebGL, la
    planta del campamento o el anillo de huecos del pueblo (`.pueblo-lienzo`) vuelven en grande al centro (`.sin-3d`).
- **Login / Facción**: tarjeta central (`.login-card`) sobre el fondo, como un menú de campaña.
- **Pantalla de carga** (`.pantalla-carga`, 0.102.0, petición de Víctor del 2026-11-02): al pasar del mundo a una plaza, un
  campamento o un pueblo, al volver y al entrar en la partida. Una imagen a pantalla completa (de la mesa de escalas 3D o de la
  vista 3D de la plaza) con un acercamiento lento; el consejo centrado en el cuarto inferior, con «Consejo» encima en Cinzel oro,
  sobre un fondo opaco en el centro que se aclara hacia las orillas; abajo del todo, lo que se carga y la barra de bronce a oro.
  Los consejos se editan sin recompilar (`public/carga/consejos.json`); detalle en `docs/Pantallas_De_Carga.md`.
- Bajo ~820 px la columna lateral se oculta y el mapa ocupa todo. En la plaza en 3D, por debajo de 1440 px el pie se
  compacta; con poca altura (≤ 820 px) el riel encoge y las obras enseñan tres; bajo 900 px de ancho la columna de la izquierda
  se estrecha y la ventana ocupa todo el ancho.

## 6. Reglas al añadir UI

1. **Reutiliza tokens y componentes.** Si necesitas un panel, que sea un panel (`--placa` + fondo
   cálido). No inventes otro estilo de caja.
2. **Un botón primario por pantalla.** El resto, secundarios.
3. **Titular = `--fuente-titulo`. Dato = Inter.** Nunca serif para cifras densas.
4. **Esquinas casi rectas** (`2–3px`). El metal no tiene `border-radius: 14px`.
5. **`#/legacy` no se toca.** Si reusas un `id`/clase de legacy (p. ej. `#mapa`), acota la regla
   legacy a su contenedor y dale a la pantalla nueva su propio dimensionado.
6. **Sin `backdrop-filter`** en los paneles nuevos (los marcos de bronce son opacos).
7. Colores de estado: `--oro` = bien/destacado, `--terracota` = aviso, rojo (`--danger`) solo para
   destructivo real.
8. Verifica en vivo en login + facción + mapa + asentamiento antes de dar por buena una regla
   compartida — es fácil que un selector agrupado pise el `position` de otro.

## 7. Dónde vive en el código

- **Tokens + bloque de rediseño**: `src/style.css` — `:root` y la sección final
  `/* REDISEÑO ESTILO ESTRATEGIA — "bronce y arcilla" */`.
- **Fuente**: `<link>` de Google Fonts en `index.html` (Cinzel + Inter).
- **Escala de la vista de asentamiento**: `RADIO_MAPA_ASENTAMIENTO` + `proyeccionAsentamiento` en
  `src/render.ts` (fuente única para dibujo y hit-test).
- **Estructura de las pantallas**: `montarMapa` / `montarAsentamiento` / `montarFaccion` /
  `menuEsquinaHtml` en `src/main.ts`. El panel del héroe, que comparten Mapa y Asentamiento, en
  `src/ui/panelHeroe.ts` (estilos: bloque `PANEL DEL HÉROE` al final de `src/style.css`).
- Pendientes visuales conocidos: `docs/Features_Pendientes.md` §9.
