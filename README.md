# PianoTeacher

App web para aprender a leer partituras de piano. Subes una partitura en PDF y ves cómo se iluminan las teclas de un piano en pantalla en el momento de cada nota (estilo Synthesia / Simply Piano), con un marcador sobre la partitura.

- Azul = mano derecha, naranja = mano izquierda.
- Nombres de nota en Do Re Mi o C D E, con la escritura de la partitura (con armadura de bemoles se lee Sol♭, no Fa♯). Se pueden mostrar sobre la partitura (botón «Notas en partitura»: mano derecha arriba de la nota, izquierda abajo) y siempre en la tecla que suena.
- Velocidad ajustable, salto de compás, repeticiones y casillas 1. / 2., y sonido de piano sintetizado.
- Al pausar quedan iluminadas las teclas y marcadas las notas que sonaban.
- Todo corre en el navegador. No hay backend.

## Versión exclusiva para el iPad Air del autor

Este proyecto está hecho a medida para **el iPad Air del autor**, usado **en horizontal (1180 × 820)** y con un sistema muy antiguo: **iPadOS 12 / Safari 12.1**. No es un diseño genérico para tablets: cada decisión de la interfaz y del código está pensada para ese equipo.

#### Interfaz pensada para ese iPad

- Pantalla completa sin scroll de página: barra y controles arriba, partitura en el centro, teclado siempre al pie.
- La partitura se ajusta al ancho de la pantalla y se desplaza sola para seguir la nota actual.
- Controles táctiles de 44 px o más; texto de 16 px en los campos para que Safari no haga zoom; botones ‹ › para cambiar de compás sin abrir el teclado en pantalla.
- Respeta la barra de estado y los bordes de iOS. En Safari, **Compartir → Añadir a pantalla de inicio** la abre a pantalla completa, sin barra del navegador.

#### Compatibilidad con Safari 12 (lo que costó que funcione ahí)

- El código se compila a ES2019 y trae polyfills (`core-js`): ese Safari no tiene `Promise.withResolvers`, `structuredClone`, `Array.at`, `ResizeObserver`, etc.
- pdf.js corre en el hilo principal, sin Web Worker, porque el archivo del worker no se puede traducir por separado (traía `?.`, que ese Safari no entiende).
- pdf.js y el lector de partituras se descargan al abrir una partitura (carga perezosa): el paquete inicial pesa unos 460 KB, así la pantalla aparece enseguida en un equipo lento.
- Sin `AudioContext` usa `webkitAudioContext`; sin `dvh`/`clamp()`/`gap` en flexbox hay alternativas en el CSS.
- Safari guarda copias agresivamente, así que el servidor envía `Cache-Control: no-cache`.
- Si algo falla al iniciar, aparece un recuadro rojo con el error y la versión del navegador (se cierra tocándolo, y se retira solo si la app arranca tarde).

En un PC o un iPad moderno también funciona; simplemente no es el objetivo del diseño.

### Usarla en el iPad (misma red Wi‑Fi)

```bash
npm install
npm run build
npm run preview        # sirve en http://IP-DEL-PC:4173
```

En el iPad abre `http://IP-DEL-PC:4173` en Safari (la IP del PC se ve con `ipconfig`). Si Windows pregunta por el firewall, permite el acceso en redes privadas. Si Safari no muestra la versión nueva, borra la caché (Ajustes → Safari) o agrega `?v=2` a la dirección.

`npm run dev` también queda visible en la red (`:5173`), pero para el iPad conviene la versión compilada (`preview`).

## Cómo funciona

No usa OCR. En un PDF *vectorial* de partitura (exportado desde Sibelius) las notas son glifos de una fuente musical con coordenadas exactas. `src/score-parser/` lee esos glifos y trazos con pdf.js y detecta:

- pentagramas, sistemas, barras de compás, claves (incluidos cambios a mitad de compás) y armadura (también sus cambios y becuadros de cancelación);
- alteraciones locales (bemol, doble bemol, becuadro, sostenido) con la regla del compás;
- duraciones por barras, corchetes y puntillos; tresillos, quintillos, decillos y otros grupos irregulares;
- varias voces en una mano (plicas arriba y abajo) con silencios ocultos, y vigas que cruzan entre ambas manos;
- cifra de compás y anacrusa, 8va y 8vb, apoyaturas, ligaduras de prolongación;
- tempo, repeticiones y casillas 1. / 2. (se desenrollan al reproducir).

Si un compás no suma lo que pide la cifra de compás, la app lo avisa («avisos de lectura», botón ⚠) y deja saltar a él. No funciona con escaneos ni fotos.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas (usan tests/fixtures/national-park.pdf)
npm run lint
npm run build
```

Estructura: `src/score-parser/` (PDF → notas), `src/playback/` (reloj y audio), `src/ui/` (teclado, partitura, rótulos), `src/App.tsx`. Los documentos de diseño están en `docs/superpowers/`.

## Partitura de ejemplo

`National Park` (Pokémon HG/SS OST), arreglo de LotusFlower, se incluye solo como archivo de prueba (`tests/fixtures/` y `public/`). La partitura pertenece a su autor y a los dueños de la música original; si vas a reutilizar el repositorio, reemplázala por una tuya.

## Limitaciones conocidas

- Solo se leen PDFs con la fuente musical **Opus** (Sibelius). Otras fuentes (MuseScore, Dorico, Finale) usan otros códigos de glifo y necesitan su propia tabla en `src/score-parser/glyphs.ts`; sin ella la app responde «No encontré notas…».
- Una sola cifra de compás por pieza (la primera) y un solo tempo.
- Un pentagrama suelto (una sola línea de melodía) se ignora; se esperan sistemas de piano de dos pentagramas.
- Las notas escritas entre ambos pentagramas con muchas líneas adicionales pueden asignarse a la mano contraria.
- 15ma y otras octavaciones distintas de 8va/8vb no se interpretan.
- Los nombres sobre la partitura se amontonan un poco en pasajes muy rápidos o con acordes grandes.
