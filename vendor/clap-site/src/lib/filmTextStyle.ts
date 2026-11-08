// A contenteditable can contain bare text after typing/pasting. Give that text
// a real paragraph before formatBlock, keeping the wrapping spacer separate.
export function ensureFilmParagraphs(editor:HTMLElement) {
  const selection=getSelection();if(!selection?.rangeCount)return;
  const selected=selection.getRangeAt(0);if(!editor.contains(selected.commonAncestorContainer))return;
  const before=selected.cloneRange();before.selectNodeContents(editor);before.setEnd(selected.startContainer,selected.startOffset);const start=before.toString().length;
  before.setEnd(selected.endContainer,selected.endOffset);const end=before.toString().length;
  let paragraph:HTMLParagraphElement|null=null,changed=false;
  for(const node of Array.from(editor.childNodes)){
    if(node instanceof Element && (node.hasAttribute('data-film-wrap') || /^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE)$/.test(node.tagName))){paragraph=null;continue;}
    if(!paragraph){paragraph=editor.ownerDocument.createElement('p');editor.insertBefore(paragraph,node);}
    paragraph.append(node);changed=true;
  }
  if(!changed)return;
  const walker=editor.ownerDocument.createTreeWalker(editor,NodeFilter.SHOW_TEXT),range=editor.ownerDocument.createRange();let position=0,hasStart=false,node:Node|null;
  while((node=walker.nextNode())){const length=node.textContent?.length??0;if(!hasStart&&start<=position+length){range.setStart(node,Math.max(0,start-position));hasStart=true;}if(hasStart&&end<=position+length){range.setEnd(node,Math.max(0,end-position));selection.removeAllRanges();selection.addRange(range);return;}position+=length;}
  if(!hasStart)range.selectNodeContents(editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);
}

export function applyFilmTextStyle(editor:HTMLElement, tag:string) {
  const special=tag==='cover-title'?'cover':tag==='section-title'?'section':undefined;
  if(special)tag='h1';
  if(!/^(p|h[1-5])$/.test(tag))return;
  ensureFilmParagraphs(editor);
  const selection=getSelection();if(!selection?.rangeCount)return;
  const selected=selection.getRangeAt(0);if(!editor.contains(selected.commonAncestorContainer))return;
  const offset=(node:Node,position:number)=>{const r=editor.ownerDocument.createRange();r.selectNodeContents(editor);r.setEnd(node,position);return r.toString().length;};
  const start=offset(selected.startContainer,selected.startOffset),end=offset(selected.endContainer,selected.endOffset);
  const selector='p,h1,h2,h3,h4,h5,div,li,td,th';
  const anchor=selected.startContainer instanceof Element?selected.startContainer:selected.startContainer.parentElement;
  const current=anchor?.closest(selector);
  const blocks=Array.from(editor.querySelectorAll<HTMLElement>(selector)).filter(el=>{
    if(el.closest('[data-film-wrap]')||el.querySelector(selector))return false;
    if(selected.collapsed)return current===el || (selected.startContainer===editor&&el===editor.childNodes[selected.startOffset]);
    const r=editor.ownerDocument.createRange();r.selectNode(el);return offset(r.endContainer,r.endOffset)>start && offset(r.startContainer,r.startOffset)<end;
  });
  for(const block of blocks){
    const replacement=editor.ownerDocument.createElement(tag);
    if(special)replacement.setAttribute('data-film-style',special);
    for(const attr of Array.from(block.attributes))if(attr.name==='style'||attr.name==='data-index-keywords')replacement.setAttribute(attr.name,attr.value);
    replacement.append(...block.childNodes);
    if(['LI','TD','TH'].includes(block.tagName))block.append(replacement);else block.replaceWith(replacement);
  }
  const walker=editor.ownerDocument.createTreeWalker(editor,NodeFilter.SHOW_TEXT),range=editor.ownerDocument.createRange();let node:Node|null,position=0,started=false;
  while((node=walker.nextNode())){const length=node.textContent?.length??0;if(!started&&start<position+length){range.setStart(node,Math.max(0,start-position));started=true;}if(started&&end<=position+length){range.setEnd(node,Math.max(0,end-position));selection.removeAllRanges();selection.addRange(range);return;}position+=length;}
  if(blocks.length){range.selectNodeContents(blocks[0].isConnected?blocks[0]:editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);}
}
