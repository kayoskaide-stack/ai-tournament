(()=>{
  async function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);
    });
  }
  async function choose(accept="*/*",capture){
    const i=document.createElement("input");i.type="file";i.accept=accept;if(capture)i.capture=capture;
    return new Promise(resolve=>{i.onchange=()=>resolve(i.files?.[0]||null);i.click()});
  }
  window.BrainTrustMedia={
    async upload(){
      const f=await choose("*/*");if(!f)return null;
      return {name:f.name,type:f.type,size:f.size,dataUrl:await fileToDataUrl(f)};
    },
    async camera(){
      const f=await choose("image/*","environment");if(!f)return null;
      return {name:f.name||"camera.jpg",type:f.type,size:f.size,dataUrl:await fileToDataUrl(f)};
    }
  };
})();
