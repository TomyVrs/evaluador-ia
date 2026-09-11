export const V6_CRITERIA={
  'SC-01':{dim:'sistema_completo_funcionando',max:8},'SC-02':{dim:'sistema_completo_funcionando',max:8},'SC-03':{dim:'sistema_completo_funcionando',max:7},'SC-04':{dim:'sistema_completo_funcionando',max:7},
  'PD-01':{dim:'proceso_documentado',max:9},'PD-02':{dim:'proceso_documentado',max:8},'PD-03':{dim:'proceso_documentado',max:8},
  'FR-01':{dim:'formato_reproducibilidad',max:5},'FR-02':{dim:'formato_reproducibilidad',max:5},'FR-03':{dim:'formato_reproducibilidad',max:5},
  'AE-01':{dim:'analisis_economico',max:5},'AE-02':{dim:'analisis_economico',max:5},'AE-03':{dim:'analisis_economico',max:5},
  'GR-01':{dim:'gobierno_riesgo',max:4},'GR-02':{dim:'gobierno_riesgo',max:4},'GR-03':{dim:'gobierno_riesgo',max:3},'GR-04':{dim:'gobierno_riesgo',max:4},
};

export const V6_DIMS={
  sistema_completo_funcionando:{max:30,ids:['SC-01','SC-02','SC-03','SC-04']},
  proceso_documentado:{max:25,ids:['PD-01','PD-02','PD-03']},
  formato_reproducibilidad:{max:15,ids:['FR-01','FR-02','FR-03']},
  analisis_economico:{max:15,ids:['AE-01','AE-02','AE-03']},
  gobierno_riesgo:{max:15,ids:['GR-01','GR-02','GR-03','GR-04']},
};

const LEGACY_PARTIAL={'SC-01':4,'SC-02':4,'SC-03':4,'SC-04':4,'PD-01':5,'PD-02':4,'PD-03':4,'FR-01':3,'FR-02':3,'FR-03':3,'AE-01':3,'AE-02':3,'AE-03':3,'GR-01':2,'GR-02':2,'GR-03':2,'GR-04':2};

function quarter(value){return Math.round(Number(value)*4)/4;}
function clamp(value,min,max){return Math.min(max,Math.max(min,value));}

export function scoreFromDecision(id,decision={}){
  const cfg=V6_CRITERIA[id]; if(!cfg)throw new Error(`Criterio V6 desconocido: ${id}`);
  if(Number.isFinite(Number(decision.puntaje))){return quarter(clamp(Number(decision.puntaje),0,cfg.max));}
  if(decision.estado==='CUMPLE')return cfg.max;
  if(decision.estado==='PARCIAL')return LEGACY_PARTIAL[id];
  if(decision.estado==='NO_CUMPLE'||decision.estado==='NO_VERIFICABLE')return 0;
  throw new Error(`Falta puntaje/estado válido para ${id}`);
}

export function stateFromScore(id,score,explicitState){
  if(explicitState==='NO_VERIFICABLE'&&score===0)return 'NO_VERIFICABLE';
  if(score<=0)return 'NO_CUMPLE';
  const pct=score/V6_CRITERIA[id].max;
  return pct>=0.85?'CUMPLE':'PARCIAL';
}

export function levelForV6(points,max,states=[]){
  if(points===0&&states.length&&states.every(s=>s==='NO_VERIFICABLE'))return 'NO_VERIFICABLE';
  const pct=(points/max)*100; if(pct>=85)return 'EXCELENTE'; if(pct>=60)return 'ADECUADO'; return 'INSUFICIENTE';
}

export function buildV6Scores(modelOutput){
  const evaluacion={}; let total=0;
  for(const [dimName,dim] of Object.entries(V6_DIMS)){
    const criterios=dim.ids.map(id=>{
      const decision=modelOutput?.criterios?.[id]; if(!decision)throw new Error(`Falta ${id}`);
      const puntos=scoreFromDecision(id,decision); const estado=stateFromScore(id,puntos,decision.estado);
      return {id,estado,puntos,evidencia:Array.isArray(decision.evidencia)?decision.evidencia:[],justificacion:decision.justificacion||''};
    });
    const puntaje=quarter(criterios.reduce((s,c)=>s+c.puntos,0));
    evaluacion[dimName]={puntaje,maximo:dim.max,nivel:levelForV6(puntaje,dim.max,criterios.map(c=>c.estado)),criterios};
    total+=puntaje;
  }
  return {evaluacion,puntaje_total:quarter(total)};
}
