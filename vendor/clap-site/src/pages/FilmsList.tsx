import { localizeText, localizeNode } from '@/i18n/localize';
import AppHeader from "@/components/AppHeader";

import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import Filmography from "@/components/clap/Filmography";

const FilmsListInner = ({ appMode }: { appMode: boolean }) => {
  const { t } = useLang();

  return (
    <div className="relative min-h-screen">
      {appMode ? <AppHeader title={localizeText(t("films_title"))} /> : <Header />}
      <main className={appMode ? "pt-24 sm:pt-6 md:pt-10 pb-20" : "pt-28 md:pt-36 pb-20"}>
        {!appMode && <div className="container">
          <Link to="/" className="inline-flex items-center gap-2 typewriter text-xs uppercase tracking-widest mb-8 hover:text-accent transition-colors">
            <ArrowLeft size={14} /> {t("back_home")}
          </Link>
        </div>}
        <Filmography showAllLink={false} appView={appMode} />
      </main>
      {localizeNode(!appMode && <Footer />)}
    </div>
  );
};

const FilmsList = ({ appView = false }: { appView?: boolean }) => (
  <LanguageProvider>
    <FilmsListInner appMode={appView} />
  </LanguageProvider>
);

export default FilmsList;
