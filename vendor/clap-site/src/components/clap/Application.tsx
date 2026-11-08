import PlayingCardsIcon from "@/components/PlayingCardsIcon";
import { localizeNode } from '@/i18n/localize';
import { Link } from "react-router-dom";
import { AppWindow, ArrowRight, UserCircle, Wrench } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export default function Application() {
  const { t } = useLang();
  const features = [
    { Icon: UserCircle, title: t("app_sheets_title"), description: t("app_sheets_desc"), href: "/characters" },
    { Icon: PlayingCardsIcon, title: t("app_resources_title"), description: t("app_resources_desc"), href: "/ressources" },
    { Icon: Wrench, title: t("app_tools_title"), description: t("app_tools_desc"), href: "/outils" },
  ];
  return <section id="application" className="relative py-20 md:py-28 border-t border-ink bg-paper-dark/30 scroll-mt-20">
    <div className="container grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div>
        <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">// {t("app_kicker")}</p>
        <h2 className="font-display text-4xl sm:text-5xl md:text-7xl break-words mb-6">{t("app_title")}</h2>
        <p className="typewriter text-lg leading-relaxed text-foreground/80 mb-8">{t("app_intro")}</p>
        <Link to="/app/studio" className="btn-clap"><AppWindow size={18} aria-hidden="true" />{t("app_cta")}<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      <div className="paper-card p-6 sm:p-8 divide-y divide-ink/20">
        {features.map(({ Icon, title, description, href }) => <Link key={href} to={href} className="group flex items-start gap-4 py-6 first:pt-0 last:pb-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4">
          <div className="shrink-0 w-12 h-12 bg-ink text-background flex items-center justify-center"><Icon size={24} aria-hidden="true" /></div>
          <div className="min-w-0 flex-1"><h3 className="font-display text-2xl mb-2 group-hover:text-accent transition-colors">{localizeNode(title)}</h3><p className="typewriter text-sm text-foreground/75 leading-relaxed">{description}</p></div><ArrowRight size={18} className="shrink-0 mt-1 text-accent group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </Link>)}
      </div>
    </div>
  </section>;
}
