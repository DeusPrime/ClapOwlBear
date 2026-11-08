export type NewsItem = {
  slug: string;
  date: string;
  category_fr: string;
  category_en: string;
  title_fr: string;
  title_en: string;
  excerpt_fr: string;
  excerpt_en: string;
  body_fr: string;
  body_en: string;
  cover?: string;
  pages?: string[];
};

export const formatNewsDate = (iso: string, lang: "fr" | "en") => {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
