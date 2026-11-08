import { localizeNode } from '@/i18n/localize';
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAccount } from "@/lib/community";
import { useLang } from "@/i18n/LanguageContext";

export default function AddPublication({ kind }: { kind: "films" | "news" }) {
  const { user } = useAccount(); const { lang } = useLang();
  if (!user?.admin) return null;
  return <Link to={`/admin/${kind}/new`} className="btn-clap self-start"><Plus size={16} aria-hidden="true" />{localizeNode(kind === "films" ? (lang === "fr" ? "Ajouter un film" : "Add a film") : (lang === "fr" ? "Ajouter une actualité" : "Add news"))}</Link>;
}
