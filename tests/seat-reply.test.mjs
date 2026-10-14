import test from 'node:test';
import assert from 'node:assert/strict';
import seatReply from '../lib/seat-reply.js';
const keys=['OPENAI_API_KEY','GEMINI_API_KEY','ANTHROPIC_API_KEY','XAI_API_KEY','DEEPSEEK_API_KEY','MISTRAL_API_KEY','OPENROUTER_API_KEY','GROK_WORKER_URL'];
const original=globalThis.fetch;
function reset(){for(const key of keys)delete process.env[key]}
function response(status,body){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})}
async function call(provider,extra={}){let code,data;await seatReply({method:'POST',body:{provider,challenge:'What is two plus two?',model:'test-model',...extra}},{status(n){code=n;return this},json(d){data=d;return this}});return{code,data}}
test('native answer includes actual API-returned model',async()=>{reset();process.env.OPENAI_API_KEY='test';let calls=0;globalThis.fetch=async()=>{calls++;return response(200,{model:'actual-openai-model',choices:[{message:{content:'Four.'}}]})};const r=await call('openai');assert.equal(calls,1);assert.equal(r.data.model,'actual-openai-model');assert.equal(r.data.fallback,false);assert.equal(r.code,200)});
test('transient native failure retries before falling back',async()=>{reset();process.env.OPENAI_API_KEY='test';let calls=0;globalThis.fetch=async()=>++calls===1?response(429,{error:{message:'busy'}}):response(200,{model:'actual',choices:[{message:{content:'Four.'}}]});const r=await call('openai');assert.equal(calls,2);assert.equal(r.data.fallback,false);assert.equal(r.data.attempts.length,2)});
test('missing native key stays unavailable instead of impersonating another model',async()=>{reset();process.env.OPENROUTER_API_KEY='test';let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not call substitute')};const r=await call('anthropic');assert.equal(calls,0);assert.equal(r.code,503);assert.equal(r.data.guess,undefined)});
test('billing failure never silently substitutes a free brain',async()=>{reset();process.env.OPENAI_API_KEY='test';process.env.OPENROUTER_API_KEY='test';let calls=0;globalThis.fetch=async()=>{calls++;return response(402,{error:{message:'No credits'}})};const r=await call('openai');assert.equal(calls,1);assert.equal(r.code,503);assert.equal(r.data.guess,undefined)});
test('all unavailable routes return an error, never a placeholder',async()=>{reset();const r=await call('mistral');assert.equal(r.code,503);assert.equal(r.data.success,false);assert.equal(r.data.guess,undefined);assert.equal(r.data.attempts.length,1)});
test('unsupported seat fails input validation',async()=>{reset();const r=await call('invented');assert.equal(r.code,400)});
test.after(()=>{reset();globalThis.fetch=original});
