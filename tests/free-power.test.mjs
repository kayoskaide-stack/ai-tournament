import test from 'node:test';
import assert from 'node:assert/strict';
import {isFreeTextModel,selectFreeBrains,callFreeBrain} from '../lib/free-power.js';
const sample=(id,pricing={prompt:'0',completion:'0'})=>({id,pricing,architecture:{output_modalities:['text']}});
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
