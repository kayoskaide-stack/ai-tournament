import {bgGroup,observations,observationIndex,setObservation} from './scene.mjs';
const $=s=>document.querySelector(s);let touring=false,elapsed=0,tourClock=0;
$('#skyInspect').addEventListener('input',e=>{const n=Number(e.target.value);bgGroup.scale.set(n,n,1);$('#skyMagnification').value=n.toFixed(2)+'×'});
$('#skySequence').onclick=()=>{touring=!touring;tourClock=0;$('#skySequence').textContent=touring?'PAUSE TARGET TOUR':'START TARGET TOUR';$('#skySequence').setAttribute('aria-pressed',String(touring));document.body.classList.toggle('targetTour',touring)};
function info(){const o=observations[observationIndex];$('#obsTarget').textContent=o.name+' / '+o.instrument}info();
setInterval(()=>{if(document.hidden)return;elapsed++;if(touring&&document.body.classList.contains('astro')&&++tourClock>=20){setObservation(observationIndex+1);tourClock=0}info();$('#obsSession').textContent='VIEW TIME '+String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0')},1000);
