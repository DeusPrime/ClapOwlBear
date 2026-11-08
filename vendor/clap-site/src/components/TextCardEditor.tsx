import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, RemoveFormatting, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { localizeText } from '@/i18n/localize';
import { richTextToHtml } from '@/lib/richText';
import { renderTextCard, loadTextCardFonts, type TextCardFields, type TextCardOptions, type TextVerticalAlign } from '@/lib/pokerTextCard';
import { TITLE_FONTS, titleFont as resolveFont, type TitleFont } from '@/lib/pokerCardTitle';

type Change = TextCardFields & { title: string; titleFont: TitleFont; url: string };
export default function TextCardEditor({ text, fontSize, title, titleFont = TITLE_FONTS[0].value, textFont = TITLE_FONTS[0].value, textVerticalAlign = "top", onChange }: {
  text: string; fontSize: number; title: string; titleFont?: TitleFont; textFont?: TitleFont; textVerticalAlign?: TextVerticalAlign; onChange: (value: Change) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    if (editor.current && document.activeElement !== editor.current) editor.current.innerHTML = richTextToHtml(text, { allowAlignment: true });
  }, [text]);
  const commit = (html: string, size = fontSize, options: TextCardOptions = {}) => {
    const clean = richTextToHtml(html, { allowAlignment: true });
    const appearance = { title, titleFont, textFont, textVerticalAlign, ...options };
    const rendered = renderTextCard(clean, size, appearance);
    setOverflow(rendered.overflow);
    onChange({ text: clean, textFontSize: size, ...appearance, url: rendered.source });
  };
  const refresh = useRef(() => {});
  refresh.current = () => commit(text);
  useEffect(() => {
    let cancelled = false;
    void loadTextCardFonts({ titleFont, textFont }).then(() => { if (!cancelled) refresh.current(); }).catch(() => { /* System fallback fonts remain usable offline. */ });
    return () => { cancelled = true; };
  }, [titleFont, textFont]);
  const command = (name: string) => {
    const selection = document.getSelection();
    if (!selection?.anchorNode || !editor.current?.contains(selection.anchorNode)) editor.current?.focus();
    document.execCommand(name, false);
    commit(editor.current?.innerHTML ?? '');
  };
  const fontSelect = (label: string, value: TitleFont, change: (font: TitleFont) => void) => <label className="flex items-center justify-between gap-3 text-sm">{localizeText(label)}<select aria-label={localizeText(label)} value={value} onChange={event => change(event.target.value as TitleFont)} className="min-h-11 min-w-0 max-w-[65%] border border-ink bg-paper p-2">{TITLE_FONTS.map(font => <option key={font.value} value={font.value}>{localizeText(font.label)}</option>)}</select></label>;
  return <section className="space-y-3" aria-label={localizeText('Éditeur du recto texte')}>
    <label className="block space-y-2 font-bold">{localizeText('Titre de la carte')}<input value={title} maxLength={120} onChange={event => commit(text, fontSize, { title: event.target.value })} className="min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
    {fontSelect('Police du titre', titleFont, value => commit(text, fontSize, { titleFont: value }))}
    <h3 className="border-t border-ink/20 pt-3 font-bold">{localizeText('Texte du recto')}</h3>
    {fontSelect('Police du texte', textFont, value => commit(text, fontSize, { textFont: value }))}
    <label className="flex items-center justify-between gap-3 text-sm">{localizeText('Alignement vertical')}<select aria-label={localizeText('Alignement vertical')} value={textVerticalAlign} onChange={event => commit(text, fontSize, { textVerticalAlign: event.target.value as TextVerticalAlign })} className="min-h-11 border border-ink bg-paper p-2"><option value="top">{localizeText('En haut')}</option><option value="middle">{localizeText('Au milieu')}</option><option value="bottom">{localizeText('En bas')}</option></select></label>
    <div role="toolbar" aria-label={localizeText('Mise en forme du texte')} className="flex flex-wrap gap-1">
      {([{ command: 'bold', label: 'Gras', Icon: Bold }, { command: 'italic', label: 'Italique', Icon: Italic }, { command: 'underline', label: 'Souligné', Icon: Underline }, { command: 'justifyLeft', label: 'Aligner à gauche', Icon: AlignLeft }, { command: 'justifyCenter', label: 'Centrer le texte', Icon: AlignCenter }, { command: 'justifyRight', label: 'Aligner à droite', Icon: AlignRight }, { command: 'insertUnorderedList', label: 'Liste à puces', Icon: List }, { command: 'insertOrderedList', label: 'Liste numérotée', Icon: ListOrdered }, { command: 'removeFormat', label: 'Effacer la mise en forme', Icon: RemoveFormatting }]).map(({ command: name, label, Icon }) => <button key={name} type="button" aria-label={localizeText(label)} title={localizeText(label)} className="flex h-11 w-11 items-center justify-center border border-ink/30 hover:bg-ink/10" onMouseDown={event => event.preventDefault()} onClick={() => command(name)}><Icon size={17} /></button>)}
    </div>
    <div ref={editor} role="textbox" aria-label={localizeText('Texte du recto')} aria-multiline="true" contentEditable suppressContentEditableWarning style={{ fontFamily: resolveFont(textFont).family }} className="min-h-40 whitespace-pre-wrap border-2 border-ink bg-paper p-3 text-base outline-none focus:ring-2 focus:ring-accent [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" onInput={event => {
      if ((event.currentTarget.textContent?.length ?? 0) > 10000) event.currentTarget.textContent = event.currentTarget.textContent!.slice(0, 10000);
      commit(event.currentTarget.innerHTML);
    }} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); }} />
    <label className="flex items-center justify-between gap-3 text-sm">{localizeText('Taille du texte')}<select aria-label={localizeText('Taille du texte')} value={fontSize} onChange={event => commit(text, Number(event.target.value))} className="min-h-11 border border-ink bg-paper p-2">{[6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20].map(size => <option key={size} value={size}>{size} pt</option>)}</select></label>
    <p className="text-xs opacity-70">{localizeText('Le texte revient à la ligne et sa taille diminue si nécessaire pour tenir sur la carte.')}</p>
    {overflow && <p role="alert" className="text-sm text-destructive">{localizeText('Le texte dépasse encore la carte. Raccourcissez-le pour que tout soit imprimé.')}</p>}
  </section>;
}
