# V6 — holdout externo

Fecha: 2026-09-11

## Caso

Repositorio público evaluado como holdout:

`borlandini-gh/agente-informe-ganadero`

Este repositorio no forma parte de los siete ZIP docentes usados para calibrar V6. No se modificó ninguna regla después de mirar su resultado.

## Resultado semántico V6

| Dimensión | V6 | Máximo | Lectura |
|---|---:|---:|---|
| Sistema completo y funcionando | 30 | 30 | Contrato de seis piezas, herramientas/implementación reales, esquema estable y supervisión explícita |
| Proceso documentado | 25 | 25 | Tres iteraciones reales, fallas concretas, métricas y decisiones vinculadas; además validación fuera de muestra |
| Formato y reproducibilidad | 15 | 15 | Tres corridas, salidas originales, hashes, versiones, comando reproducible y tests |
| Análisis económico | 13 | 15 | Costo/fórmula/proyección claros; modelo opcional justificado, pero sin comparación experimental equivalente con alternativas |
| Gobierno y riesgo | 15 | 15 | Permisos, L0–L4, segregación, fallas, contingencias y firma humana muy explícitos |
| **Total** | **98** | **100** | Trabajo fuerte y trazable |

## Hallazgos relevantes

- La extracción principal es determinística; el modelo es opcional y no decide cifras.
- README y `DECISIONES.md` describen tres fallas/iteraciones concretas, y las corridas preservan evidencia original.
- Existe una validación fuera de muestra posterior a las iteraciones, incluyendo una falla estructural nueva y su prueba de regresión.
- La arquitectura limita permisos y separa preparación, revisión visual, aprobación y envío.
- El análisis económico distingue costo determinístico de tokens igual a cero y escenario generativo opcional, con fórmula y proyección reproducibles.
- La justificación de `gpt-5.6-luna` es razonable por suficiencia/costo, pero no demuestra empíricamente que sea la mejor opción frente a modelos alternativos; por eso AE-03 no recibe máximo.

## Resultado del control

V6 no generó una penalización por nombres de archivos, cantidad de documentación ni estructura distinta a los fixtures docentes. La lectura semántica reconoce un trabajo fuerte sin necesidad de agregar excepciones para este repositorio.

Este holdout no convierte la calibración en una validación estadística; sí reduce el riesgo inmediato de que las reglas nuevas funcionen únicamente sobre A/B/C/D y los tres casos Toño.
