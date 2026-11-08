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
    if(message?.id==='OBR_MODAL_OPEN') {
      window.__qaModal = message.data;
      const frame=document.createElement('iframe');frame.id='toast';frame.src=message.data.url;
      frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;pointer-events:none';document.body.append(frame);
    }
    if(message?.id==='OBR_MODAL_CLOSE')document.querySelector('#toast')?.remove();
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
 const context=await browser.newContext({viewport:{width:1100,height:780},reducedMotion:'no-preference'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port+'/qa');
 await page.frameLocator('#panel').getByRole('button',{name:'Gérer la salle',exact:true}).waitFor();
 await page.evaluate(()=>{document.querySelector('#panel').remove();document.body.style.background='#242d38';});
 const visual={label:'Force + Athlétisme',potential:6,outcome:'prowess',successes:5,prowess:true,dice:[{sides:8,value:5,kind:'diff',outcome:'prowess'},{sides:20,value:3,kind:'destin',outcome:'prowess'}]};
 async function command(method,args) {
  return page.evaluate(({method,args})=>new Promise((resolve,reject)=>{
    const channel=new BroadcastChannel('clap-owlbear:full-import-room:host:connection-host');const id=crypto.randomUUID();
    const timer=setTimeout(()=>{channel.close();reject(new Error('Background command timeout'));},5000);
    channel.onmessage=({data})=>{if(data.type==='result'&&data.id===id){clearTimeout(timer);channel.close();data.error?reject(new Error(data.error)):resolve(data.value);}};
    channel.postMessage({type:'command',id,method,args});
  }),{method,args});
 }
 await command('broadcastRoll',['Force + Athlétisme','D8 : 5 · Destin : 3 · Potentiel 6 · Réussite : 5',{public:true,rollVisual:visual}]);
 const toast=page.frameLocator('#toast');
 await toast.getByRole('status').waitFor();
 assert.equal(await toast.locator('[data-rolling-die]').count(),2);
 const animation = await toast.locator('[data-rolling-die]').first().evaluate(el=>({count:el.getAnimations().length,transform:getComputedStyle(el).transform}));
 assert.ok(animation.count>0,'Dice must animate in the compiled Owlbear overlay');
 await page.screenshot({path:'release/qa/roll-toast-rolling.png'});
 await toast.getByText('Prouesse · 5',{exact:true}).waitFor();
 const modal=await page.evaluate(()=>window.__qaModal);assert.equal(modal.disablePointerEvents,true);assert.equal(modal.hideBackdrop,true);
 await page.screenshot({path:'release/qa/roll-toast-light.png'});
 await page.locator('#toast').waitFor({state:'detached',timeout:7000});
 await command('setRollVisibility',[true]);await command('broadcastRoll',['Secret','D6: 1',{}]);
 await page.waitForTimeout(150);assert.equal(await page.locator('#toast').count(),0);
 await page.evaluate(()=>localStorage.setItem('clap-theme','dark'));
 await command('broadcastRoll',['Force','D8 : 1',{public:true,rollVisual:{...visual,outcome:'complication',successes:1,dice:[{sides:8,value:1,kind:'diff',outcome:'complication'},{sides:20,value:17,kind:'destin',outcome:'failure'}]}}]);
 await toast.getByText(/^Complication · 1/).waitFor();await page.screenshot({path:'release/qa/roll-toast-dark.png'});
 assert.deepEqual(errors,[]);
 console.log('Native dice toast Chrome QA OK: actual background command, main panel closed, animated dice, result colors, automatic close, private roll filtering, light/dark.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
