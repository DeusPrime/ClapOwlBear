import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { getLanguage } from '@/i18n/localize';

export function ListLoading({ loading }: { loading: boolean }) {
  const [visible, setVisible] = useState(loading);
  useEffect(() => {
    if (loading) { setVisible(true); return; }
    const timer = window.setTimeout(() => setVisible(false), 150);
    return () => window.clearTimeout(timer);
  }, [loading]);
  if (!visible) return null;
  return <p role="status" className="my-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />{getLanguage() === 'en' ? 'Loading…' : 'Chargement…'}</p>;
}
