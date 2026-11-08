import OBR from '@owlbear-rodeo/sdk';
import type { Player } from '@owlbear-rodeo/sdk';
import { MAX_PROJECT, projectSchema, readArchive, rollDice, stored, type Project } from './model';
import './style.css';
const CHANNEL='fr.clap.owlbear/v1', META='fr.clap.owlbear/hero';
let project:Project|undefined, selected='', connected=false, role='GM', playerId='preview', playerName='Aperçu', room='preview';
let party:Player[]=[], tab='project', publishing=false;
type Message={id:string;author:string;text:string;time:number};
let messages:Message[]=[];
const transfers=new Map<string,{sender:string;parts:string[];next:number;size:number;started:number}>();
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><img src="${import.meta.env.BASE_URL}icon.svg" alt=""><div><h1>CLAP! <span>STUDIO</span></h1><p>Votre plateau de jeu</p></div><span id="connection">Aperçu local</span></header><nav aria-label="Onglets"><button data-tab="project">Projet</button><button data-tab="sheet">Ma fiche</button><button data-tab="chat">Discussion</button></nav><p id="status" role="status"></p><main id="content"></main><footer>CLAP! · Owlbear Rodeo <span>0.1 · prototype</span></footer>`;
const content=document.querySelector<HTMLElement>('#content')!;
function status(text:string){document.querySelector('#status')!.textContent=text;}
function el<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''){const node=document.createElement(tag);node.textContent=text;node.className=className;return node;}
function button(text:string,action:()=>void|Promise<void>){const b=el('button',text);b.type='button';b.onclick=()=>{Promise.resolve().then(action).catch(report);};return b;}
function report(error:unknown){status(error instanceof Error?error.message:'Une erreur est survenue.');}
function info(title:string,text:string){content.append(el('h2',title),el('p',text,'muted'));}
function render(){
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.tab===tab)));
  content.replaceChildren();
  if(tab==='project')renderProject();else if(tab==='sheet')renderSheet();else renderChat();
}
function renderProject(){
  info(project?.project.name||'Le prochain film commence ici',project?`${project.heroes.length} héros · ${project.resources.length} ressources · ${project.tools.length} documents`:'Importez un projet .clapStudio créé sur le site CLAP!.');
  if(role==='GM'){
    const input=el('input'); input.type='file';input.accept='.clapStudio';input.id='archive';input.setAttribute('aria-label','Importer un projet .clapStudio');
    input.onchange=()=>{const file=input.files?.[0];if(file)void (async()=>{status('Lecture du projet…');const next=await readArchive(file);await stored(`${room}:project`,next);project=next;selected='';status('Projet importé sur ce navigateur. Il reste privé tant que vous ne le partagez pas.');render();})().catch(report);};
    content.append(input);
    if(project){content.append(el('p','Le partage rend tout le projet accessible aux joueurs connectés, y compris les notes et les documents. Importez une copie sans secrets du MJ.','notice'));
      const share=button(publishing?'Partage en cours…':'Partager tout le projet dans la salle',()=>publish());share.disabled=publishing||!connected;content.append(share);
    }
  } else if(!project)content.append(el('p','Le MJ doit ouvrir son panneau CLAP! et partager le projet.'));
  if(!project)return;
  const folder=el('details');folder.open=true;folder.append(el('summary',`📁 ${project.project.name}`));
  for(const hero of project.heroes)folder.append(button(`Fiche · ${hero.nom}`,()=>{selected=hero.id;tab='sheet';render();}));
  for(const resource of project.resources){const detail=el('details');detail.append(el('summary',`${resource.type} · ${String(resource.item.nom||resource.item.name||resource.item.titre||'Ressource')}`));detail.append(fields(resource.item));folder.append(detail);}
  for(const tool of project.tools){const detail=el('details');detail.append(el('summary',`Document · ${String(tool.name||'Sans titre')}`));detail.append(fields(tool));folder.append(detail);}
  content.append(folder,el('p','Dossier du panneau CLAP! : l’import dans les dossiers natifs Owlbear sera ajouté ultérieurement.','muted'));
}
function fields(value:unknown,depth=0):HTMLElement{
  const out=el('div','','fields');if(depth>6)return out;
  if(Array.isArray(value)){for(const item of value)out.append(fields(item,depth+1));return out;}
  if(value && typeof value==='object'){
    for(const [key,v] of Object.entries(value)){
      if(['id','directoryId','updatedAt'].includes(key)||v===null||v===undefined||v==='')continue;
      if(typeof v==='string'&&v.startsWith('data:image/')){if(/^data:image\/(png|jpeg|webp|gif);base64,/.test(v)){const image=el('img');image.src=v;image.alt=key;image.loading='lazy';out.append(image);}continue;}
      out.append(el('strong',key));out.append(fields(v,depth+1));
    }
  }else out.append(el('p',String(value)));
  return out;
}
function renderSheet(){
  info('Ma fiche','Associez votre joueur Owlbear à un héros du projet.');
  if(!project){content.append(el('p','Importez ou recevez un projet pour accéder aux fiches.'));return;}
  const select=el('select');select.setAttribute('aria-label','Choisir un héros');
  select.append(new Option('Choisir un héros',''));
  for(const h of project.heroes)select.append(new Option(h.nom,h.id));
  select.value=selected;select.onchange=()=>{selected=select.value;render();};content.append(select);
  const hero=project.heroes.find(h=>h.id===selected);if(!hero)return;
  content.append(button('Associer cette fiche à mon joueur',async()=>{if(connected)await OBR.player.setMetadata({[META]:{projectId:project!.project.id,heroId:hero.id}});await stored(`${room}:selection`,hero.id);status(`Fiche de ${hero.nom} associée à ${playerName}.`);}));
  content.append(el('h2',hero.nom));if(hero.concept)content.append(el('p',hero.concept));
  if(hero.portrait&&/^data:image\/(png|jpeg|webp);base64,/.test(hero.portrait)){const image=el('img');image.src=hero.portrait;image.alt=hero.nom;image.className='portrait';content.append(image);}
  if(hero.facets){const facets=el('div','','facets');for(const [name,facet]of Object.entries(hero.facets)){const card=el('section');card.append(el('h3',`${name==='ame'?'Âme':name} · ${facet.core}`));for(const [skill,value]of Object.entries(facet.skills))card.append(el('p',`${skill} : ${value}`));facets.append(card);}content.append(facets);}
  const details=el('details');details.append(el('summary','Toutes les données de la fiche'),fields(hero));content.append(details);
  content.append(button('Faire un jet public',()=>{tab='chat';render();}));
}
function renderChat(){
  info('Discussion de salle','Messages et jets publics. Le panneau doit rester ouvert pour recevoir les événements.');
  const log=el('div','','log');log.setAttribute('role','log');log.setAttribute('aria-label','Messages de la salle');
  if(!messages.length)log.append(el('p','Le plateau attend votre première réplique.','muted'));
  for(const m of messages){const item=el('article');item.append(el('strong',m.author),el('time',new Date(m.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})),el('p',m.text));log.append(item);}
  content.append(log);
  const form=el('form');const input=el('input');input.placeholder='Votre message…';input.maxLength=1500;input.required=true;input.setAttribute('aria-label','Votre message');const send=el('button','Envoyer');send.type='submit';form.append(input,send);
  form.onsubmit=e=>{e.preventDefault();const text=input.value.trim();if(text)void post(text).then(()=>{input.value='';}).catch(report);};content.append(form);
  const diceForm=el('form');const dice=el('input');dice.value='2d6';dice.maxLength=24;dice.setAttribute('aria-label','Notation du jet de dés');const roll=el('button','Lancer en public');roll.type='submit';diceForm.append(dice,roll);diceForm.onsubmit=e=>{e.preventDefault();void(async()=>{const r=rollDice(dice.value);await post(`🎲 ${r.notation} → [${r.dice.join(', ')}] = ${r.total}`);})().catch(report);};content.append(diceForm,el('p','Jets génériques : NdF±bonus. Les règles spécifiques CLAP! restent à intégrer. Historique conservé sur ce navigateur, limité aux 200 derniers événements.','muted'));
  log.scrollTop=log.scrollHeight;
}
async function addMessage(m:Message){if(messages.some(x=>x.id===m.id))return;messages=[...messages,m].slice(-200);if(tab==='chat')render();await stored(`${room}:messages`,messages);}
async function post(text:string){const message:Message={id:crypto.randomUUID(),author:playerName,text,time:Date.now()};if(connected)await OBR.broadcast.sendMessage(CHANNEL,{type:'message',message});await addMessage(message);}
async function publish(target?:string){
  if(!project||role!=='GM'||!connected)return;
  if(publishing){if(!target)status('Un partage est déjà en cours. Réessayez dans un instant.');return;}
  publishing=true;render();
  try{
    const json=JSON.stringify(project);if(new TextEncoder().encode(json).length>MAX_PROJECT)throw new Error('Projet trop volumineux.');
    const id=crypto.randomUUID();const count=Math.ceil(json.length/1500);
    await OBR.broadcast.sendMessage(CHANNEL,{type:'start',id,count,target});
    for(let index=0;index<count;index++)await OBR.broadcast.sendMessage(CHANNEL,{type:'part',id,index,text:json.slice(index*1500,(index+1)*1500),target});
    await OBR.broadcast.sendMessage(CHANNEL,{type:'end',id,target});status('Projet partagé avec les panneaux CLAP! actuellement ouverts.');
  }finally{publishing=false;render();}
}
async function receive(event:{connectionId:string;data:unknown}){
  const d=event.data as Record<string,unknown>;if(!d||typeof d!=='object')return;
  const sender=party.find(p=>p.connectionId===event.connectionId);if(!sender)return;
  if(d.type==='request'&&role==='GM'){// Re-sharing requires an explicit MJ action; never expose a newly imported private project automatically.
    status(`${sender.name} attend un projet. Utilisez « Partager tout le projet » pour le transmettre.`);return;
  }
  if(d.type==='message'){
    const m=d.message as Message|undefined;
    if(m&&typeof m.id==='string'&&m.id.length<=100&&typeof m.text==='string'&&m.text.length<=2000)await addMessage({id:`${event.connectionId}:${m.id}`,author:sender.name,text:m.text,time:Date.now()});return;
  }
  if(sender.role!=='GM'||(d.target&&d.target!==playerId)||typeof d.id!=='string'||d.id.length>100)return;
  for(const [id,t] of transfers)if(Date.now()-t.started>120000)transfers.delete(id);
  if(d.type==='start'&&Number.isInteger(d.count)&&Number(d.count)>0&&Number(d.count)<=Math.ceil(MAX_PROJECT/1500)){
    if(transfers.size>=2)return;
    transfers.set(d.id,{sender:event.connectionId,parts:new Array(Number(d.count)),next:0,size:0,started:Date.now()});status('Réception du projet partagé par le MJ…');return;
  }
  const t=transfers.get(d.id);if(!t||t.sender!==event.connectionId)return;
  if(d.type==='part'){
    if(d.index!==t.next||typeof d.text!=='string'||d.text.length>1500||t.next>=t.parts.length){transfers.delete(d.id);return;}
    t.size+=new TextEncoder().encode(d.text).length;if(t.size>MAX_PROJECT){transfers.delete(d.id);return;}
    t.parts[t.next++]=d.text;return;
  }
  if(d.type==='end'){
    transfers.delete(d.id);if(t.next!==t.parts.length)return;
    const next=projectSchema.parse(JSON.parse(t.parts.join('')));await stored(`${room}:project`,next);project=next;status(`Projet « ${next.project.name} » reçu et enregistré sur ce navigateur.`);render();
  }
}
async function restore(){
  const cached=await stored(`${room}:project`);if(cached){const p=projectSchema.safeParse(cached);if(p.success)project=p.data;}
  const selection=await stored(`${room}:selection`);selected=typeof selection==='string'?selection:'';
  const history=await stored(`${room}:messages`);messages=Array.isArray(history)?history.slice(-200):[];
}
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab!;render();});
render();
if(OBR.isAvailable)OBR.onReady(()=>{void(async()=>{
  connected=true;room=OBR.room.id;[role,playerId,playerName,party]=await Promise.all([OBR.player.getRole(),OBR.player.getId(),OBR.player.getName(),OBR.party.getPlayers()]);
  await restore();const metadata=await OBR.player.getMetadata();const assignment=metadata[META] as {heroId?:string;projectId?:string}|undefined;if(assignment?.projectId===project?.project.id)selected=assignment?.heroId||selected;
  document.querySelector('#connection')!.textContent=`${playerName} · ${role==='GM'?'MJ':'Joueur'}`;
  OBR.party.onChange(players=>{party=players;});OBR.player.onChange(player=>{role=player.role;playerName=player.name;render();});
  OBR.broadcast.onMessage(CHANNEL,e=>{void receive(e).catch(report);});render();await OBR.broadcast.sendMessage(CHANNEL,{type:'request'});
})().catch(report);});else void restore().then(()=>{status('Aperçu autonome : import, fiches et dés locaux. Ouvrez dans Owlbear pour partager.');render();}).catch(report);
