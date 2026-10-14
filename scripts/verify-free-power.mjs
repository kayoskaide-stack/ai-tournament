import { writeFile } from 'node:fs/promises';
import { freePowerCatalog, callFreeBrain } from '../lib/free-power.js';
const catalog = await freePowerCatalog();
const checks = await Promise.all(catalog.recommended.map(async m => {
  if (!catalog.configured) return { model:m.id, verified:false, status:'connection-not-configured' };
  try { const r=await callFreeBrain({model:m.id,prompt:'Reply with the number 4 only: what is 2 + 2?'}); return {model:m.id,actualModel:r.model,verified:/\b4\b|four/i.test(r.guess),latency:r.latency}; }
  catch(e){return{model:m.id,verified:false,status:e.status||503,error:e.message}};
}));
await writeFile('free-power-health.json', JSON.stringify({ checkedAt:new Date().toISOString(), configured:catalog.configured, checks, catalogCount:catalog.models.length },null,2));
console.log('Free AI Power live checks:',checks.filter(x=>x.verified).length+'/'+checks.length,'verified; catalog:',catalog.models.length);
