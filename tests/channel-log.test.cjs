const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync('channel-log.js','utf8');
function setup(){
 const entries=new Map(),controls={},downloads=[],listeners={};
 function control(id){return controls[id]||(controls[id]={value:'',hidden:false,textContent:'',disabled:false})}
 const db={createObjectStore(){},transaction(){const tx={objectStore(){return{put(row){entries.set(row.id,row)},getAll(){const request={};setTimeout(()=>{request.result=[...entries.values()];request.onsuccess()},0);return request}}}};setTimeout(()=>tx.oncomplete?.(),0);return tx}};
 const indexedDB={open(){const request={result:db};setTimeout(()=>{request.onupgradeneeded?.();request.onsuccess()},0);return request}};
 const context={Date,Promise,Blob,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms||0,5)),clearTimeout,console,indexedDB,URL:{createObjectURL(blob){downloads.push(blob);return 'test-url'},revokeObjectURL(){}},S:{workspace:{channel:'ai-tournament',logs:{'ai-tournament':[{at:new Date(Date.now()-86400000).toISOString(),nick:'Earlier',text:'Yesterday'},{at:new Date().toISOString(),nick:'Kyle',text:'Today'}]}}},safe:s=>String(s),wb(){["#logPeriod","#logFormat","#logStart","#logEnd","#logDates","#logDownload","#logResult"].forEach(control)},$:id=>control(id),document:{createElement(){return{click(){},remove(){}}},querySelector(){return{append(){}}},body:{append(){}}}};
 context.window=context;context.addEventListener=(name,fn)=>listeners[name]=fn;vm.createContext(context);vm.runInContext(script,context);
 return{context,controls,downloads,listeners,entries};
}
test('archive retains all speakers and date export excludes older messages',async()=>{
 const {context:c,controls,downloads,listeners}=setup();
 const row={id:'gemmy',at:new Date().toISOString(),nick:'Gemmy',text:'An actual model label'};
 listeners['braintrust:message']({detail:{channel:'ai-tournament',row}});
 assert.equal((await c.BrainTrustLogs.rowsFor('ai-tournament')).length,3);
 c.BrainTrustLogs.open();controls['#logPeriod'].value='today';controls['#logFormat'].value='json';
 await controls['#logDownload'].onclick();
 const data=JSON.parse(await downloads[0].text());assert.equal(data.messages.length,2);assert.deepEqual(data.messages.map(x=>x.nick),['Kyle','Gemmy']);assert.ok(data.warnings.length);
 controls['#logPeriod'].value='all';await controls['#logDownload'].onclick();assert.equal(JSON.parse(await downloads[1].text()).messages.length,3);
});
test('archive survives trimming the display cache',async()=>{const {context:c}=setup();await c.BrainTrustLogs.rowsFor('ai-tournament');c.S.workspace.logs['ai-tournament']=[];assert.equal((await c.BrainTrustLogs.rowsFor('ai-tournament')).length,2)});
test('invalid date range produces a visible error without a download',async()=>{const {context:c,controls,downloads}=setup();c.BrainTrustLogs.open();controls['#logPeriod'].value='custom';controls['#logFormat'].value='txt';controls['#logStart'].value='2026-10-13T12:00';controls['#logEnd'].value='2026-10-12T12:00';await controls['#logDownload'].onclick();assert.match(controls['#logResult'].textContent,/valid start and end/);assert.equal(downloads.length,0)});
