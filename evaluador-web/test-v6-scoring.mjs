import assert from 'node:assert/strict';
import { buildV6Scores } from './api/v6-scoring.mjs';

const ids=['SC-01','SC-02','SC-03','SC-04','PD-01','PD-02','PD-03','FR-01','FR-02','FR-03','AE-01','AE-02','AE-03','GR-01','GR-02','GR-03','GR-04'];
const make=scores=>({criterios:Object.fromEntries(ids.map(id=>[id,{puntaje:scores[id]??0,estado:'PARCIAL',evidencia:[],justificacion:''}]))});

const perfect=buildV6Scores(make({'SC-01':8,'SC-02':8,'SC-03':7,'SC-04':7,'PD-01':9,'PD-02':8,'PD-03':8,'FR-01':5,'FR-02':5,'FR-03':5,'AE-01':5,'AE-02':5,'AE-03':5,'GR-01':4,'GR-02':4,'GR-03':3,'GR-04':4}));
assert.equal(perfect.puntaje_total,100);

// La referencia docente usa fracciones: V6 debe poder expresarlas sin hardcodear casos.
const weak=buildV6Scores(make({
  'SC-01':2,'SC-02':2,'SC-03':2,'SC-04':1.5,
  'PD-01':0,'PD-02':0,'PD-03':0,
  'FR-01':5,'FR-02':5,'FR-03':5,
  'AE-01':0,'AE-02':0,'AE-03':0,
  'GR-01':1,'GR-02':1,'GR-03':0.75,'GR-04':1,
}));
assert.equal(weak.evaluacion.sistema_completo_funcionando.puntaje,7.5);
assert.equal(weak.evaluacion.proceso_documentado.puntaje,0);
assert.equal(weak.evaluacion.formato_reproducibilidad.puntaje,15);
assert.equal(weak.evaluacion.analisis_economico.puntaje,0);
assert.equal(weak.evaluacion.gobierno_riesgo.puntaje,3.75);
assert.equal(weak.puntaje_total,26.25);

// Redondeo controlado a cuartos y clamp dentro del máximo.
const bounded=buildV6Scores(make({'SC-01':99,'SC-02':7.62,'SC-03':-2}));
assert.equal(bounded.evaluacion.sistema_completo_funcionando.criterios.find(c=>c.id==='SC-01').puntos,8);
assert.equal(bounded.evaluacion.sistema_completo_funcionando.criterios.find(c=>c.id==='SC-02').puntos,7.5);
assert.equal(bounded.evaluacion.sistema_completo_funcionando.criterios.find(c=>c.id==='SC-03').puntos,0);

console.log('V6 continuous scoring: OK');
