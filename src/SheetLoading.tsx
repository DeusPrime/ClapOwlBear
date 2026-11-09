import { LoaderCircle } from 'lucide-react';
import { useLang } from '@/i18n/LanguageContext';
export default function SheetLoading(){const {lang}=useLang();return <div role="status" aria-live="polite" className="flex min-h-24 flex-col items-center justify-center gap-3 p-5 text-center"><LoaderCircle aria-hidden="true" className="h-8 w-8 animate-spin text-accent motion-reduce:[animation-duration:3s]"/><span className="text-sm font-bold">{lang==='fr'?'Chargement en cours…':'Loading…'}</span></div>;}
