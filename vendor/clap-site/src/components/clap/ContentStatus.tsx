import { localizeNode } from '@/i18n/localize';
type Props = {
  query: { isPending: boolean; isError: boolean; data?: unknown[]; refetch: () => unknown };
  lang: "fr" | "en";
};

export default function ContentStatus({ query, lang }: Props) {
  if (query.isPending) return <p role="status" className="typewriter py-6">{localizeNode(lang === "fr" ? "Chargement…" : "Loading…")}</p>;
  if (query.isError) return <p role="alert" className="typewriter py-6">
    {localizeNode(lang === "fr" ? "Le contenu est momentanément indisponible. " : "Content is temporarily unavailable. ")}
    <button className="underline" onClick={() => query.refetch()}>{localizeNode(lang === "fr" ? "Réessayer" : "Try again")}</button>
  </p>;
  if (!query.data?.length) return <p className="typewriter py-6">{localizeNode(lang === "fr" ? "Aucune publication pour le moment." : "No publications yet.")}</p>;
  return null;
}
