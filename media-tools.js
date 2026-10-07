
(()=>{
  const imageRe=/^image\//i;
  function choose(accept="*/*",capture){const i=document.createElement("input");i.type="file";i.accept=accept;if(capture)i.capture=capture;return new Promise(resolve=>{i.onchange=()=>resolve(i.files?.[0]||null);i.click()})}
  function asDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
  function asText(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=reject;r.readAsText(file)})}
  async function describe(file){
    if(!file)return null;
    if(imageRe.test(file.type||""))return{kind:"image",name:file.name||"image.jpg",type:file.type,size:file.size,dataUrl:await asDataUrl(file)};
    const textLike=/^(text\/|application\/(json|javascript|xml))/i.test(file.type||"")||/\.(txt|md|json|csv|log|js|mjs|cjs|html|css)$/i.test(file.name||"");
    if(textLike){if(file.size>1024*1024)throw Error("Text upload maximum is 1 MB.");return{kind:"text",name:file.name||"file.txt",type:file.type,size:file.size,text:(await asText(file)).slice(0,250000)}}
    throw Error("That file type is not yet supported in AI chat. Use an image or small text/code file.");
  }
  window.BrainTrustMedia={async upload(){return describe(await choose("image/*,.txt,.md,.json,.csv,.log,.js,.mjs,.cjs,.html,.css"))},async camera(){return describe(await choose("image/*","environment"))}};
})();
