import { initializeDirectoryAssets } from "./lib/directoryAssets";
import { LanguageProvider } from "./i18n/LanguageContext";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/interface.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";

const savedTheme = localStorage.getItem("clap-theme");
if (savedTheme) document.documentElement.classList.toggle("dark", savedTheme === "dark");

void initializeDirectoryAssets().then(() => {
  createRoot(document.getElementById("root")!).render(<LanguageProvider><App /></LanguageProvider>);
}).catch(error => {
  document.getElementById("root")!.textContent = "Impossible d’ouvrir le stockage des projets. Recharge la page. " + (error instanceof Error ? error.message : "");
});
registerServiceWorker();
