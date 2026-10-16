# PianoTeacher — Diseño

Fecha: 2026-10-16

## Objetivo

App web para personas a quienes les cuesta leer partitura. Muestra la partitura y un piano en pantalla que ilumina las teclas de cada nota en el momento en que suena (estilo Synthesia, Simply Piano, Flowkey). Uso personal, sin cuentas ni backend. Todo corre en el navegador.

Éxito: al cargar `Pokemon HGSS OST - National Park.pdf`, la app extrae las notas correctamente, las reproduce y las ilumina en el teclado de forma sincronizada con un cursor sobre la partitura.

## Hallazgo clave

El PDF de prueba es vectorial (exportado desde Sibelius, 4 páginas). Las cabezas de nota son glifos de la fuente Opus con coordenadas exactas, y las líneas del pentagrama son trazos vectoriales. Por eso las notas se pueden leer de forma determinista, sin OMR. No funciona con escaneos o fotos (fuera de alcance).

## Enfoque elegido

Parser vectorial en el navegador con pdf.js (glifos + trazos → modelo de notas). Descartado por ahora: OMR externo (Audiveris) e importación de MusicXML/MIDI (posible v2).

## Stack

Vite + React + TypeScript. pdf.js para lectura y renderizado del PDF. Web Audio para un sintetizador de piano simple. Vitest para pruebas. UI en español latino neutro (esMX).

## Módulos

### `score-parser/`
Entrada: PDF. Salida: `Note[]` con `{ midi, startBeat, durationBeats, hand, page, x, y }`, más metadatos (tempo, compás, armadura).

Pasos:
1. Extraer glifos (fuente, carácter, x, y) y trazos de cada página.
2. Detectar pentagramas por grupos de 5 líneas horizontales; agrupar de a dos (derecha/izquierda) por la llave.
3. Leer la clave (sol/fa) y la armadura.
4. Convertir la posición vertical de cada cabeza de nota en nota diatónica, y aplicar armadura y alteraciones del compás.
5. Deducir la duración desde el glifo, la plica, las barras/corchetes y los puntillos.
6. Dividir en compases por las barras de compás y alinear ambas manos por posición horizontal.
7. Leer tempo (p. ej. negra = N) y compás desde el texto.
8. Validar: los beats de cada compás deben sumar lo que indica el compás; si no, emitir una advertencia para ese compás.

### `playback/`
Reloj de reproducción: play, pausa, velocidad, salto de compás. Genera el sonido y emite las notas activas.

### `ui/PianoKeyboard`
Teclado de 88 teclas. Ilumina las teclas activas con un color por mano. Muestra el nombre de la nota, con alternancia entre letras (C D E) y solfeo (Do Re Mi).

### `ui/ScoreView`
Página del PDF renderizada, con cursor y resaltado de la nota actual.

## Flujo

Subir PDF → parsear → vista previa con las notas detectadas y advertencias → reproducir y ver el teclado iluminarse.

## Manejo de errores

Si un compás no cuadra, se muestra una advertencia y no se inventan notas. Un PDF sin pentagramas detectables muestra un mensaje claro ("este PDF no parece una partitura vectorial").

## Pruebas

TDD sobre `score-parser` usando el PDF de National Park como fixture: se verifican a mano los primeros compases (pitch y duración) y que los beats de cada compás coincidan con el compás. Pruebas unitarias del mapeo posición→nota y del reloj de reproducción.

## Fuera de alcance (v1)

Escaneos/OMR, MusicXML/MIDI, modo "esperar mi tecla", cuentas, backend, ligaduras de expresión y ornamentos complejos. Repeticiones y tresillos: mejor esfuerzo, con advertencia si fallan.

## Riesgos

Ligaduras de prolongación, tresillos, repeticiones y ritmos poco comunes pueden interpretarse mal. El PDF de prueba se revisará compás por compás.
