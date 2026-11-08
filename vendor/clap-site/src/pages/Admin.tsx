import { localizeText, localizeNode } from '@/i18n/localize';
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import AccountAvatar from "@/components/AccountAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityRequest, useAccount, type Account } from "@/lib/community";

type ManagedAccount = Account & { created: number; root: boolean };
function AdminInner() {
  const { lang } = useLang(); const fr = lang === "fr";
  const { user, loading } = useAccount(); const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["admin-users"], enabled: Boolean(user?.admin), retry: false,
    queryFn: ({ signal }) => communityRequest<{ users: ManagedAccount[] }>("/admin/users", undefined, signal) });
  const accounts = (query.data?.users ?? []).filter(account => `${account.username} ${account.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const act = async (id: string, action: "promote" | "delete") => {
    setBusy(true); setError("");
    try {
      await communityRequest(`/admin/users/${encodeURIComponent(id)}/${action}`, {}); setPendingDelete(null);
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      await client.invalidateQueries({ queryKey: ["film-activity"] });
      await client.invalidateQueries({ queryKey: ["content", "films"] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erreur du service."); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen"><Header /><main className="container max-w-5xl pt-28 md:pt-36 pb-20">
    <Link to="/compte" className="typewriter text-sm underline">{localizeNode(fr ? "← Mon compte" : "← My account")}</Link>
    <h1 className="font-display text-5xl mt-8 mb-6">{localizeNode(fr ? "Administration des comptes" : "Account administration")}</h1>
    {loading ? <p role="status">{localizeNode(fr ? "Chargement…" : "Loading…")}</p> : !user?.admin ? <p>{localizeNode(fr ? "Cette page est réservée aux administrateurs." : "This page is restricted to administrators.")} <Link to="/compte" className="underline">{localizeNode(fr ? "Connexion" : "Sign in")}</Link></p> : <>
      <p className="typewriter mb-6">{localizeNode(query.data?.users.length ?? 0)} {localizeNode(fr ? "comptes enregistrés" : "registered accounts")} · {localizeNode(query.data?.users.filter(account => account.admin).length ?? 0)} {localizeNode(fr ? "administrateurs" : "administrators")}</p>
      <label className="block space-y-2 mb-8"><span className="typewriter text-sm">{localizeNode(fr ? "Rechercher un compte" : "Search accounts")}</span><Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={localizeText(fr ? "Pseudo ou email" : "Username or email")} /></label>
      {localizeNode(query.isPending && <p role="status">{localizeNode(fr ? "Chargement des comptes…" : "Loading accounts…")}</p>)}
      {query.isError && <p role="alert">{query.error.message} <button className="underline" onClick={() => void query.refetch()}>{localizeNode(fr ? "Réessayer" : "Retry")}</button></p>}
      {localizeNode(error && <p role="alert" className="text-destructive mb-4">{localizeNode(error)}</p>)}
      <div className="space-y-4">{accounts.map(account => <article key={account.id} className="paper-card p-5 flex flex-col sm:flex-row gap-5 sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3"><AccountAvatar username={account.username} avatar={account.avatar} /><h2 className="font-display text-2xl break-words">{account.username}</h2></div>
          <p className="typewriter text-sm break-all">{account.email || (fr ? "Email non fourni" : "Email not provided")}</p>
          <p className="typewriter text-xs">{localizeNode(account.root ? (fr ? "Administrateur initial" : "Initial administrator") : account.admin ? (fr ? "Administrateur" : "Administrator") : (fr ? "Membre" : "Member"))}</p>
          <p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "Inscrit le " : "Joined ")}{localizeNode(new Date(account.created).toLocaleDateString(fr ? "fr-FR" : "en-GB"))} · {[...(account.hasPassword ? [fr ? "Mot de passe" : "Password"] : []), ...account.providers.map(provider => provider === "google" ? "Google" : "Discord")].join(", ")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end shrink-0">
          {localizeNode(!account.admin && <Button variant="outline" disabled={busy} onClick={() => void act(account.id, "promote")}>{localizeNode(fr ? "Passer administrateur" : "Make administrator")}</Button>)}
          {!account.root && account.id !== user.id && (pendingDelete === account.id ? <div className="space-y-3 sm:max-w-64">
            <p className="text-sm">{fr ? "Supprimer ce compte, ses notes et ses commentaires ? Cette action est définitive." : "Delete this account, its ratings and comments? This is permanent."}</p>
            <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={() => void act(account.id, "delete")}>{localizeNode(fr ? "Confirmer" : "Confirm")}</Button><Button variant="outline" disabled={busy} onClick={() => setPendingDelete(null)}>{localizeNode(fr ? "Annuler" : "Cancel")}</Button></div>
          </div> : <Button variant="destructive" disabled={busy} onClick={() => setPendingDelete(account.id)}>{localizeNode(fr ? "Supprimer le compte" : "Delete account")}</Button>)}
        </div>
      </article>)}</div>
      {localizeNode(query.data && !accounts.length && <p>{localizeNode(fr ? "Aucun compte ne correspond à la recherche." : "No accounts match your search.")}</p>)}
    </>}
  </main><Footer /></div>;
}
export default function AdminPage() { return <LanguageProvider><AdminInner /></LanguageProvider>; }
