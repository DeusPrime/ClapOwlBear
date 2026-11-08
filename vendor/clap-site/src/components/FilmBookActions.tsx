import { Download, MoreVertical, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';

export default function FilmBookActions({ busy, status, exportWord, exportPdf, remove }: { busy: boolean; status: string; exportWord: () => void; exportPdf: () => void; remove: () => void }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><button type="button" aria-label="Actions du film" data-tour="detail-actions" className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"><MoreVertical size={22} /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="w-64 max-w-[calc(100vw-2rem)] border-2 border-ink bg-paper p-2 text-foreground shadow-[4px_4px_0_hsl(var(--ink))]">
      <DropdownMenuLabel className="px-3 py-2 typewriter text-xs uppercase tracking-widest text-foreground/60">Actions du film</DropdownMenuLabel>
      <p role="status" className="px-2 pb-2 text-xs text-muted-foreground">{status}</p>
      <DropdownMenuSeparator className="bg-ink/15" />
      <DropdownMenuItem disabled={busy} onSelect={exportWord} className="min-h-12 cursor-pointer gap-3 px-3"><Download size={18} />Exporter Word (.docx)</DropdownMenuItem>
      <DropdownMenuItem disabled={busy} onSelect={exportPdf} className="min-h-12 cursor-pointer gap-3 px-3"><Download size={18} />Exporter PDF / Imprimer</DropdownMenuItem>
      <DropdownMenuSeparator className="bg-ink/15" />
      <DropdownMenuItem disabled={busy} onSelect={remove} className="min-h-12 cursor-pointer gap-3 px-3 text-destructive focus:bg-destructive/10 focus:text-destructive"><Trash2 size={18} />Supprimer le film</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
