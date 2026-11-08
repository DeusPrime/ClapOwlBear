import { localizeText } from '@/i18n/localize';
import directorEn from "@/assets/book-cover-en.png";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/i18n/LanguageContext";
import director from "@/assets/book-cover.png";
import { Play, AppWindow } from "lucide-react";
import { Link } from "react-router-dom";

const Hero = () => {
  const { t, lang } = useLang();
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = imgWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // -1 (sortie par le haut) à 1 (entrée par le bas)
      const center = rect.top + rect.height / 2;
      const rel = (center - vh / 2) / vh;
      setOffset(Math.max(-1, Math.min(1, rel)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id="home" className="relative pt-28 md:pt-32 pb-16 md:pb-24 overflow-hidden">
      {/* splatters */}
      <div className="splat splat-in" style={{ top: '15%', left: '5%', width: 14, height: 14 }} />
      <div className="splat splat-in" style={{ top: '30%', left: '12%', width: 6, height: 6 }} />
      <div className="splat splat-in" style={{ bottom: '20%', right: '8%', width: 22, height: 22 }} />
      <div className="splat splat-in" style={{ top: '50%', right: '4%', width: 8, height: 8 }} />

      <div className="container grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="ribbon text-sm">{t("hero_badge")}</span>
            <span className="typewriter text-sm uppercase tracking-widest text-muted-foreground">
              — {t("hero_tagline")}
            </span>
          </div>

          <h1 className="font-display leading-[0.85] text-balance break-words">
            <span className="block text-6xl sm:text-7xl md:text-8xl lg:text-9xl">{t("hero_title_1")}</span>
            <span className="block text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-accent splat-in" style={{ animationDelay: '.15s' }}>
              {t("hero_title_2")}
            </span>
            <span className="block text-6xl sm:text-7xl md:text-8xl lg:text-9xl">{t("hero_title_3")}</span>
          </h1>

          <p className="mt-8 text-lg md:text-xl max-w-xl typewriter text-foreground/80 leading-relaxed">
            {t("hero_subtitle")}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#universe" className="btn-clap">
              <Play size={16} /> {t("hero_cta_primary")}
            </a>
            <Link to="/app/studio" className="btn-ghost-clap">
              <AppWindow size={16} /> {t("hero_cta_application")}
            </Link>
          </div>
        </div>

        <div ref={imgWrapRef} className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-0 bg-accent/10 -rotate-3 rounded" aria-hidden />
          <img
            src={lang === "en" ? directorEn : director}
            alt={localizeText("Clap & Role — couverture du livre de base")}
            className="relative w-full h-auto block will-change-transform rounded"
            style={{
              transform: `translate3d(${offset * 20}px, 0, 0) rotate(${offset * 2}deg)`,
              boxShadow: '12px 16px 40px hsl(var(--ink) / 0.45), 4px 6px 12px hsl(var(--ink) / 0.35)',
              transition: 'transform 0.1s linear',
            }}
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;
