import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
export default function FilmPageSheet({children}:{children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1);
  useLayoutEffect(()=>{const root=ref.current;if(!root)return;const update=()=>setScale(Math.min(1,root.clientWidth/(210*96/25.4)));update();const observer=new ResizeObserver(update);observer.observe(root);return()=>observer.disconnect();},[]);
  return <div ref={ref} className="w-full" style={{height:`${297*96/25.4*scale}px`}}><div style={{width:'210mm',transform:`scale(${scale})`,transformOrigin:'top left'}}>{children}</div></div>;
}
