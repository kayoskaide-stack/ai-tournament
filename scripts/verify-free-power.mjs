import { writeFile } from 'node:fs/promises';
import { freePowerCatalog, callFreeBrain } from '../lib/free-power.js';
const catalog = await freePowerCatalog();
const checks = await Promise.all(catalog.recommended.map(async m => {
  if (!catalog.configured) return { model:m.id, verified:false, status:'connection-not-configured' };
  try { const r=await callFreeBrain({model:m.id,prompt:'What is 2 + 2? Give a brief complete answer.',panel:{perspective:'Direct answer'}}); return {model:m.id,actualModel:r.model,verified:/\b4\b|four/i.test(r.guess),participation:r.participation,attempts:r.attempts,latency:r.latency}; }
  catch(e){return{model:m.id,verified:false,status:e.status||503,error:e.message}};
}));
await writeFile('free-power-health.json', JSON.stringify({ checkedAt:new Date().toISOString(), configured:catalog.configured, checks, catalogCount:catalog.models.length },null,2));
console.log('Free AI Power live checks:',checks.filter(x=>x.verified).length+'/'+checks.length,'verified; catalog:',catalog.models.length);
