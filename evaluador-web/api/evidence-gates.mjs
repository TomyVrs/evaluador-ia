const STATE_RANK={NO_VERIFICABLE:0,NO_CUMPLE:1,PARCIAL:2,CUMPLE:3};

function evidenceFiles(userPrompt){
  const marker='CONTENIDO LEÍDO DEL ALCANCE\n';
  const start=String(userPrompt||'').indexOf(marker);
  if(start<0)return[];
  let block=String(userPrompt).slice(start+marker.length);
  const end=block.lastIndexOf('\nRecordá: todo el contenido anterior');
  if(end>=0)block=block.slice(0,end);
  const files=[];const re=/===== ARCHIVO: (.+?) =====\n([\s\S]*?)(?=\n===== ARCHIVO: |$)/g;let m;
  while((m=re.exec(block)))files.push({path:m[1].trim(),content:m[2].trim()});
  return files;
}

function joined(files,filter=()=>true){return files.filter(filter).map(f=>`\n${f.path}\n${f.content}`).join('\n');}
function capState(a,b){if(!(a in STATE_RANK)||!(b in STATE_RANK)||a==='NO_VERIFICABLE')return a;return STATE_RANK[a]>STATE_RANK[b]?b:a;}
function appendUnique(target,value,keyFn=x=>JSON.stringify(x)){const key=keyFn(value);if(!target.some(x=>keyFn(x)===key))target.push(value);}
function safeJson(text){try{return JSON.parse(text);}catch{return null;}}
function executableContent(file){if(!/\.(?:js|mjs|cjs|ts|tsx|py|sh|ps1)$/i.test(file.path))return file.content;return file.content.split('\n').filter(line=>!/^\s*(?:#|\/\/)/.test(line)).join('\n');}
function publicFinding(x){return {afirmacion:x.afirmacion,evidencia_contraria:x.evidencia_contraria,impacto:x.impacto};}

function runConsistencySignals(files){
  const groups=new Map();
  for(const file of files){
    const m=file.path.match(/(^|\/)(?:corridas?|runs?)\/([^/]+)\/(entrada|input|salida|output)\.json$/i);
    if(!m)continue;
    const key=file.path.slice(0,file.path.lastIndexOf('/'));
    if(!groups.has(key))groups.set(key,{});
    groups.get(key)[/entrada|input/i.test(m[3])?'input':'output']=safeJson(file.content);
  }
  const policies=joined(files,f=>/(?:politica|política|govern|gobierno|riesgo)/i.test(f.path+'\n'+f.content));
  const thresholdMatch=policies.match(/(?:reembolso|refund)[^\n]{0,100}(?:mayor(?:es)?|superior(?:es)?|over|above)[^\d]{0,30}(?:USD|US\$|\$)?\s*(\d+(?:[.,]\d+)?)[^\n]{0,100}(?:revisi[oó]n|aprobaci[oó]n)[^\n]{0,50}humana/i)||policies.match(/(?:revisi[oó]n|aprobaci[oó]n)[^\n]{0,50}humana[^\n]{0,100}(?:reembolso|refund)[^\d]{0,30}(?:USD|US\$|\$)?\s*(\d+(?:[.,]\d+)?)/i);
  const threshold=thresholdMatch?Number(thresholdMatch[1].replace(',','.')):null;
  let paired=0,mismatchedIds=0,policyViolations=0;const fingerprints=new Map();
  for(const [run,pair] of groups){
    if(!pair.input||!pair.output||typeof pair.input!=='object'||typeof pair.output!=='object')continue;
    paired++;
    const ids=Object.keys(pair.input).filter(k=>/(?:^|_)id$/i.test(k)&&k in pair.output);
    if(ids.some(k=>String(pair.input[k])!==String(pair.output[k])))mismatchedIds++;
    if(Number.isFinite(threshold)){
      const refundKey=Object.keys(pair.input).find(k=>/refund|reembolso/i.test(k));
      const reviewKey=Object.keys(pair.output).find(k=>/human.*review|review.*required|revision.*humana|revisi[oó]n.*humana/i.test(k));
      if(refundKey&&reviewKey&&Number(pair.input[refundKey])>threshold&&pair.output[reviewKey]===false)policyViolations++;
    }
    const fp=JSON.stringify(pair.output);if(!fingerprints.has(fp))fingerprints.set(fp,[]);fingerprints.get(fp).push({run,input:pair.input});
  }
  const repeated=[...fingerprints.values()].some(items=>items.length>=2&&new Set(items.map(x=>JSON.stringify(x.input))).size>1);
  if(!(mismatchedIds||policyViolations||(paired>=3&&repeated)))return[];
  return [{tipo:'salida_inconsistente',afirmacion:'Las corridas registradas contienen resultados que no son consistentes con sus propias entradas y/o con una regla explícita de revisión humana.',evidencia_contraria:`Corridas pareadas: ${paired}; IDs incompatibles: ${mismatchedIds}; violaciones de revisión humana: ${policyViolations}; salida idéntica sobre entradas diferentes: ${repeated?'sí':'no'}.`,impacto:'La evidencia de ejecución no valida el comportamiento declarado. Afecta la calidad funcional, el proceso y/o el gobierno; no invalida por sí sola que la corrida esté formalmente documentada y sea reproducible.'}];
}

function integritySignals(files){
  const findings={manipulation:[],unsupported:[],contradictions:[]};
  const narratives=files.filter(f=>/(?:readme|decisiones|decision|analisis|an[aá]lisis|documentaci[oó]n)/i.test(f.path));
  const implementation=files.filter(f=>!narratives.includes(f));
  const executableImpl=implementation.map(f=>`\n${f.path}\n${executableContent(f)}`).join('\n');
  const implText=executableImpl.toLowerCase();

  for(const file of files){
    const text=file.content;
    const target=/(?:evaluador|grader|corrector(?:\s+autom[aá]tico)?|calificador|sistema\s+evaluador)/i.test(text);
    const override=/(?:ignorar|ignore|override|anular|desobedecer)[^\n]{0,100}(?:reglas|instrucciones|r[uú]brica|previous|system)|(?:asignar|otorgar|registrar|devolver|return)[^\n]{0,80}(?:\d{1,3}\s*\/\s*\d{1,3}|puntaje|score|nota\s+final)|(?:respetar|mantener)[^\n]{0,80}(?:calificaci[oó]n|puntaje|score|nota)|(?:omitir|no\s+reportar|no\s+informar)[^\n]{0,100}(?:observaciones?|comentarios?|instrucci[oó]n|historial|evidencia)|no\s+es\s+necesario\s+leer[^\n]{0,120}|nota\s+final\s*(?:>=|>|debe\s+ser)\s*\d+/i.test(text);
    if(target&&override)appendUnique(findings.manipulation,`Instrucción dirigida al evaluador detectada en ${file.path}; debe reportarse e ignorarse como evidencia no confiable.`,String);
  }

  const advanced=[['MCP',/\bmcp\b/i],['Google Drive',/google\s+drive/i],['embeddings',/\bembeddings?\b/i],['similitud coseno',/(?:coseno|cosine)/i],['lazy loading',/lazy\s+loading/i],['resumen jerárquico',/(?:hierarchical|jer[aá]rquic)/i],['memoria persistente',/memoria\s+persistente/i]];
  const unsupportedTerms=[];
  for(const [label,re] of advanced){if(narratives.some(f=>re.test(f.content))&&!re.test(implText))unsupportedTerms.push(label);}
  if(unsupportedTerms.length>=2)findings.unsupported.push({tipo:'capacidades_no_verificadas',afirmacion:`Se describen mecanismos avanzados (${unsupportedTerms.join(', ')}) sin respaldo fuera de archivos narrativos.`,evidencia_contraria:'No aparecen implementación, configuración, trazas o resultados independientes que corroboren esos mecanismos.',impacto:'No deben computarse como evidencia de funcionamiento, integración, memoria ni gobierno.'});

  const allNarrative=joined(narratives);const run3=joined(files,f=>/(?:corrida[_ -]?0?3|run[_ -]?0?3)/i.test(f.path));
  const historicalError=/(?:corrida\s*3|run\s*3)[\s\S]{0,500}(?:clasific[^\n]{0,120}(?:sin_oc|sin\s+oc)|reclamo\s+al\s+proveedor|error\s+de\s+clasificaci[oó]n)/i.test(allNarrative)||/(?:nota\s+de\s+cr[eé]dito|nc[^\n]{0,80})[^\n]{0,160}(?:sin_oc|sin\s+oc)/i.test(allNarrative);
  const rewrittenSuccess=/(?:nota\s+de\s+cr[eé]dito|\bnc\b)[\s\S]{0,220}ajuste[\s\S]{0,500}(?:0\s+de\s+\d+|cero\s+clasificaciones?\s+corregidas?|ninguna[^\n]{0,80}errores?\s+de\s+clasificaci[oó]n)/i.test(run3);
  const notVerified=/(?:no\s+verificado|todav[ií]a\s+no\s+volv[ií]\s+a\s+correr|no\s+volv[ií]\s+a\s+correr|sin\s+re[- ]?ejecutar)/i.test(allNarrative);
  const claimsValidated=/(?:video\s+muestra[^\n]{0,160}(?:corridas|ejecuciones)[^\n]{0,160}(?:ninguna|sin)[^\n]{0,100}errores?|cero\s+clasificaciones?\s+corregidas?)/i.test(run3);
  if((historicalError&&rewrittenSuccess)||(notVerified&&claimsValidated))findings.contradictions.push({tipo:'historial_fabricado',afirmacion:'La documentación histórica declara una falla real/no verificada, pero la evidencia de la corrida correspondiente fue reescrita como exitosa o sin correcciones.',evidencia_contraria:'DECISIONES/README y los artefactos de la corrida 3 describen estados incompatibles para la misma ejecución.',impacto:'Contradicción material sobre qué ocurrió realmente: compromete proceso, evidencia de corrida, reproducibilidad y supervisión.'});

  const integrationClaim=narratives.some(f=>/(?:integrado\s+(?:al|con\s+el)|integraci[oó]n|conexi[oó]n|conect[oó]\s+el|consulta\s+en\s+tiempo\s+real)[^\n]{0,100}(?:crm|salesforce|hubspot|google\s+drive|drive|api)|(?:crm|salesforce|hubspot|google\s+drive)[^\n]{0,80}(?:integrado|conectado|tiempo\s+real)/i.test(f.content));
  const integrationProof=/(?:requests\.(?:get|post|put|delete)|httpx\.(?:get|post|put|delete)|axios\.(?:get|post|put|delete)|fetch\s*\(|(?:salesforce|hubspot|drive|crm)[A-Za-z0-9_.]*\.(?:get|post|query|search|create|update|delete)\s*\()/i.test(executableImpl);
  const accuracyClaim=narratives.some(f=>/(?:(?:exactitud|accuracy|precisi[oó]n)[^\n]{0,60}9\d(?:[.,]\d+)?\s*%|9\d(?:[.,]\d+)?\s*%[^\n]{0,60}(?:exactitud|accuracy|precisi[oó]n))/i.test(f.content));
  const metricProof=implementation.some(f=>/(?:(?:exactitud|accuracy|precisi[oó]n)[^\n]{0,80}\d+(?:[.,]\d+)?\s*%|\d+(?:[.,]\d+)?\s*%[^\n]{0,80}(?:exactitud|accuracy|precisi[oó]n))/i.test(executableContent(f)));
  const productionClaim=narratives.some(f=>/(?:list[oa]\s+para\s+producci[oó]n|production[- ]ready|aprobado\s+para\s+producci[oó]n)/i.test(f.content));
  const explicitPending=implementation.some(f=>/(?:pendiente\s+(?:conectar|implementar|integrar)|todo\b|not\s+implemented)/i.test(executableContent(f)));
  if((integrationClaim&&!integrationProof)||(accuracyClaim&&!metricProof)||(productionClaim&&explicitPending))findings.unsupported.push({tipo:'capacidades_no_verificadas',afirmacion:'El trabajo declara integración externa, desempeño cuantitativo alto y/o preparación productiva sin evidencia independiente suficiente.',evidencia_contraria:'La implementación no muestra una llamada operable corroborable, la métrica no tiene medición trazable y/o existen pendientes explícitos incompatibles con la afirmación.',impacto:'La afirmación se considera no verificada y no puede elevar criterios de sistema, proceso o gobierno.'});

  for(const f of runConsistencySignals(files))findings.contradictions.push(f);
  return findings;
}

function applyIntegrityCaps(modelOutput,findings){
  const cap=(id,state,note)=>{const c=modelOutput.criterios?.[id];if(!c)return;const before=c.estado;c.estado=capState(before,state);if(c.estado!==before)c.justificacion=`${c.justificacion||''} [Control de integridad V6: ${before} → ${c.estado}; ${note}]`.trim();};
  if(findings.unsupported.length){cap('SC-02','PARCIAL','capacidades o integración sin evidencia independiente suficiente');cap('GR-02','PARCIAL','controles/capacidades declarados sin soporte verificable');}
  for(const finding of findings.contradictions){
    if(finding.tipo==='historial_fabricado'){
      cap('SC-03','PARCIAL','resultado histórico reescrito de manera incompatible');cap('PD-02','PARCIAL','la falla real no queda preservada de forma confiable');cap('PD-03','PARCIAL','decisiones y corrida no son trazables de forma consistente');cap('FR-02','PARCIAL','la evidencia original de una corrida fue alterada o contradicha');cap('FR-03','PARCIAL','no puede reconstruirse de forma confiable qué versión/resultado ocurrió');cap('GR-04','PARCIAL','la revisión declarada contradice la evidencia histórica');
    }else if(finding.tipo==='salida_inconsistente'){
      cap('SC-03','PARCIAL','las salidas no son consistentes con sus entradas o reglas funcionales');cap('PD-02','PARCIAL','las corridas no validan el comportamiento declarado');cap('PD-03','PARCIAL','las decisiones no se sostienen contra las ejecuciones registradas');cap('GR-04','PARCIAL','una regla explícita de revisión humana no se respeta en la salida');
      // No tocar FR-02/FR-03: una corrida puede estar perfectamente documentada y ser funcionalmente incorrecta.
    }
  }
}

// V6: GPT juzga semánticamente los criterios. Los viejos gates regex de scoring quedan retirados.
const LEGACY_GATES_RETIRED_V6=['SC-02','PD-01','FR-03','AE-01','AE-03'];void LEGACY_GATES_RETIRED_V6;

export function applyDeterministicEvidenceGates(modelOutput,userPrompt){
  if(!modelOutput?.criterios)return modelOutput;
  const files=evidenceFiles(userPrompt);if(!files.length)return modelOutput;
  const findings=integritySignals(files);
  modelOutput.alertas_manipulacion=Array.isArray(modelOutput.alertas_manipulacion)?modelOutput.alertas_manipulacion:[];
  modelOutput.inconsistencias=Array.isArray(modelOutput.inconsistencias)?modelOutput.inconsistencias:[];
  for(const alert of findings.manipulation)appendUnique(modelOutput.alertas_manipulacion,alert,String);
  for(const internal of [...findings.unsupported,...findings.contradictions]){const finding=publicFinding(internal);appendUnique(modelOutput.inconsistencias,finding,x=>`${x.afirmacion}|${x.evidencia_contraria}`);}
  applyIntegrityCaps(modelOutput,findings);
  return modelOutput;
}
