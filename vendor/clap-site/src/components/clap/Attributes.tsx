import { localizeText, localizeNode } from '@/i18n/localize';
import { useLang } from "@/i18n/LanguageContext";

// Réactiver lorsque les vidéos pédagogiques seront prêtes.
const SHOW_VIDEOS = false;

const Attributes = () => {
  const { t } = useLang();
  const facets = [
    { title: t("facet_corps"), body: t("facet_corps_desc") },
    { title: t("facet_esprit"), body: t("facet_esprit_desc") },
    { title: t("facet_ame"), body: t("facet_ame_desc") },
  ];
  const steps = [
    { title: t("rules_step_1_title"), body: t("rules_step_1_body") },
    { title: t("rules_step_2_title"), body: t("rules_step_2_body") },
    { title: t("rules_step_3_title"), body: t("rules_step_3_body") },
  ];
  const narrativeTools = [
    { title: t("rules_destiny_title"), paragraphs: [t("rules_destiny_body")] },
    { title: t("rules_prowess_complication_title"), paragraphs: [t("rules_prowess_complication_body")] },
    { title: t("rules_sequelae_title"), paragraphs: [t("rules_sequelae_body")] },
  ];

  return (
    <section id="rules" className="relative py-20 md:py-28 bg-paper-dark/40 border-y border-ink">
      <div className="container">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">
            // {t("attr_kicker")}
          </p>
          <h2 className="font-display text-4xl sm:text-5xl md:text-7xl break-words mb-6">{t("attr_title")}</h2>
        </div>

        <section aria-labelledby="rules-hero-title" className="mb-16">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <h3 id="rules-hero-title" className="font-display text-3xl sm:text-4xl mb-4">{t("rules_hero_title")}</h3>
            <p className="typewriter text-base leading-relaxed text-foreground/80">{t("attr_intro")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {facets.map((facet) => (
              <article key={facet.title} className="paper-card p-6">
                <h4 className="font-display text-2xl text-accent mb-3">{localizeNode(facet.title)}</h4>
                <p className="typewriter text-sm leading-relaxed text-foreground/80">{localizeNode(facet.body)}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="rules-action-title">
          <h3 id="rules-action-title" className="font-display text-3xl sm:text-4xl text-center mb-8">{t("rules_action_title")}</h3>
          <ol className="grid md:grid-cols-3 gap-6 mb-8">
          {steps.map((step) => (
            <li key={step.title} className="paper-card p-6">
              <h4 className="font-display text-2xl text-accent mb-3">{localizeNode(step.title)}</h4>
              <p className="typewriter text-sm leading-relaxed text-foreground/80">{localizeNode(step.body)}</p>
            </li>
          ))}
        </ol>
        </section>

        <section aria-labelledby="rules-narrative-title" className="mt-16">
          <h3 id="rules-narrative-title" className="font-display text-3xl sm:text-4xl text-center mb-8">{t("rules_narrative_title")}</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {narrativeTools.map((tool) => (
              <article key={tool.title} className="paper-card p-6">
                <h4 className="font-display text-2xl text-accent mb-3">{localizeNode(tool.title)}</h4>
                <div className="space-y-3">
                  {tool.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="typewriter text-sm leading-relaxed text-foreground/80">{localizeNode(paragraph)}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Vidéos pédagogiques */}
        {SHOW_VIDEOS && (
        <div className="mt-4">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">
              // {t("videos_kicker")}
            </p>
            <h3 className="font-display text-4xl md:text-5xl mb-4">{t("videos_title")}</h3>
            <p className="typewriter text-base text-foreground/80">{t("videos_intro")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { id: "dQw4w9WgXcQ", title: t("video_1_title") },
              { id: "5qap5aO4i9A", title: t("video_2_title") },
              { id: "jfKfPfyJRdk", title: t("video_3_title") },
            ].map((v, i) => (
              <article
                key={v.id}
                className="paper-card overflow-hidden"
                style={{ transform: `rotate(${i % 2 === 0 ? "-0.4deg" : "0.4deg"})` }}
              >
                <div className="relative aspect-video bg-ink">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                    title={localizeText(v.title)}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <h4 className="font-display text-xl tracking-wider">
                    {localizeNode(String(i + 1).padStart(2, "0"))}. {localizeNode(v.title)}
                  </h4>
                  <span className="typewriter text-[10px] uppercase tracking-widest text-accent">{localizeText("●REC")}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
        )}
      </div>
    </section>
  );
};

export default Attributes;
