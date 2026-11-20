---
name: stop-slop
description: Quita los patrones de escritura de IA de los textos en español. Úsala al escribir, editar o revisar textos en español (páginas, mensajes, correos, publicaciones) para eliminar las muletillas predecibles de IA y calificarlos sobre 50.
metadata:
  trigger: Escribir textos en español, editar borradores, revisar contenido con patrones de IA
  author: Hardik Pandya (https://hvpandya.com), adaptada al español de Colombia para ¡Alertax
---

# Stop Slop en español

Quita los patrones predecibles de IA de un texto en español.

## Reglas

1. **Quitar el relleno.** Fuera los arranques que carraspean, las muletillas de énfasis y casi todos los adverbios en -mente. Ver [references/frases.md](references/frases.md).

2. **Romper las estructuras de fórmula.** Nada de contrastes binarios («no es X, es Y»), listas de lo que algo no es, fragmentos dramáticos, preguntas retóricas de preámbulo ni cosas que actúan como personas. Ver [references/estructuras.md](references/estructuras.md).

3. **Voz activa.** Cada frase tiene a alguien haciendo algo. Nada de pasiva con «ser» («fue creado por»). La pasiva con «se» («se borra», «se manda») sí es natural en español. Nada de objetos haciendo cosas de personas («el reporte se convierte en ayuda»).

4. **Ser concreto.** Nada de afirmaciones vagas («Las razones son de fondo»). Nombrar la cosa. Nada de «todo», «siempre», «nunca» haciendo trabajo vago. En reglas de seguridad y privacidad, «nunca» sí va si es cierto: «quien escanea nunca ve tus datos».

5. **Poner al lector en la escena.** Nada de narrador lejano. «Tú» o «usted» le gana a «las personas». Lo concreto le gana a lo abstracto. Un solo trato por texto.

6. **Variar el ritmo.** Mezclar frases largas y cortas. Dos elementos le ganan a tres. Terminar los párrafos de forma distinta. Sin rayas (—).

7. **Confiar en el lector.** Decir los hechos directo. Sin suavizar, justificar ni llevar de la mano.

8. **Quitar las frases de póster.** Si suena a frase para enmarcar, reescribirla.

## Revisión rápida

Antes de entregar:

- ¿Adverbios en -mente o «realmente», «simplemente», «totalmente»? Quitarlos.
- ¿Pasiva con «ser»? Buscar quién actúa y ponerlo de sujeto.
- ¿Una cosa haciendo algo de persona («la decisión surge»)? Nombrar a la persona.
- ¿Frase que arranca con «Lo que…», «Cuando…», «Por qué…» como preámbulo? Reordenarla.
- ¿«Esto es lo que…», «Te cuento algo:»? Ir al grano.
- ¿«No es X, es Y»? Decir Y.
- ¿Tres frases seguidas del mismo largo? Cambiar una.
- ¿Cada párrafo termina con un remate? Variar.
- ¿Raya en alguna parte? Quitarla.
- ¿Afirmación vaga («Las implicaciones son grandes»)? Nombrar la implicación.
- ¿Narrador lejano («Nadie diseñó esto»)? Meter al lector.
- ¿Frases que hablan del texto («En lo que sigue…»)? Borrarlas.
- ¿Faltan los signos de apertura (¿ ¡)? Ponerlos.
- ¿Mezcla tú y usted? Dejar uno.

## Calificación

Del 1 al 10 en cada punto:

| Punto | Pregunta |
|-------|----------|
| Directo | ¿Afirma o anuncia? |
| Ritmo | ¿Variado o de metrónomo? |
| Confianza | ¿Respeta la inteligencia del lector? |
| Autenticidad | ¿Suena a persona? |
| Densidad | ¿Sobra algo? |

Menos de 35/50: revisar otra vez.

## Cuándo no aplicar

- Textos legales (política de privacidad, términos, consentimiento): se respetan las palabras, plazos y condiciones que pide la ley. Solo se arregla la redacción alrededor, y el abogado revisa.
- Citas, nombres propios y la marca «¡Alertax».
- Textos de las plantillas de WhatsApp ya aprobadas por Meta: si se cambian, hay que volver a pedir aprobación.

## Ejemplos

Ver [references/ejemplos.md](references/ejemplos.md).

## Licencia

MIT. Basada en [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) (MIT, Hardik Pandya).
