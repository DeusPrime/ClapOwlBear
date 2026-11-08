import { localizeText } from '@/i18n/localize';
import { useLang } from "@/i18n/LanguageContext";
import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/app": "Mon studio",
  "/studio": "Mon studio",
  "/cgu": "Conditions générales d’utilisation",
  "/confidentialite": "Politique de confidentialité",
  "/mentions-legales": "Mentions légales",
  "/films": "Films à l’affiche",
  "/compte": "Mon compte",
  "/admin/films/new": "Ajouter un film",
  "/admin/news/new": "Ajouter une actualité",
  "/": "Jeu de rôle cinématographique",
  "/news": "Actualités",
  "/credits": "Crédits",
  "/contact": "Contact",
  "/characters": "Héros",
  "/ressources": "Cartes",
  "/salle": "Salle",
  "/outils": "Ressources",
  "/outils/cartes-poker": "Planches d’images A4",
  "/outils/conversion-image": "Conversion d’image",
  "/outils/fonds-livre": "Fonds de livre",
  "/key-roles": "Rôles clés",
  "/figurants": "Figurants",
  "/profils": "Profils",
  "/pouvoirs": "Pouvoirs",
  "/vehicules": "Véhicules",
};

const resourceTitles: Record<string, string> = {
  "key-roles": "Rôle clé",
  figurants: "Figurant",
  profils: "Profil",
  pouvoirs: "Pouvoir",
  vehicules: "Véhicule",
};

export default function PageTitle() {
  const { pathname } = useLocation();
  const { lang } = useLang();

  // Reset before page effects supply a loaded resource or translated title.
  useLayoutEffect(() => {
    const path = pathname.replace(/^\/app(?=\/)/, "").replace(/\/+$/, "") || "/";
    const [, section, id, action] = path.split("/");
    let title = titles[path];
    if (!title && /^\/admin\/(films|news)\/[^/]+\/edit$/.test(path)) title = id === "films" ? "Modifier le film" : "Modifier l’actualité";
    if (!title && resourceTitles[section] && id) {
      const resource = resourceTitles[section];
      title = id === "new" ? `Créer : ${resource}` : action === "edit" ? `Modifier : ${resource}` : resource;
    }
    if (!title && section === "characters" && id) title = id === "new" ? "Créer un héros" : "Héros";
    if (!title && section === "news" && id) title = "Actualité";
    if (!title && section === "films" && id) title = "Film";
    if (!title && section === "membres" && id) title = "Profil public";
    document.title = `${localizeText(title || "Page introuvable")} — Clap & Role`;
  }, [pathname, lang]);

  return null;
}
