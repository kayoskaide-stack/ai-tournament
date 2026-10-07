const streams=globalThis.__btBuildStreams||(globalThis.__btBuildStreams=new Map());

export function pushBuildEvent(id,event){
  const key=String(id||"default");
  const arr=streams.get(key)||[];
  arr.push({at:Date.now(),...event});
  if(arr.length>300) arr.splice(0,arr.length-300);
  streams.set(key,arr);
}
export default function handler(req,res){
  const id=String(req.query?.id||"default");
  const since=Number(req.query?.since||0);
  const arr=(streams.get(id)||[]).filter(x=>x.at>since);
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({ok:true,id,events:arr});
}
