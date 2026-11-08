import { localizeText } from '@/i18n/localize';
import ImageEditorField from "./ImageEditorField";
import type { ImageEditing } from "@/lib/imageEditing";

export default function CardBackImageEditor({ value, editing, onChange, label = "Fond du dos", inputLabel, disabled }: {
  value?: string; editing?: ImageEditing; onChange: (value?: string, editing?: ImageEditing) => void; label?: string; inputLabel?: string; disabled?: boolean;
}) {
  return <ImageEditorField value={value} editing={editing} onChange={onChange} label={localizeText(label)} inputLabel={inputLabel} removeLabel="Rétablir le fond d’origine" aspectRatio={63 / 88} maxImageDimension={1039} disabled={disabled} />;
}
