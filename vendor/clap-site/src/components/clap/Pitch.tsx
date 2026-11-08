import { localizeNode } from '@/i18n/localize';
import page1En from "@/assets/book-page-1-en.png";
import page2En from "@/assets/book-page-2-en.png";
import page3En from "@/assets/book-page-3-en.png";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useRef, useState } from "react";
import page1 from "@/assets/book-page-1.png";
import page2 from "@/assets/book-page-2.png";
import page3 from "@/assets/book-page-3.png";
import { Zap, MessageCircle, Puzzle } from "lucide-react";

const Pitch = () => {
  const { t, lang } = useLang();
  const features = [
    { icon: Zap, title: t("feat_1_title"), body: t("feat_1_body") },
    { icon: MessageCircle, title: t("feat_2_title"), body: t("feat_2_body") },
    { icon: Puzzle, title: t("feat_3_title"), body: t("feat_3_body") },
  ];

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [topIdx, setTopIdx] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const passed = vh - rect.top;
      const prog = Math.max(0, Math.min(1, passed / total));
      setP(prog);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Scattered pages — each shifts/rotates slightly with scroll
  const pages = [
    { src: lang === "en" ? page1En : page1, baseRot: -8, baseX: -18, baseY: -6, dRot: 6, dX: -10, dY: -8, z: 1 },
    { src: lang === "en" ? page2En : page2, baseRot: 5, baseX: 14, baseY: 4, dRot: -7, dX: 12, dY: -6, z: 3 },
    { src: lang === "en" ? page3En : page3, baseRot: -2, baseX: -2, baseY: 12, dRot: 4, dX: 4, dY: 10, z: 2 },
  ];

  return (
    <section id="universe" ref={sectionRef} className="relative py-20 md:py-28 border-t border-ink">
      <div className="container">
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-12 items-center">
          <div
            ref={stageRef}
            className="relative h-[420px] md:h-[520px] flex items-center justify-center order-2 lg:order-1"
          >
            {/* table shadow */}
            <div
              className="absolute inset-x-8 bottom-6 h-6 rounded-full blur-2xl"
              style={{ background: "hsl(var(--ink) / 0.35)" }}
              aria-hidden
            />
            {pages.map((pg, i) => {
              const rot = pg.baseRot + pg.dRot * p;
              const tx = pg.baseX + pg.dX * p;
              const ty = pg.baseY + pg.dY * p;
              return (
                <img
                  key={i}
                  src={pg.src}
                  alt=""
                  loading="lazy"
                  onClick={() => setTopIdx(i)}
                  className="absolute w-[62%] max-w-[280px] h-auto cursor-pointer rounded"
                  style={{
                    transform: `translate(${tx}%, ${ty}%) rotate(${rot}deg)`,
                    zIndex: topIdx === i ? 10 : pg.z,
                    boxShadow:
                      "8px 12px 28px hsl(var(--ink) / 0.35), 2px 4px 8px hsl(var(--ink) / 0.25)",
                    transition: "transform 0.25s ease-out",
                  }}
                />
              );
            })}
          </div>
          <div className="order-1 lg:order-2">
            <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">
              // {t("pitch_kicker")}
            </p>
            <h2 className="font-display text-4xl sm:text-5xl md:text-7xl break-words mb-6 text-balance">{t("pitch_title")}</h2>
            <p className="typewriter text-lg leading-relaxed text-foreground/80 max-w-2xl">
              {t("pitch_body")}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16 md:mt-24">
          {features.map((f, i) => (
            <article key={i} className="paper-card p-6 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 shrink-0 bg-ink text-background flex items-center justify-center">
                  <f.icon size={22} />
                </div>
                <h3 className="font-display text-2xl">{localizeNode(f.title)}</h3>
              </div>
              <p className="typewriter text-sm leading-relaxed text-foreground/75">{localizeNode(f.body)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pitch;
