import {useEffect,useState,type CSSProperties} from 'react';
import {featherWatermark} from '@/lib/filmWatermark';
export default function FilmImage({source,widthMm,heightMm,featherMm=10,className,alt,style}:{source:string;widthMm:number;heightMm:number;featherMm?:number;className?:string;alt:string;style?:CSSProperties}){
 const [result,setResult]=useState('');
 useEffect(()=>{let active=true;const image=new Image();image.onload=()=>{try{const width=Math.min(widthMm,heightMm*image.naturalWidth/image.naturalHeight);const url=featherMm===0?source:featherWatermark(image,width,featherMm).toDataURL();if(active)setResult(url);}catch{if(active)setResult(source);}};image.src=source;return()=>{active=false;};},[source,widthMm,heightMm,featherMm]);
 return result?<img src={result} className={className} alt={alt} style={style} draggable={false}/>:null;
}
