import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import JSZip from 'jszip';
const require=createRequire(resolve('../../clap-cinematic-quest/package.json'));
const { chromium }=require('playwright');
const players=new Map();const events=[];let sequence=0,roomMetadata={};let lostOffer=false,lostReady=false;
function add(id,role,name){players.set(id,{id,role,name,connectionId:'sdk-'+id,metadata:{},color:'#123456',syncView:false});}
add('host','GM','MJ');add('guest-old','PLAYER','Invité');
function parentPage(){
 const id=new URL(location.href).searchParams.get('player');const appOrigin='http://localhost:'+location.port;
 const subscriptions=new Map();let since=0;window.__qaModals=[];
 const receive=(frame,key,data)=>frame.postMessage({id:key,data},appOrigin);
 const ready=frame=>frame.contentWindow.postMessage({id:'OBR_READY',data:{ref:'qa',userId:id}},appOrigin);
 addEventListener('message',event=>{void(async()=>{
  const msg=event.data;if(!msg||event.origin!==appOrigin)return;
  if(msg.id==='OBR_BROADCAST_SUBSCRIBE'){const channel=msg.data.channel;if(!subscriptions.has(channel))subscriptions.set(channel,new Set());subscriptions.get(channel).add(event.source);return;}
  if(msg.id==='OBR_BROADCAST_UNSUBSCRIBE'){subscriptions.get(msg.data.channel)?.delete(event.source);return;}
  if(msg.id==='OBR_MODAL_OPEN'){
    window.__qaModals.push(msg.data);
    const f=document.createElement('iframe');f.id='toast';const url=new URL(msg.data.url);url.searchParams.set('obrref',btoa(location.origin+' cross-private-room'));f.src=url;
    f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;pointer-events:none';f.onload=()=>ready(f);document.body.append(f);
  }
  if(msg.id==='OBR_MODAL_CLOSE')document.querySelector('#toast')?.remove();
  if(msg.id==='OBR_BROADCAST_SEND_MESSAGE'&&['LOCAL','ALL'].includes(msg.data.options?.destination)){
    for(const frame of subscriptions.get(msg.data.channel)||[])receive(frame,'OBR_BROADCAST_MESSAGE_'+msg.data.channel,{connectionId:'sdk-'+id,data:msg.data.data});
  }
  if(!msg.nonce)return;
  const response=await fetch('/sdk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:id,message:msg})});
  const result=await response.json();receive(event.source,msg.id+'_RESPONSE'+msg.nonce,result);
 })().catch(console.error);});
 setInterval(()=>{void fetch('/events?player='+id+'&since='+since).then(r=>r.json()).then(batch=>{for(const event of batch){since=Math.max(since,event.seq);for(const frame of subscriptions.get(event.channel)||[])receive(frame,'OBR_BROADCAST_MESSAGE_'+event.channel,{connectionId:event.connectionId,data:event.data});}}).catch(()=>{});},40);
 for(const [name,file]of[['background','background.html'],['panel','index.html']]){
  const f=document.createElement('iframe');f.id=name;f.src=appOrigin+'/ClapOwlBear/'+file+'?obrref='+btoa(location.origin+' cross-private-room');f.onload=()=>ready(f);
  if(name==='background')f.style.display='none';else f.style.cssText='width:100%;height:900px;border:0';document.body.append(f);
 }
}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/qa'){res.setHeader('Content-Type','text/html');res.end('<html><body><script>('+parentPage.toString()+')()</script></body></html>');return;}
 if(url.pathname==='/events'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(events.filter(e=>e.player!==url.searchParams.get('player')&&e.seq>Number(url.searchParams.get('since')))));return;}
 if(url.pathname==='/sdk'){
  let body='';for await(const chunk of req)body+=chunk;const {player,message}=JSON.parse(body);const self=players.get(player);let value={};
  const data=message.data;
  switch(message.id){
   case 'OBR_PLAYER_GET_ID':value={id:player};break;
   case 'OBR_PLAYER_GET_CONNECTION_ID':value={connectionId:self.connectionId};break;
   case 'OBR_PLAYER_GET_NAME':value={name:self.name};break;
   case 'OBR_PLAYER_GET_ROLE':value={role:self.role};break;
   case 'OBR_PLAYER_GET_METADATA':value={metadata:self.metadata};break;
   case 'OBR_PLAYER_GET_COLOR':value={color:self.color};break;
   case 'OBR_PLAYER_GET_SYNC_VIEW':value={syncView:false};break;
   case 'OBR_PARTY_GET_PLAYERS':value={players:[...players.values()].filter(p=>p.id!==player)};break;
   case 'OBR_ROOM_GET_METADATA':value={metadata:roomMetadata};break;
   case 'OBR_PLAYER_SET_METADATA':Object.assign(self.metadata,data.update);break;
   case 'OBR_ROOM_SET_METADATA':Object.assign(roomMetadata,data.update);break;
   case 'OBR_BROADCAST_SEND_MESSAGE':if(player==='guest-old'&&data.channel==='fr.clap.owlbear/v2/signal'&&data.data.index===0&&!lostOffer){lostOffer=true;break;}if(player==='guest-old'&&data.channel==='fr.clap.owlbear/v3/data'&&data.data.type==='ready'&&!lostReady){lostReady=true;break;}if(data.options?.destination!=='LOCAL')events.push({seq:++sequence,player,connectionId:self.connectionId,channel:data.channel,data:data.data});break;
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
 }
 const path=resolve('dist',decodeURIComponent(url.pathname).replace(/^\/ClapOwlBear\//,''));assert.ok(path.startsWith(resolve('dist')+sep));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch(error){res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,resolve));const port=server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,...(process.env.CLAP_REAL_TIMERS==='1'?{ignoreDefaultArgs:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']}: {})});const contexts=[];const errors=[];
async function participant(id){const context=await browser.newContext({viewport:{width:1000,height:850}});contexts.push(context);
 await context.addInitScript(()=>{window.RTCPeerConnection=class{constructor(){throw new Error('Direct WebRTC must not be used in native Owlbear');}};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+port+'/qa?player='+id);await page.frameLocator('#panel').getByRole('tab').first().waitFor({timeout:30000});return page;}
async function call(page,id,method,args=[]){return page.evaluate(({id,method,args})=>new Promise((resolve,reject)=>{
 const frame=document.querySelector('#panel')||document.querySelector('#background');
 // The test host invokes the extension bus in its own origin through a frame below.
 resolve(null);
}),{id,method,args}).then(async()=>{
 const frame=page.frames().find(f=>f.url().includes('/background.html'));
 return frame.evaluate(({id,method,args})=>new Promise((resolve,reject)=>{
  const bus=new BroadcastChannel('clap-owlbear:cross-private-room:'+id+':sdk-'+id);const token=crypto.randomUUID();const timer=setTimeout(()=>{bus.close();reject(new Error('RPC timeout '+method));},30000);
  bus.onmessage=({data})=>{if(method==='snapshot'&&data.type==='snapshot'&&!data.partial){clearTimeout(timer);bus.close();resolve(data.snapshot);}if(data.type==='result'&&data.id===token){clearTimeout(timer);bus.close();data.error?reject(new Error(data.error)):resolve(data.value);}};
  if(method==='importProject')args[0]=Uint8Array.from(args[0]).buffer;
  bus.postMessage(method==='snapshot'?{type:'hello'}:{type:'command',id:token,method,args});
 }),{id,method,args});});}
async function until(fn,label,timeout=30000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout: '+label);}
try{
 const host=await participant('host'),guest=await participant('guest-old');
 await until(async()=> (await call(host,'host','snapshot')).connected.includes('guest-old'),'native private guest connection');
 const source=readFileSync('vendor/clap-site/src/lib/characters.ts','utf8');
 const skills=runInNewContext('('+source.match(/export const FACET_SKILLS[^=]*=\s*({[\s\S]*?\n});/)[1]+')');
 const injuries=runInNewContext(source.match(/export const INJURY_LOCATIONS = (\[[\s\S]*?\n\]);/)[1]);
 const start=source.indexOf('export const blankCharacter =');const end=source.indexOf('\n});',start)+4;
 const fn=source.slice(start,end).replace('export const blankCharacter = (): Character =>','() =>');
 const hero=runInNewContext('('+fn.replace(/;$/,'')+')()',{crypto,activeDirectory:()=> 'project-source',FACET_SKILLS:skills,INJURY_LOCATIONS:injuries});
 hero.portrait=await host.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;const ctx=canvas.getContext('2d');const pixels=ctx.createImageData(200,200);
  for(let offset=0;offset<pixels.data.length;offset+=65536)crypto.getRandomValues(pixels.data.subarray(offset,Math.min(offset+65536,pixels.data.length)));
  for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=255;ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
 });
 hero.nom='Returning guest hero';hero.notes='SECRET_ROOM_PROGRESS';hero.autresAccessoires=[{nom:'Keepsake',proprietes:'Preserve'}];
 const zip=await new JSZip().file('studio.json',JSON.stringify({format:'clap-studio',version:1,project:{id:'project-source',name:'Guest recovery QA'},heroes:[hero],resources:[],tools:[]})).generateAsync({type:'uint8array'});
 await call(host,'host','importProject',[Array.from(zip),undefined,true]);
 const heroId=(await call(host,'host','snapshot')).roomHeroes[0].id;await call(host,'host','assignCharacter',['guest-old',heroId]);
 try {await until(async()=> (await call(guest,'guest-old','snapshot')).session.characterId===heroId,'first hero assignment',90000);} catch(error) {console.log('HOST',JSON.stringify((await call(host,'host','snapshot')).connectionDiagnostics));console.log('GUEST',JSON.stringify((await call(guest,'guest-old','snapshot')).connectionDiagnostics));throw error;}
 await call(host,'host','sendChat',['Public chat across private contexts']);
 await until(async()=> (await call(guest,'guest-old','snapshot')).messages.some(m=>m.text==='Public chat across private contexts'),'chat synchronization');
 await contexts[1].close();players.delete('guest-old');
 await until(async()=> !(await call(host,'host','snapshot')).members.some(m=>m.id==='guest-old'),'old guest leaves');
 add('guest-new','PLAYER','Invité');const returning=await participant('guest-new');
 await until(async()=> (await call(host,'host','snapshot')).connected.includes('guest-new'),'fresh private identity connects');
 assert.equal((await call(returning,'guest-new','snapshot')).session.characterId,undefined);
 await returning.frameLocator('#panel').getByLabel('Récupérer un héros',{exact:true}).selectOption(heroId);
 await returning.frameLocator('#panel').getByRole('button',{name:'Demander au MJ',exact:true}).click();
 await host.frameLocator('#panel').getByRole('heading',{name:'Récupérer un héros',exact:true}).waitFor();
 assert.equal((await call(returning,'guest-new','snapshot')).session.characterId,undefined,'No automatic identity matching by name');
 await host.frameLocator('#panel').getByRole('button',{name:'Autoriser',exact:true}).click();
 await until(async()=> (await call(returning,'guest-new','snapshot')).session.characterId===heroId,'approved recovery',90000);
 const recovered=await call(host,'host','snapshot');assert.equal(recovered.sheets['guest-new'].notes,'SECRET_ROOM_PROGRESS');assert.equal(recovered.sheets['guest-new'].autresAccessoires[0].nom,'Keepsake');
 await returning.evaluate(()=>document.querySelector('#panel').remove());
 await call(host,'host','broadcastRoll',['Force','D8 : 4',{public:true,rollVisual:{label:'Force',potential:5,outcome:'success',successes:4,dice:[{sides:8,value:4,kind:'diff',outcome:'success'}]}}]);
 await returning.frameLocator('#toast').getByText('Réussite · 4',{exact:true}).waitFor({timeout:15000});
 await returning.screenshot({path:'release/qa/private-guest-dice.png'});
 assert.ok(!JSON.stringify(events.filter(e=>e.channel==='fr.clap.owlbear/v3/data')).includes('SECRET_ROOM_PROGRESS'),'Private transport remains encrypted');
 assert.ok(lostOffer&&lostReady,'Lost opening packets must be recovered');
 assert.deepEqual(errors,[]);console.log('Cross-browser native QA OK: isolated storage, no direct WebRTC, real SDK signaling, encrypted chat and hero assignment, new guest identity recovered only after GM approval, animated dice with panel closed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
