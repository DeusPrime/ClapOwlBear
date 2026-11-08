import { localizeText, localizeNode } from '@/i18n/localize';
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { useAppMode } from "@/hooks/use-app-mode";
import AccountAvatar from "@/components/AccountAvatar";
import { useLang } from "@/i18n/LanguageContext";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { useAccount } from "@/lib/community";

const sections = [
  { id: "universe", key: "nav_universe" as const },
  { id: "rules", key: "nav_rules" as const },
  { id: "application", key: "nav_application" as const },
  { id: "filmography", key: "nav_films" as const },
  { id: "news", key: "nav_news" as const },
  { id: "resources", key: "nav_resources" as const },
];

const Header = () => {
  const { t, lang, setLang } = useLang();
  const { user } = useAccount();
  const { pathname } = useLocation();
  const appMode = useAppMode();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all ${
        scrolled ? "bg-paper/95 backdrop-blur border-b border-ink" : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-20">
        <Link to="/#home" className="flex items-center gap-3 group" aria-label={localizeText(lang === "fr" ? "Clap & Role — Retour à l’accueil" : "Clap & Role — Back to home")} onClick={() => {
          setOpen(false);
          document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
        }}>
          <Logo className="w-10 h-10 md:w-12 md:h-12 text-foreground group-hover:rotate-[-4deg] transition-transform" />
          <span className="font-display text-2xl md:text-3xl tracking-wider hidden sm:inline">{localizeText("Clap & Role")}</span>
        </Link>

        <nav className="hidden xl:flex items-center gap-5 2xl:gap-8">
          {sections.map((s) => (
            <Link
              key={s.id}
              to={`/#${s.id}`}
              className="text-sm uppercase tracking-widest font-bold hover:text-accent transition-colors relative after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-accent hover:after:w-full after:transition-all"
            >
              {t(s.key)}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center gap-2">
          <Link to={appMode ? "/app/compte" : "/compte"} className={`flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-widest border-2 border-ink px-2 py-2 hover:bg-ink hover:text-background ${user ? "max-w-40 sm:max-w-56 xl:max-w-48" : "max-w-28"}`} title={localizeText(user?.username)} aria-label={localizeText(lang === "fr" ? "Mon compte" : "My account")}>
            {user && <AccountAvatar username={user.username} avatar={user.avatar} className="h-5 w-5 shrink-0" />}
            <span className="min-w-0 truncate">{user ? user.username : lang === "fr" ? "Connexion" : "Sign in"}</span>
          </Link>
          <div className="flex border-2 border-ink" role="group" aria-label={lang === "fr" ? "Langue" : "Language"}>
            {(["fr", "en"] as const).map(language => <button key={language} type="button" onClick={() => setLang(language)} aria-pressed={lang === language} aria-label={language === "fr" ? "Français" : "English"} className={`px-2 py-2 text-xs font-bold ${lang === language ? "bg-ink text-background" : "hover:bg-ink/10"}`}>{language.toUpperCase()}</button>)}
          </div>
          {pathname === "/" && !appMode && <ThemeToggle />}
          <button
            className="xl:hidden p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label={localizeText("Menu")}
          >
            {localizeNode(open ? <X size={20} /> : <Menu size={20} />)}
          </button>
        </div>
      </div>

      {open && (
        <div className="xl:hidden bg-paper border-t border-ink">
          <nav className="container py-4 flex flex-col gap-3">
            {sections.map((s) => (
              <Link
                key={s.id}
                to={s.id === "news" ? "/news" : s.id === "filmography" ? "/films" : `/#${s.id}`}
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-widest font-bold py-2 border-b border-ink/20"
              >
                {s.id === "filmography" ? (lang === "fr" ? "Films à l’affiche" : "Now showing") : t(s.key)}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
