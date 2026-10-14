const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[],calls=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());let data={ok:true};
  if(url.pathname==='/api/session')data={user:{id:'test',nick:'Kyle',role:'owner'}};
  if(url.pathname==='/api/status')data={configuredKeys:['gemini'],callableSeats:['openai','gemini','anthropic','xai','deepseek','mistral','openrouter']};
  if(url.pathname==='/api/gate'&&url.searchParams.get('target')==='contestant'){
   const body=route.request().postDataJSON();calls.push(body);assert.equal(body.allSeats,true);
   data={guess:'Four. This is a test response from a simulated API.',provider:body.provider,actualProvider:body.provider==='gemini'?'gemini':'openrouter',model:'test/actual-model',fallback:body.provider!=='gemini',route:'test/route'};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:8765');
 await page.waitForFunction(()=>window.BrainTrustLogs&&document.body.classList.contains('bt-auth-ready'));
 const cube=page.frames().find(f=>f.url().includes('/cosmos/'));
 await cube.evaluate(()=>parent.postMessage({type:'braintrust:face-open',index:2},location.origin));
 await page.waitForFunction(()=>!document.querySelector('#btCubePanel').hidden);
 await page.evaluate(async()=>{S.admin.humanPace=false;for(const a of AI_META){S.providerState[a.key].status='out'};await send('What is two plus two?')});
 assert.equal(calls.length,7);assert.equal(new Set(calls.map(x=>x.provider)).size,7);
 assert.equal(await page.locator('#chat .message').count(),8);
 assert.equal(await page.locator('#chat').getByText('[Fallback:',{exact:false}).count(),6);
 assert.match(await page.locator('.btHeroMetrics').innerText(),/ROOM MESSAGES\s+8/);
 await page.evaluate(()=>{const channel=S.workspace.channel;const row={id:crypto.randomUUID(),at:new Date(Date.now()-86400000).toISOString(),nick:'Old speaker',text:'Yesterday archive test'};window.dispatchEvent(new CustomEvent('braintrust:message',{detail:{channel,row}}));BrainTrustLogs.open()});
 await page.locator('#logPeriod').selectOption('today');await page.locator('#logFormat').selectOption('json');
 const downloadPromise=page.waitForEvent('download');await page.locator('#logDownload').click();const download=await downloadPromise;
 const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 assert.equal(exported.messages.length,8);assert.ok(exported.messages.every(x=>x.nick!=='Old speaker'));assert.ok(exported.warnings.length);
 await page.locator('#logPeriod').selectOption('all');const fullPromise=page.waitForEvent('download');await page.locator('#logDownload').click();const full=JSON.parse(await fs.readFile(await (await fullPromise).path(),'utf8'));assert.equal(full.messages.length,9);
 await page.reload();await page.waitForFunction(()=>window.BrainTrustLogs);assert.equal(await page.evaluate(async()=> (await BrainTrustLogs.rowsFor('ai-tournament')).length),9);
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: seven seats attempted despite OUT state; actual model/fallback labels; live message count; date filtering; all saved speakers; archive retained after reload; no JS errors. External APIs were simulated.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
