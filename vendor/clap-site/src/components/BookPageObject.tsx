import { creditsQrLabel } from '@/lib/filmCreditsLayout';
import FilmImage from './FilmImage';
import { constrainFilmObject, resizeFilmObject } from '@/lib/filmPageLayout';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { cleanBookHtml, type BookObject } from '@/lib/filmBooks';
import { placeFilmCaret } from '@/lib/filmPagination';

export default function BookPageObject({ object, change, remove, activate, preview }: { object: BookObject; change: (patch: Partial<BookObject>) => void; remove: () => void; activate: (element:HTMLDivElement)=>void; preview:(object:BookObject|null)=>void }) {
  const text = useRef<HTMLDivElement>(null);
  const lastGood=useRef(object.html??'');
  const [draft, setDraft] = useState<BookObject | null>(null);
  const locked = object.locked || /\/book-links\/(discord|site)\.png$/.test(object.source ?? '');
  const current = draft ?? object;
  useEffect(() => { if (text.current && document.activeElement !== text.current) text.current.innerHTML = cleanBookHtml(object.html ?? ''); }, [object.html]);
  useEffect(()=>{
    if(locked||object.kind!=='image'||object.aspectRatio||!object.source)return;
    let active=true;const image=new Image();image.onload=()=>{if(!active)return;const ratio=image.naturalWidth/image.naturalHeight;const width=Math.min(object.width,object.height*ratio),height=width/ratio;change(constrainFilmObject({...object,aspectRatio:ratio,width,height,x:object.x+(object.width-width)/2,y:object.y+(object.height-height)/2}));};image.src=object.source;return()=>{active=false;};
  },[object.kind,object.source,object.aspectRatio,object.width,object.height,object.x,object.y,change]);
  function gesture(event: PointerEvent<HTMLButtonElement>, resize: boolean) {
    event.preventDefault(); const handle = event.currentTarget; handle.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY }; let next = object;
    const scale = handle.closest('.book-page')!.getBoundingClientRect().width / 210;
    const move = (e: globalThis.PointerEvent) => {
      const dx = (e.clientX-start.x)/scale, dy = (e.clientY-start.y)/scale;
      next = resize ? resizeFilmObject(object,dx,dy) : { ...object, x: Math.max(0,Math.min(210-object.width,object.x+dx)), y: Math.max(0,Math.min(297-object.height,object.y+dy)) };
      next=constrainFilmObject(next); setDraft(next);preview(next);
    };
    const finish = () => { handle.removeEventListener('pointermove',move); handle.removeEventListener('pointerup',finish); handle.removeEventListener('pointercancel',finish); change(next); setDraft(null); };
    handle.addEventListener('pointermove',move); handle.addEventListener('pointerup',finish); handle.addEventListener('pointercancel',finish);
  }
  if(locked)return <div className="book-object book-object-locked" style={{left:object.x+'mm',top:object.y+'mm',width:object.width+'mm',height:object.height+'mm',pointerEvents:'none'}}><FilmImage source={object.source!} widthMm={object.width} heightMm={object.height} featherMm={0} alt="QR code" /><span className="book-qr-label">{creditsQrLabel(object.source)}</span></div>;
  return <div className={`book-object ${object.kind === 'example' ? 'book-example' : ''}`} style={{left:`${current.x}mm`,top:`${current.y}mm`,width:`${current.width}mm`,height:`${current.height}mm`}}>
    <div className="book-object-tools"><button aria-label="Déplacer l’élément" title="Glisser pour déplacer ; flèches pour ajuster" onPointerDown={e => gesture(e,false)} onKeyDown={e=>{const delta: Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const d=delta[e.key];if(d){e.preventDefault();change(constrainFilmObject({...object,x:Math.max(0,Math.min(210-object.width,object.x+d[0])),y:Math.max(0,Math.min(297-object.height,object.y+d[1]))}));}}}>✥ Déplacer</button><button aria-label="Supprimer l’élément" onClick={remove}>×</button>{object.kind==='image'&&<label className="flex items-center gap-1 bg-paper px-2 text-xs">Fondu<input aria-label="Estompage de l’image" type="range" min="0" max="25" step="0.5" value={object.featherMm??10} onChange={e=>change({featherMm:Number(e.target.value)})}/></label>}</div>
    {object.kind === 'image' ? <FilmImage source={object.source!} widthMm={current.width} heightMm={current.height} featherMm={object.featherMm} alt="Illustration déplaçable" /> : <div ref={text} className="book-example-text" contentEditable suppressContentEditableWarning role="textbox" aria-label="Texte de l’encart gris" onFocus={()=>activate(text.current!)} onInput={() => {const root=text.current!,html=cleanBookHtml(root.innerHTML);const growth=Math.max(0,root.scrollHeight-root.clientHeight);const height=object.height+(growth?growth*25.4/96+.5:0);if(height>274-object.y){root.innerHTML=lastGood.current;placeFilmCaret(root,Number.MAX_SAFE_INTEGER);return;}lastGood.current=html;change({html,height});}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}} />}
    <button className={`book-resize ${object.kind==='image'?'book-image-resize':''}`} aria-label="Redimensionner l’élément" title="Glisser pour redimensionner ; flèches pour ajuster" onPointerDown={e=>gesture(e,true)} onKeyDown={e=>{const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const d=delta[e.key];if(d){e.preventDefault();change(resizeFilmObject(object,d[0],d[1]));}}}>↘</button>
  </div>;
}
