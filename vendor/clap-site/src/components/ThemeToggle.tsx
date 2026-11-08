import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const ThemeToggle = ({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) => {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const saved = localStorage.getItem("clap-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else if (saved === "light") {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("clap-theme", next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={localizeText(dark ? "Activer le thème clair" : "Activer le thème sombre")}
      className={`p-2 hover:text-accent transition-colors ${className}`}
    >
      {localizeNode(dark ? <Sun size={18} /> : <Moon size={18} />)}
      {localizeNode(showLabel && <span>{localizeNode(dark ? "Passer au thème clair" : "Passer au thème sombre")}</span>)}
    </button>
  );
};

export default ThemeToggle;
