import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const $=s=>document.querySelector(s),app=$('#app'),modeLabel=$('#modeLabel'),zoomLabel=$('#zoomLabel'),hint=$('#hint');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;app.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x010208);const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.05,120);camera.position.set(0,0,7);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
const bgGroup=new THREE.Group();scene.add(bgGroup);const bg=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x071025}));bg.position.z=-7;bgGroup.add(bg);const glow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x16334e,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false}));glow.position.z=-6.96;bgGroup.add(glow);
const observations=[
 {key:'ngc346',name:'NGC 346',instrument:'MIRI',location:'SMALL MAGELLANIC CLOUD / TUCANA',distance:'≈200,000 LIGHT-YEARS',released:'10 OCT 2023',bands:'7.7 · 10 · 11.3 · 15 · 21 μm',image:'/cosmos/webb-background.webp',aspect:1851/1932,source:'https://science.nasa.gov/missions/webb/nasas-webb-captures-an-ethereal-view-of-ngc-346/',credit:'NASA, ESA, CSA, STScI, N. Habel; processing P. Kavanagh'},
 {key:'m74',name:'M74 / PHANTOM GALAXY',instrument:'MIRI',location:'PISCES / NGC 628',distance:'≈32 MILLION LIGHT-YEARS',released:'29 AUG 2022',bands:'7.7 · 10 · 11 · 21 μm',image:'/cosmos/webb-m74.webp',aspect:1977/1130,source:'https://esawebb.org/images/potm2208a/',credit:'ESA/Webb, NASA & CSA, J. Lee / PHANGS-JWST; J. Schmidt'}
];
let IMG_ASPECT=observations[0].aspect,observationIndex=0,skyLoad=0;
const skyTint=new THREE.Color(0x30486c);
function setSkyMood(astronomy){skyTint.setHex(astronomy?0xffffff:0x30486c)}
function setObservation(index){
 observationIndex=((index%observations.length)+observations.length)%observations.length;const o=observations[observationIndex],load=++skyLoad;IMG_ASPECT=o.aspect;fitBackground();
 $('#skyTitle').textContent='JWST · '+o.name+' · '+o.instrument;
 $('#astroInfo').replaceChildren();const title=document.createElement('b');title.textContent=o.name+' // '+o.instrument;$('#astroInfo').append(title);
 for(const text of [o.location+' · '+o.distance,'INFRARED / '+o.bands,'RELEASED '+o.released]){const line=document.createElement('div');line.textContent=text;$('#astroInfo').append(line)}
 const credit=document.createElement('div');credit.className='warn';credit.textContent=o.credit;$('#astroInfo').append(credit);
 const source=document.createElement('a');source.href=o.source;source.target='_blank';source.rel='noopener';source.textContent='OBSERVATION / SOURCE ↗';$('#astroInfo').append(source);
 new THREE.TextureLoader().load(o.image,t=>{if(load!==skyLoad){t.dispose();return}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());bg.material.map?.dispose();bg.material.dispose();bg.material=new THREE.MeshBasicMaterial({map:t,color:skyTint.clone(),toneMapped:false});},undefined,()=>{$('#skyTitle').textContent='JWST · '+o.name+' · IMAGE UNAVAILABLE'});
}
function fitBackground(){const dist=camera.position.z-bg.position.z,h=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*dist,w=h*camera.aspect;let W,H;if(w/h>IMG_ASPECT){W=w*1.25;H=W/IMG_ASPECT}else{H=h*1.25;W=H*IMG_ASPECT}bg.scale.set(W,H,1);glow.scale.set(W*1.014,H*1.014,1)}fitBackground();setObservation(0);
const starsGeo=new THREE.BufferGeometry(),starPos=[];for(let i=0;i<1000;i++){const r=8+Math.random()*24,a=Math.random()*Math.PI*2,z=-3-Math.random()*30;starPos.push(Math.cos(a)*r,(Math.random()-.5)*19,z)}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xddeeff,size:.024,transparent:true,opacity:.63,depthWrite:false}));scene.add(stars);
scene.add(new THREE.HemisphereLight(0xaad8ff,0x100812,.92));const cool=new THREE.PointLight(0xbfe9ff,40,30,2);cool.position.set(-4.2,3.5,5);scene.add(cool);const warm=new THREE.PointLight(0x82b5ff,24,26,2);warm.position.set(4,-2,3);scene.add(warm);
const rig=new THREE.Group(),block=new THREE.Group();scene.add(rig);rig.add(block);block.rotation.set(THREE.MathUtils.degToRad(-18),THREE.MathUtils.degToRad(32),THREE.MathUtils.degToRad(-7));
const glassMat=new THREE.MeshPhysicalMaterial({color:0xe9f8ff,metalness:0,roughness:.045,transmission:1,thickness:2.15,ior:1.52,clearcoat:.95,clearcoatRoughness:.04,attenuationColor:new THREE.Color(0xc7efff),attenuationDistance:8,envMapIntensity:2.1,side:THREE.DoubleSide});
const outer=new THREE.Mesh(new RoundedBoxGeometry(3.05,3.05,3.05,10,.16),glassMat);block.add(outer);const halo=new THREE.Mesh(new RoundedBoxGeometry(3.1,3.1,3.1,6,.18),new THREE.MeshBasicMaterial({color:0x9eeeff,transparent:true,opacity:.02,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));block.add(halo);
const faceColours=['#a2d9ff','#94ceff','#adc8ff','#a8deff','#91c8ef','#8bd5ff'];
const edgeMaterial=new THREE.LineBasicMaterial({color:0xa9ecff,transparent:true,opacity:.38});
const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.035,3.035,3.035)),edgeMaterial);block.add(edges);
for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
 const corner=new THREE.Mesh(new THREE.SphereGeometry(.029,10,8),new THREE.MeshBasicMaterial({color:0xd6ffff}));corner.position.set(sx*1.48,sy*1.48,sz*1.48);block.add(corner);
}
let tournamentMessages=[];
function drawTournamentChat(x){
 x.save();x.globalAlpha=1;x.fillStyle="rgba(3,12,30,.96)";x.fillRect(66,264,892,502);
 x.beginPath();x.rect(78,276,868,478);x.clip();
 x.fillStyle="#94ceff";x.font="500 24px ui-monospace,monospace";x.fillText("#ai-tournament / LIVE CHAT",82,300);
 if(!tournamentMessages.length){x.fillStyle="#c0d9ef";x.font="400 26px Deck,sans-serif";x.fillText("No saved messages yet. Tap to open the room.",82,380)}
 let y=348;
 for(const row of tournamentMessages.slice(-4)){
  x.fillStyle=row.nick==="Kyle"?"#f0c995":"#94ceff";x.font="600 25px Deck,sans-serif";x.fillText(String(row.nick).slice(0,42),82,y);
  x.font="400 17px ui-monospace,monospace";x.textAlign="right";x.fillStyle="#8ba6bf";const date=new Date(row.at);x.fillText(Number.isNaN(date.getTime())?"":date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),942,y);x.textAlign="left";
  x.font="400 25px Deck,sans-serif";x.fillStyle="#e4f3ff";
  const text=String(row.text||"").replace(/\s+/g," ").slice(0,1200);let line="",lines=[];
  for(const ch of text){if(x.measureText(line+ch).width>850){lines.push(line);line=""}line+=ch;if(lines.length===2)break}
  if(lines.length<2&&line)lines.push(line);else if(lines.length===2)lines[1]=lines[1].slice(0,-2)+"…";
  lines.forEach((value,i)=>x.fillText(value,82,y+34+i*31));y+=105;
 }
 x.restore();
}
function panelTexture(title,a,b,index){
 const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d'),colour=faceColours[index];
 const g=x.createLinearGradient(0,0,1024,1024);g.addColorStop(0,'rgba(6,20,55,.80)');g.addColorStop(1,'rgba(3,10,29,.70)');x.fillStyle=g;x.fillRect(35,35,954,954);
 x.strokeStyle=colour;x.lineWidth=3;x.beginPath();x.moveTo(82,36);x.lineTo(944,36);x.lineTo(988,82);x.lineTo(988,944);x.lineTo(942,988);x.lineTo(80,988);x.lineTo(36,944);x.lineTo(36,82);x.closePath();x.stroke();
 x.globalAlpha=.12;x.lineWidth=1;for(let y=60;y<980;y+=40){x.beginPath();x.moveTo(45,y);x.lineTo(979,y);x.stroke()}for(let k=60;k<980;k+=40){x.beginPath();x.moveTo(k,45);x.lineTo(k,979);x.stroke()}x.globalAlpha=1;
 x.fillStyle=colour;x.font='500 19px ui-monospace,monospace';x.fillText('BRAIN TRUST / SECTOR',78,90);x.textAlign='right';x.fillText('SECTOR 0'+(index+1),946,90);x.textAlign='left';
 x.fillStyle='#f0fcff';x.font='600 '+(title.length>13?49:64)+'px Deck,sans-serif';x.fillText(title,76,184);x.fillStyle=colour;x.font='400 22px ui-monospace,monospace';x.fillText(a,78,226);
 const cx=512,cy=506;
 x.strokeStyle=colour;x.globalAlpha=.3;for(const radius of [110,173,226]){x.beginPath();x.arc(cx,cy,radius,0,Math.PI*2);x.stroke()}x.globalAlpha=.7;x.lineWidth=4;x.beginPath();x.arc(cx,cy,226,-Math.PI*.4,Math.PI*.9);x.stroke();x.lineWidth=1;
 for(let i=0;i<60;i++){const angle=i*Math.PI/30,outer=i%5===0?247:237;x.beginPath();x.moveTo(cx+Math.cos(angle)*229,cy+Math.sin(angle)*229);x.lineTo(cx+Math.cos(angle)*outer,cy+Math.sin(angle)*outer);x.stroke()}
 x.globalAlpha=.85;
 if(index===0){for(let row=0;row<7;row++){x.fillStyle=colour;x.fillRect(cx-108,cy-87+row*27,20,3);x.globalAlpha=.3+row*.06;x.fillRect(cx-64,cy-87+row*27,45+(row*31)%120,3)}x.globalAlpha=1}
 else if(index===1){for(let i=0;i<6;i++){const angle=i*Math.PI/3;x.beginPath();x.arc(cx+Math.cos(angle)*132,cy+Math.sin(angle)*132,14,0,Math.PI*2);x.stroke();x.beginPath();x.moveTo(cx+Math.cos(angle)*118,cy+Math.sin(angle)*118);x.lineTo(cx,cy);x.stroke()}x.beginPath();x.arc(cx,cy,30,0,Math.PI*2);x.stroke()}
 else if(index===2){for(let i=0;i<6;i++){const angle=i*Math.PI/3-Math.PI/2;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(angle)*172,cy+Math.sin(angle)*172);x.stroke()}x.beginPath();for(let i=0;i<7;i++){const angle=(i%6)*Math.PI/3-Math.PI/2,rad=[144,96,157,112,150,127][i%6];const xx=cx+Math.cos(angle)*rad,yy=cy+Math.sin(angle)*rad;i?x.lineTo(xx,yy):x.moveTo(xx,yy)}x.stroke()}
 else if(index===4){for(let i=0;i<5;i++){x.globalAlpha=.45+i*.09;x.fillRect(cx-104+i*45,cy+94-(40+i*31),22,40+i*31)}x.globalAlpha=1}
 else{for(let i=0;i<50;i++){const amp=12+Math.abs(Math.sin(i*.43)*Math.cos(i*.17))*140;x.fillStyle=colour;x.fillRect(cx-175+i*7,cy-amp/2,3,amp)}}
 if(index===2)drawTournamentChat(x);
 x.fillStyle=colour;x.font='400 18px ui-monospace,monospace';x.fillText('MODULE / '+String(index+1).padStart(2,'0'),78,801);x.fillStyle='#d2e6f4';x.font='500 23px ui-monospace,monospace';x.fillText(b,78,846);x.strokeStyle=colour;x.globalAlpha=.28;x.beginPath();x.moveTo(78,874);x.lineTo(946,874);x.stroke();x.globalAlpha=1;
 x.fillStyle=colour;x.font='600 20px ui-monospace,monospace';x.fillText('TOUCH TO ENTER',78,930);x.textAlign='right';x.font='400 17px ui-monospace,monospace';x.fillText('CUBE / COSMOS',946,930);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
const faceData=[['LAB','BUILD / EXPERIMENT','PROJECTS + PROPOSALS'],['CHAT ROOM','BRAIN TRUST / IRC','TALK + COLLABORATE'],['TOURNAMENT','INDEPENDENT AI VOICES','CHALLENGE + REFINE'],['COMEDY CLUB','LAUGHLY / LIVE SCORES','JOKES + REACTIONS'],['MISSION CONTROL','PROVIDERS / SYSTEMS','LIVE STATUS + SETTINGS'],['AUDIO','LISTEN / CREATE','VOICE + LOCAL PLAYBACK']],poses=[[[0,0,1.552],[0,0,0]],[[0,0,-1.552],[0,Math.PI,0]],[[1.552,0,0],[0,Math.PI/2,0]],[[-1.552,0,0],[0,-Math.PI/2,0]],[[0,1.552,0],[-Math.PI/2,0,0]],[[0,-1.552,0],[Math.PI/2,0,0]]];
const dataGroup=new THREE.Group();block.add(dataGroup);const panels=[];faceData.forEach((d,i)=>{const m=new THREE.MeshBasicMaterial({map:panelTexture(...d,i),transparent:true,opacity:0,blending:THREE.NormalBlending,depthWrite:false,depthTest:true,side:THREE.FrontSide,toneMapped:false});const p=new THREE.Mesh(new THREE.PlaneGeometry(2.48,2.48),m);p.position.fromArray(poses[i][0]);p.rotation.set(...poses[i][1]);p.userData.baseY=p.position.y;p.scale.y=.001;dataGroup.add(p);panels.push(p)});
function setTournamentChat(rows){
 if(!Array.isArray(rows))return;
 tournamentMessages=rows.slice(-4).map(row=>({at:String(row?.at||""),nick:String(row?.nick||""),text:String(row?.text||"").slice(0,1200)}));
 const panel=panels[2],old=panel.material.map;
 panel.material.map=panelTexture(...faceData[2],2);panel.userData.liveChat=true;old.dispose();
}
document.fonts.load('500 64px Deck').then(()=>{panels.forEach((p,i)=>{const old=p.material.map;p.material.map=panelTexture(...faceData[i],i);old.dispose()})}).catch(()=>{});
export {setTournamentChat,observations,observationIndex,setObservation,setSkyMood,skyTint,faceData,THREE,$,modeLabel,zoomLabel,hint,renderer,scene,camera,bgGroup,bg,glow,stars,rig,block,outer,glassMat,halo,panels,fitBackground};
