# Burbuja

> Tu plan financiero, explicado a tu nivel. Una voz te lo cuenta en burbujas que salen una a una y que, al terminar, forman el mapa completo de tu dinero. Después, cada mes, te acompaña: misiones, un resumen que puedes escuchar como un podcast y una reunión para ver cómo te ha ido.

Este documento es la referencia del proyecto. Si una decisión cambia, se cambia aquí primero.
Versión visual para compartir: [`idea-burbuja.pdf`](idea-burbuja.pdf). Todavía no incluye las secciones 7 a 11 ni el cambio a inglés.

---

## Índice

1. [La idea en 30 segundos](#1-la-idea-en-30-segundos)
2. [Por qué](#2-por-qué)
3. [Reglas que no se rompen](#3-reglas-que-no-se-rompen)
4. [El recorrido](#4-el-recorrido)
5. [Zoom = nivel de conocimiento](#5-zoom--nivel-de-conocimiento)
6. [Burbujas y mini apps](#6-burbujas-y-mini-apps)
7. [Chat contextual y «Ask Sherpas»](#7-chat-contextual-y-ask-sherpas)
8. [La letra pequeña: simplificar sin ocultar](#8-la-letra-pequeña-simplificar-sin-ocultar)
9. [Misiones del mes](#9-misiones-del-mes)
10. [Resumen mensual: interactivo o podcast](#10-resumen-mensual-interactivo-o-podcast)
11. [La reunión de fin de mes](#11-la-reunión-de-fin-de-mes)
12. [Voz](#12-voz)
13. [Dirección visual](#13-dirección-visual)
14. [Los días después](#14-los-días-después)
15. [Datos: la subida es el gancho, no el motor](#15-datos-la-subida-es-el-gancho-no-el-motor)
16. [Arquitectura y formatos](#16-arquitectura-y-formatos)
17. [Alcance del MVP y semana](#17-alcance-del-mvp-y-semana)
18. [Qué descartamos](#18-qué-descartamos)
19. [Contra los criterios de evaluación](#19-contra-los-criterios-de-evaluación)
20. [Decisiones abiertas](#20-decisiones-abiertas)

---

## 1. La idea en 30 segundos

1. **Subes tus documentos, o entras directo si Sherpas ya tiene tu Intake.** Los datos se convierten en burbujas: dinero, casa, deudas, protección, hijos, jubilación.
2. **Cada burbuja te habla.** Una voz de ElevenLabs la explica y dentro hay una mini app para tocar y probar.
3. **Todo acaba en una nube.** Es el mapa entero de tu dinero. Entras en él como en un edificio: de la fachada a cada planta y de cada planta a cada mesa.
4. **Puedes preguntar en cualquier momento.** Abajo hay un chat que sabe lo que tienes en pantalla. Si seleccionas un texto, aparece **«Ask Sherpas»**.
5. **Nada importante se esconde.** Lo que debes saber antes de decidir se ve a cualquier nivel de detalle, y antes de actuar comprobamos que lo has entendido.
6. **Cada mes, un ciclo.** Tres misiones que suben tu nota, un resumen interactivo o en modo podcast para el coche, y una reunión de fin de mes para ver cómo te ha ido.

No hay asesor para entender el plan. Diseñamos para familias que nunca verán a uno: el plan tiene que funcionar solo. Para las decisiones de mucho impacto, siempre hay una persona a un toque (sección 8).

## 2. Por qué

Un asesor hace tres trabajos con cada cliente:

| | Trabajo | Hoy |
|---|---|---|
| 1 | Recoger los datos | Lo hace Sherpas (Intake) |
| 2 | Hacer los números | Lo hace Sherpas (Paraplanner) |
| 3 | **Explicar el plan** | A mano, reunión a reunión. **Esto es lo que hacemos nosotros** |

Un plan enviado sin más, aunque sea bueno, es demasiado de golpe: un idioma nuevo, diez segundos para captar la atención y nadie al lado para volver a explicarlo. Burbuja sustituye lo que hacía el asesor:

| El asesor… | Burbuja… |
|---|---|
| Traduce cifras a algo que se entiende | Usa zoom semántico y analogías por nivel |
| Ordena prioridades | Acaba en una nube con un único primer paso |
| Da malas noticias con tacto | Usa una voz con emoción y elige el orden: a Michael no le enseña el 26 primero |
| Resuelve dudas | Ofrece el chat contextual y «Ask Sherpas» |
| Se asegura de que entiendes antes de decidir | Muestra «Debes saber» en cada nivel y una tarjeta de decisión antes de actuar |
| Hace seguimiento | Propone misiones mensuales, un resumen del mes y una reunión de fin de mes |

## 3. Reglas que no se rompen

1. **No inventamos números.** Toda cifra que ve el usuario sale de `cases/<familia>/*.json` o `persona.md`. Si un dato no está, se dice: «eso no está en tu plan».
2. **El modelo elige y explica, nunca calcula.** Elige qué plantilla de mini app usar, con qué datos y en qué orden, y escribe el guion. Las proyecciones y los escenarios son los del plan (`projections`, `top_moves`).
3. **El color va dentro, no en la burbuja.** Las burbujas son de cristal blanco. El color es para las mini apps y para los puntos de estado.
4. **La voz nunca bloquea.** Todo lo que se dice está también escrito en pantalla, y se puede silenciar.
5. **Las claves solo viven en el backend.** La clave de IA del equipo y el token del MCP nunca llegan al navegador.
6. **Un caso perfecto antes que cuatro a medias.** Michael Carter es el caso de la demo.
7. **Toda la app va en inglés.** Los casos son de EE. UU.: voz, interfaz, botones, guiones, chat, mini apps, podcast, reunión, notas de voz y mensajes de error, sin excepciones. Este documento sigue en español para el equipo: las frases de ejemplo están traducidas, y la copia final se escribe en inglés.
8. **Simplificamos el lenguaje, nunca el contenido.** Los hechos importantes («Debes saber») aparecen en todos los niveles de zoom, dichos más fácil pero nunca quitados.
9. **Nada se bloquea.** Ningún nivel, misión ni modo esconde información. El detalle completo siempre está a un toque.
10. **Para cualquier edad.** Cada gesto tiene una alternativa con botón y otra con voz. El modo sencillo está disponible para todo el mundo.

## 4. El recorrido

| Acto | Duración | Qué pasa |
|---|---|---|
| **0. La entrada** | ~10 s | Dos caminos, el mismo final: las burbujas formándose y la voz arrancando: «Vale, Michael. Ya lo tengo. Te lo cuento en tres minutos.» Ver la tabla siguiente. |
| **1. Calibración** | ~20 s | Tres preguntas, por voz o con botones: cuánto te suena un 401(k), si prefieres qué hacer o el porqué, y si quieres cifras exactas o ideas. Eso fija tu nivel de partida. Aquí también se enseña el zoom (sección 5.2) y se ofrece el modo sencillo (5.3). |
| **2. Las burbujas** | ~3 min | Una a una, cada burbuja crece hasta llenar la pantalla. La voz la narra y dentro hay una mini app. Al terminar, se encoge y vuela a la nube. Puedes cortar en cualquier momento por voz o por el chat. |
| **3. La nube** | siempre | Todas las burbujas forman tu mapa. Una brilla: tu primer paso, que se convierte en tu primera misión (sección 9). La nube se guarda y vuelves a ella cuando quieras. |
| **4. Cada mes** | ~5 min | Resumen del mes (interactivo o podcast), reunión de fin de mes y misiones nuevas (secciones 9 a 11). |

### Dos formas de empezar

| Entrada | Cuándo | Qué ve el usuario |
|---|---|---|
| **A. Con documentos** | La familia todavía no tiene datos en Sherpas | Arrastra sus documentos y cada uno se deshace en gotas que se juntan en burbujas |
| **B. Desde el Intake** | Sherpas ya tiene el Intake completo de la familia: el asesor lo cargó o la familia ya pasó por el cuestionario | Se salta la subida. Abre un enlace personal («Tu plan está listo, Michael») y las burbujas emergen directamente de su nombre. Si el Intake trae el perfil de riesgo y el estilo de decisión, la calibración se reduce a una pregunta de confirmación |

- **Una sola pantalla de inicio que decide sola.** Si hay Intake para esa familia, entra por B. Si no, ofrece A.
- **Las dos entradas acaban en el mismo plan** (`financial-health.json` y compañía). A partir del Acto 1 el recorrido es idéntico.
- **La entrada B es el caso realista en producción**: el asesor manda el enlace y la familia nunca tiene que subir nada.
- **En la demo** enseñamos las dos: Michael por A (el gancho visual) y otra familia por B, para que se vea que funciona sin subir nada.

**Orden de las burbujas.** El guion decide el orden por familia. La regla general es empezar por lo que el usuario hace bien, seguir por lo urgente y terminar en el primer paso. Ejemplo con Michael: «Ahorras el 23,9 %, el esfuerzo está» → flujo de caja → colchón → casa contra jubilación → protección → primer paso.

## 5. Zoom = nivel de conocimiento

Un solo gesto sirve para profundizar y para simplificar. Al acercarte no ves más grande, ves **más hondo**.

### 5.1 La metáfora del edificio

Como cuando ves un edificio, haces zoom y acabas viendo cada puesto de trabajo de la empresa: de fuera hacia dentro, y siempre sabes en qué planta estás.

| Planta | Equivale a | Qué ves | Ejemplo: la jubilación de Michael |
|---|---|---|---|
| 4 · La ciudad | Muy lejos | Una frase para toda tu vida financiera | «Ganas bien, pero el dinero va en mal orden.» |
| 3 · El edificio | Nube | Una frase por burbuja | «A los 58 te jubilas, pero el dinero no llega hasta el final.» |
| 2 · La planta | Burbuja | La explicación con su mini app | Línea de tiempo en la que el ahorro se agota a los 85 |
| 1 · La mesa | Dentro | Cifras exactas y métricas, cada una en su «mesa» | Hueco de $1.177.586 a la jubilación, retirada media del 5,6 %, la Seguridad Social cubre el 34 % del gasto |

**Visualmente:** al entrar en una burbuja, su cristal hace de ventana y dentro se ven sus «salas», las burbujas hijas. Al entrar en una sala aparecen las «mesas», las fichas con cada cifra. Es el mismo movimiento que todo el mundo conoce de los mapas (país → ciudad → calle) o de la app de fotos (años → meses → días).

**El zoom se hace en Three.js, con una cámara real.** No es una escala en 2D: la cámara viaja por la escena, se acerca a la burbuja, atraviesa el cristal y se coloca delante de las salas y las mesas, igual que un dron que entra en un edificio por la ventana.
- **Cada planta es una posición de cámara.** El ascensor, el pellizco, la rueda del ratón y la voz mueven la cámara entre esas posiciones. Nunca hay un zoom libre en el que perderse: siempre se acaba en una planta.
- **El movimiento tiene muelle y dura menos de un segundo.** Al llegar, el texto HTML de esa planta aparece con un fundido.
- **El pellizco sigue al dedo**, pero al soltarlo la cámara se ajusta a la planta más cercana, como un carrusel.
- **En el modo sencillo y con `prefers-reduced-motion`** la cámara no viaja: se cambia de planta con un fundido en la vista 2D.

Detalles técnicos en la sección 13.1.

### 5.2 Que se entienda a la primera, con 20 o con 70 años

- **Se aprende haciendo, una vez.** En la calibración, la voz dice «Toca la burbuja para entrar» y una mano fantasma enseña el gesto. El usuario lo hace una vez de verdad antes de empezar. Lo mismo para salir: «Pellizca hacia fuera o pulsa Volver».
- **El ascensor.** En el lateral hay un indicador vertical con las 4 plantas, con su nombre y la planta actual iluminada. Cada planta es un botón: pulsarla te lleva ahí sin gestos.
- **Siempre sabes dónde estás.** Arriba aparece una ruta del tipo «Tu dinero › Jubilación › Cifras» y un botón grande de «‹ Volver».
- **Tres formas de hacer lo mismo:**
  - el gesto (pellizcar, rueda del ratón, tocar);
  - los botones (ascensor, «Más fácil», «Más detalle», «Volver»);
  - la voz o el chat («explícamelo más fácil», «enséñame los números»).
- **Nunca te pierdes.** Si alguien va y vuelve varias veces sin avanzar, la voz ofrece ayuda: «¿Quieres que te lleve yo?».

### 5.3 Modo sencillo (accesibilidad)

Pensado para personas mayores, pero **se ofrece a todo el mundo** en la calibración («¿Prefieres letra más grande y pasos más sencillos?»). Nunca se activa por la edad. También se sugiere solo si alguien tiene dificultades. Se puede activar y desactivar en cualquier momento.

| Modo normal | Modo sencillo |
|---|---|
| Nube libre, navegas como quieras | Recorrido lineal: una burbuja cada vez, con «Siguiente» y «Volver» |
| Pellizcar y gestos | Solo botones grandes; no hace falta ningún gesto |
| Burbujas de cristal translúcido | Fondo blanco sólido con borde oscuro: más contraste, sin transparencias |
| Texto normal | Texto grande (mínimo 18 pt) y zonas táctiles grandes (mínimo 44 px) |
| Voz a velocidad normal | Voz más lenta, con pausas, y subtítulos siempre visibles |
| Animaciones con muelle | Animaciones mínimas (respeta `prefers-reduced-motion`) |
| Escena 3D con cámara que entra en las burbujas | Vista 2D plana, sin movimiento de cámara (sección 13.1) |
| Confirmación normal | Doble confirmación antes de cualquier acción |
| — | **Persona de confianza:** con el permiso del usuario, puede compartir el resumen con un familiar |

Referencia técnica: WCAG 2.2 nivel AA.

### 5.4 Perfiles de partida

La calibración solo decide en qué planta empieza el zoom:

| Perfil | Empieza en | Estilo |
|---|---|---|
| Novato | Edificio (nube) | Frases cortas y analogías |
| Dime qué hacer | Edificio (nube) | Solo acciones |
| Quiero entenderlo | Planta (burbuja) | El porqué, sin jerga |
| Experto | Mesa (dentro) | Cifras completas y métricas |

**El perfil se adapta.** Si alguien abre siempre «Dentro», la próxima vez empieza ahí. Si dice «no entiendo» dos veces, baja un nivel. En pareja, cada persona tiene su nivel: Timothy (Growth) y Melanie (Moderate) ven el mismo plan con distinta profundidad. El perfil inicial se puede sugerir con el apartado D5 (estilo de decisión) del `persona.md`.

## 6. Burbujas y mini apps

Cada burbuja tiene:
- un título y un punto de estado (rojo, ámbar o verde);
- un tamaño según su importancia;
- un guion en 4 niveles;
- una mini app;
- su bloque «Debes saber» (sección 8);
- y las relaciones con otras burbujas, que se ven como líneas en la nube.

### Catálogo

| Mini app | Caso | Qué haces | Dato del plan |
|---|---|---|---|
| Casa o jubilación | Michael | Pones o quitas la casa de 2027 y ves dónde se agota el ahorro | Proyección; se agota a los 85 |
| Tu mes en monedas | Michael | El sueldo cae en cubos (impuestos, alquiler, gastos, deudas) y el último se desborda | Flujo de caja de −$8.336 al año |
| Tanque de oxígeno | Michael | Un depósito con los meses que aguantas sin ingresos | 3,2 meses de 5 a 6 recomendados |
| El score que sube | Todos | Activas cada movimiento recomendado y la nota sube en directo | `top_moves`: de 26 a 62 |
| ¿Adónde va cada dólar? | Weah | Arrastras el efectivo hacia la tarjeta, el colchón o la universidad | $150.000 en efectivo; tarjeta al 18 % |
| Dos personas, un plan | Weah | Cada uno mueve su control de riesgo; la burbuja común se colorea donde coinciden | Perfiles Growth y Moderate |
| La grieta | Samantha | Tocas su 82, la burbuja se agrieta y dentro aparece el problema | El ahorro se agota a los 73 |
| El paraguas | Johnson | Un paraguas sobre la familia que crece con el seguro de vida | $250.000 frente a $1,6 M o más |

### Plantillas

Las mini apps son **6 a 8 plantillas** genéricas. Así sirven para cualquier familia, no solo para estas cuatro:

`timeline` · `split` (reparto) · `tank` (depósito) · `scale` (balanza) · `umbrella` · `score` · `buckets` (monedas) · `crack` (grieta)

El modelo de texto decide qué plantilla usa cada burbuja y con qué campos del JSON la rellena.

## 7. Chat contextual y «Ask Sherpas»

Un chat que **siempre sabe qué tienes delante**. No es un chat genérico sobre el plan, como el que Sherpas ya tiene: forma parte de la experiencia.

### 7.1 La barra de abajo

- Barra de cristal fija abajo, siempre visible, con el texto: «Pregunta lo que quieras sobre esto…».
- Se puede escribir o mantener pulsado el micrófono para hablar.
- Al enviar, la barra se expande hacia arriba en una hoja de cristal con la conversación. **La burbuja actual sigue visible detrás.**
- La narración se pausa mientras preguntas y se retoma al cerrar el chat («¿Sigo?»).
- La respuesta sale escrita y también en voz (`eleven-flash-v2.5`), con el mismo nivel de zoom que el usuario tiene en ese momento.
- La respuesta puede incluir **acciones**, que se muestran como botones bajo el mensaje:
  - «Llévame a la burbuja de la casa» → la app navega hasta esa burbuja.
  - «Explícalo más fácil» → el zoom baja un nivel.
  - «Enséñamelo» → resalta el elemento de la mini app del que se habla.

### 7.2 «Ask Sherpas» al seleccionar texto

- Seleccionas cualquier texto de la explicación (subtítulo de la voz, frase de la burbuja, etiqueta de la mini app) y aparece un pequeño menú de cristal junto a la selección: **«Ask Sherpas»**.
- Al pulsarlo se abre el chat con la cita ya puesta («Sobre: “retirada media del 5,6 %”») y tres preguntas sugeridas:
  - «¿Qué significa?»
  - «¿Es bueno o malo para mí?»
  - «¿Qué puedo hacer?»
- También se puede escribir una pregunta propia.
- En móvil funciona igual con la selección nativa: pulsación larga y luego «Ask Sherpas».

### 7.3 Qué contexto recibe el modelo

Con cada pregunta, el frontend manda al backend el estado de la pantalla. El backend añade el plan completo de la familia, que nunca viaja desde el navegador.

```json
{
  "family": "michael-carter",
  "person": "Michael",
  "profile": "quiero-entenderlo",
  "zoom": "burbuja",
  "easy_mode": false,
  "screen": {
    "bubble_id": "retirement",
    "bubble_title": "Jubilación a los 58",
    "miniapp": { "template": "timeline", "state": { "house_2027": true } },
    "narration_line": "Con la casa en 2027, tu ahorro llega hasta los 85."
  },
  "selection": "retirada media del 5,6 %",
  "history": [ { "role": "user", "text": "..." }, { "role": "assistant", "text": "..." } ],
  "question": "¿Es bueno o malo para mí?"
}
```

### 7.4 Cómo responde

- **Modelo:** `gpt-5-mini` (o `deepseek-flash` para pruebas baratas) a través del proxy.
- **Instrucciones del sistema:**
  - responder **solo con datos del plan**; si algo no está, decirlo y ofrecer lo más cercano;
  - adaptar el lenguaje al `profile`, al `zoom` y al `easy_mode`;
  - como mucho 3 frases, y después ofrecer «¿Quieres más detalle?»;
  - si la pregunta toca un «Debes saber», incluirlo siempre en la respuesta;
  - **no dar recomendaciones nuevas.** Solo explicar las del plan. Si piden algo fuera del plan, o una decisión de mucho impacto, ofrecer hablar con una persona (sección 8.4).
- **Formato de salida:** JSON con `text` y una lista opcional de `actions` (`go_to_bubble`, `zoom_in`, `zoom_out`, `highlight`, `talk_to_human`), para que el frontend pinte los botones.
- **Memoria:** las preguntas se guardan con la burbuja de la que salieron. En la nube, una burbuja con preguntas lleva un pequeño indicador. La reunión de fin de mes las retoma (sección 11).

## 8. La letra pequeña: simplificar sin ocultar

**El riesgo.** Si simplificamos demasiado, la familia puede decidir sin saber del todo qué está haciendo ni por qué. Simplificar de más es ocultar información, y en finanzas eso tiene consecuencias legales, no solo de experiencia. Este apartado es lo que hace que Burbuja sea seria y no solo bonita.

### 8.1 «Debes saber» en cada burbuja

- Cada burbuja tiene un bloque **«Debes saber»** con los hechos importantes: riesgos, supuestos, exclusiones y costes.
- **Aparece en todos los niveles de zoom**, también en «La ciudad» y en el modo sencillo. Lo que cambia es el lenguaje, no la presencia.
- Se distingue visualmente: un borde fino y el icono «i». Nunca se oculta tras un desplegable cerrado por defecto.
- Ejemplos reales del caso de Michael:
  - «El plan no incluye los costes de cuidados de larga duración.» (`persona.md`)
  - «La fecha de pago de julio de 2028 solo se cumple si sigues pagando $200 al mes.» (`financial-health.json`)
  - «Las proyecciones son estimaciones, no garantías.»

### 8.2 Lo que asume el plan

En la nube hay una burbuja fija, **«Lo que asume tu plan»**, con las hipótesis del plan: edades, fechas, gastos y aportaciones que se dan por hechos. Si una hipótesis no se cumple, el plan cambia, y eso también se dice.

### 8.3 La tarjeta de decisión, antes de actuar

Antes de convertir cualquier recomendación en una misión o en una acción, aparece una tarjeta con:

| Apartado | Ejemplo: añadir un umbrella de $1M (Michael) |
|---|---|
| Qué vas a hacer | Pedir presupuesto de un seguro umbrella de $1M |
| Por qué | Hoy no tienes cobertura de responsabilidad civil adicional y el plan recomienda un mínimo de $1M |
| Qué cambia | Tu nota pasaría de 26 a 31 (`top_moves`) |
| Qué cuesta o qué arriesgas | Lo que diga el presupuesto; no está en tu plan y no lo inventamos |
| Alternativas | No hacerlo ahora; hablarlo con una persona |
| Debes saber | Los «Debes saber» de la burbuja de protección |

Después vienen **una o dos preguntas de comprensión**, por ejemplo: «¿Qué te cubre un umbrella?», con tres opciones. No es un examen: si fallas, la app te lo vuelve a explicar más fácil. Lo que pretende es que nadie confirme una acción sin haberla entendido.

### 8.4 Quién recomienda qué

- **Burbuja explica el plan; no lo cambia.** Las recomendaciones salen del plan de Sherpas y del asesor o la firma que lo firma. Burbuja no genera recomendaciones nuevas, ni en las burbujas, ni en el chat, ni en las misiones.
- **Hay una persona a un toque.** Para las decisiones de mucho impacto o difíciles de deshacer (seguros, cambios en la jubilación, mover sumas grandes), la tarjeta de decisión y el chat ofrecen «Hablar con una persona». No contradice la idea de no tener asesor: no hace falta nadie para entender el plan, pero la persona está ahí cuando la decisión lo merece. Además, es el diseño legalmente más seguro.

### 8.5 Que se pueda revisar

- **Guiones revisables.** La narración, los «Debes saber» y las misiones se generan antes y se guardan, así que el equipo de cumplimiento normativo de la firma puede revisarlos antes de publicarlos. Es una ventaja directa de cachear.
- **Registro de lo que se mostró.** Se guarda qué se enseñó, a qué nivel, qué «Debes saber» vio el usuario, qué respondió en las preguntas de comprensión y qué confirmó, junto con la versión del guion.
- **Las respuestas del chat** siguen las reglas de la sección 7.4 y también quedan registradas.
- **Voz y podcast:** los «Debes saber» también se dicen en voz alta, en corto, y aparecen en las notas del episodio. **En modo podcast no se confirma ninguna decisión**: solo se apuntan intenciones para confirmarlas después con la pantalla delante.

### 8.6 Marco legal en EE. UU. (a validar con los mentores de Sherpas)

> No es asesoramiento legal. Es la lista de lo que hay que preguntar en el Discord del reto (13 a 18 de noviembre).

| Tema | Referencia | Qué implica para nosotros |
|---|---|---|
| Deber fiduciario del asesor registrado | Investment Advisers Act de 1940 (SEC) | Revelar de forma completa y justa los hechos importantes. De ahí salen los «Debes saber» y la tarjeta de decisión |
| Comunicaciones de brokers | FINRA Rule 2210 y Reg BI | Comunicaciones justas, equilibradas y sin omitir hechos importantes |
| Publicidad de asesores | SEC Marketing Rule (Rule 206(4)-1) | Cuidado si algo se usa como publicidad, sobre todo con resultados hipotéticos |
| Gamificación | La SEC abrió en 2021 una consulta sobre las *digital engagement practices* (funciones tipo juego en apps financieras) | Gamificar hábitos sanos, nunca operar ni comprar productos (sección 9.4) |
| Accesibilidad | ADA; WCAG 2.2 AA como estándar técnico | Modo sencillo, contraste y alternativas a los gestos |
| Privacidad | Gramm-Leach-Bliley Act (datos financieros) | Pedir solo los datos necesarios, guardar las claves en el backend y compartir con la persona de confianza solo con consentimiento |

**En el pitch:** «Simplificamos el lenguaje, nunca el contenido.»

## 9. Misiones del mes

Tareas mensuales gamificadas, **con la satisfacción de un juego pero con la seriedad de un banco**. Cada misión sube tu nota financiera de verdad.

### 9.1 Cómo son

- **Tres misiones al mes, nunca más:**

  | Tipo | Duración | De dónde sale |
  |---|---|---|
  | **Rápida** | ≤ 10 minutos | `top_moves` con `effort: "low"` |
  | **Importante** | Un paso de algo grande | `top_moves` con `effort: "high"` o las recomendaciones del plan, partidas en pasos |
  | **Entender** | 2 minutos | Un concepto del plan, explicado con una mini app o con «Ask Sherpas» |

- **Cada misión lleva:** por qué (una frase), cómo (pasos concretos), cuánto tarda, su «Debes saber», su tarjeta de decisión cuando hay acción, y «Ask Sherpas».
- **El usuario elige** las misiones del mes siguiente en la reunión de fin de mes, entre las que propone el plan.

**Ejemplo, Michael, mes 1:**

| Tipo | Misión | Efecto según el plan |
|---|---|---|
| Rápida | Pide presupuesto de un umbrella de $1M | Nota de 26 a 31 (`top_moves`: «Add umbrella cover», esfuerzo bajo) |
| Importante | Programa una transferencia automática a tu colchón de emergencia, por la cantidad que tú elijas | Avanza hacia los $16.530 que faltan para el mínimo recomendado |
| Entender | ¿Qué es la tasa de retirada y por qué la tuya preocupa? | Prepara la misión del mayor salto: «Lower the withdrawal rate», de 26 a 62 |

### 9.2 Las mecánicas (la parte de la dopamina)

- **El anillo del mes.** Tres segmentos que se van cerrando, uno por misión. Es visible en la nube y en el resumen mensual.
- **Vista previa de la nota.** «Si completas esta, tu nota pasa a 31.» Siempre con el `score_after` del plan, nunca inventado.
- **La burbuja cambia.** Al completar una misión, su punto pasa de rojo a ámbar o de ámbar a verde, con una animación corta de muelle, una vibración suave y una frase de voz.
- **Racha de meses, no de días.** «3 meses seguidos cerrando el anillo.» Sin presión diaria.
- **Hitos con nombre propio.** «Colchón completo», «Deuda de la tarjeta a cero». Son pocos y significan algo real.

### 9.3 Nota prevista frente a nota real

Cuando el usuario marca una misión como hecha, la nota sube como **«prevista»** (línea discontinua). Pasa a **«real»** solo cuando el cambio se confirma con el siguiente Intake o con un documento. Así la gamificación nunca miente.

### 9.4 Límites (para que sea profesional)

- Nunca premiamos operar, invertir en un producto concreto ni asumir más riesgo.
- No hay rankings ni comparaciones con otras personas.
- No hay urgencia artificial, cuentas atrás ni castigos. Una misión no hecha simplemente pasa al mes siguiente.
- Las misiones se pueden pausar.
- La información nunca se desbloquea completando misiones (regla 9).

## 10. Resumen mensual: interactivo o podcast

A final de mes, el usuario recibe **su mes**, con dos formas de verlo.

### 10.1 Interactivo

- Es la misma nube, con lo que ha cambiado resaltado: las burbujas que mejoraron brillan y los puntos que cambiaron de color se animan.
- Muestra el anillo del mes, la nota (prevista y real), las preguntas que hiciste en «Ask Sherpas» y lo que viene: momentos del plan como las facturas de la universidad de Samantha en agosto o la casa de Michael en 2027.
- Se navega con el mismo zoom y el mismo chat.

### 10.2 Modo podcast

- **El mismo contenido, convertido en un episodio de audio de 3 a 5 minutos** para escuchar en el coche, andando o en el gimnasio.
- **Formato:** dos voces que conversan, una presentadora y un copresentador que pregunta lo que preguntaría el usuario. Cada burbuja es un capítulo.
- **Controles:** reproducir y pausar, saltar capítulo, velocidad de 1x o 1,25x, controles en la pantalla de bloqueo y descarga para escuchar sin conexión.
- **Al final del episodio:** «¿Tienes dos minutos para contarme cómo te ha ido?», y empieza la reunión de fin de mes solo por voz (sección 11).
- **Seguridad al volante:** en modo podcast todo es por voz, no hay nada que tocar y no se confirma ninguna decisión (sección 8.5).

## 11. La reunión de fin de mes

Una conversación corta, de 3 a 5 minutos, por voz o por escrito, que hace lo que haría el asesor en la reunión de seguimiento.

| Paso | Pregunta | Qué hace con la respuesta |
|---|---|---|
| 1 | «¿Cómo ha ido el mes?» | Abre la conversación sin juzgar |
| 2 | Repasa cada misión: «¿Pudiste pedir el presupuesto del umbrella?» | Marca cada misión como hecha, en marcha o no hecha. Si no se hizo: «¿Qué te lo impidió?», sin culpa |
| 3 | «¿Ha cambiado algo? Trabajo, familia, un gasto grande…» | Si algo cambia el plan, lo apunta como «actualizar Intake». Nosotros no recalculamos |
| 4 | «¿Hay algo que te preocupe ahora?» | Recoge la preocupación que el plan no pregunta (problema 4 del brief) |
| 5 | «Para el mes que viene te propongo esto…» | El usuario elige sus tres misiones |

**Qué deja al terminar:**
- un resumen escrito;
- el estado de cada misión;
- los cambios que hay que llevar al Intake;
- las preguntas abiertas;
- y, si hace falta, una marca de «esto merece hablar con una persona».

**Reglas:**
- La reunión no toma decisiones vinculantes; solo registra intenciones.
- Las acciones se confirman después, con la tarjeta de decisión delante.
- Sigue todas las reglas del chat (sección 7.4): solo datos del plan y ninguna recomendación nueva.

## 12. Voz

| Para qué | Modelo | Notas |
|---|---|---|
| Narrar cada burbuja | `eleven-v3` | Admite emoción (`[calm]`, `[warm]`) para las malas noticias. Se genera **una vez** y se guarda en mp3 |
| Podcast mensual | `eleven-v3` | Dos voces. Se genera una vez por mes y familia y se guarda |
| Respuestas del chat en vivo | `eleven-flash-v2.5` | Baja latencia |
| Escuchar al usuario | `scribe-v2` | Voz a texto, para el micrófono del chat, las interrupciones y la reunión |
| Pensar la respuesta | `gpt-5-mini` | Barato; recibe el contexto de la sección 7.3 |
| Reunión de fin de mes | Por decidir | Opción A: por turnos (`scribe-v2` → `gpt-5-mini` → `eleven-flash-v2.5`), con la misma voz de siempre pero más latencia y más gasto de ElevenLabs. Opción B: `gpt-realtime-2.1-mini`, más natural y fuera del tope de ElevenLabs, pero con otra voz |

- **Presupuesto.** ElevenLabs tiene un tope de **$1,40** de nuestros $50. Toda la narración fija y **un único episodio de podcast para la demo** se pre-generan y se cachean. La voz en directo se usa solo para el chat (y para la reunión si elegimos la opción A). Probamos con modelos baratos y guardamos los caros para la demo.
- **Sincronía.** Cada frase del guion lleva un `cue` que dispara una animación: «…y aquí se acaba» hace estallar la burbuja justo en ese momento.
- **Límites del proxy:** 60 peticiones por minuto y 4 a la vez.
- **Idioma: inglés.** Voces nativas en inglés de EE. UU. y `scribe-v2` configurado para inglés.
- **Modo sencillo:** voz más lenta y con más pausas. Se consigue generando una versión aparte o, más barato, bajando la velocidad de reproducción.

## 13. Dirección visual

**Cristal por fuera, color por dentro.** Todo blanco y con mucho aire, al estilo de Apple.

1. **Fondo blanco.** Tipografía grande y limpia (SF Pro o Inter), grises suaves y una sola tinta de acento: azul `#0071E3`.
2. **Burbujas de cristal líquido.** Cuerpo blanco translúcido, borde brillante, reflejo arriba a la izquierda y sombra muy suave. **Nunca llevan color.**
3. **El estado es un punto.** Rojo `#FF3B30`, ámbar `#FF9F0A` o verde `#34C759` junto al título.
4. **Dentro, sólido y con color.** La mini app va en una tarjeta blanca opaca con colores vivos.
5. **Algo que refractar.** Detrás de las burbujas, manchas pastel muy difuminadas para que el cristal se note.
6. **Movimiento con muelle.** Las burbujas flotan un poco, se abren con efecto muelle y la voz dispara cada animación.
7. **El chat, el menú «Ask Sherpas», el ascensor y el reproductor del podcast** son del mismo cristal que las burbujas.
8. **«Debes saber»** lleva un borde fino y el icono «i». Destaca sin alarmar.
9. **Modo sencillo:** el cristal se vuelve blanco sólido con borde oscuro. Las transparencias quitan contraste.

```css
.glass {
  background: rgba(255, 255, 255, .55);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, .8);
  box-shadow: 0 10px 30px rgba(29, 43, 79, .10), inset 0 1px 0 rgba(255, 255, 255, .9);
}
.easy .glass {
  background: #fff;
  backdrop-filter: none;
  border: 2px solid #1D1D1F;
}
```

### 13.1 Lo interactivo, en Three.js

El mundo de burbujas se hace en 3D con **Three.js**, usando **React Three Fiber** (Three.js dentro de React) y **drei** (sus utilidades). El cristal líquido y el zoom del edificio piden 3D de verdad.

**Qué va en 3D (Three.js):**
- **Las burbujas de cristal.** `MeshTransmissionMaterial` de drei, o `MeshPhysicalMaterial` con `transmission`, da refracción real, brillo en el borde y grosor. Las manchas pastel del fondo se ven deformadas a través del cristal, que es justo el efecto de cristal líquido.
- **La nube.** Burbujas flotando en el espacio, con algo de profundidad y paralaje al mover el ratón o inclinar el móvil. Las posiciones se calculan con `d3-force-3d` (o `d3-force` en 2D, con una profundidad suave) y la cámara las recorre.
- **El zoom del edificio.** La cámara entra físicamente en la burbuja: atraviesa el cristal y dentro aparecen las salas (burbujas hijas) y las mesas. Al salir, la cámara retrocede. Cada planta es una posición de cámara guardada en el guion (`camera: { position, target }`) y las transiciones se animan con muelle (`CameraControls` de drei, o `@react-spring/three` o `maath/easing`). El pellizco y la rueda se capturan y se traducen en «subir» o «bajar» planta, con ajuste a la más cercana.
- **Las animaciones clave:** las gotas de los documentos que se juntan en burbujas (Acto 0), la burbuja que estalla a los 85, la que se agrieta en el caso de Samantha y la que se desinfla.
- **La luz.** Un `Environment` suave, blanco y de estudio, que da los reflejos estilo Apple.

**Qué se queda en HTML, encima de la escena:**
- **Todo el texto:** títulos, guiones, subtítulos, «Must know» y el chat. Así se puede **seleccionar para «Ask Sherpas»** (el texto dibujado en 3D no se puede seleccionar), lo leen los lectores de pantalla y se ve nítido a cualquier tamaño.
- **Las mini apps:** tarjetas HTML o SVG ancladas a su burbuja con el componente `<Html>` de drei. Son sólidas, con color y accesibles (regla 3 y sección 9).
- **El ascensor, la ruta, el reproductor del podcast y la tarjeta de decisión.**

**Rendimiento y accesibilidad:**
- Pocas burbujas a la vez (menos de 15 en pantalla) y una sola pasada de transmisión.
- La calidad baja sola en dispositivos lentos (`PerformanceMonitor` de drei), y en móviles modestos la refracción se reduce a un cristal más simple.
- **Siempre hay una vista 2D de respaldo** con el mismo contenido. La usan el modo sencillo, `prefers-reduced-motion` y los navegadores sin WebGL. Es la misma app con otra «cámara».
- Ninguna información existe solo en 3D: todo dato tiene su versión en HTML (regla 9).

## 14. Los días después

El ciclo completo:

```
Día 0     Recorrido + nube + primer paso → primera misión
Día 3     Nota de voz corta: «¿Lo arreglamos en 2 minutos?»
Mes       Misiones (anillo del mes) + recordatorios en el momento de actuar
Fin de mes  Resumen (interactivo o podcast) → reunión → misiones nuevas
```

- **La nube se guarda.** Al volver, la ves tal como la dejaste, con la misión actual brillando.
- **La burbuja que se desinfla.** Si la misión rápida lleva tiempo sin hacerse, su burbuja pierde aire poco a poco.
- **En el momento de actuar.** Los recordatorios llegan cuando la familia tiene que decidir, no en la fecha del plan. Por ejemplo, la burbuja de la universidad de Samantha aparece antes de las facturas de agosto.
- **El chat y la reunión recuerdan** las preguntas que quedaron abiertas.

## 15. Datos: la subida es el gancho, no el motor

Sherpas ya recoge los datos y hace los números. Si nosotros volvemos a leer extractos y a calcular, gastamos la semana en lo que no puntúa y nos arriesgamos a inventar cifras.

- **En el MVP, entrada A (con documentos):** el usuario arrastra sus documentos (por ejemplo `cases/<familia>/report.pdf`) y ve cómo se forman las burbujas. Por detrás cargamos el plan ya calculado (`financial-health.json`, `investment-analysis.json`, `persona.md`).
- **En el MVP, entrada B (Intake existente):** un enlace del tipo `/f/<familia>` simula que el Intake ya existe en Sherpas y carga directamente el mismo plan, sin pantalla de subida.
- **En el MVP, el «mes 2»:** solo tenemos un plan por familia, así que el mes siguiente se simula con lo que el usuario marca como hecho. La nota prevista sale del `score_after` de `top_moves`. Todo lo demás queda igual; no inventamos movimientos.
- **En el pitch:** «En producción esto va conectado al Intake de Sherpas y se actualiza cada mes. Nosotros somos el tercer trabajo: explicar y acompañar.»
- **Fuente de datos:** la carpeta `cases/` del repo. El MCP de Sherpas es opcional y da los mismos datos.

## 16. Arquitectura y formatos

```
Preproceso (una vez por familia, y una vez al mes)
  plan JSON + persona.md ──► modelo de texto ──► guion.json (burbujas, niveles, «Debes saber», misiones)
  guion.json ──► eleven-v3 ──► audio/*.mp3 (narración + podcast del mes)

Navegador
  Escena 3D: Three.js + React Three Fiber + drei (burbujas de cristal, nube, cámara del zoom, animaciones)
  Capa HTML encima: texto, mini apps (<Html> de drei), ascensor, ruta, tarjeta de decisión, reproductor
  Vista 2D de respaldo: modo sencillo, reduced-motion y sin WebGL
  d3-force-3d (posiciones de la nube) · Framer Motion (animaciones de la capa HTML)
  barra de chat + menú «Ask Sherpas» (al seleccionar texto)
  modo sencillo · tarjeta de decisión · anillo del mes · reproductor del podcast
  estado: nube, perfil, modo, misiones, preguntas ──► localStorage

Entrada
  A. /                    ──► subida de documentos ──► identifica la familia ──► /plan/:family
  B. /f/:family           ──► Intake ya existe en Sherpas ──► /plan/:family (sin subida)

Backend (base: examples/voice/server.mjs)
  GET  /intake/:family    ──► ¿existe Intake? + perfil de riesgo y estilo de decisión (para acortar la calibración)
  GET  /plan/:family      ──► guion.json + audio
  GET  /month/:family     ──► resumen del mes + episodio del podcast + misiones propuestas
  POST /ask               ──► gpt-5-mini (con el plan + contexto de pantalla) ──► { text, actions }
  POST /checkin           ──► reunión de fin de mes, un turno cada vez ──► { text, mission_updates, intake_changes, flags }
  POST /tts               ──► eleven-flash-v2.5 ──► audio
  POST /stt               ──► scribe-v2 ──► texto
  POST /log               ──► registro de lo mostrado y lo confirmado (sección 8.5)
  Las claves se quedan aquí (.env)
```

### `guion.json`, un ejemplo de burbuja

```json
{
  "id": "retirement",
  "title": "Jubilación a los 58",
  "status": "red",
  "weight": 1.0,
  "links": ["house_2027", "cash_flow"],
  "miniapp": {
    "template": "timeline",
    "data": { "start_age": 37, "retire_age": 58, "depletion_age": 85, "plan_end_age": 91, "house_year": 2027 },
    "source": "cases/michael-carter/financial-health.json#projections"
  },
  "levels": {
    "lejos":   { "text": "Ganas bien, pero el dinero va en mal orden." },
    "nube":    { "text": "A los 58 te jubilas, pero el dinero no llega hasta el final." },
    "burbuja": { "text": "Con la casa en 2027, tu ahorro llega hasta los 85. El plan dura hasta los 91.",
                 "audio": "audio/michael/retirement.burbuja.mp3",
                 "cues": [ { "at": "hasta los 85", "do": "pop_at_depletion" } ] },
    "dentro":  { "text": "Hueco de $1.177.586 a la jubilación; retirada media del 5,6 %; la Seguridad Social cubre el 34 % del gasto." }
  },
  "must_know": [
    { "text": "El plan no incluye los costes de cuidados de larga duración.", "source": "cases/michael-carter/persona.md#D3" },
    { "text": "Las proyecciones son estimaciones, no garantías.", "source": "general" }
  ]
}
```

### Una misión

```json
{
  "id": "m1-umbrella",
  "month": 1,
  "type": "rapida",
  "title": "Pide presupuesto de un umbrella de $1M",
  "why": "Hoy no tienes cobertura de responsabilidad civil adicional.",
  "steps": ["Llama a tu aseguradora actual", "Pide un umbrella de $1M", "Sube el presupuesto o márcala como hecha"],
  "minutes": 10,
  "score_before": 26,
  "score_after": 31,
  "source": "cases/michael-carter/financial-health.json#score.top_moves[0]",
  "decision_card": true,
  "status": "pendiente"
}
```

Toda cifra de `data`, `levels`, `must_know` y de las misiones tiene que poder rastrearse hasta su `source`.

## 17. Alcance del MVP y semana

**MVP, por prioridad:**

| Prioridad | Qué | Por qué |
|---|---|---|
| 1 | Recorrido de Michael: dos entradas, calibración, 4 o 5 burbujas con 3 mini apps, nube con zoom y ascensor | Es el núcleo |
| 1 | «Debes saber» y la tarjeta de decisión | Es barato y es lo que nos diferencia |
| 2 | Chat contextual y «Ask Sherpas» | Para que se entienda cualquier cosa |
| 2 | Modo sencillo | Es casi solo CSS y un recorrido lineal |
| 3 | «Mes 2» de Michael: 3 misiones, anillo, resumen interactivo, **un** episodio de podcast pregrabado y una reunión de 3 preguntas | Cubre el extra de los días después |
| 4 | Los otros tres casos con las mismas plantillas | Si da tiempo |

| Día | Objetivo |
|---|---|
| Vie 13 | Entregar `/idea` antes de las 22:00. Guion de Michael, con «Debes saber» y misiones |
| Sáb–Dom 14–15 | Escena Three.js: burbujas de cristal, nube y cámara del zoom con ascensor. En paralelo: 3 mini apps en HTML y tarjeta de decisión |
| Lun 16 | Voz cacheada, chat contextual, «Ask Sherpas» y modo sencillo |
| Mar 17 | Mes 2: misiones, resumen, podcast y reunión. Otros casos si sobra tiempo |
| Mié 18 | Pulido, vídeo de 2 min y entrega antes de las 23:59 |
| Jue 19 | Pitch de 2 minutos |

**Si vamos tarde,** se recorta en este orden: los otros casos, después la reunión (pasa a ser con guion fijo) y después el podcast (se queda en un fragmento de 30 segundos).

**Riesgo de Three.js.** Es la parte más vistosa y la más fácil de que se coma el tiempo. Para el domingo por la noche, la escena 3D tiene que estar navegable con burbujas de cristal y el zoom de cámara. Si no lo está, la demo se monta sobre la vista 2D, que existe igualmente para el modo sencillo, y el 3D se queda en la portada y en la nube final.

**Demo de 2 minutos (Michael):**

| Tiempo | Qué se ve |
|---|---|
| 0:00 | Subida → burbujas. «Ahorras el 23,9 %» |
| 0:20 | Casa o jubilación: la burbuja estalla a los 85 |
| 0:40 | Seleccionar «retirada media del 5,6 %» → «Ask Sherpas». Aparece su «Debes saber» |
| 0:55 | Ascensor: de la mesa a la ciudad. Activar el modo sencillo durante 3 segundos |
| 1:10 | Primer paso → tarjeta de decisión → la nota prevista sube de 26 a 31 |
| 1:25 | «Un mes después»: el anillo del mes, 5 segundos del podcast y una pregunta de la reunión |
| 1:50 | Cierre: el enlace de otra familia entra directo desde el Intake. «Simplificamos el lenguaje, nunca el contenido» |

## 18. Qué descartamos

| Descartado | Por qué |
|---|---|
| Solo chat de voz en tiempo real | Sherpas ya tiene chat, es caro y el tope de ElevenLabs no lo aguanta. Nuestro chat es un complemento del recorrido, no el producto |
| Avatar de vídeo de un asesor | Caro, lento y se siente falso |
| Calcular escenarios nuevos con IA | El brief pide no inventar cifras |
| Leer y analizar extractos reales | Ya lo hace Sherpas, y quita tiempo a la experiencia |
| Un PDF o resumen más bonito | Sigue siendo leer |
| Rankings y comparaciones entre usuarios | Presión social, problemas de privacidad y nada que ver con el plan de cada familia |
| Rachas diarias | Generan ansiedad. Las finanzas de una familia se mueven por meses |
| Premios por invertir o comprar productos | Riesgo regulatorio y ético (sección 8.6) |
| Esconder información detrás de niveles o misiones | Rompe la regla 9 y es justo el problema de simplificar de más |
| Activar el modo sencillo según la edad | Es paternalista. Se ofrece a todos y cada uno decide |

## 19. Contra los criterios de evaluación

| Criterio | Puntos | Cómo lo cubrimos |
|---|---|---|
| Engancha | 20 | Los documentos se convierten en burbujas de cristal en 10 segundos y la voz habla desde el principio |
| Se entiende | 20 | El zoom del edificio va de una frase a la cifra exacta, con ascensor y modo sencillo para cualquier edad. El chat y «Ask Sherpas» resuelven cualquier palabra al momento. «Debes saber» evita entender a medias |
| Mueve a actuar | 20 | Un primer paso que se convierte en misión, el anillo del mes, la nota prevista y la tarjeta de decisión |
| Personal | 15 | Guion, misiones y podcast con los nombres y datos de cada familia, un nivel por persona y una reunión que pregunta por su mes |
| Creatividad | 15 | Zoom como nivel de conocimiento, la nube como mapa vivo, el podcast de tu propio dinero y la reunión mensual con IA |
| Extra: los días después | — | El ciclo mensual completo: misiones, resumen, podcast y reunión |
| Idea del viernes | 10 | Este documento, resumido |

## 20. Decisiones abiertas

- [ ] Nombre final del producto («Burbuja» es provisional).
- [x] Idioma: **toda la app en inglés**. Ver la regla 7.
- [ ] Voces de ElevenLabs: una principal y una segunda para el podcast, siempre las mismas.
- [ ] Reunión de fin de mes: opción A (turnos con ElevenLabs) u opción B (`gpt-realtime-2.1-mini`). Ver sección 12.
- [ ] Framework: propuesta **React + Vite + React Three Fiber + drei**. Vite basta: no hace falta servidor de render y el backend ya es el de `examples/voice`.
- [ ] Cristal en 3D: `MeshTransmissionMaterial` de drei o `MeshPhysicalMaterial`. Probar los dos en un móvil normal el sábado.
- [ ] Probar cómo expone el proxy TTS y STT (`eleven-*`, `scribe-v2`) antes de montar `/tts` y `/stt`.
- [ ] Preguntar a los mentores de Sherpas por el marco legal de la sección 8.6, sobre todo la gamificación y quién firma las recomendaciones.
- [ ] Modo pareja: ¿dentro del MVP o como extra?
- [ ] Entrada B: ¿qué campos del Intake usamos para saltarnos la calibración? Candidatos: el perfil de riesgo de `financial-health.json` y el D5 del `persona.md`.
- [ ] Reparto de tareas en el equipo.
