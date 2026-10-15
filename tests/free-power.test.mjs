import test from 'node:test';
import assert from 'node:assert/strict';
import {isFreeTextModel,selectFreeBrains,callFreeBrain} from '../lib/free-power.js';
const sample=(id,pricing={prompt:'0',completion:'0'})=>({id,pricing,architecture:{output_modalities:['text']},supported_parameters:['reasoning']});
test('zero-price gate rejects paid, missing pricing, and hidden request costs',()=>{
 assert.equal(isFreeTextModel(sample('a/b:free')),true);
 for(const m of [sample('a/b'),sample('a/b:free',{prompt:'0.1',completion:'0'}),sample('a/b:free',{}),sample('a/b:free',{prompt:'0',completion:'0',request:'0.01'})])assert.equal(isFreeTextModel(m),false);
});
test('default roster uses distinct model families',()=>assert.deepEqual(selectFreeBrains([{id:'a/one',family:'a'},{id:'a/two',family:'a'},{id:'b/one',family:'b'}]).map(m=>m.id),['a/one','b/one']));
test('free inference enforces catalog allowlist, zero price and genuine model response',async()=>{
 const original=globalThis.fetch;process.env.OPENROUTER_API_KEY='test';let calls=0;
 globalThis.fetch=async(url,o)=>{if(!o?.body)return new Response(JSON.stringify({data:[sample('test/real:free')]}));calls++;const b=JSON.parse(o.body);assert.equal(b.provider.max_price.prompt,0);assert.equal(b.model,'test/real:free');return new Response(JSON.stringify({model:'test/actual:free',choices:[{message:{content:'Four'}}]}))};
 try{await assert.rejects(()=>callFreeBrain({model:'paid/model',prompt:'test'}),/zero price/);assert.equal(calls,0);const r=await callFreeBrain({model:'test/real:free',prompt:'two plus two'});assert.equal(calls,1);assert.equal(r.model,'test/actual:free');assert.equal(r.free,true);assert.equal(r.fallback,false)}finally{globalThis.fetch=original;delete process.env.OPENROUTER_API_KEY}
});

test('empty, reasoning-only, truncated and malformed replies retry once on the same zero-price model',async()=>{
 const original=globalThis.fetch,old=process.env.OPENROUTER_API_KEY;
 process.env.OPENROUTER_API_KEY='test';
 try {
  for (const first of [
   {message:{content:''}},
   {message:{content:null,reasoning:'Private thoughts that must never be displayed.'}},
   {message:{content:[{type:'text',text:'A partial answer'}]},finish_reason:'length'},
   {message:{content:'{"participation":"answered","text":"broken'}}
  ]) {
   const bodies=[];
   globalThis.fetch=async(url,o)=>{
    const b=JSON.parse(o.body);bodies.push(b);
    return new Response(JSON.stringify({model:'test/real:free',choices:[bodies.length===1?first:{message:{content:[{type:'text',text:'Hello Kyle, I am here and ready to help.'}]},finish_reason:'stop'}]}));
   };
   const r=await callFreeBrain({model:'test/real:free',prompt:'Introduce yourself',panel:{}});
   assert.equal(r.attempts,2);assert.equal(r.participation,'answered');assert.match(r.guess,/Hello Kyle/);
   assert.deepEqual(bodies.map(b=>b.model),['test/real:free','test/real:free']);
   assert.deepEqual(bodies.map(b=>b.max_tokens),[2048,4096]);
   for(const b of bodies){assert.equal(b.provider.max_price.prompt,0);assert.equal(b.provider.max_price.completion,0);assert.deepEqual(b.reasoning,{enabled:false})}
  }
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:null,reasoning:'Not a final answer.'}}]}))};
  await assert.rejects(()=>callFreeBrain({model:'test/real:free',prompt:'test',panel:{}}),/thinking without a final answer/);
  assert.equal(calls,2);
  calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({error:{code:429}}))};
  await assert.rejects(()=>callFreeBrain({model:'test/real:free',prompt:'test'}),/quota or rate limit/);
  assert.equal(calls,1);
 }finally{globalThis.fetch=original;if(old===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=old}
});
