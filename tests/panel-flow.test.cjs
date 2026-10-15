const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
  class Element {
    constructor(tag='div'){this.tag=tag;this.children=[];this.style={setProperty(){}};this.classList={add(){},toggle(){}};this.dataset={};this.textContent=''}
    append(...nodes){this.children.push(...nodes)} prepend(...nodes){this.children.unshift(...nodes)}
    setAttribute(){} remove(){} focus(){} querySelector(){return null}
  }
  const header=new Element(),users=new Element(),chat=new Element(),button=new Element(),input=new Element();
  const nodes={'.app header':header,'#users':users,'#send':button,'.btModuleHero':new Element()};
  const messages=[],calls=[],notices=[],storage=new Map([['BT_FREE_SELECTION','["retired/model:free"]']]);
  const models=['alpha/one:free','beta/two:free','gamma/three:free'].map(id=>({id,name:id,family:id.split('/')[0]}));
  const context={document:{createElement:t=>new Element(t),querySelector:s=>nodes[s]||null,body:new Element()},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},MutationObserver:class{observe(){}},render(){},arenaBusy:false,pendingImages:[],AI_META:[],input,chat,S:{nick:'Kyle',workspace:{channel:'ai-tournament'},history:[]},send(){throw Error('Unexpected legacy dispatch')},notice:t=>notices.push(t),add:(type,nick,text)=>messages.push({nick,text}),setTimeout,AbortSignal,
    fetch:async(url,options)=>{
      if(url.includes('health'))return{ok:true,json:async()=>({checks:[]})};
      if(!options?.body)return{ok:true,json:async()=>({configured:true,models,recommended:models})};
      const body=JSON.parse(options.body);calls.push(body);
      if(body.model.startsWith('gamma/'))return{ok:false,json:async()=>({error:'Shared quota reached'})};
      const review=body.model.startsWith('beta/')&&body.mode!=='challenge';
      return{ok:true,json:async()=>({success:true,model:body.model,latency:100,participation:review?'reviewed':'answered',guess:review?'Nothing useful to add.':'A useful answer.'})};
    }};
  vm.createContext(context);vm.runInContext(fs.readFileSync('free-power-ui.js','utf8'),context);
  return{context,calls,messages,notices,header,storage};
}
test('selected brains all receive calls; reviews, failures and another-angle rounds remain distinct',async()=>{
  const h=harness();await new Promise(r=>setImmediate(r));
  assert.equal(JSON.parse(h.storage.get('BT_FREE_SELECTION')).length,3,'retired selection repaired');
  await h.context.send('How does baud work?');
  assert.equal(h.calls.length,3);assert.equal(new Set(h.calls.map(x=>x.model)).size,3);
  assert.equal(h.calls[0].prior.length,0);assert.equal(h.calls[1].prior.length,1);
  assert.equal(h.messages.filter(x=>x.nick==='beta/two:free').length,1);
  assert.match(h.messages.find(x=>x.nick==='beta/two:free').text,/Reviewed — nothing further/);
  assert.ok(h.notices.some(x=>/No review or agreement recorded/.test(x)));
  await h.context.send('Does anyone have another angle?');
  assert.equal(h.calls.length,6);
  for(const call of h.calls.slice(3)){assert.equal(call.mode,'challenge');assert.match(call.challenge,/How does baud work/);assert.ok(call.prior.length>=1)}
  assert.ok(h.notices.some(x=>/2 answered, 0 reviewed.*1 unavailable/.test(x)));
  await h.context.send('A completely new question');
  assert.equal(h.calls[6].mode,'review');assert.equal(h.calls[6].prior.length,0);
  assert.equal(h.context.arenaBusy,false);
});
