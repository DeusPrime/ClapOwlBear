import AppUpdateNotice from "./components/AppUpdateNotice";
import { localizeNode } from '@/i18n/localize';
import { useLang } from "./i18n/LanguageContext";
import { useState } from "react";
import GlobalExportLoader from "./components/GlobalExportLoader";
import RoomRewardNotification from "./components/RoomRewardNotification";
import { AuthProvider } from "./lib/community";
import Account from "./pages/Account";
import Legal from "./pages/Legal";
import PublicProfile from "./pages/PublicProfile";
import Admin from "./pages/Admin";
import CreatePublication from "./pages/CreatePublication";
import FilmDetail from "./pages/FilmDetail";
import FilmsList from "./pages/FilmsList";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NewsList from "./pages/NewsList.tsx";
import NewsArticle from "./pages/NewsArticle.tsx";
import Credits from "./pages/Credits.tsx";
import Contact from "./pages/Contact.tsx";
import CharactersList from "./pages/CharactersList.tsx";
import CharacterEditor from "./pages/CharacterEditor.tsx";
import KeyRolesList from "./pages/KeyRolesList.tsx";
import KeyRoleEditor from "./pages/KeyRoleEditor.tsx";
import FigurantsList from "./pages/FigurantsList.tsx";
import FigurantEditor from "./pages/FigurantEditor.tsx";
import ProfilesList from "./pages/ProfilesList.tsx";
import ProfileEditor from "./pages/ProfileEditor.tsx";
import PowersList from "./pages/PowersList.tsx";
import PowerEditor from "./pages/PowerEditor.tsx";
import VehiclesList from "./pages/VehiclesList.tsx";
import VehicleEditor from "./pages/VehicleEditor.tsx";
import ResourcesList from "./pages/ResourcesList.tsx";
import ResourceDetail from "./pages/ResourceDetail.tsx";
import NotFound from "./pages/NotFound.tsx";
import ComingSoon from "./pages/ComingSoon.tsx";
import ScrollToTop from "./components/ScrollToTop";
import PageTitle from "./components/PageTitle";
import Room from "./pages/Room";
import RoomConnection from "./components/RoomConnection";
import ImageConverter from "./pages/ImageConverter";
import Tools from "./pages/Tools";
import FilmBookEditor from "./pages/FilmBookEditor";
import SingleImageConverter from "./pages/SingleImageConverter";
import BookBackgroundGenerator from "./pages/BookBackgroundGenerator";
import Dashboard from "./pages/Dashboard";
import { PwaInstallProvider } from "./components/PwaInstallPrompt";

const queryClient = new QueryClient();

const App = () => {
  useLang();
  const [unlocked, setUnlocked] = useState(
    () =>
      typeof window !== "undefined" &&
      (sessionStorage.getItem("clap-unlocked") === "1" || localStorage.getItem("clap-unlocked") === "1")
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <GlobalExportLoader />
        <AppUpdateNotice />
        {localizeNode(!unlocked ? (
          <ComingSoon onUnlock={() => setUnlocked(true)} />
        ) : (
          <BrowserRouter>
            <AuthProvider><PwaInstallProvider>
            <PageTitle />
            <ScrollToTop />
            <RoomConnection />
            <RoomRewardNotification />
            <Routes>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/app/studio" element={<Dashboard />} />
              <Route path="/salle" element={<Room />} />
              <Route path="/app/salle" element={<Room appView />} />
              <Route path="/" element={<Index />} />
              <Route path="/compte" element={<Account />} />
              <Route path="/app/compte" element={<Account appView />} />
              <Route path="/cgu" element={<Legal kind="cgu" />} />
              <Route path="/confidentialite" element={<Legal kind="confidentialite" />} />
              <Route path="/mentions-legales" element={<Legal kind="mentions-legales" />} />
              <Route path="/app/cgu" element={<Legal kind="cgu" appView />} />
              <Route path="/app/confidentialite" element={<Legal kind="confidentialite" appView />} />
              <Route path="/app/mentions-legales" element={<Legal kind="mentions-legales" appView />} />
              <Route path="/membres/:id" element={<PublicProfile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/films/new" element={<CreatePublication key="films" kind="films" />} />
              <Route path="/admin/news/new" element={<CreatePublication key="news" kind="news" />} />
              <Route path="/admin/films/:identifier/edit" element={<CreatePublication key="films-edit" kind="films" editing />} />
              <Route path="/admin/news/:identifier/edit" element={<CreatePublication key="news-edit" kind="news" editing />} />
              <Route path="/films" element={<FilmsList />} />
              <Route path="/app/films" element={<FilmsList appView />} />
              <Route path="/app/films/:code" element={<FilmDetail appView />} />
              <Route path="/app/news" element={<NewsList appView />} />
              <Route path="/app/news/:slug" element={<NewsArticle appView />} />
              <Route path="/films/:code" element={<FilmDetail />} />
              <Route path="/news" element={<NewsList />} />
              <Route path="/news/:slug" element={<NewsArticle />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/characters" element={<CharactersList />} />
              <Route path="/characters/:id" element={<CharacterEditor />} />
              <Route path="/ressources" element={<ResourcesList />} />
              <Route path="/outils/cartes-poker" element={<ImageConverter />} />
              <Route path="/outils" element={<Tools />} />
              <Route path="/film" element={<FilmBookEditor />} />
              <Route path="/outils/film" element={<Navigate to="/film" replace />} />
              <Route path="/outils/conversion-image" element={<SingleImageConverter />} />
              <Route path="/outils/fonds-livre" element={<BookBackgroundGenerator />} />
              <Route path="/key-roles" element={<KeyRolesList />} />
              <Route path="/key-roles/new" element={<KeyRoleEditor />} />
              <Route path="/key-roles/:id/edit" element={<KeyRoleEditor />} />
              <Route path="/key-roles/:id" element={<ResourceDetail kind="key-role" />} />
              <Route path="/figurants" element={<FigurantsList />} />
              <Route path="/figurants/new" element={<FigurantEditor />} />
              <Route path="/figurants/:id/edit" element={<FigurantEditor />} />
              <Route path="/figurants/:id" element={<ResourceDetail kind="figurant" />} />
              <Route path="/profils" element={<ProfilesList />} />
              <Route path="/profils/new" element={<ProfileEditor />} />
              <Route path="/profils/:id/edit" element={<ProfileEditor />} />
              <Route path="/profils/:id" element={<ResourceDetail kind="profile" />} />
              <Route path="/pouvoirs" element={<PowersList />} />
              <Route path="/pouvoirs/new" element={<PowerEditor />} />
              <Route path="/pouvoirs/:id/edit" element={<PowerEditor />} />
              <Route path="/pouvoirs/:id" element={<ResourceDetail kind="power" />} />
              <Route path="/vehicules" element={<VehiclesList />} />
              <Route path="/vehicules/new" element={<VehicleEditor />} />
              <Route path="/vehicules/:id/edit" element={<VehicleEditor />} />
              <Route path="/vehicules/:id" element={<ResourceDetail kind="vehicle" />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </PwaInstallProvider></AuthProvider>
          </BrowserRouter>
        ))}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
