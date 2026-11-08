import { localizeText, localizeNode } from '@/i18n/localize';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Facet } from "@/lib/characters";
import { HeartCrack, Brain, Eye } from "lucide-react";

const CONFIG: Record<Facet, { title: string; subtitle: string; Icon: typeof HeartCrack; color: string; dark: string }> = {
  corps: {
    title: "À l'agonie",
    subtitle: "Le corps lâche. Chaque souffle est un combat.",
    Icon: HeartCrack,
    color: "#7F240F",
    dark: "#2b0c05",
  },
  esprit: {
    title: "Délire",
    subtitle: "L'esprit se fissure. Plus rien ne tient debout.",
    Icon: Brain,
    color: "#3E7A2F",
    dark: "#14290f",
  },
  ame: {
    title: "Désespoir",
    subtitle: "L'âme s'effondre. Le vide a tout emporté.",
    Icon: Eye,
    color: "#253A72",
    dark: "#0c1326",
  },
};

export default function CriticalDialog({
  facet, onClose,
}: { facet: Facet | null; onClose: () => void }) {
  const open = facet !== null;
  if (!facet) {
    return (
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent />
      </Dialog>
    );
  }
  const { title, subtitle, Icon, color, dark } = CONFIG[facet];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-xl border-0 p-0 overflow-hidden text-white"
        style={{ background: `linear-gradient(135deg, ${dark} 0%, #050403 48%, #050403 100%)` }}
      >
        <div className="relative px-10 py-14 text-center">
          {/* Pulsing rings */}
          <span className="absolute inset-0 m-auto w-72 h-72 rounded-full opacity-10 animate-ping" style={{ backgroundColor: color }} />
          <span className="absolute inset-0 m-auto w-48 h-48 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: color }} />

          <div className="relative animate-scale-in">
            <Icon size={96} strokeWidth={1.2} className="mx-auto mb-6 drop-shadow-[0_0_20px_currentColor]" style={{ color }} />
            <h2 className="font-display text-5xl md:text-6xl tracking-wider mb-3 animate-pulse" style={{ color }}>
              {localizeNode(title)}
            </h2>
            <p className="typewriter text-sm uppercase tracking-[0.3em] text-white/70">
              {localizeNode(subtitle)}
            </p>
            <button
              onClick={onClose}
              className="mt-8 px-6 py-2 border-2 border-white/40 typewriter text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
            >{localizeText(" Continuer ")}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
