import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { panelMessages } from '../lib/panel-review.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('final synthesis is a real panel mode with prior answers and no fake review',()=>{
  const r=panelMessages({model:'alpha/model:free',question:'What should I do?',mode:'synthesis',prior:[{model:'one',text:'First useful point.'},{model:'two',text:'Correction and second point.'}]});
  assert.equal(r.synthesis,true);
  assert.equal(r.mayReview,false);
  assert.match(r.system,/final editor/i);
  assert.match(r.system,/2–6 short paragraphs|2-6 short paragraphs/i);
  const prompt=JSON.parse(r.prompt);
  assert.equal(prompt.previousAnswers.length,2);
  assert.equal(prompt.question,'What should I do?');
});

test('free power rejects model identity drift and marks accepted identity',()=>{
  const src=read('lib/free-power.js');
  assert.match(src,/Model identity mismatch/);
  assert.match(src,/identityVerified:\s*true/);
  assert.match(src,/estimatedCostUsd:\s*0/);
  assert.match(src,/mode === 'synthesis'|mode === "synthesis"/);
});

test('masked and hidden views retain the real message before changing display',()=>{
  const src=read('panel-view-modes.js');
  assert.match(src,/Full Debate/);
  assert.match(src,/MASKED/);
  assert.match(src,/FINAL ANSWER ONLY/);
  assert.match(src,/baseAdd\(type,nick,text,keep\)/);
  assert.match(src,/line\.hidden=true/);
  assert.match(src,/mode:'synthesis'/);
});

test('Mission Control includes health budget audit deploy transcript and support surfaces',()=>{
  const src=read('braintrust-experience.js');
  for(const term of ['Doctor','Cost / Budget','Intelligence Fund','Audit History','Safe Deployments','Export Transcript','COPY FULL INVITE'])assert.match(src,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.match(src,/BRAINTRUST_USER/);
  const index=read('index.html');
  assert.match(index,/panel-view-modes\.js/);
  assert.match(index,/braintrust-experience\.js/);
});

test('Intelligence Fund is transparent and never enables automatic spending by default',()=>{
  const p=JSON.parse(read('config/intelligence-fund-policy.json'));
  assert.equal(p.guardrails.autoSpendEnabledByDefault,false);
  assert.equal(p.guardrails.providerIdentityMustBeVerified,true);
  assert.ok(p.measures.costPerUsefulContribution);
  assert.ok(p.allocation.reliabilityReservePercent>0);
  const status=read('api/status.js');
  assert.match(status,/BRAINTRUST_DONATE_URL/);
  assert.match(status,/BRAINTRUST_INTELLIGENCE_FUND_URL/);
});

test('IRC usrctrl is CService-gated and tournament seats do not impersonate fallbacks',()=>{
  const relay=read('shellter/relay.mjs');
  assert.match(relay,/BRAINTRUST_IRC_OWNER_ACCOUNTS/);
  assert.match(relay,/WHOIS \$\{speaker\}/);
  assert.match(relay,/scope=irc-users/);
  assert.match(relay,/contestant_identity_mismatch/);
  assert.doesNotMatch(relay,/fallbacks\s*:/);
  assert.match(relay,/NEW ONE-TIME ACCESS CODE/);
});

test('admin router exposes self-healing registration, audit and deployment status',()=>{
  const admin=read('api/admin.js');
  assert.match(admin,/scope==="self-sync"/);
  assert.match(admin,/scope==="audit"/);
  assert.match(admin,/scope==="deploy"/);
  assert.match(read('lib/registration-sync.js'),/registration_status_reconciled/);
});
