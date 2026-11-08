import { useState, useSyncExternalStore } from "react";
import { roomClient } from "@/lib/roomClient";
import { useRoom } from "@/hooks/use-room";
import { runtimeInfo, runtimeSubscribe } from "./runtime/client";
import { Button } from "@/components/ui/button";
export default function SiteLinkPanel() {
  const info = useSyncExternalStore(runtimeSubscribe, runtimeInfo),
    room = useRoom();
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (info?.role !== "GM") return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Liaison impossible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 border border-ink/20 p-4">
      <h2 className="font-display text-2xl">Salle du site CLAP!</h2>
      {info.mode === "site" ? (
        <>
          <p className="text-sm">
            Cette salle Owlbear est liée à la partie {info.code} du site. Les
            joueurs rejoignent la même table automatiquement.
          </p>
          {room.session?.role !== "mj" && (
            <p className="text-sm">
              Pour piloter la partie depuis Owlbear, le MJ du site doit te
              transmettre le rôle de MJ depuis « Gérer la salle ». Tu disposeras
              alors des outils complets du MJ ici.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Fermer la liaison quitte la partie liée. Si tu en es le MJ, cette
            action la ferme pour tous ses participants après sauvegarde.
          </p>
          <Button
            disabled={busy}
            onClick={() => void run(() => roomClient.unlinkSiteRoom())}
          >
            Fermer la liaison et ouvrir une partie Owlbear
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm">
            Pour jouer avec une salle déjà ouverte sur le site, son MJ génère un
            code dans « Gérer la salle → Relier Owlbear Rodeo ». La liaison
            masque cette partie dans l’annuaire du site.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => roomClient.linkSiteRoom(code));
            }}
          >
            <label htmlFor="site-room-code" className="block text-sm font-bold">
              Identifiant et code de liaison de la salle
            </label>
            <input
              id="site-room-code"
              aria-label="Code de liaison de la salle du site"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full border border-ink/20 bg-paper p-3 font-mono text-sm"
              placeholder="ABCDEF123456.code-de-liaison"
              required
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              La partie Owlbear courante sera sauvegardée puis fermée avant la
              connexion à cette salle. Aucun mot de passe ou jeton MJ n’est
              partagé avec les joueurs.
            </p>
            <Button type="submit" disabled={busy}>
              Relier la salle du site
            </Button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
