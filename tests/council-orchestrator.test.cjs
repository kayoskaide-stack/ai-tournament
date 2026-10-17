const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');

class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.classList={add(){}};this.textContent='';this.value='';this.disabled=false;this.scrollHeight=0}
  append(...x){this.children.push(...x)} appendChild(x){this.children.push(x);return x} remove(){} focus(){} querySelector(){return null}
}
function harness(){
  const button=new Element('button'),bar=new Element(),chat=new Element(),input=new Element('input');input.value='';
  const notices=[],messages=[],calls=[],starts=[];
  const models=[
    {id:'alpha/one:free',name:'Alpha',family:'alpha'},
    {id:'beta/two:free',name:'Beta',family:'beta'},
    {id:'gamma/three:free',name:'Gamma',family:'gamma'},
    {id:'delta/four:free',name:'Delta',family:'delta'}
  ];
  const storage=new Map([['BT_FREE_SELECTION',JSON.stringify(models.map(x=>x.id))],['BT_AI_MODE','free']]);
  const nodes={'#send':button,'.btPowerBar':bar};
  const context={
    console,document:{readyState:'complete',body:new Element('body'),createElement:t=>new Element(t),querySelector:s=>nodes[s]||null},
    window:{BrainTrustFreePower:{},addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    MutationObserver:class{observe(){}},setTimeout,clearTimeout,AbortSignal,
    S:{nick:'Kyle',workspace:{channel:'ai-tournament'},history:[]},input,chat,pendingImages:[],AI_META:[],arenaBusy:false,
    renderPhotoTray(){},add:(type,nick,text)=>messages.push({type,nick,text}),notice:(text,type)=>notices.push({text,type}),
    send:async()=>{throw Error('legacy send should not handle council question')},
    fetch:async(url,opts)=>{
      if(!opts?.body)return{ok:true,json:async()=>({configured:true,models,recommended:models.slice(0,3)})};
      const body=JSON.parse(opts.body);calls.push(body);starts.push(Date.now());
      await new Promise(r=>setTimeout(r,body.model.startsWith('alpha/')?25:body.model.startsWith('beta/')?15:5));
      return{ok:true,json:async()=>({success:true,model:body.model,latency:25,participation:'answered',guess:`answer-${body.model}`})};
    }
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync('council-orchestrator.js','utf8'),context);
  return{context,calls,starts,messages,notices,input,storage};
}

test('first council round asks three distinct families concurrently and independently',async()=>{
  const h=harness();h.context.input.value='How should this work?';await h.context.send();
  assert.equal(h.calls.length,3);
  assert.equal(new Set(h.calls.map(x=>x.model.split('/')[0])).size,3);
  assert.ok(h.calls.every(x=>Array.isArray(x.prior)&&x.prior.length===0));
  assert.ok(Math.max(...h.starts)-Math.min(...h.starts)<15,'calls should launch together, not wait for previous answers');
  assert.equal(h.messages.filter(x=>x.nick!=='Kyle').length,3);
  assert.ok(h.notices.some(x=>/independent model families are thinking in parallel/i.test(x.text)));
  assert.ok(h.notices.some(x=>/Panel complete:/i.test(x.text)));
});

test('another-angle round gives each brain the same completed prior material',async()=>{
  const h=harness();h.context.input.value='Original question';await h.context.send();
  h.context.input.value='Does anyone have another angle?';await h.context.send();
  assert.equal(h.calls.length,6);
  for(const call of h.calls.slice(3)){
    assert.equal(call.mode,'challenge');
    assert.equal(call.prior.length,3);
    assert.match(call.challenge,/Original question/);
  }
});
