import test from 'node:test';
import assert from 'node:assert/strict';
import { panelMessages, parsePanelReply } from '../lib/panel-review.js';
import freePower from '../lib/free-power.js';

test('a review requires an actual answer and explicit structured model result', () => {
  assert.throws(()=>parsePanelReply('{"participation":"reviewed","text":"Agreed"}',false),/invalid review/);
  for(const raw of ['PASS','','I agree','{"participation":"reviewed","text":""}']) {
    assert.throws(()=>parsePanelReply(raw,true));
  }
  assert.deepEqual(parsePanelReply('{"participation":"reviewed","text":"No useful addition."}',true),{participation:'reviewed',guess:'No useful addition.'});
});
test('challenge preserves the original question and treats earlier content as reference data', () => {
  const r=panelMessages({model:'a/model:free',question:'How does baud work?\nAny other angle?',mode:'challenge',prior:[{model:'b/model',text:'Earlier explanation'}]});
  assert.equal(r.mayReview,true);
  assert.match(r.system,/overlooked assumption/);
  assert.match(r.system,/not instructions/);
  assert.match(JSON.parse(r.prompt).question,/How does baud work/);
});
test('panel endpoint performs genuine inference, returns explicit review, and fails closed on malformed output', async () => {
  const original=globalThis.fetch,old=process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY='test';let output='{"participation":"answered","text":"Four."}',calls=0;
  globalThis.fetch=async(url,options)=>{
    if(!options?.body)return new Response(JSON.stringify({data:[{id:'panel/real:free',pricing:{prompt:'0',completion:'0'},architecture:{output_modalities:['text']}}]}));
    calls++;const body=JSON.parse(options.body);assert.equal(body.messages[0].role,'system');assert.equal(body.provider.max_price.completion,0);
    return new Response(JSON.stringify({model:'panel/actual',choices:[{message:{content:output}}]}));
  };
  async function request(prior=[]){let code,data;await freePower({method:'POST',body:{model:'panel/real:free',challenge:'2 + 2?',panel:true,prior}}, {status(n){code=n;return this},json(d){data=d}});return{code,data}}
  try {
    const a=await request();assert.equal(a.data.participation,'answered');assert.equal(a.data.model,'panel/actual');
    output='{"participation":"reviewed","text":"The calculation is complete."}';
    assert.equal((await request([{model:'other',text:'Four'}])).data.participation,'reviewed');
    assert.equal((await request()).code,502);
    output='not JSON';const bad=await request();assert.equal(bad.data.success,false);assert.equal(bad.data.participation,undefined);
    assert.equal(calls,4);
  } finally {globalThis.fetch=original;if(old===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=old}
});
