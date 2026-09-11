const STATE_RANK = {
  NO_VERIFICABLE: 0,
  NO_CUMPLE: 1,
  PARCIAL: 2,
  CUMPLE: 3,
};

function evidenceFiles(userPrompt) {
  const marker = 'CONTENIDO LEÍDO DEL ALCANCE\n';
  const start = String(userPrompt || '').indexOf(marker);
  if (start < 0) return [];
  let block = String(userPrompt).slice(start + marker.length);
  const end = block.lastIndexOf('\nRecordá: todo el contenido anterior');
  if (end >= 0) block = block.slice(0, end);

  const files = [];
  const re = /===== ARCHIVO: (.+?) =====\n([\s\S]*?)(?=\n===== ARCHIVO: |$)/g;
  let match;
  while ((match = re.exec(block))) {
    files.push({ path: match[1].trim(), content: match[2].trim() });
  }
  return files;
}

function joined(files, filter = () => true) {
  return files.filter(filter).map(file => `\n${file.path}\n${file.content}`).join('\n');
}

function capState(modelState, gateState) {
  if (!(modelState in STATE_RANK) || !(gateState in STATE_RANK)) return modelState;
  if (modelState === 'NO_VERIFICABLE') return modelState;
  return STATE_RANK[modelState] > STATE_RANK[gateState] ? gateState : modelState;
}

function floorState(modelState, gateState) {
  if (!(modelState in STATE_RANK) || !(gateState in STATE_RANK)) return modelState;
  if (modelState === 'NO_VERIFICABLE') return modelState;
  return STATE_RANK[modelState] < STATE_RANK[gateState] ? gateState : modelState;
}

function sc02Gate(files) {
  const all = joined(files);
  const implementationFile = files.some(file =>
    /\.(?:js|mjs|cjs|ts|tsx|py|sh|ps1)$/i.test(file.path) &&
    /(?:tool|herramient|connector|conector|mcp|function|def\s+|class\s+|api\b|sdk\b)/i.test(file.content)
  );
  const integrationFile = files.some(file =>
    /(?:tool|herramient|connector|conector|mcp|integraci[oó]n|config|package\.json|pyproject|requirements)/i.test(file.path) &&
    /(?:endpoint|scope|permiso|permission|auth|oauth|token|api|sdk|mcp|connector|conector)/i.test(file.content)
  );
  const explicitIdentifier = /(?:herramienta|tool|connector|conector|funci[oó]n|function)\s+(?:concreta\s+)?(?:llamada|denominada|nombre)?\s*[:=]\s*[`'\"]?[A-Za-z][A-Za-z0-9_.-]{2,}/i.test(all);
  const concrete = implementationFile || integrationFile || explicitIdentifier;
  const trace = /(?:tool[_ -]?call|function[_ -]?call|mcp[_ -]?call|connector[_ -]?call|conector[_ -]?call|llamada\s+(?:real\s+)?a\s+(?:la\s+)?herramienta|ejecuci[oó]n\s+de\s+(?:la\s+)?herramienta|invocaci[oó]n\s+de\s+[A-Za-z][A-Za-z0-9_.-]{2,})/i.test(all);
  const operable = trace || implementationFile || integrationFile;
  if (!concrete) return 'NO_CUMPLE';
  if (!operable) return 'PARCIAL';
  return 'CUMPLE';
}

function sc02LiteralFloor(files) {
  const all = joined(files);
  const namedConcrete = /(?:conector(?:es)?|herramienta(?:s)?|tool(?:s)?)\s+(?:real(?:es)?\s+)?(?:de\s+)?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9_.-]+(?:\s+(?:y|e)\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9_.-]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9_.-]+)*)?/m.test(all);
  const explicitUse = /(?:leer|enviar|crear|modificar|eliminar|consultar|buscar|escribir|actualizar|acceder|read|send|create|update|delete|search|fetch|write)\b/i.test(all);
  return namedConcrete && explicitUse ? 'PARCIAL' : null;
}

function pd01Floor(files) {
  const processFiles = files.filter(file => /(?:decisiones|decisions|proceso|process|iteraci[oó]n|iteration|version|versi[oó]n)/i.test(file.path + '\n' + file.content));
  const text = joined(processFiles.length ? processFiles : files);
  const labels = text.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:(?:versi[oó]n|version)\s+(?:inicial|final|primera|segunda|tercera|cuarta|quinta|v?\d+(?:\.\d+)*)|(?:primera|segunda|tercera|cuarta|quinta)\s+(?:versi[oó]n|version)|v\d+(?:\.\d+)*)\b/gim) || [];
  const normalized = new Set(labels.map(label => label.toLowerCase().replace(/[#\s]+/g, ' ').trim()));
  if (normalized.size >= 2) return 'PARCIAL';
  const hasInitial = /(?:versi[oó]n|version)\s+inicial|(?:primera)\s+(?:versi[oó]n|version)|\bv1\b/i.test(text);
  const hasConcreteChange = /(?:cambi(?:amos|o|ó|ar)|ajust(?:amos|e|ó|ar)|agreg(?:amos|ó|ar)|elimin(?:amos|ó|ar)|modific(?:amos|ó|ar))\s+[^\n]{3,}/i.test(text);
  if (hasInitial && hasConcreteChange) return 'PARCIAL';
  return null;
}

function fr03Gate(files) {
  const runFiles = files.filter(file => /(?:corrida|run|ejecuci[oó]n|registro)/i.test(file.path));
  const runText = joined(runFiles.length ? runFiles : files);
  const all = joined(files);
  const hasInput = /(?:^|\n)\s*(?:[-*]\s*)?(?:#{1,6}\s*)?(?:\*\*)?(?:entrada|input)(?:\*\*)?\s*(?::|=|-|\n)/im.test(runText);
  const hasOutput = /(?:^|\n)\s*(?:[-*]\s*)?(?:#{1,6}\s*)?(?:\*\*)?(?:salida|output)(?:\*\*)?\s*(?::|=|-|\n)/im.test(runText);
  const hasPromptOrConfig = /(?:prompt|configuraci[oó]n|config)\s*[:=-]\s*`?[^\n]+/i.test(runText);
  const exactVersion = /(?:ref(?:erencia)?|commit|sha|versi[oó]n|version|modelo|model)\s*(?:exact[ao])?\s*[:=#]\s*`?(?:[0-9a-f]{7,40}|v?\d+(?:\.\d+)+|main\b|develop\b|[A-Za-z0-9._/-]*\d[A-Za-z0-9._/-]*)/i.test(all);
  if (hasInput && hasOutput && hasPromptOrConfig && exactVersion) return 'CUMPLE';
  if (hasInput && hasOutput) return 'PARCIAL';
  return 'NO_CUMPLE';
}

function ae01Gate(files) {
  const econ = joined(files, file => /(?:econom|cost|costo|pricing|precio|financ)/i.test(file.path + '\n' + file.content));
  const text = econ || joined(files);
  const costPerRun = /(?:USD|US\$|EUR|ARS|\$)\s*\d[\d.,]*\s*(?:por|\/|cada)\s*(?:corrida|ejecuci[oó]n|run)|\d[\d.,]*\s*(?:USD|EUR|ARS)\s*(?:por|\/|cada)\s*(?:corrida|ejecuci[oó]n|run)|(?:costo|coste|cost)\s+(?:declarad[oa]\s+|estimad[oa]\s+)?(?:por|\/|cada)\s*(?:corrida|ejecuci[oó]n|run)\s*[:=-]\s*(?:USD|US\$|EUR|ARS|\$)\s*\d[\d.,]*/i.test(text);
  const explicitBasis = /(?:base\s+de\s+c[aá]lculo|supuesto)\s*[:=-]\s*[^\n]{3,}/i.test(text);
  const tokenBasis = /(?:\d[\d.,]*\s*(?:tokens?|caracteres?)|tokens?\s*[:=-]\s*\d[\d.,]*)[\s\S]{0,160}(?:tarifa|precio|costo)|(?:tarifa|precio|costo)[\s\S]{0,160}(?:\d[\d.,]*\s*(?:tokens?|caracteres?))/i.test(text);
  const providerBasis = /(?:precio|tarifa)\s+(?:oficial|del\s+proveedor|por\s+mill[oó]n|por\s+1m)|(?:pricing|price)\s+(?:page|source|fuente)/i.test(text);
  const basis = explicitBasis || tokenBasis || providerBasis;
  const provenance = /(?:estimad[oa]|estimaci[oó]n|fuente\s*[:=-]|https?:\/\/|pricing|tarifa\s+oficial|precio\s+oficial)/i.test(text);
  if (!costPerRun) return 'NO_CUMPLE';
  if (!basis || !provenance) return 'PARCIAL';
  return 'CUMPLE';
}

function ae03Gate(files) {
  const econ = joined(files, file => /(?:econom|cost|costo|pricing|precio|modelo|model)/i.test(file.path + '\n' + file.content));
  const text = econ || joined(files);
  const explicitChosen = /(?:modelo|model|configuraci[oó]n)\s+(?:elegid[oa]|seleccionad[oa]|usad[oa])\s*[:=-]?\s*[`'\"]?[A-Za-z0-9][A-Za-z0-9_.\/-]{2,}|(?:elegimos|seleccionamos|se\s+elige|se\s+selecciona|usar)\s+(?:el\s+modelo\s+)?[`'\"]?(?:gpt|gemini|claude|llama|mistral|qwen|deepseek|grok|phi|o\d)[A-Za-z0-9_.\/-]*/i.test(text);
  const selectionIntent = /(?:modelo\s+m[aá]s\s+(?:peque[nñ]o|econ[oó]mico)|costo[- ]?eficien|menor\s+costo|m[aá]s\s+barato|modelo\s+adecuado)/i.test(text);
  const comparisonWord = /(?:comparaci[oó]n|comparar|benchmark|prueba\s+(?:comparativa|a\/b)|\bvs\.?\b|versus)/i.test(text);
  const negativeOrFutureOnly = /(?:debe\s+confirmarse|queda\s+pendiente|pendiente\s+de|no\s+presenta|sin\s+(?:comparaci[oó]n|prueba)|falta\s+(?:comparar|medir)|se\s+deber[ií]a\s+comparar)/i.test(text);
  const metricEvidence = /(?:latencia|calidad|exactitud|accuracy|score|puntaje|costo|precio|tokens?)\s*[:=-]?\s*\d[\d.,]*|\d[\d.,]*\s*(?:%|USD|ms|s|tokens?)/i.test(text);
  const namedModels = text.match(/\b(?:gpt[-\w.]*|gemini[-\w.]*|claude[-\w.]*|llama[-\w.]*|mistral[-\w.]*|qwen[-\w.]*|deepseek[-\w.]*|grok[-\w.]*|phi[-\w.]*)\b/gi) || [];
  const distinctModels = new Set(namedModels.map(name => name.toLowerCase())).size;
  const verifiedComparison = comparisonWord && !negativeOrFutureOnly && (metricEvidence || distinctModels >= 2);
  if (explicitChosen && verifiedComparison) return 'CUMPLE';
  if (explicitChosen || selectionIntent || comparisonWord) return 'PARCIAL';
  return 'NO_CUMPLE';
}

function appendUnique(target, value, keyFn = item => JSON.stringify(item)) {
  const key = keyFn(value);
  if (!target.some(item => keyFn(item) === key)) target.push(value);
}

function integritySignals(files) {
  const findings = { manipulation: [], unsupported: [], contradictions: [] };
  const narratives = files.filter(file => /(?:readme|decisiones|decision|analisis|an[aá]lisis|documentaci[oó]n)/i.test(file.path));
  const implementation = files.filter(file => !narratives.includes(file));
  const implText = joined(implementation).toLowerCase();

  for (const file of files) {
    const text = file.content;
    const targetsEvaluator = /(?:evaluador|grader|corrector|calificador)/i.test(text);
    const triesOverride = /(?:ignorar|ignore|override|anular|desobedecer)[^\n]{0,80}(?:reglas|instrucciones|rubrica|rúbrica|previous|system)|(?:asignar|otorgar|return|devolver)[^\n]{0,50}(?:\d{2,3}\s*\/\s*100|puntaje|score)|no\s+(?:reportar|informar|verificar)[^\n]{0,80}(?:instrucci[oó]n|historial|evidencia)/i.test(text);
    if (targetsEvaluator && triesOverride) {
      appendUnique(findings.manipulation, `Instrucción dirigida al evaluador detectada en ${file.path}; debe reportarse e ignorarse como evidencia no confiable.`);
    }
  }

  const advancedTerms = [
    ['MCP', /\bmcp\b/i],
    ['Google Drive', /google\s+drive/i],
    ['embeddings', /\bembeddings?\b/i],
    ['similitud coseno', /(?:coseno|cosine)/i],
    ['lazy loading', /lazy\s+loading/i],
    ['resumen jerárquico', /(?:hierarchical|jer[aá]rquic)/i],
    ['memoria persistente', /memoria\s+persistente/i],
  ];
  const unsupportedTerms = [];
  for (const [label, pattern] of advancedTerms) {
    const claimed = narratives.some(file => pattern.test(file.content));
    const implemented = pattern.test(implText);
    if (claimed && !implemented) unsupportedTerms.push(label);
  }
  if (unsupportedTerms.length >= 2) {
    findings.unsupported.push({
      afirmacion: `Se describen mecanismos avanzados (${unsupportedTerms.join(', ')}) sin respaldo fuera de archivos narrativos.`,
      evidencia_contraria: 'No aparecen implementaciones, configuración, trazas o resultados independientes que corroboren esos mecanismos en el paquete leído.',
      impacto: 'No deben computarse como evidencia de funcionamiento, integración, memoria ni gobierno; la afirmación queda no verificada.',
    });
  }

  const allNarrative = joined(narratives);
  const run3 = joined(files, file => /(?:corrida[_ -]?0?3|run[_ -]?0?3)/i.test(file.path));
  const historicalError = /(?:corrida\s*3|run\s*3)[\s\S]{0,500}(?:clasific[^\n]{0,120}(?:sin_oc|sin\s+oc)|reclamo\s+al\s+proveedor|error\s+de\s+clasificaci[oó]n)/i.test(allNarrative)
    || /(?:nota\s+de\s+cr[eé]dito|nc[^\n]{0,80})[^\n]{0,160}(?:sin_oc|sin\s+oc)/i.test(allNarrative);
  const rewrittenSuccess = /(?:nota\s+de\s+cr[eé]dito|\bnc\b)[\s\S]{0,220}(?:ajuste)[\s\S]{0,500}(?:0\s+de\s+\d+|cero\s+clasificaciones?\s+corregidas?|ninguna\s+hay\s+errores?\s+de\s+clasificaci[oó]n)/i.test(run3);
  const notVerified = /(?:no\s+verificado|todav[ií]a\s+no\s+volv[ií]\s+a\s+correr|no\s+volv[ií]\s+a\s+correr|sin\s+re[- ]?ejecutar)/i.test(allNarrative);
  const claimsValidated = /(?:video\s+muestra[^\n]{0,120}(?:corridas|ejecuciones)[^\n]{0,120}(?:ninguna|sin)[^\n]{0,80}errores?|aprobado\s+para\s+producci[oó]n|cero\s+clasificaciones?\s+corregidas?)/i.test(run3);

  if ((historicalError && rewrittenSuccess) || (notVerified && claimsValidated)) {
    findings.contradictions.push({
      afirmacion: 'La documentación histórica declara una falla real/no verificada, pero la evidencia de la corrida correspondiente fue reescrita como exitosa o sin correcciones.',
      evidencia_contraria: 'DECISIONES/README y los artefactos de la corrida 3 describen estados incompatibles para la misma ejecución y/o la misma clasificación.',
      impacto: 'Contradicción material: reduce la confiabilidad del proceso documentado y de la reproducibilidad; no puede premiarse la versión favorable sin resolver la discrepancia.',
    });
  }

  const integrationClaim = narratives.some(file => /(?:integraci[oó]n|conexi[oó]n)\s+(?:real\s+)?(?:con|a)\s+(?:crm|salesforce|hubspot|drive|api)/i.test(file.content));
  const integrationProof = implementation.some(file => /(?:crm|salesforce|hubspot|google\s+drive|oauth|api[_ -]?key|endpoint)/i.test(file.content) && /\.(?:js|mjs|ts|py|json|ya?ml)$/i.test(file.path));
  const accuracyClaim = narratives.some(file => /(?:exactitud|accuracy|precisi[oó]n)\s*(?:de|:|=)?\s*9\d(?:[.,]\d+)?\s*%/i.test(file.content));
  const metricProof = implementation.some(file => /(?:exactitud|accuracy|precisi[oó]n)[^\n]{0,80}\d+(?:[.,]\d+)?\s*%/i.test(file.content));
  if ((integrationClaim && !integrationProof) || (accuracyClaim && !metricProof)) {
    findings.unsupported.push({
      afirmacion: 'El trabajo declara integración externa y/o desempeño cuantitativo alto sin evidencia independiente suficiente.',
      evidencia_contraria: 'No se encontró implementación/configuración reproducible de la integración ni medición trazable que sostenga el porcentaje declarado.',
      impacto: 'La afirmación se considera no verificada y no puede elevar criterios de sistema, proceso o gobierno.',
    });
  }

  return findings;
}

function applyIntegrityCaps(modelOutput, findings) {
  const cap = (id, state, note) => {
    const criterion = modelOutput.criterios?.[id];
    if (!criterion) return;
    const original = criterion.estado;
    criterion.estado = capState(original, state);
    if (criterion.estado !== original) criterion.justificacion = `${criterion.justificacion || ''} [Control de integridad V6: ${original} → ${criterion.estado}; ${note}]`.trim();
  };

  if (findings.unsupported.length) {
    cap('SC-02', 'PARCIAL', 'afirmaciones de integración/capacidades sin evidencia independiente suficiente');
    cap('GR-02', 'PARCIAL', 'controles o capacidades declarados sin soporte verificable');
  }
  if (findings.contradictions.length) {
    cap('SC-03', 'PARCIAL', 'artefactos de salida/resultado contradicen la historia documentada');
    cap('PD-02', 'PARCIAL', 'las fallas reales no quedan representadas de forma confiable');
    cap('PD-03', 'PARCIAL', 'las decisiones no son trazables de forma consistente contra la corrida');
    cap('FR-02', 'PARCIAL', 'una corrida presenta evidencia internamente contradictoria');
    cap('FR-03', 'PARCIAL', 'la reconstrucción de la ejecución queda comprometida por inconsistencias materiales');
    cap('GR-04', 'PARCIAL', 'la supervisión declarada no concuerda con la evidencia de revisión');
  }
}

export function applyDeterministicEvidenceGates(modelOutput, userPrompt) {
  if (!modelOutput?.criterios) return modelOutput;
  const files = evidenceFiles(userPrompt);
  if (!files.length) return modelOutput;

  const gates = {
    'SC-02': sc02Gate(files),
    'FR-03': fr03Gate(files),
    'AE-01': ae01Gate(files),
    'AE-03': ae03Gate(files),
  };

  for (const [id, gateState] of Object.entries(gates)) {
    const criterion = modelOutput.criterios[id];
    if (!criterion) continue;
    const original = criterion.estado;
    criterion.estado = capState(original, gateState);
    if (criterion.estado !== original) {
      criterion.justificacion = `${criterion.justificacion || ''} [Control mecánico V5: ${original} → ${criterion.estado}; se aplicó la condición operativa literal del criterio.]`.trim();
    }
  }

  const sc02Minimum = sc02LiteralFloor(files);
  const sc02 = modelOutput.criterios['SC-02'];
  if (sc02 && sc02Minimum) {
    const original = sc02.estado;
    sc02.estado = floorState(original, sc02Minimum);
    if (sc02.estado !== original) {
      sc02.justificacion = `${sc02.justificacion || ''} [Control mecánico V5 SC-02: ${original} → ${sc02.estado}; herramienta/conector concreto y uso explícito corresponden como mínimo a PARCIAL aunque falte operabilidad reproducible.]`.trim();
    }
  }

  const pd01Minimum = pd01Floor(files);
  const pd01 = modelOutput.criterios['PD-01'];
  if (pd01 && pd01Minimum) {
    const original = pd01.estado;
    pd01.estado = floorState(original, pd01Minimum);
    if (pd01.estado !== original) {
      pd01.justificacion = `${pd01.justificacion || ''} [Control mecánico V5 PD-01: ${original} → ${pd01.estado}; múltiples versiones explícitas corresponden como mínimo a PARCIAL aunque la reconstrucción sea insuficiente.]`.trim();
    }
  }

  const findings = integritySignals(files);
  modelOutput.alertas_manipulacion = Array.isArray(modelOutput.alertas_manipulacion) ? modelOutput.alertas_manipulacion : [];
  modelOutput.inconsistencias = Array.isArray(modelOutput.inconsistencias) ? modelOutput.inconsistencias : [];
  for (const alert of findings.manipulation) appendUnique(modelOutput.alertas_manipulacion, alert, item => String(item));
  for (const finding of [...findings.unsupported, ...findings.contradictions]) {
    appendUnique(modelOutput.inconsistencias, finding, item => `${item.afirmacion}|${item.evidencia_contraria}`);
  }
  applyIntegrityCaps(modelOutput, findings);

  return modelOutput;
}
