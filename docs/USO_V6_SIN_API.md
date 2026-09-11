# Uso personal de V6 sin API

La V6 admite dos modos. Para el uso personal actual se recomienda **ChatGPT asistido**, porque no requiere Vercel, API keys ni costos por llamada.

## Modo recomendado: HTML local + ChatGPT

La página `evaluador-web/public/v6-assisted.html` prepara la evidencia localmente y luego permite importar el resultado devuelto por GPT.

Flujo:

1. Abrir `v6-assisted.html` en Chrome o Edge.
2. Cargar el ZIP o carpeta del trabajo.
3. Revisar el inventario priorizado, la cantidad de caracteres y la huella SHA-256.
4. Copiar o descargar el paquete de evidencia que genera la página.
5. Abrir una conversación con GPT-5.6 Sol.
6. Adjuntar o pegar `evaluador-web/prompts/evaluador_v6_chatgpt.md` y el paquete de evidencia. También se puede adjuntar el ZIP original si ChatGPT puede leerlo directamente.
7. Pedir: `Evaluá este trabajo con el contrato V6 adjunto.`
8. Copiar la respuesta completa de ChatGPT o solamente su bloque JSON y pegarla en la sección **Importá el resultado** de la página.

La página acepta JSON puro, un bloque cercado con ```json o una respuesta con texto más JSON. El navegador no llama a ningún modelo ni envía el ZIP a un servidor.

### Protecciones del HTML asistido

- ZIP estándar de hasta 15 MB.
- Máximo 500 entradas por ZIP.
- No admite ZIP64 ni archivos protegidos con contraseña.
- Ignora archivos textuales individuales mayores a 150 KB después de descomprimir, incluso si el encabezado del ZIP declara un tamaño menor.
- Prioriza hasta 120 archivos y 260.000 caracteres de evidencia.
- Calcula SHA-256 local para trazabilidad.
- Nunca ejecuta código contenido en el trabajo.

## Alternativa directa: ZIP + ChatGPT

Si no hace falta la página intermedia:

1. Abrir una conversación con GPT-5.6 Sol.
2. Adjuntar el ZIP completo del trabajo.
3. Adjuntar o pegar `evaluador-web/prompts/evaluador_v6_chatgpt.md`.
4. Pedir: `Evaluá este ZIP con el contrato V6 adjunto.`
5. Conservar la tabla, el total, inconsistencias, alertas y el JSON devuelto.

El ZIP es evidencia. No hace falta ejecutar su contenido. El evaluador debe inventariar y leer los archivos textuales relevantes, pero no correr código del alumno para dar por cierta una afirmación narrativa.

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

## Estado

La V6 personal se desarrolla en `TomyVrs/evaluador-ia`, rama `v6/benchmark-hardening`. No modifica el repositorio entregado del grupo ni su Vercel. La calibración docente y un holdout externo ya están documentados; el PR debe permanecer sin merge hasta aprobación explícita.
