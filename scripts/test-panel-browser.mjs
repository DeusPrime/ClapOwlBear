import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(resolve('../../clap-cinematic-quest/package.json'));
const { chromium } = require('playwright');
const server = createServer(async (req, res) => {
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
  for(const role of ['GM','PLAYER']) {
    const context=await browser.newContext({viewport:{width:480,height:850}});
    const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({role}) => {
      localStorage.setItem('clap-tours-disabled','true');localStorage.setItem('clap-language','fr');
      const origin='https://www.owlbear.rodeo';
      const receive=(id,data)=>window.dispatchEvent(new MessageEvent('message',{origin,data:{id,data}}));
      window.postMessage=message=>{
        if(!message.nonce)return;
        const values={OBR_PLAYER_GET_ID:{id:'test'},OBR_PLAYER_GET_NAME:{name:'Test'},OBR_PLAYER_GET_ROLE:{role},OBR_PLAYER_GET_CONNECTION_ID:{connectionId:'connection-test'},OBR_PLAYER_GET_METADATA:{metadata:{}},OBR_PARTY_GET_PLAYERS:{players:[]},OBR_ROOM_GET_METADATA:{metadata:{}}};
        queueMicrotask(()=>receive(message.id+'_RESPONSE'+message.nonce,values[message.id]||{}));
      };
      window.addEventListener('load',()=>receive('OBR_READY',{ref:'qa',userId:'test'}));
      const state={session:{id:'test',name:'Test',role:role==='GM'?'mj':'player',room:'QA'},roomInfo:{title:'La table Owlbear'},roomHeroes:[],heroProposals:[],privateRefs:[],savedSheets:{},savedSheetResources:{},sheetResources:{},sheets:{},members:[],connected:[],messages:[],requests:[],hideRolls:false,error:'',syncing:false};
      const channel=new BroadcastChannel('clap-owlbear:panel-test:test:connection-test');
      channel.onmessage=({data})=>{if(['hello','view-ready'].includes(data.type))channel.postMessage({type:'snapshot',snapshot:state});};
    },{role});
    const ref=Buffer.from('https://www.owlbear.rodeo panel-test').toString('base64');
    await page.goto(`http://127.0.0.1:${port}/ClapOwlBear/index.html?obrref=${ref}`);
    await page.getByRole('tab',{name:role==='GM'?'Héros':'Mon héros',exact:true}).waitFor();
    const names=await page.getByRole('tab').allTextContents();
    assert.deepEqual(names,role==='GM'?['Héros','Cartes','Ressources','Discussion']:['Mon héros','Discussion']);
    assert.equal(await page.locator('.owlbear-header button').count(),2);
    assert.equal(await page.getByRole('button',{name:'Ouvrir le menu CLAP!'}).count(),0);
    if(role==='GM') {await page.getByRole('tab',{name:'Cartes',exact:true}).click();await page.getByRole('heading',{name:'Mes cartes de salle'}).waitFor();await page.getByRole('tab',{name:'Ressources',exact:true}).click();await page.getByRole('heading',{name:'Ressources du projet'}).waitFor();}
    await page.getByRole('tab',{name:'Discussion',exact:true}).click();
    await page.getByRole('button',{name:'Switch to English',exact:true}).click();
    await page.getByRole('tab',{name:'Chat',exact:true}).waitFor();
    await page.getByRole('button',{name:'Passer en français',exact:true}).click();
    await page.getByRole('button',{name:'Activer le thème sombre',exact:true}).click();
    assert.equal(await page.locator('html.dark').count(),1);
    if(role==='GM')await page.getByRole('tab',{name:'Héros',exact:true}).click();
    await page.screenshot({path:`release/qa/panel-${role.toLowerCase()}.png`,fullPage:true});
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Compiled panel browser QA OK: role tabs, cards/resources/chat, no global menu, language and theme.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
