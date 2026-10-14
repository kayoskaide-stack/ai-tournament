(()=>{
  let archiveError = '', pending = Promise.resolve();
  const db = new Promise(resolve => {
    if (!window.indexedDB) { archiveError='Browser archive unavailable.'; resolve(null); return; }
    const request=indexedDB.open('BrainTrustChannelLogs',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('messages',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{archiveError='Browser archive unavailable.';resolve(null)};
    request.onblocked=()=>{archiveError='Browser archive is blocked by another tab.';resolve(null)};
  });
  function archive(channel,rows){
    pending=pending.then(async()=>{
      const store=await db;if(!store)return;
      await new Promise((resolve,reject)=>{
        const tx=store.transaction('messages','readwrite');
        rows.forEach((row,index)=>tx.objectStore('messages').put({
          ...row,channel,id:row.id||JSON.stringify([channel,row.at,row.nick,row.text,index])
        }));
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
    }).catch(()=>{archiveError='Some messages could not be archived. Available browser history will still be exported.'});
  }
  for(const [channel,rows] of Object.entries(S.workspace.logs))archive(channel,rows);
  window.addEventListener('braintrust:message',e=>{
    if(e.detail?.row)archive(e.detail.channel,[e.detail.row]);
  });
  async function rowsFor(channel){
    await pending;const store=await db;
    if(!store)return (S.workspace.logs[channel]||[]).slice();
    return new Promise(resolve=>{
      const request=store.transaction('messages').objectStore('messages').getAll();
      request.onsuccess=()=>resolve(request.result.filter(x=>x.channel===channel).sort((a,b)=>a.at.localeCompare(b.at)));
      request.onerror=()=>{archiveError='Archive read failed.';resolve((S.workspace.logs[channel]||[]).slice())};
    });
  }
  function download(body,filename,mime){
    const url=URL.createObjectURL(new Blob([body],{type:mime})),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function localDate(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)}
  function open(){
    const channel=S.workspace.channel;
    wb('Export channel log',`<p>#${safe(channel)}</p><label>Period<select id="logPeriod"><option value="all">All saved history</option><option value="hour">Last hour</option><option value="today">Today</option><option value="custom">Custom dates</option></select></label><div id="logDates" hidden><label>Start<input id="logStart" type="datetime-local"></label><label>End<input id="logEnd" type="datetime-local"></label></div><label>Format<select id="logFormat"><option value="txt">Text file (.txt)</option><option value="json">Data file (.json)</option><option value="print">Print / Save as PDF</option></select></label><p>Dates use your phone’s local time. Includes all speakers in this browser’s saved channel history. Other devices and messages from before recording began are not included.</p><p id="logResult" role="status"></p><button id="logDownload">Export</button>`);
    $('#logStart').value=localDate(new Date(Date.now()-3600000));$('#logEnd').value=localDate(new Date());
    $('#logPeriod').onchange=()=>{$('#logDates').hidden=$('#logPeriod').value!=='custom'};
    $('#logDownload').onclick=async()=>{
      const status=$('#logResult'),button=$('#logDownload');button.disabled=true;
      try{
        const period=$('#logPeriod').value,format=$('#logFormat').value;
        let start=-Infinity,end=Date.now();
        if(period==='hour')start=end-3600000;
        if(period==='today'){const today=new Date();today.setHours(0,0,0,0);start=today.getTime()}
        if(period==='custom'){start=new Date($('#logStart').value).getTime();end=new Date($('#logEnd').value).getTime()+59999}
        if(Number.isNaN(start)||Number.isNaN(end)||start>end)throw Error('Choose valid start and end dates.');
        const rows=(await rowsFor(channel)).filter(x=>Date.parse(x.at)>=start&&Date.parse(x.at)<=end);
        if(!rows.length)throw Error('No saved messages in this period.');
        const warnings=[archiveError,'History covers messages recorded in this browser only. Earlier or other-device messages may be missing.'].filter(Boolean);
        const truncated=S.workspace.logTruncatedBefore?.[channel];
        if(truncated)warnings.push(`Older cached messages were removed before ${truncated}; only messages present in the archive can be recovered.`);
        const header=`Brain Trust — #${channel}\nExported: ${new Date().toISOString()}\nMessages: ${rows.length}\nFirst: ${rows[0].at}\nLast: ${rows[rows.length-1].at}\n${warnings.join('\n')}\n\n`;
        const body=header+rows.map(x=>`[${new Date(x.at).toLocaleString()}] <${x.nick}> ${x.text}`).join('\n\n');
        const filename=channel.replace(/[^a-z0-9_-]/gi,'_')+'-log-'+new Date().toISOString().slice(0,10);
        if(format==='print'){
          const old=document.getElementById('btLogPrintFrame');old?.remove();
          const frame=document.createElement('iframe');frame.id='btLogPrintFrame';frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px';document.body.append(frame);
          frame.contentDocument.open();frame.contentDocument.write(`<!doctype html><title>${safe(filename)}</title><style>body{font:12px monospace}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><pre>${safe(body)}</pre>`);frame.contentDocument.close();
          frame.contentWindow.focus();frame.contentWindow.print();
        }else if(format==='json')download(JSON.stringify({channel,exportedAt:new Date().toISOString(),warnings,messages:rows},null,2),filename+'.json','application/json');
        else download(body,filename+'.txt','text/plain;charset=utf-8');
        status.textContent=`Export prepared: ${rows.length} messages.`;
      }catch(e){status.textContent=e.message}finally{button.disabled=false}
    };
  }
  window.BrainTrustLogs={open,rowsFor};
  const button=document.createElement('button');button.type='button';button.textContent='Export log';button.onclick=open;
  document.querySelector('#menuBar').append(button);
})();
