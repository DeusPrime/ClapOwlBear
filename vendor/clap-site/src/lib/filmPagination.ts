import { cleanBookHtml, type BookObject } from './filmBooks';
import { applyFilmTextWrap } from './filmTextWrap';

type Segment={node:Node;length:number;start:number};
function segments(root:HTMLElement){const result:Segment[]=[];let start=0;function walk(node:Node){if(node instanceof Element&&node.hasAttribute('data-film-wrap'))return;const length=node.nodeType===Node.TEXT_NODE?(node.textContent?.length??0):node instanceof Element&&(node.tagName==='BR'||(!node.childNodes.length&&/^(P|DIV|H[1-5])$/.test(node.tagName)))?1:0;if(length){result.push({node,length,start});start+=length;}else node.childNodes.forEach(walk);}root.childNodes.forEach(walk);return {items:result,length:start};}
export function filmCaretPoint(root:HTMLElement,offset:number):[Node,number]{const {items}=segments(root);for(const item of items)if(offset<item.start+item.length){if(item.node.nodeType===Node.TEXT_NODE)return [item.node,Math.max(0,offset-item.start)];const parent=item.node.parentNode!;return [parent,Array.from(parent.childNodes).indexOf(item.node as ChildNode)];}const last=items[items.length-1];if(last?.node.nodeType===Node.TEXT_NODE)return [last.node,last.length];return [root,root.childNodes.length];}
export function filmCaretOffset(root:HTMLElement):number|null{const selection=getSelection();if(!selection?.focusNode||!root.contains(selection.focusNode))return null;const point=document.createRange();point.setStart(selection.focusNode,selection.focusOffset);point.collapse(true);for(const item of segments(root).items){if(item.node===selection.focusNode&&item.node.nodeType===Node.TEXT_NODE)return item.start+selection.focusOffset;const end=document.createRange();if(item.node.nodeType===Node.TEXT_NODE)end.setStart(item.node,item.length);else end.setStartAfter(item.node);end.collapse(true);if(point.compareBoundaryPoints(Range.START_TO_START,end)<0)return item.start;}return segments(root).length;}
export function placeFilmCaret(root:HTMLElement,offset:number){root.focus({preventScroll:true});const [node,index]=filmCaretPoint(root,offset),range=document.createRange();range.setStart(node,index);range.collapse(true);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);}
function splitAt(root:HTMLElement,offset:number){const [node,index]=filmCaretPoint(root,offset),range=document.createRange();range.selectNodeContents(root);range.setEnd(node,index);const head=document.createElement('div');head.append(range.cloneContents());range.selectNodeContents(root);range.setStart(node,index);const tail=document.createElement('div');tail.append(range.cloneContents());const block=(node instanceof Element?node:node.parentElement)?.closest('p,h1,h2,h3,h4,h5,li')??root;const prefix=document.createRange();prefix.selectNodeContents(block);prefix.setEnd(node,index);const continued=prefix.toString().length>0&&prefix.toString().length<(block.textContent?.length??0);return {head:cleanBookHtml(head.innerHTML),tail:cleanBookHtml(tail.innerHTML),continued};}

export function joinFilmContinuation(tail:string,next:string,joined:boolean){if(!joined)return tail+next;const first=document.createElement('div'),second=document.createElement('div');first.innerHTML=tail;second.innerHTML=next;const left=first.lastElementChild,right=second.firstElementChild;if(left&&right&&left.tagName===right.tagName&&/^(P|H[1-5]|DIV)$/.test(left.tagName)){left.append(...right.childNodes);right.remove();}else if(first.lastChild?.nodeType===Node.TEXT_NODE&&second.firstChild?.nodeType===Node.TEXT_NODE){first.lastChild.textContent+=second.firstChild.textContent??'';second.firstChild.remove();}return first.innerHTML+second.innerHTML;}

export function splitFilmPage(root:HTMLElement,objects:BookObject[],manual=false){
  const caret=filmCaretOffset(root),length=segments(root).length;
  if(manual)return {...splitAt(root,caret??length),offset:caret??length,caret};
  if(root.scrollHeight<=root.clientHeight+1)return null;
  const article=document.createElement('article');article.className='book-page';article.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;z-index:-1';
  const measure=document.createElement('div');measure.className='book-content';article.append(measure);document.body.append(article);
  try{
    let low=0,high=length;
    while(low<high){const middle=Math.ceil((low+high)/2);measure.innerHTML=splitAt(root,middle).head;applyFilmTextWrap(measure,objects);if(measure.scrollHeight<=measure.clientHeight+1)low=middle;else high=middle-1;}
    // Prefer a word boundary while preserving every character in the tail.
    const plain=root.textContent??'';let offset=low;
    if(offset<length&&offset>0&&plain.length===length){const previous=plain.slice(0,offset).search(/\s+\S*$/);if(previous>offset*.75)offset=previous+1;}
    if(offset===0&&length>0){
      // An illustration may reserve the entire page; the continuation has no
      // such reservation. Keep this page and move its text intact.
      return {head:'<p><br></p>',tail:cleanBookHtml(root.innerHTML),offset:0,caret,continued:false};
    }
    return {...splitAt(root,offset),offset,caret};
  }finally{article.remove();}
}
