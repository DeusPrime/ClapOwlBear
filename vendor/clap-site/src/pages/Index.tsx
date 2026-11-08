import { useEffect, useState } from "react";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import Header from "@/components/clap/Header";
import Hero from "@/components/clap/Hero";
import FilmStrip from "@/components/clap/FilmStrip";
import Marquee from "@/components/clap/Marquee";
import Pitch from "@/components/clap/Pitch";
import Attributes from "@/components/clap/Attributes";
import Filmography from "@/components/clap/Filmography";
import News from "@/components/clap/News";
import Resources from "@/components/clap/Resources";
import Application from "@/components/clap/Application";
import CTA from "@/components/clap/CTA";
import Footer from "@/components/clap/Footer";
import ComingSoon from "./ComingSoon";

const SEO = () => {
  const { lang } = useLang();
  useEffect(() => {
    const title =
      lang === "fr"
        ? "Clap & Role — Jeu de rôle cinématographique"
        : "Clap & Role — Cinematic tabletop RPG";
    const desc =
      lang === "fr"
        ? "Clap & Role est un jeu de rôle papier où tes héros tournent leur propre film. Règles, ressources et univers à découvrir."
        : "Clap & Role is a tabletop RPG where your heroes shoot their own movie. Rules, resources and universe to explore.";
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.origin + "/");
  }, [lang]);
  return null;
};

const Page = () => (
  <div className="relative min-h-screen">
    <SEO />
    <Header />
    <main>
      <Hero />
      <FilmStrip />
      <Marquee />
      <FilmStrip />
      <Pitch />
      <Attributes />
      <Application />
      <Filmography />
      <News />
      <Resources />
      <CTA />
    </main>
    <Footer />
  </div>
);

const Index = () => {
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && (sessionStorage.getItem("clap-unlocked") === "1" || localStorage.getItem("clap-unlocked") === "1")
  );
  if (!unlocked) return <ComingSoon onUnlock={() => setUnlocked(true)} />;
  return (
    <LanguageProvider>
      <Page />
    </LanguageProvider>
  );
};

export default Index;
