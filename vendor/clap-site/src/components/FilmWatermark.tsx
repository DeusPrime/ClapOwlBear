import {useEffect,useState} from 'react';
import type {BookPage} from '@/lib/filmBooks';
import {featherWatermark} from '@/lib/filmWatermark';
export default function FilmWatermark({mark,protectBands=false}:{protectBands?:boolean;mark:NonNullable<BookPage['watermark']>}){
 const [source,setSource]=useState('');
 useEffect(()=>{let active=true;setSource('');const image=new Image();image.onload=()=>{try{const result=featherWatermark(image,210*mark.size/100,mark.featherMm).toDataURL();if(active)setSource(result);}catch{if(active)setSource(mark.source);}};image.src=mark.source;return()=>{active=false;};},[mark.source,mark.size,mark.featherMm]);
 return <div aria-hidden="true" className="book-watermark" data-protect-bands={protectBands||undefined}>{source&&<img className="book-watermark-image" src={source} alt="" style={{opacity:mark.opacity,width:mark.size+'%',left:(mark.x??50)+'%',top:(mark.y??50)+'%'}}/>}</div>;
}
