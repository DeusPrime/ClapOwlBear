import { localizeText, localizeNode } from '@/i18n/localize';
import { useLang } from "@/i18n/LanguageContext";
import Logo from "./Logo";
import { Link } from "react-router-dom";

const Footer = () => {
  const { t, lang } = useLang();
  return (
    <footer className="bg-paper border-t-2 border-ink pt-14 pb-8">
      <div className="container grid sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Logo className="w-14 h-14 text-foreground" />
            <span className="font-display text-3xl tracking-wider">{localizeText("Clap & Role")}</span>
          </div>
          <p className="typewriter text-sm text-foreground/75 max-w-xs">{t("footer_about")}</p>
        </div>
        <div>
          <h4 className="font-display text-lg mb-3">{t("footer_links")}</h4>
          <ul className="space-y-2 typewriter text-sm">
            <li><Link to="/#home" className="hover:text-accent">{t("nav_home")}</Link></li>
            <li><Link to="/#universe" className="hover:text-accent">{t("nav_universe")}</Link></li>
            <li><Link to="/#rules" className="hover:text-accent">{t("nav_rules")}</Link></li>
            <li><Link to="/#resources" className="hover:text-accent">{t("nav_resources")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg mb-3">{localizeNode(lang === "fr" ? "Qui sommes-nous ?" : "About us")}</h4>
          <ul className="space-y-2 typewriter text-sm">
            <li><Link to="/credits" className="hover:text-accent">{t("footer_credits")}</Link></li>
            <li><Link to="/contact" className="hover:text-accent">{t("footer_contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg mb-3">{t("footer_legal")}</h4>
          <ul className="space-y-2 typewriter text-sm">
            <li><Link to="/cgu" className="hover:text-accent">{localizeText("Conditions d’utilisation")}</Link></li>
            <li><Link to="/confidentialite" className="hover:text-accent">{localizeText("Confidentialité")}</Link></li>
            <li><Link to="/mentions-legales" className="hover:text-accent">{localizeText("Mentions légales")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="container border-t border-ink/30 pt-6 flex flex-wrap justify-between items-center gap-4">
        <p className="typewriter text-xs text-foreground/60">
          © {localizeNode(new Date().getFullYear())}{localizeText(" Clap & Role — ")}{t("footer_rights")}
        </p>
        <p className="typewriter text-xs text-foreground/60">{localizeText(" // SCENE.FIN ")}</p>
      </div>
    </footer>
  );
};

export default Footer;
