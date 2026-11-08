import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(resolve('../../clap-cinematic-quest/package.json'));
const { chromium } = require('playwright');
function harness() {
  let metadata = {}, roomMetadata = {};
  addEventListener('message', event => {
    const message = event.data;
    if (!message?.nonce) return;
    const values = { OBR_PLAYER_GET_ID:{id:'host'}, OBR_PLAYER_GET_NAME:{name:'MJ'}, OBR_PLAYER_GET_ROLE:{role:'GM'}, OBR_PLAYER_GET_CONNECTION_ID:{connectionId:'connection-host'}, OBR_PLAYER_GET_METADATA:{metadata}, OBR_PARTY_GET_PLAYERS:{players:[]}, OBR_ROOM_GET_METADATA:{metadata:roomMetadata} };
    if(message.id==='OBR_PLAYER_SET_METADATA') metadata={...metadata,...message.data.update};
    if(message.id==='OBR_ROOM_SET_METADATA') roomMetadata={...roomMetadata,...message.data.update};
    event.source.postMessage({id:message.id+'_RESPONSE'+message.nonce,data:values[message.id]||{}},location.origin);
  });
  const ref=btoa(location.origin+' full-import-room');
  for(const [id,entry] of [['background','background.html'],['panel','index.html']]) {
    const frame=document.createElement('iframe');frame.id=id;frame.src='/ClapOwlBear/'+entry+'?obrref='+ref;
    if(id==='background')frame.style.display='none';else {frame.style.width='100%';frame.style.height='900px';}
    frame.onload=()=>frame.contentWindow.postMessage({id:'OBR_READY',data:{ref:'qa',userId:'host'}},location.origin);
    document.body.append(frame);
  }
}
const server = createServer(async (req, res) => {
  if(req.url==='/qa') {res.setHeader('Content-Type','text/html');res.end('<html><body><script>('+harness.toString()+')()</script></body></html>');return;}
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/ClapOwlBear\//, '');
    const file = resolve('dist', name || 'index.html');
    assert.ok(file.startsWith(resolve('dist') + sep));
    const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json' };
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');res.end(await readFile(file));
  } catch { res.statusCode=404; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port=server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('release/qa',{recursive:true});
try {
 const context=await browser.newContext();
 await context.addInitScript(() => {
   window.__qaRenders = 0; window.__qaProgress = [];
   window.addEventListener("clap-room-import-progress", event => window.__qaProgress.push(event.detail?.message));
   const get = HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext = function(...args) { window.__qaRenders++; return get.apply(this,args); };
 });
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});
 await page.goto('http://127.0.0.1:'+port+'/qa');
 const panel=page.frameLocator('#panel');
 await panel.getByRole('button',{name:'Gérer la salle',exact:true}).waitFor({timeout:30000});
 await panel.getByRole('button',{name:'Gérer la salle',exact:true}).click();
 await panel.getByRole('menuitem',{name:'Changer de projet',exact:true}).click();
 const {default:JSZip}=await import('jszip');
 const image='data:image/png;base64,'+'A'.repeat(1800000);
 const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=';
 const tools=['a4-sheets','book-background','image-conversion'].map((kind,index)=>({id:'tool-'+index,directoryId:'source',name:'Resource '+index,kind,updatedAt:1,data:{tool:kind,settings:kind==='a4-sheets'?{fit:'cover',zoom:1,marks:true}:kind==='book-background'?{strength:60,side:'left',tone:'light'}:{style:60,rotation:0},images:[{id:'image-'+index,name:'Image',source:pixel,width:1,height:1,copies:1,rotation:0,style:60,crop:{x:.5,y:.5,zoom:1}}]}}));
 const fixture={format:'clap-studio',version:1,project:{id:'source',name:'Silverlake QA',posterImage:image,posterEditing:{source:image,rotation:0,style:0},backImages:{power:image}},heroes:[],resources:[],tools};
 const buffer=await new JSZip().file('studio.json',JSON.stringify(fixture)).generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 await panel.getByLabel('Fichier projet de la salle .clapStudio',{exact:true}).setInputFiles({name:'Silverlake.clapStudio',mimeType:'application/zip',buffer});
 const start=Date.now();
 await panel.getByRole('alertdialog').getByRole('button',{name:'Confirmer et remettre à zéro',exact:true}).click();
 await panel.getByRole('alertdialog').waitFor({state:'hidden',timeout:150000});
 await panel.getByText('Silverlake QA',{exact:true}).waitFor();
 const background = page.frames().find(frame=>frame.url().includes('background.html'));
 assert.equal(await background.evaluate(()=>window.__qaRenders),0,'Import must not run hidden canvas rendering');
 const visible = page.frames().find(frame=>frame.url().includes('index.html'));
 assert.ok((await visible.evaluate(()=>window.__qaProgress)).includes('Ressource 3/3'),'The visible panel must receive actual background import steps');
 await panel.getByRole('tab',{name:'Ressources',exact:true}).click();
 await panel.getByText('Resource 2',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('Native compiled background + panel import QA OK:',Date.now()-start,'ms');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
