import { constrainFilmObject } from './filmPageLayout';
import type { BookObject } from './filmBooks';

// A single exclusion contour keeps all text clear of independently positioned
// objects. Prefer the wider reading side; narrow remaining slivers are skipped.
export function applyFilmTextWrap(editor: HTMLElement, objects: BookObject[], titlePage = false) {
  const key=JSON.stringify([titlePage,objects.map(o=>[o.x,o.y,o.width,o.height])]);
  if(editor.dataset.wrapKey===key && editor.querySelector('[data-film-wrap]'))return;
  editor.dataset.wrapKey=key;
  editor.querySelectorAll('[data-film-wrap]').forEach(el=>el.remove());
  if(!objects.length)return;
  const origin=24+(titlePage?65:0),width=170;
  const boxes=objects.map(constrainFilmObject).map(o=>({left:Math.max(0,o.x-20-3),right:Math.min(width,o.x+o.width-20+3),top:Math.max(0,o.y-origin-3),bottom:Math.max(0,Math.min(titlePage?185:250,o.y+o.height-origin+3))})).filter(o=>o.right>0&&o.left<width&&o.bottom>o.top);
  if(!boxes.length)return;
  const right=boxes.reduce((n,b)=>n+(b.left+b.right)/2,0)/boxes.length>width/2;
  const ys=[...new Set([0,...boxes.flatMap(b=>[b.top,b.bottom])])].sort((a,b)=>a-b);
  const height=ys[ys.length-1];
  const contour:string[]=[];
  for(let i=0;i<ys.length-1;i++){
    const occupied=boxes.filter(b=>b.top<ys[i+1]&&b.bottom>ys[i]);
    let edge=right?(occupied.length?Math.min(...occupied.map(b=>b.left)):width):(occupied.length?Math.max(...occupied.map(b=>b.right)):0);
    if(occupied.length && (right?edge:width-edge)<30)edge=right?0:width;
    contour.push(`${edge/width*100}% ${ys[i]}mm`,`${edge/width*100}% ${ys[i+1]}mm`);
  }
  const outer=right?'100%':'0%';
  const spacer=editor.ownerDocument.createElement('span');spacer.dataset.filmWrap='';spacer.contentEditable='false';spacer.setAttribute('aria-hidden','true');
  Object.assign(spacer.style,{float:right?'right':'left',width:'100%',height:`${height}mm`,shapeOutside:`polygon(${outer} 0mm,${contour.join(',')},${outer} ${height}mm)`,pointerEvents:'none'});
  editor.prepend(spacer);
}
