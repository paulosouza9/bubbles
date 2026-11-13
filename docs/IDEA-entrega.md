**Burbuja · idea del equipo [NOMBRE DEL EQUIPO]**

**Qué vamos a construir**
- Una web app (en inglés) que explica el plan de Sherpas sin asesor. Una voz de ElevenLabs lo cuenta en burbujas de cristal en 3D (Three.js) que salen una a una, cada una con una mini app interactiva. Al final, las burbujas forman una nube: el mapa del dinero de la familia.
- El zoom es el nivel de conocimiento: de una frase a la cifra exacta, como entrar en un edificio planta a planta. Está hecho con una cámara 3D que atraviesa el cristal de cada burbuja. Hay botones para quien no use gestos y un modo sencillo para cualquier edad.
- Abajo hay un chat que sabe lo que hay en pantalla. Al seleccionar cualquier texto aparece «Ask Sherpas».
- Cada mes: 3 misiones sacadas de los `top_moves` del plan, un resumen interactivo o en modo podcast, y una reunión corta por voz para ver cómo ha ido.
- Demo con Michael Carter (nota 26). Se entra subiendo documentos o directamente desde un Intake que ya existe.

**Por qué**
- Sherpas ya recoge los datos y hace los números; lo que falta es explicar. Las burbujas dan el plan de uno en uno y la voz quita la obligación de leer.
- El mismo plan sirve al novato y al experto: cambia la profundidad, no el contenido.
- «Simplificamos el lenguaje, nunca el contenido.» Simplificar de más es ocultar información. Por eso hay un bloque «Must know» visible en todos los niveles y, antes de actuar, una tarjeta de decisión con una pregunta de comprensión.
- Las misiones y la reunión mensual cubren el día 3 y el día 30.

**Qué descartamos y por qué**
- **Solo un chat o una voz en tiempo real:** Sherpas ya lo tiene y es caro. Nuestro chat acompaña el recorrido, no es el producto.
- **Leer extractos y calcular el plan nosotros:** Sherpas ya lo hace, y nos arriesgaríamos a inventar cifras. La subida de documentos es solo la entrada visual.
- **Que la IA calcule escenarios nuevos:** el modelo elige y explica; los números son siempre los del plan.
- **Un avatar de vídeo de asesor:** caro, lento y se siente falso.
- **Gamificación de app de consumo (rankings, rachas diarias, premios por invertir):** genera ansiedad y tiene riesgo regulatorio.
- **Activar el modo sencillo según la edad:** es paternalista. Se ofrece a todo el mundo.

**Riesgos que asumimos**
- El tope de ElevenLabs es de $1,40, así que la narración y un episodio de podcast se generan una vez y se guardan.
- Solo hay un plan por familia. El «mes 2» se simula con lo que el usuario marca como hecho y con el `score_after` del plan.
- El alcance es grande. Primero van el recorrido y el «Must know». Si vamos tarde, recortamos en este orden: los otros casos, la reunión y el podcast.

**Pregunta para los mentores:** ¿qué límites legales veis en gamificar mejoras financieras y en quién firma las recomendaciones que mostramos?
