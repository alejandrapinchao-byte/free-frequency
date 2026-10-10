# Free Frequency

Experiencia web educativa sobre alternativas de comunicación cuando la conectividad falla. HTML + CSS + JS; el menú 3D usa Three.js (copia local, ver abajo).
Fuentes: Fraunces y DM Sans (Google Fonts, con alternativa del sistema).

## Cómo probarla
```bash
npm run dev
```
Abre la dirección que muestre la terminal (por defecto http://localhost:5190; si está ocupado usa el siguiente puerto libre).
Se recomienda usar el servidor: abrir `index.html` con doble clic puede funcionar, pero no está verificado.

## Estructura
- **Portada** → **Menú principal 3D** → **Recorrido de la alternativa** (secuencia visual + cuadro educativo) → **Preparación**.
- El menú principal tiene exactamente tres objetos 3D sobre una plataforma central: **teléfono celular**, **radio portátil AM/FM** y **linterna**. No hay walkie-talkie ni otras alternativas.
- **Secuencia obligatoria** (`js/sequence.js`, motor común; `js/seq-modules.js`, un módulo por alternativa). Siempre en este orden:
  1. **Objeto protagonista**: el modelo 3D solo, centrado y girando, sin personaje.
  2. **Primer plano de las manos** usándolo (demostración animada propia de cada alternativa).
  3. **Personaje completo** usándolo (el mismo objeto, mezclado sin cortes; Mateo en zona rural, Valeria en zona urbana).
  4. **Cuadro educativo**: cómo ayuda, cómo usarlo en el contexto elegido, qué conexión necesita (si aplica), condiciones y límites, y los controles interactivos.
  - Contexto: el cuadro tiene un selector «Zona rural · Mateo» / «Zona urbana · Valeria». Cambiarlo repite el acercamiento con el otro personaje y muestra la explicación de uso de ese contexto.
  - Teléfono (4 temas, con chips en el cuadro): Mensajes SMS (las manos escriben un SMS en el teclado simulado), Llamadas breves, Búsqueda de cobertura y Modo avión (el pulgar activa el interruptor de la pantalla; el cuadro tiene un interruptor que cambia la pantalla).
  - Radio: una mano sostiene la radio y la otra gira las perillas (enciende y recorre el dial); el cuadro incluye el sintonizador interactivo (`js/tuner.js`), ilustrativo, sin audio ni frecuencias reales.
  - Linterna: el pulgar pulsa el interruptor y la luz ilumina el entorno oscuro y sus obstáculos; el cuadro y el interruptor sobre el modelo encienden y apagan la luz.
  - Control del usuario: la primera vez se ve la secuencia completa; al volver se muestra directo el plano completo con el cuadro. «Repetir el acercamiento» repite la etapa 2, «Repetir secuencia» o los pasos de la barra de progreso permiten volver a cualquier etapa, «Saltar introducción» va al cuadro. Nada cambia de pantalla por sí solo: solo «Finalizar recorrido» muestra la despedida con regreso al menú.
  - Con «reducir movimiento» no hay transiciones: los cuatro pasos son planos fijos que se eligen con la barra de progreso. Sin WebGL se muestra una versión plana con el mismo cuadro y controles (sin acercamiento).
- Contenido (textos, temas, contextos) y fuentes revisadas: `js/data.js`.
- `js/hub.js`: menú 3D y modelos del teléfono, la radio y la linterna (geometría de Three.js, material "toon"; sin archivos de modelo externos), que la secuencia reutiliza. Sin WebGL muestra una versión plana con las mismas acciones.
- `js/app.js`: estado, rutas y transiciones. `js/components.js`: sección final. `js/tuner.js`: sintonizador. `css/styles.css`: estilos.

## Dependencia
`assets/vendor/three.min.js`: Three.js r149 (MIT, ver `assets/vendor/three.LICENSE.txt`), script clásico sin build.

## Interacción del menú
Hay un único cuadro informativo (texto HTML real, accesible) que muestra el nombre y la explicación del objeto. Seleccionar nunca navega: el recorrido empieza solo con el botón **«Comenzar recorrido»** del cuadro.
- **Ratón:** pasar el cursor muestra una vista previa (el objeto se ilumina y hace una animación breve); la vista previa se queda ~1,3 s tras quitar el cursor, y no se oculta si el cursor está sobre el cuadro. Un clic selecciona: el objeto queda resaltado y el cuadro permanece visible hasta elegir otro, pulsar el fondo o Escape.
- **Táctil:** un toque selecciona el objeto y muestra su cuadro; tocar otro lo actualiza. Un toque en el botón del cuadro abre el recorrido (los toques en los primeros 350 ms tras cambiar de objeto se ignoran para evitar errores).
- **Teclado:** Tab enfoca cada objeto (vista previa), Enter lo selecciona, el siguiente Tab llega al botón «Comenzar recorrido», Escape quita la selección.
- Un arrastre del puntero de más de 10 px no cuenta como selección.
- Textos del menú: `FF.menu` en `js/data.js`.

## Recursos provisionales (reemplazables con el mismo nombre)
- Escenas por capas 3:2: `assets/scenes/{cauca,cali}-{back,front}.svg`. La escena de fondo depende del contexto elegido: Cauca (zona rural) o Cali (zona urbana).
- Iconos de las fichas: `assets/objects/*.svg`.
- Personajes: `assets/characters/cauca.png` (Mateo) y `cali.png` (Valeria); originales en `*-original.png`.

## Personajes y límites reales
- El personaje completo es la ilustración de referencia (imagen plana sobre un plano 3D): no tiene esqueleto, parpadeo ni mirada; se mueve el cuerpo entero (respiración, balanceo al explicar).
- Las manos y los antebrazos del primer plano son geometría 3D sencilla y estilizada (palma, dedos, pulgar elástico, manga de cuadros o manga floral con brazalete según el contexto). En el plano completo se ve la mano que sostiene el objeto a la altura de la muñeca de la ilustración; en el teléfono y la radio no se simula un brazo alzado ni llevarse el teléfono al oído.
- La luz de la linterna es un foco sencillo sin sombras.

## Rutas
`#inicio`, `#selector` (menú principal), `#telefono`, `#radio`, `#linterna`, `#preparacion`.

## Contenido
Los textos son educativos y no reemplazan las indicaciones de las autoridades. Revisados con MinTIC, CRC, UNGRD y Cruz Roja Colombiana (detalle en la cabecera de `js/data.js`). No se citan frecuencias, alcances de radios ni garantías de conectividad. La radio se presenta siempre como receptora: no transmite.
