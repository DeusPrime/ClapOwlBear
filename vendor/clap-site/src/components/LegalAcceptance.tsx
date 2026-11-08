import { localizeText } from '@/i18n/localize';
import { useId } from "react";
import { Link } from "react-router-dom";

export default function LegalAcceptance({ accepted, onChange, appView, required = false, disabled = false }: { accepted: boolean; onChange: (value: boolean) => void; appView: boolean; required?: boolean; disabled?: boolean }) {
  const id = useId(), prefix = appView ? "/app" : "";
  return <div className="space-y-2 border-2 border-ink/20 p-4">
    <div className="flex items-start gap-3"><input id={id} type="checkbox" checked={accepted} required={required} disabled={disabled} onChange={event => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-accent" />
      <label htmlFor={id} className="text-sm leading-6">{localizeText("J’accepte les conditions générales d’utilisation et reconnais avoir pris connaissance de la politique de confidentialité.")}</label></div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 pl-8 text-xs"><Link target="_blank" rel="noopener noreferrer" className="underline" to={`${prefix}/cgu`}>{localizeText("Lire les CGU")}</Link><Link target="_blank" rel="noopener noreferrer" className="underline" to={`${prefix}/confidentialite`}>{localizeText("Lire la politique de confidentialité")}</Link></div>
    <p className="pl-8 text-xs text-muted-foreground">{localizeText("Cette acceptation concerne le compte et les contributions ; elle n’autorise ni publicité ciblée ni vente de données.")}</p>
  </div>;
}
