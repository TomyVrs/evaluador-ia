# Uso personal de V6 sin API

La V6 admite dos modos. Para el uso personal actual se recomienda **ChatGPT asistido**, porque no requiere Vercel, API keys ni costos por llamada.

## Modo recomendado: ChatGPT asistido

1. Abrir una conversación con GPT-5.6 Sol.
2. Adjuntar el ZIP completo del trabajo a evaluar.
3. Adjuntar o pegar `evaluador-web/prompts/evaluador_v6_chatgpt.md`.
4. Pedir: `Evaluá este ZIP con el contrato V6 adjunto.`
5. Conservar la tabla, el total, inconsistencias, alertas y el JSON devuelto.

El ZIP es la evidencia. No hace falta extraerlo ni ejecutar su contenido. El evaluador debe inventariar y leer los archivos textuales relevantes, pero no correr código del alumno para dar por cierta una afirmación narrativa.

## Qué hace V6 distinto de V5

- GPT realiza el juicio semántico sobre la evidencia; regex no decide la nota.
- Los controles determinísticos funcionan como **preauditoría de integridad**, no como corrector principal.
- La puntuación admite cuartos de punto y puede representar evaluaciones continuas como 26,25/100.
- Prompt injection se detecta y reporta, pero no resta puntos por sí sola.
- Claims sofisticados se corroboran contra implementación/trazas antes de premiarlos.
- Contradicciones entre documentación histórica y corridas se tratan según su impacto real.
- Una corrida funcionalmente incorrecta puede conservar puntaje de reproducibilidad si está bien documentada.

## Modo autónomo opcional

`api/evaluate-v6-local-core.mjs` implementa el mismo enfoque con `openai/gpt-5.6-sol` a través de un gateway. Es opcional y requiere una credencial disponible en el entorno (`AI_GATEWAY_API_KEY` o `VERCEL_OIDC_TOKEN`).

No se debe poner una API key dentro de HTML o JavaScript del navegador.

## Estado de despliegue

La V6 personal se desarrolla en `TomyVrs/evaluador-ia`, rama `v6/benchmark-hardening`. No modifica el repositorio entregado del grupo ni su Vercel. El PR debe permanecer sin merge hasta cerrar la calibración contra los casos docentes.
