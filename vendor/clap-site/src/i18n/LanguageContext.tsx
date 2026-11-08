import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { translations, Lang, Dict } from "./translations";
import { getLanguage, saveLanguage } from './localize';
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: keyof Dict) => string };
const LanguageContext = createContext<Ctx | undefined>(undefined);
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const parent = useContext(LanguageContext);
  const [lang, setLangState] = useState<Lang>(getLanguage);
  const setLang = (l: Lang) => {
    saveLanguage(l);
    setLangState(l);
  };
  useEffect(() => { if (!parent) document.documentElement.lang = lang; }, [lang, parent]);
  const t = (key: keyof Dict) => translations[lang][key] ?? translations.fr[key] ?? String(key);
  if (parent) return <>{children}</>;
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
};
export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
