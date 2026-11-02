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
- **Lienzo del mapa** (`.mapa-lienzo`, `.asent-lienzo`) — marco `--placa` + `inset` oscuro (viñeta),
  esquinas casi rectas. El canvas lo llena al 100 %.

## 5. Estructura de pantalla

- **Fondo**: siempre `position: fixed; inset: 0`, warm-dark con viñeta radial. El mapa a pantalla
  completa (mundo y plaza en 3D) o centrado (campamento y pueblo).
- **Chrome flotante**: riel de iconos en un borde, menú de esquina (avatar) arriba-derecha, zoom
  abajo-derecha, paneles que se despliegan junto a su disparador.
- **Avisos y elecciones, arriba al centro**: bajo la barra salen los avisos (`.aviso-global`) y, en el mundo y en el modo
  mapa, la lista de qué hay bajo un clic cuando son dos o más cosas (`.eleccion-clic`, 0.93.0): una placa de bronce con una
  fila por cosa (símbolo en un medallón, qué es y un detalle). Mientras está abierta, el aviso que hubiera espera debajo.
- **Vista de la plaza** (`.plaza-3d`, 0.92.0, petición de Víctor del 2026-11-02): la plaza en 3D (`docs/Ciudad_3D.md`) a
  pantalla completa, también bajo la barra del jugador, que es transparente y de iconos como en el mundo. Encima, como el HUD
  de un juego de estrategia:
  - arriba a la izquierda, en columna: el blasón (`.asent-blason`: escudo completo de la Facción dueña con el medallón del
    nivel prendido en su esquina, el nombre de la ciudad y la Facción); mientras la plaza sube de nivel, colgando de él, la
    placa de la subida (`.asent-ascenso-hud`, 0.95.0: «Subiendo a nivel N», el porcentaje, la barra y lo que falta, que
    avanza cada segundo); el minimapa 2D (`.asent-minimapa`), la ficha del edificio elegido y el rastreador de misiones; los
    clics fuera de las cajas pasan a la escena;
  - arriba a la derecha, bajo la barra: «Ejércitos» (su panel se abre debajo) y «Salir al mundo»;
  - abajo al centro: el almacén (`.asent-recursos`) flotando;
  - en la barra, el primero por la derecha: el botón «Asentamiento» (`.jugador-boton-asent`, en oro y con su nombre), que abre
    la ventana «Asentamiento» (`.asent-ventana`) a pantalla completa bajo la barra, con el aire de la de Facción: en el lateral,
    el escudo grande, el nombre, la Facción y el nivel, y debajo las pestañas de los edificios en vertical con su icono; a la
    derecha, el contenido (lo que antes iba en la columna derecha). Se cierra con ✕, Esc, el mismo botón o un clic fuera.
  - El campamento y el pueblo siguen con barra superior en flujo, columna izquierda, mapa centrado y columna derecha.
- **Login / Facción**: tarjeta central (`.login-card`) sobre el fondo, como un menú de campaña.
- Bajo ~820 px la columna lateral se oculta y el mapa ocupa todo. En la plaza en 3D, bajo 900 px, la columna de la
  izquierda se estrecha, «Asentamiento» queda en icono y la ventana pasa a una sola columna (lateral arriba, pestañas en fila).

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
