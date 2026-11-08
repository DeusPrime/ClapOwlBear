import { creditsQrLabel } from './filmCreditsLayout';
import { backCoverWordFrame } from './filmBackCover';
import { filmCreditsCss } from './filmCreditsStyle';
import {filmSectionLabelCss,hasFilmSectionLabel,appendFilmSectionLabel,filmSectionLabelWord} from './filmSectionLabel';
import { featherWatermark, filmWatermarkCss } from './filmWatermark';
import JSZip from 'jszip';
import { withFilmReferences } from './filmReferences';
import { filmTypographyCss, filmWordStyles } from './filmTypography';
import { filmTocCss, filmTocWordStyles } from './filmTocStyle';
import { filmCoverCss, filmCoverLogoUrl, filmCoverLogoPng } from './filmCover';
import { filmSpecialTitleCss, filmSpecialTitleWordStyles } from './filmSpecialTitles';
import { downloadBlob } from './characterPng';
import { cleanBookHtml, type FilmBook, type BookObject } from './filmBooks';
import { filmPageBackground, filmPageHasDarkBackground, filmBandCss, FILM_BAND_HEIGHT_MM, fadeFilmBandCut } from './filmPageBackground';
import { constrainFilmObject, filmNumberStyle } from './filmPageLayout';
import { applyFilmTextWrap } from './filmTextWrap';
const numberFontCss = `@font-face{font-family:"LM Mono Light 10";src:url("${import.meta.env.BASE_URL}fonts/lmmonolt10-bold.otf") format("opentype");font-weight:700;font-style:normal;font-display:swap}`;

const objectCss = `.book-page .book-object .book-image-resize{right:-5px;bottom:-5px;width:12px;height:12px;padding:0;background:#fff;border:1px solid #333;font-size:0;box-shadow:0 0 0 1px #fff;z-index:3}.book-object:has(.book-image-resize):hover,.book-object:has(.book-image-resize):focus-within{outline:1px solid #777}.book-page[data-overflow]::after{content:"Le texte dépasse la page A4. Ajoutez une page.";position:absolute;top:2mm;left:20mm;color:#b91c1c;background:#fff;font:12px sans-serif;padding:4px}.book-page.title-page{background-color:#242424}.book-page.title-page .book-number{color:white}.book-page.title-page .book-content{color:white;text-align:center;text-shadow:0 2px 6px #000}.book-object{position:absolute;z-index:2;min-width:0;border:0;box-sizing:border-box}.book-example{border:1px solid #777;background:#d9d9d9;color:#222;padding:5mm;box-sizing:border-box}.book-example-text{height:100%;overflow:clip;outline:none}.book-page .book-object img{width:100%;height:100%;max-height:none;object-fit:contain}.book-feathered{mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent),linear-gradient(to bottom,transparent,#000 12%,#000 88%,transparent);mask-composite:intersect;-webkit-mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent),linear-gradient(to bottom,transparent,#000 12%,#000 88%,transparent);-webkit-mask-composite:source-in}.book-object-tools{position:absolute;left:0;top:-28px;display:flex;gap:4px;opacity:0;white-space:nowrap}.book-object:hover .book-object-tools,.book-object:focus-within .book-object-tools{opacity:1}.book-object-tools button,.book-resize{font:12px sans-serif;color:#222;background:white;border:1px solid #555;padding:4px;touch-action:none}.book-object-tools button:first-child{cursor:move}.book-resize{position:absolute;right:0;bottom:0;cursor:nwse-resize}.book-object:hover{outline:1px dashed #777}@media print{.book-object-tools,.book-resize{display:none!important}.book-example-text{overflow:hidden}.book-page .book-content{overflow:hidden}.book-object{outline:none!important}}`;

export const bookPageCss = `${numberFontCss}${objectCss}${filmWatermarkCss}${filmBandCss}${filmSectionLabelCss}.book-page .book-watermark{position:absolute;left:0;top:0;width:210mm;height:297mm;pointer-events:none;overflow:hidden;z-index:0}.book-page .book-watermark-image{position:absolute;transform:translate(-50%,-50%);height:auto;max-height:none;max-width:none}.book-page .book-content{position:relative;z-index:2}@page{size:A4;margin:0}*{box-sizing:border-box}.book-page{scroll-margin-top:170px;position:relative;width:210mm;height:297mm;min-height:297mm;padding:24mm 20mm 23mm;background-color:white;background-size:100% 100%;color:#222;font:11pt "Courier Prime","Courier New",monospace;line-height:1.5;overflow-wrap:anywhere}.book-page .book-content{height:250mm;overflow:clip;min-height:15mm;text-transform:none}.book-page h1,.book-page h2,.book-page h3{font-family:inherit;text-transform:none;letter-spacing:normal;margin:12pt 0;font-weight:bold}.book-page p{margin:0 0 8pt}.book-page h1{font-size:32pt}.book-page h2{font-size:21pt}.book-page h3{font-size:15pt}.book-page blockquote{margin:12pt 0;padding:12pt;background:#e5e5e5;border-left:4px solid #777}.book-page table{width:100%;border-collapse:collapse;table-layout:fixed}.book-page td,.book-page th{border:1px solid #777;padding:6pt;overflow-wrap:anywhere}.book-page th{background:#ddd}.book-page>img{position:absolute;bottom:24mm;left:20mm;max-width:170mm}.book-page img{max-width:100%;max-height:65mm;object-fit:contain}.book-page.title-page .book-content{padding-top:65mm}.book-number{position:absolute;bottom:8mm;right:20mm;font-size:10pt}@media print{html,body{margin:0}.book-page{height:297mm;min-height:0;break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}.book-page:last-child{break-after:auto}}${filmTypographyCss}${filmCreditsCss}${filmTocCss}${filmCoverCss}${filmSpecialTitleCss}`;

export async function printFilmBook(book: FilmBook) {
  book=withFilmReferences(book);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write('<!doctype html><html><head><title></title><style>'+bookPageCss+'</style></head><body></body></html>'); doc.close();
  doc.title = book.name;
  let number = 0;
  const backgrounds: HTMLImageElement[] = [];
  for (const section of book.sections) for (const page of section.pages) {
    const el = doc.createElement('article');if(filmPageHasDarkBackground(section,page))el.dataset.darkBackground='true';if(page.backCover)el.dataset.backcover='true';if(page.frontMatter)el.dataset.frontmatter=page.id.endsWith('-credits')?'credits':page.id.endsWith('-community')?'community':'thanks';if(page.generated)el.dataset.generated=page.generated;if(page.cover)el.dataset.cover='true'; el.className = `book-page ${page.titlePage ? 'title-page' : ''}`;
    if(page.cover){const logo=doc.createElement('img');logo.className='book-cover-logo';logo.src=filmCoverLogoUrl;logo.alt='Logo Clap & Role';el.append(logo);}
    const bg = filmPageBackground(section,page,number+1);
    if (bg) { el.style.backgroundImage = `url("${bg}")`;const preload=new Image();preload.src=bg;backgrounds.push(preload); }
    if(page.imagePage){number++;const footer=doc.createElement("span");footer.className="book-number";footer.textContent=String(number);Object.assign(footer.style,filmNumberStyle(number,false,page.imagePage.numberColor));el.append(footer);doc.body.append(el);continue;}
    if(!page.titlePage&&!page.imagePage&&page.watermark){const mark=doc.createElement("div");mark.className="book-watermark";if(bg)mark.dataset.protectBands="true";const img=doc.createElement("img");img.className="book-watermark-image";const original=new Image();original.src=page.watermark.source;await original.decode();img.src=featherWatermark(original,210*page.watermark.size/100,page.watermark.featherMm).toDataURL();img.alt="";Object.assign(img.style,{opacity:String(page.watermark.opacity),width:`${page.watermark.size}%`,left:`${page.watermark.x??50}%`,top:`${page.watermark.y??50}%`});mark.append(img);el.append(mark);}
    if(page.watermark && bg && !page.titlePage){const bands=doc.createElement("div");bands.className="book-bands";bands.style.backgroundImage=`url("${bg}")`;el.append(bands);}
    const content = doc.createElement('div'); content.className = 'book-content'; content.innerHTML = cleanBookHtml(page.html); el.append(content);
    if(page.cover){const bottom=doc.createElement('div');bottom.className='book-content book-cover-bottom';bottom.innerHTML=cleanBookHtml(page.coverBottomHtml??'<h2>Titre bas</h2>');el.append(bottom);}
    applyFilmTextWrap(content,page.objects??[],page.titlePage);
    if (page.image) { const img = doc.createElement('img'); const original=new Image();original.src=page.image;await original.decode();img.src=featherWatermark(original,Math.min(170,65*original.naturalWidth/original.naturalHeight)).toDataURL(); img.alt = ''; el.append(img); }
    for (const stored of page.objects ?? []) {
      const object=constrainFilmObject(stored);
      const box = doc.createElement('div'); box.className = `book-object ${object.kind==='example'?'book-example':''}`;
      Object.assign(box.style,{left:`${object.x}mm`,top:`${object.y}mm`,width:`${object.width}mm`,height:`${object.height}mm`});
      if (object.kind==='image') { const img=doc.createElement('img');const original=new Image();original.src=object.source!;await original.decode();img.src=object.featherMm===0?object.source!:featherWatermark(original,Math.min(object.width,object.height*original.naturalWidth/original.naturalHeight),object.featherMm).toDataURL();box.append(img); }
      else box.innerHTML = cleanBookHtml(object.html ?? '');
      const label=creditsQrLabel(object.source);if(label){const caption=doc.createElement('span');caption.className='book-qr-label';caption.textContent=label;box.append(caption);}
      el.append(box);
    }
    number++;
    if(hasFilmSectionLabel(page))appendFilmSectionLabel(doc,el,section.name,number,section.labelColor);
    if(!page.cover && !page.titlePage && !page.frontMatter && page.generated!=='toc' && page.generated!=='index') {const footer = doc.createElement('span'); footer.className = 'book-number'; footer.textContent = String(number); Object.assign(footer.style,filmNumberStyle(number,!!bg)); el.append(footer); } doc.body.append(el);
  }
  await Promise.all([...Array.from(doc.images),...backgrounds].map(img => img.decode().catch(() => {})));
  await doc.fonts.ready;
  const overflow = Array.from(doc.querySelectorAll('.book-page')).findIndex(el=>Array.from(el.querySelectorAll('.book-content,.book-example')).some(box=>box.scrollHeight>box.clientHeight+2));
  if(overflow>=0){frame.remove();throw new Error(`Le contenu de la page ${overflow+1} dépasse son format. Ajoutez une page ou agrandissez l’encart avant l’export PDF.`);}
  frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true });
  frame.contentWindow!.focus(); frame.contentWindow!.print();
}

const xml = (text: string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Native OOXML: paragraphs, runs, tables and embedded pictures remain editable in Word.
export async function exportFilmWord(book: FilmBook) {
  book=withFilmReferences(book);
  const zip = new JSZip(); let imageId = 0;
  const rels: string[] = [];
  async function picture(source: string, background = false, placement?: BookObject, shade = false, logo = false) {
    const response = await fetch(source); if (!response.ok) throw new Error('Image inaccessible.');
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0); bitmap.close();
    if(shade){ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(canvas.width*12.845/210,canvas.height*18.245/297,canvas.width*(210-25.69)/210,canvas.height*(297-36.49)/297);}
    if (!background && !logo) {
      const original=new Image();original.src=canvas.toDataURL();await original.decode();
      const widthMm=placement?Math.min(placement.width,placement.height*canvas.width/canvas.height):Math.min(170,canvas.width*9525/36000,65*canvas.width/canvas.height);
      if(placement?.featherMm!==0){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(featherWatermark(original,widthMm,placement?.featherMm),0,0);}
    }
    const data = canvas.toDataURL('image/png').split(',')[1];
    const id = ++imageId, rid = `rId${id}`; zip.file(`word/media/image${id}.png`, data, { base64: true });
    rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${id}.png"/>`);
    const width = background ? 7560000 : placement ? Math.min(placement.width*36000,placement.height*36000*canvas.width/canvas.height) : Math.min(6120000, canvas.width * 9525), height = background ? 10692000 : placement ? width*canvas.height/canvas.width : Math.min(2300000, width * canvas.height / canvas.width);
    const cx = Math.round(background ? width : height * canvas.width / canvas.height), cy = Math.round(height);
    const content = `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${logo?'Logo Clap &amp; Role':`Image ${id}`}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Image"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>`;
    const x = placement ? Math.round((placement.x+(placement.width-cx/36000)/2)*36000) : 0;
    const y = placement ? Math.round((placement.y+(placement.height-cy/36000)/2)*36000) : 0;
    const framedContent=content;
    const drawing = background || placement ? `<wp:anchor distT="108000" distB="108000" distL="108000" distR="108000" simplePos="0" relativeHeight="${background?0:1}" behindDoc="${background?1:0}" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${y}</wp:posOffset></wp:positionV>${framedContent.replace('<wp:docPr', `${background||logo?'<wp:wrapNone/>':'<wp:wrapSquare wrapText="bothSides"/>'}<wp:docPr`)}</wp:anchor>` : `<wp:inline>${content}</wp:inline>`;
    return `<w:r><w:drawing>${drawing}</w:drawing></w:r>`;
  }
  let currentFrontMatter: 'credits'|'community'|'thanks'|undefined;
  function frontMatterRun(node: Node) {
    if(!currentFrontMatter)return '';
    const block=node.parentElement?.closest('h1,h2,h3,h4,h5,p');
    const heading=block?.tagName;
    const author=currentFrontMatter==='credits'&&!!node.parentElement?.closest('[data-film-credit-block="author"]');
    const font=heading?.startsWith('H')||author?'Courier Prime':'LM Mono Light 10';
    const titleBlock=!!node.parentElement?.closest('[data-film-credit-block="title"]');
    const size=titleBlock?(heading==='H2'?56:32):heading==='H1'||heading==='H2'?72:heading==='H3'||author?36:currentFrontMatter==='credits'?24:28;
    return `<w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${size}"/><w:b/>`;
  }
  function runs(node: Node, bold = false, italic = false, underline = false): string {
    if (node.nodeType === Node.TEXT_NODE) return `<w:r><w:rPr>${frontMatterRun(node)}${bold?'<w:b/>':''}${italic?'<w:i/>':''}${underline?'<w:u w:val="single"/>':''}</w:rPr><w:t xml:space="preserve">${xml(node.textContent ?? '')}</w:t></w:r>`;
    const el = node as Element; if (el.tagName === 'BR') return '<w:r><w:br/></w:r>';
    return Array.from(node.childNodes).map(n => runs(n, bold || ['B','STRONG','TH'].includes(el.tagName), italic || ['I','EM'].includes(el.tagName), underline || el.tagName==='U')).join('');
  }
  let currentGenerated:string|undefined;
  function blocks(node: Element, gray = false, listIndex?:number): string {
    if(currentGenerated==='toc'){
      if(node.tagName==='H2')return `<w:p><w:pPr><w:pStyle w:val="FilmTocHeading"/></w:pPr>${runs(node)}</w:p>`;
      const level=node.getAttribute('data-toc-level');
      if(level)return `<w:p><w:pPr><w:pStyle w:val="FilmToc${level}"/></w:pPr>${runs(node.querySelector('[data-toc-label]')!)}<w:r><w:tab/></w:r>${runs(node.querySelector('[data-toc-number]')!)}</w:p>`;
      if(node.tagName==='P')return `<w:p><w:pPr><w:pStyle w:val="FilmToc1"/></w:pPr>${runs(node)}</w:p>`;
    }
    if (node.tagName === 'TABLE') return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(s=>`<w:${s} w:val="single" w:sz="4" w:color="777777"/>`).join('')}</w:tblBorders></w:tblPr>${Array.from(node.querySelectorAll('tr')).map(row=>`<w:tr>${Array.from(row.children).map(cell=>`<w:tc><w:tcPr>${cell.tagName==='TH'?'<w:shd w:fill="DDDDDD"/>':''}</w:tcPr><w:p>${runs(cell)}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
    if (['BLOCKQUOTE','UL','OL'].includes(node.tagName) || (node.tagName==='DIV' && Array.from(node.children).some(el=>['P','DIV','H1','H2','H3','H4','H5','TABLE','UL','OL','BLOCKQUOTE'].includes(el.tagName)))) return Array.from(node.childNodes).map((el,index)=>el.nodeType===Node.TEXT_NODE ? (el.textContent?.trim()?`<w:p>${runs(el)}</w:p>`:'') : blocks(el as Element,gray || node.tagName==='BLOCKQUOTE',node.tagName==='OL'?index+1:undefined)).join('') || '<w:p/>';
    const heading = /^H[1-5]$/.test(node.tagName) ? Number(node.tagName[1]) : 0;
    const special=node.getAttribute('data-film-style');
    const align=(node as HTMLElement).style.textAlign;
    return `<w:p><w:pPr>${heading?`<w:pStyle w:val="${special==='cover'?'FilmCoverTitle':special==='section'?'FilmSectionTitle':`Heading${heading}`}"/>`:''}${align?`<w:jc w:val="${align==='justify'?'both':xml(align)}"/>`:''}${gray?'<w:shd w:fill="E5E5E5"/>':''}<w:spacing w:after="120"/></w:pPr>${node.tagName==='LI'?`<w:r><w:t>${listIndex?`${listIndex}.`:'•'} </w:t></w:r>`:''}${runs(node)}</w:p>`;
  }
  let body = '', count = 0;
  for (const section of book.sections) for (const page of section.pages) {
    currentGenerated=page.generated;currentFrontMatter=page.frontMatter?(page.id.endsWith('-credits')?'credits':page.id.endsWith('-community')?'community':'thanks'):undefined;
    if (count++) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    let bg = filmPageBackground(section,page,count);
    if(page.titlePage && !bg) {const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#242424';ctx.fillRect(0,0,2,2);bg=canvas.toDataURL();}
    if(!page.titlePage&&!page.imagePage&&page.watermark){const canvas=document.createElement("canvas");canvas.width=1260;canvas.height=1782;const ctx=canvas.getContext("2d")!;if(bg){const base=new Image();base.src=bg;await base.decode();ctx.drawImage(base,0,0,canvas.width,canvas.height);}const originalBackground=bg;const mark=new Image();mark.src=page.watermark.source;await mark.decode();const width=canvas.width*page.watermark.size/100,height=width*mark.height/mark.width;const faded=featherWatermark(mark,210*page.watermark.size/100,page.watermark.featherMm);const watermarkLayer=document.createElement("canvas");watermarkLayer.width=canvas.width;watermarkLayer.height=canvas.height;const layer=watermarkLayer.getContext("2d")!;layer.drawImage(faded,canvas.width*(page.watermark.x??50)/100-width/2,canvas.height*(page.watermark.y??50)/100-height/2,width,height);if(originalBackground)fadeFilmBandCut(layer,canvas.width,canvas.height);ctx.save();ctx.globalAlpha=page.watermark.opacity;ctx.drawImage(watermarkLayer,0,0);ctx.restore();if(originalBackground && !page.titlePage){const bands=new Image();bands.src=originalBackground;await bands.decode();ctx.globalAlpha=1;const fraction=FILM_BAND_HEIGHT_MM/297;for(const offset of [0,1-fraction])ctx.drawImage(bands,0,bands.naturalHeight*offset,bands.naturalWidth,bands.naturalHeight*fraction,0,canvas.height*offset,canvas.width,canvas.height*fraction);}bg=canvas.toDataURL("image/png");}
    if (bg) body += `<w:p>${await picture(bg,true,undefined,page.generated==='toc')}</w:p>`;
    if(!page.imagePage){
    if (page.titlePage) body += `<w:p><w:pPr><w:spacing w:before="${page.cover?340:3000}"/></w:pPr></w:p>`;
    if(page.cover)body+=`<w:p>${await picture(await filmCoverLogoPng(),false,{id:'cover-logo',kind:'image',x:60,y:103.5,width:90,height:90},false,true)}</w:p>`;
    const doc = new DOMParser().parseFromString(cleanBookHtml(page.html),'text/html');
    let pageText = Array.from(doc.body.childNodes).map(node => node.nodeType === Node.TEXT_NODE ? `<w:p>${runs(node)}</w:p>` : blocks(node as Element)).join('');
    if(currentFrontMatter==='credits'||currentFrontMatter==='community') {
      const positions: Record<string, [number, number]> = { title:[65,60], author:[215,35], copyright:[273,20], community:[90,35] };
      pageText = Array.from(doc.body.children).map(element=>{
        const role=element.getAttribute('data-film-credit-block')??'';
        const position=positions[role];if(!position)return blocks(element);
        const text=blocks(element).replace(/<w:jc[^>]*\/>/g,'').replace(/<w:pPr>/g,'<w:pPr><w:jc w:val="center"/>');
        return `<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" id="credits-${role}-${count}" style="position:absolute;margin-left:20mm;margin-top:${position[0]}mm;width:170mm;height:${position[1]}mm;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent>${text}</w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>`;
      }).join('');
    }
    if(page.titlePage) pageText=pageText.replace(/<w:jc[^>]*\/>/g,'').replace(/<w:pPr>/g,'<w:pPr><w:jc w:val="center"/>').replace(/<w:rPr>/g,'<w:rPr><w:color w:val="FFFFFF"/>');
    if(filmPageHasDarkBackground(section,page))pageText=pageText.replace(/<w:rPr>/g,'<w:rPr><w:color w:val="FFFFFF"/>');
    if(page.backCover)pageText=backCoverWordFrame(pageText,count);
    body += pageText;
    if(page.cover){const lower=new DOMParser().parseFromString(cleanBookHtml(page.coverBottomHtml??'<h2>Titre bas</h2>'),'text/html');const text=Array.from(lower.body.childNodes).map(el=>el.nodeType===Node.TEXT_NODE?`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${runs(el)}</w:p>`:blocks(el as Element)).join('').replace(/<w:jc[^>]*\/>/g,'').replace(/<w:pPr>/g,'<w:pPr><w:jc w:val="center"/>').replace(/<w:rPr>/g,'<w:rPr><w:color w:val="FFFFFF"/>');body+=`<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" id="coverBottomTitle${count}" style="position:absolute;margin-left:20mm;margin-top:210mm;width:170mm;height:64mm;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent>${text||'<w:p/>'}</w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>`;}
    if (page.image) body += `<w:p>${await picture(page.image)}</w:p>`;
    for(const stored of page.objects??[]) {
      const object=constrainFilmObject(stored);
      if(object.kind==='image' && object.source) {
        body+=`<w:p>${await picture(object.source,false,object)}</w:p>`;
        const label=creditsQrLabel(object.source);
        if(label)body+=`<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" id="qr-label-${count}-${label}" style="position:absolute;margin-left:${object.x}mm;margin-top:${object.y+object.height+3}mm;width:${object.width}mm;height:12mm;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier Prime" w:hAnsi="Courier Prime"/><w:b/><w:sz w:val="36"/><w:color w:val="FFFFFF"/></w:rPr><w:t>${label}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>`;
      }
      else {
        const text=new DOMParser().parseFromString(cleanBookHtml(object.html??''),'text/html');
        body+=`<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" id="example${++imageId}" style="position:absolute;margin-left:${object.x}mm;margin-top:${object.y}mm;width:${object.width}mm;height:${object.height}mm;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" fillcolor="#D9D9D9" stroked="t" strokecolor="#777777" strokeweight="0.75pt"><w10:wrap xmlns:w10="urn:schemas-microsoft-com:office:word" type="square"/><v:textbox inset="5mm,5mm,5mm,5mm"><w:txbxContent>${Array.from(text.body.children).map(el=>blocks(el,true)).join('') || '<w:p/>'}</w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>`;
      }
    }
    }
    if(!page.cover && !page.titlePage && !page.frontMatter && !page.generated) {
    if(hasFilmSectionLabel(page))body+=filmSectionLabelWord(section.name,count,section.labelColor);
    const numberStyle=filmNumberStyle(count,!!bg,page.imagePage?.numberColor);
    const numberX=parseFloat(numberStyle.left)-parseFloat(numberStyle.width)/2,numberY=parseFloat(numberStyle.top)-parseFloat(numberStyle.height)/2;
    body+=`<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" id="pageNumber${count}" style="position:absolute;margin-left:${numberX}mm;margin-top:${numberY}mm;width:${parseFloat(numberStyle.width)}mm;height:${parseFloat(numberStyle.height)}mm;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;v-text-anchor:middle" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="LM Mono Light 10" w:hAnsi="LM Mono Light 10"/><w:b/><w:sz w:val="32"/><w:color w:val="${page.imagePage?.numberColor==='white'?'FFFFFF':'000000'}"/></w:rPr><w:t>${count}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>`;
    }
  }
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('word/styles.xml',filmWordStyles().replace('</w:styles>',filmTocWordStyles+filmSpecialTitleWordStyles+'</w:styles>'));
  zip.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1361" w:right="1134" w:bottom="1304" w:left="1134"/></w:sectPr></w:body></w:document>`);
  downloadBlob(await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),`${book.name.replace(/[<>:"/\\|?*]/g,'_')}.docx`);
}
