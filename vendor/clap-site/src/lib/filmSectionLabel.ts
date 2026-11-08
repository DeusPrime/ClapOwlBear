import type {BookPage} from './filmBooks';
export const hasFilmSectionLabel=(page:BookPage)=>!page.titlePage&&!page.cover&&!page.generated&&!page.frontMatter&&!page.imagePage;
export const sectionLabelFontSize=(name:string)=>Math.max(7,Math.min(12,12*86/Math.max(1,name.trim().length)));
export const sectionLabelColor=(color?:string)=>/^#[0-9a-f]{6}$/i.test(color??'')?color!:'#1da429';
export function sectionLabelMetrics(name:string){
 // Visible end spacing derived from Word label extents minus the 12 pt title length.
 const characters=Math.max(1,Array.from(name.trim()).length);
 const textLength=characters*sectionLabelFontSize(name)*25.4/72*.6;
 return {width:390525/36000,height:textLength+2*4};
}
export function sectionLabelStyle(name:string,pageNumber:number,color?:string){
 const {width,height}=sectionLabelMetrics(name);
 return {width:width+'mm',height:height+'mm',backgroundColor:sectionLabelColor(color),left:pageNumber%2?'auto':'0',right:pageNumber%2?'0':'auto','--section-label-length':height-2*4+'mm',boxShadow:(pageNumber%2?'-': '')+'0.748mm 0.748mm 1.411mm rgba(0,0,0,.4)',borderRadius:'0'};
}
export const filmSectionLabelCss='.book-page .book-section-label{position:absolute;top:30mm;color:#fff;z-index:4;pointer-events:none;border-radius:0;overflow:hidden}.book-section-label span{position:absolute;left:50%;top:50%;width:var(--section-label-length);text-align:center;font-family:"Courier Prime","Courier New",monospace;font-weight:700;line-height:1.1;letter-spacing:normal;text-transform:none;white-space:nowrap;transform:translate(-50%,-50%) rotate(-90deg)}.book-section-label[data-side=left] span{transform:translate(-50%,-50%) rotate(90deg)}';
export function appendFilmSectionLabel(doc:Document,article:HTMLElement,name:string,pageNumber:number,color?:string){
 const box=doc.createElement('div');box.className='book-section-label';box.dataset.side=pageNumber%2?'right':'left';
 const style=sectionLabelStyle(name,pageNumber,color);Object.assign(box.style,style);box.style.setProperty('--section-label-length',style['--section-label-length']);
 const text=doc.createElement('span');text.textContent=name.trim();text.style.fontSize=sectionLabelFontSize(name)+'pt';box.append(text);article.append(box);
}
export function filmSectionLabelWord(name:string,pageNumber:number,color?:string){
 const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const {width,height}=sectionLabelMetrics(name);
 return '<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" id="sectionLabel'+pageNumber+'" style="position:absolute;margin-left:'+(pageNumber%2?210-width:0)+'mm;margin-top:30mm;width:'+width+'mm;height:'+height+'mm;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;v-text-anchor:middle;z-index:4" fillcolor="'+sectionLabelColor(color)+'" stroked="f"><v:shadow on="t" color="black" opacity=".4" offset="'+(pageNumber%2?'-':'')+'.748mm,.748mm"/><v:textbox inset="1mm,4mm,1mm,4mm" style="layout-flow:vertical;'+(pageNumber%2?'mso-layout-flow-alt:bottom-to-top':'')+'"><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/><w:textDirection w:val="'+(pageNumber%2?'btLr':'tbRl')+'"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier Prime" w:hAnsi="Courier Prime"/><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="'+Math.round(sectionLabelFontSize(name)*2)+'"/></w:rPr><w:t>'+escape(name.trim())+'</w:t></w:r></w:p></w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>';
}
