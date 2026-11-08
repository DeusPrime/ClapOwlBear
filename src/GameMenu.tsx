import { useState, useSyncExternalStore } from "react";
import { runtimeInfo, runtimeSubscribe } from "./runtime/client";
import { Link } from "react-router-dom";
import {
  Menu,
  X,
  Users,
  LayoutDashboard,
  UserCircle,
  Library,
  Clapperboard,
  Settings,
} from "lucide-react";
import { useRoom } from "@/hooks/use-room";
import ThemeToggle from "@/components/ThemeToggle";
import DirectoryPicker from "@/components/DirectoryPicker";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
export default function GameMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const room = useRoom(),
    info = useSyncExternalStore(runtimeSubscribe, runtimeInfo),
    gm = room.session?.role === "mj" || (!room.session && info?.role === "GM");
  const [open, setOpen] = useState(false);
  const links = gm
    ? ([
        ["/app/salle", "Salle de jeu", Users],
        ["/app/studio", "Mes projets", LayoutDashboard],
        ["/characters", "Héros", UserCircle],
        ["/ressources", "Cartes", Library],
        ["/outils", "Ressources", Library],
        ["/film", "Film", Clapperboard],
        ["/settings", "Importer / exporter", Settings],
      ] as const)
    : ([["/app/salle", "Ma fiche et la salle", Users]] as const);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ouvrir le menu CLAP!"
          className="flex h-11 w-11 items-center justify-center"
        >
          <Menu size={24} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto bg-paper">
        <SheetTitle className="font-display text-3xl">Clap & Role</SheetTitle>
        <SheetDescription>Votre partie dans Owlbear Rodeo.</SheetDescription>
        <nav className="my-6 grid gap-2">
          {links.map(([to, title, Icon]) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded border border-ink/15 px-3 py-2"
            >
              <Icon size={18} />
              {title}
            </Link>
          ))}
          {!gm && info?.role === "GM" && (
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded border border-ink/15 px-3 py-2"
            >
              Connexion de salle
            </Link>
          )}
        </nav>
        {gm && (
          <DirectoryPicker
            manage
            mobileMenu
            value={value}
            onChange={onChange}
          />
        )}
        <div className="mt-6 border-t border-ink/15 pt-4">
          <ThemeToggle showLabel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
