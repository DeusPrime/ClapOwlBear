import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
export default function FilmLazyPage({children,eager=false,pageId}:{children:ReactNode;eager?:boolean;pageId:string}){
 const root=useRef<HTMLDivElement>(null),[mounted,setMounted]=useState(eager),[height,setHeight]=useState(1220);
 useLayoutEffect(()=>{const el=root.current;if(!el)return;const update=()=>setHeight(Math.min(1,el.clientWidth/(210*96/25.4))*297*96/25.4+100);update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{const el=root.current;if(!el||mounted)return;if(eager){setMounted(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setMounted(true);observer.disconnect();}},{rootMargin:'1600px 0px'});observer.observe(el);return()=>observer.disconnect();},[mounted,eager]);
 return <div ref={root} data-film-page-slot={pageId} data-loaded={mounted||eager} style={mounted||eager?undefined:{height}}>{mounted||eager?children:<div className="grid h-full place-items-center border border-ink/10 bg-paper/60 text-sm text-muted-foreground" aria-label="Page en attente de chargement">Chargement au défilement…</div>}</div>;
}
