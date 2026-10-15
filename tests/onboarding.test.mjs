import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createIdentityGate } from '../shellter/identity-gate.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'bt-gate-'));
Object.assign(process.env,{BRAINTRUST_SESSION_SECRET:'test-only-secret-at-least-32-characters',BRAINTRUST_OWNER_EMAIL:'owner@example.test',BRAINTRUST_ALLOWED_EMAILS:'allowed@example.test',RESEND_API_KEY:'test',BRAINTRUST_EMAIL_FROM:'test@example.test',BRAINTRUST_PUBLIC_URL:'https://braintrust.example.test',BRAINTRUST_RELAY_BASE_URL:'https://relay.example.test',BRAINTRUST_RELAY_TOKEN:'test-relay-token-long-enough'});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const d of ['lib','security','api'])fs.mkdirSync(path.join(root,d));
fs.writeFileSync(path.join(root,'package.json'),'{"type":"module"}');
fs.writeFileSync(path.join(root,'security/users.js'),'export default '+JSON.stringify({users:[{id:'owner-kyle',nick:'Kyle',role:'owner',rev:1,codeSha256:hash('owner-code')},{id:'guest-dan',nick:'Dan',role:'member',rev:2,codeSha256:hash('dan-code')}]}));
fs.writeFileSync(path.join(root,'security/policy.js'),'export default {frozen:false}');
for(const p of ['lib/braintrust-auth.js','lib/identity-bridge.js','api/auth.js'])fs.copyFileSync(new URL('../'+p,import.meta.url),path.join(root,p));
const auth=await import(pathToFileURL(path.join(root,'lib/braintrust-auth.js')));
const {default:handler}=await import(pathToFileURL(path.join(root,'api/auth.js')));
const req=r=>({headers:{cookie:'bt_session='+r.token}});
const response=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.data=v;return this},send(v){this.data=v;return this},end(){}});
function signed(p){const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+crypto.createHmac('sha256',process.env.BRAINTRUST_SESSION_SECRET).update(b).digest('base64url')}
test('invite and legacy guest sessions locked; owner access retained',()=>{
 const invite=auth.loginUser('Dan','dan-code');assert.equal(invite.onboarding,true);assert.equal(auth.authenticateRequest(req(invite)),null);assert.equal(auth.readOnboarding(req(invite)).emailVerified,false);
 const r=response();assert.equal(auth.requireAccess(req(invite),r),null);assert.equal(r.statusCode,401);
 assert.equal(auth.authenticateRequest(req({token:signed({id:'guest-dan',kind:'registry',rev:2,exp:Date.now()+10000})})),null);
 assert.equal(auth.authenticateRequest(req(auth.loginUser('Kyle','owner-code'))).role,'owner');assert.equal(auth.loginUser('Dan','wrong'),null);
});
test('email confirmation precedes account proof; typed username is insufficient',()=>{
 const pending=auth.readOnboarding(req(auth.loginUser('Dan','dan-code')));
 const token=auth.createMagicLinkToken({email:'dan@example.test',invite:{id:pending.id,rev:pending.rev,flow:pending.flow}});
 const email=auth.loginPasswordless(auth.readMagicLinkToken(token)), user=auth.readOnboarding(req(email));
 assert.equal(user.emailVerified,true);assert.equal(user.id,'guest-dan');assert.equal(auth.authenticateRequest(req(email)),null);
 assert.equal(auth.completeOnboarding(user,{verified:false,account:'Dan'}),null);assert.equal(auth.completeOnboarding({...user,emailVerified:false},{verified:true,account:'Dan'}),null);
 assert.equal(auth.authenticateRequest(req(auth.completeOnboarding(user,{verified:true,account:'DanAccount'}))).cservice,'DanAccount');
 assert.equal(auth.readMagicLinkToken(token+'x'),null);
 assert.equal(auth.readMagicLinkToken(auth.createMagicLinkToken({email:'dan@example.test',invite:{id:pending.id,rev:1,flow:pending.flow}})),null);
 assert.equal(auth.authenticateRequest(req(auth.loginPasswordless({email:'allowed@example.test',nick:'Allowed',cservice:'anything'}))),null);
});
test('private challenge plus server WHOIS required; ownership, persistence, expiry, replay',()=>{
 let clock=1000000;const sent=[],file=path.join(root,'state.json');const gate=createIdentityGate({send:s=>sent.push(s),nick:'Bot',file,now:()=>clock});
 const binding='dan:2:'+'a'.repeat(48), {challenge}=gate.start(binding);
 assert.equal(gate.start(binding).challenge,challenge);assert.throws(()=>gate.status('other',challenge));
 const pm={command:'PRIVMSG',prefix:'Dan!u@host',params:['Bot'],trailing:'!verify '+challenge};const num=(command,prefix='server')=>({command,prefix,params:['Bot','Dan','DanAccount'],trailing:''});
 gate.handle({...pm,params:['#room']});assert.equal(sent.length,0);gate.handle(pm);assert.equal(sent[0],'WHOIS Dan Dan');
 gate.handle(num('330','Evil!u@h'));gate.handle(num('318'));assert.equal(gate.status(binding,challenge).verified,false);
 gate.handle(pm);gate.handle(num('330'));gate.handle(num('318'));assert.equal(gate.status(binding,challenge).account,'DanAccount');
 assert.equal(createIdentityGate({send(){},nick:'Bot',file,now:()=>clock}).status(binding,challenge).verified,true);
 gate.consumeEmail('b'.repeat(48),clock+10000);assert.throws(()=>gate.consumeEmail('b'.repeat(48),clock+10000));clock+=16*60000;assert.throws(()=>gate.status(binding,challenge));
});
test('WHOIS timeout, nick change and disconnect fail closed',()=>{
 let clock=0;const gate=createIdentityGate({send(){},nick:'Bot',file:path.join(root,'timeouts.json'),now:()=>clock}),binding='x'.repeat(48),{challenge}=gate.start(binding);
 const pm={command:'PRIVMSG',prefix:'Dan!u@h',params:['Bot'],trailing:'!verify '+challenge},num=command=>({command,prefix:'server',params:['Bot','Dan','Account'],trailing:''});
 gate.handle(pm);clock=16000;gate.handle(num('330'));gate.handle(num('318'));assert.equal(gate.status(binding,challenge).verified,false);
 gate.handle(pm);gate.handle({command:'NICK',prefix:'Dan!u@h',params:[],trailing:'Other'});gate.handle(num('330'));gate.handle(num('318'));assert.equal(gate.status(binding,challenge).verified,false);
 gate.handle(pm);gate.reset();gate.handle(num('330'));gate.handle(num('318'));assert.equal(gate.status(binding,challenge).verified,false);
});
test('API confirmation email, one-time consumption, ordering, cross-origin and outage checks',async()=>{
 let r=response();await handler({method:'POST',query:{action:'identity-start'},headers:{},body:{}},r);assert.equal(r.statusCode,403);
 const invite=auth.loginUser('Dan','dan-code');let mail,used=false;const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{if(url==='https://api.resend.com/emails'){mail=JSON.parse(options.body);return {ok:true}}if(url.endsWith('/consume-email')){if(used)return {ok:false};used=true;return {ok:true,json:async()=>({ok:true})}}throw Error('offline')};
 try{
 r=response();await handler({method:'POST',query:{action:'request-link'},headers:req(invite).headers,body:{email:'dan@example.test'}},r);assert.equal(r.statusCode,200);assert.equal(mail.to,'dan@example.test');assert.match(mail.html,/CONFIRM MY EMAIL/);
 const token=new URL(mail.text.match(/https:\/\/\S+/)[0]).searchParams.get('token');r=response();await handler({method:'POST',query:{action:'verify'},body:{token},headers:{}},r);assert.equal(r.statusCode,302);
 const cookie=r.headers['Set-Cookie'].split(';')[0];assert.equal(auth.sessionSummary({headers:{cookie}}).onboarding.emailVerified,true);
 r=response();await handler({method:'POST',query:{action:'verify'},body:{token},headers:{}},r);assert.equal(r.statusCode,503);
 r=response();await handler({method:'POST',query:{action:'identity-start'},headers:{cookie},body:{}},r);assert.equal(r.statusCode,503);assert.match(r.data.error,/locked/);
 mail=null;r=response();await handler({method:'POST',query:{action:'request-link'},headers:{},body:{email:'allowed@example.test'}},r);assert.equal(mail,null);
 r=response();await handler({method:'POST',query:{action:'login'},headers:{origin:'https://evil.test',host:'braintrust.example.test'},body:{nick:'Dan',code:'dan-code'}},r);assert.equal(r.statusCode,403);
 }finally{globalThis.fetch=original}
});
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));

test('single-file deployed relay includes the tested identity gate',()=>{
 const source=fs.readFileSync(new URL('../shellter/identity-gate.mjs',import.meta.url),'utf8');
 const embedded=source.slice(source.indexOf('const fold')).replace('export function createIdentityGate','function createIdentityGate');
 assert.ok(fs.readFileSync(new URL('../shellter/relay.mjs',import.meta.url),'utf8').includes(embedded));
});
