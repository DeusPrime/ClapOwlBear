import type { BookObject } from './filmBooks';
export const FILM_CONTENT_TOP = 24;
export const FILM_CONTENT_BOTTOM = 274;
export function constrainFilmObject(object: BookObject): BookObject {
  const top=object.kind==='image'?0:FILM_CONTENT_TOP,bottom=object.kind==='image'?297:FILM_CONTENT_BOTTOM;
  if(object.kind==='image'&&object.aspectRatio){
    const ratio=object.aspectRatio;
    const width=Math.max(1,Math.min(210,297*ratio,object.width)),height=width/ratio;
    return {...object,width,height,x:Math.max(0,Math.min(210-width,object.x)),y:Math.max(0,Math.min(297-height,object.y))};
  }
  const width=Math.max(25,Math.min(210,object.width)),height=Math.max(15,Math.min(bottom-top,object.height));
  return {...object,width,height,x:Math.max(0,Math.min(210-width,object.x)),y:Math.max(top,Math.min(bottom-height,object.y))};
}
export function filmNumberStyle(pageNumber:number, framed:boolean, imageColor?: 'white'|'black'): Record<string,string> {
  if(imageColor)return {...filmNumberStyle(pageNumber,false),left:(pageNumber%2?195:15)+'mm',color:imageColor==='white'?'#ffffff':'#000000',textShadow:'none'};
  if(!framed)return {left:'105mm',top:'286.33mm',right:'auto',bottom:'auto',width:'24.73mm',height:'14.4mm',transform:'translate(-50%,-50%)',display:'grid',placeItems:'center'};
  return {left:`${((pageNumber%2 ? 2133 : 55)+146)/2480*210}mm`,top:`${(3297+85)/3508*297}mm`,right:'auto',bottom:'auto',width:`${292/2480*210}mm`,height:`${170/3508*297}mm`,transform:'translate(-50%,-50%)',display:'grid',placeItems:'center',fontFamily:'"LM Mono Light 10","Courier Prime","Courier New",monospace',fontSize:'16pt',lineHeight:'1',fontWeight:'bold',color:'#000000',textShadow:'none'};
}

export function resizeFilmObject(object:BookObject,dx:number,dy:number):BookObject {
 if(object.kind!=='image')return constrainFilmObject({...object,width:object.width+dx,height:object.height+dy});
 const {width,height}=object;
 const desired=1+(dx*width+dy*height)/(width*width+height*height);
 const maximum=Math.min((210-object.x)/width,(297-object.y)/height);
 const minimum=Math.min(maximum,Math.max(5/width,5/height));
 const scale=Math.max(minimum,Math.min(maximum,desired));
 return constrainFilmObject({...object,aspectRatio:width/height,width:width*scale,height:height*scale});
}
