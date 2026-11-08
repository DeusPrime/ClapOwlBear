import { localizeText, localizeNode } from '@/i18n/localize';
import AppHeader from "@/components/AppHeader";
import LegalAcceptance from "@/components/LegalAcceptance";
import TurnstileChallenge from "@/components/TurnstileChallenge";
import { legalAcceptance } from "@/lib/legal";
import { useAppMode } from "@/hooks/use-app-mode";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AccountAvatar from "@/components/AccountAvatar";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { COMMUNITY_API, communityRequest, useAccount, type AuthConfig } from "@/lib/community";

function ProviderIcon({ provider }: { provider: "google" | "discord" }) {
  return provider === "google" ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 13.91a6 6 0 0 1 0-3.82V7.5H3.05a10 10 0 0 0 0 9l3.35-2.59Z" />
    <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.35 2.59C7.19 7.72 9.4 5.96 12 5.96Z" />
  </svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.095.252-.194.372-.293a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.293a.077.077 0 0 1-.006.128c-.598.35-1.22.648-1.873.892a.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .031-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.419 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.419 0 1.334-.946 2.419-2.157 2.419Z" />
  </svg>;
}

function AccountInner({ appView }: { appView: boolean }) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const fr = lang === "fr";
  const { user, loading, error: accountError, refresh } = useAccount();
  const [params, setParams] = useSearchParams();
  const [reset, setReset] = useState(() => params.get("reset"));
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const [loginChallenge, setLoginChallenge] = useState(false);
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [unlinkProvider, setUnlinkProvider] = useState<"google" | "discord" | null>(null);
  const [unlinkPassword, setUnlinkPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const config = useQuery({ queryKey: ["auth-config"], queryFn: () => communityRequest<AuthConfig>("/auth/config") });
  const registrationOpen = config.data?.legal?.registrationOpen ?? config.data?.legal?.ready;
  const needsLoginCaptcha = loginChallenge || config.data?.captcha?.loginRequired === true;
  const captchaAction = mode === "register" ? "register" : "login";
  const showCaptcha = !user && !reset && (mode === "register" || (mode === "login" && needsLoginCaptcha));
  const resetCaptcha = () => { setCaptchaToken(""); setCaptchaRevision(value => value + 1); };
  useEffect(() => { setCaptchaToken(""); }, [mode, acceptedLegal]);
  useEffect(() => { setAcceptedLegal(false); }, [user?.id]);
  useEffect(() => { if (["legal", "captcha"].includes(params.get("error") || "")) setMode("register"); }, [params]);
  const oauthQuery = new URLSearchParams();
  if (appView) oauthQuery.set("app", "1");
  if (user) oauthQuery.set("link", "1");
  else if (acceptedLegal && registrationOpen && config.data?.legal) {
    oauthQuery.set("acceptedTerms", "1"); oauthQuery.set("acknowledgedPrivacy", "1");
    oauthQuery.set("termsVersion", config.data.legal.termsVersion); oauthQuery.set("privacyVersion", config.data.legal.privacyVersion);
  }
  const oauthSuffix = oauthQuery.toString() ? `?${oauthQuery}` : "";
  const oauthHref = (provider: string) => `${COMMUNITY_API}/auth/${provider}/start${oauthSuffix}`;
  const startOAuth = (provider: string) => void run(async () => {
    try {
      await communityRequest("/auth/verification", { captchaToken, ...legalAcceptance(acceptedLegal, config.data?.legal) });
      window.location.assign(oauthHref(provider));
    } finally { resetCaptcha(); }
  });
  useEffect(() => { if (user) { setUsername(user.username); setDescription(user.description ?? ""); } }, [user]);
  useEffect(() => {
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setUnlinkPassword(""); setUnlinkProvider(null); setRemovePassword(false); setPasswordEmail("");
  }, [user?.id]);
  useEffect(() => {
    if (reset) {
      if (params.has("reset")) {
        const next = new URLSearchParams(params); next.delete("reset");
        setParams(next, { replace: true });
      }
    }
  }, [reset, params, setParams]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur du service.");
      if (e && typeof e === "object" && "captchaRequired" in e && e.captchaRequired === true) {
        setLoginChallenge(true);
        void config.refetch();
      }
    }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (reset) {
        await communityRequest("/auth/reset", { token: reset, password }); setReset(null); setParams({}, { replace: true });
        setPassword(""); setMode("login"); await refresh();
        setNotice(fr ? "Mot de passe modifié. Tu peux te connecter." : "Password updated. You can sign in.");
      } else if (user) {
        await communityRequest("/auth/profile", { username, description }); await refresh();
        await client.invalidateQueries({ queryKey: ["public-profile"] });
        await client.invalidateQueries({ queryKey: ["film-activity"] });
        await client.invalidateQueries({ queryKey: ["admin-users"] });
        setNotice(fr ? "Profil enregistré." : "Profile saved.");
      } else if (mode === "forgot") {
        await communityRequest("/auth/forgot", { email, ...(appView ? { app: true } : {}) });
        setNotice(fr ? "Si un compte correspond à cet email, un lien de récupération sera envoyé. Vérifie aussi les indésirables." : "If an account matches this email, a recovery link will be sent. Check your spam folder too.");
      } else {
        if (mode === "register" && (!acceptedLegal || !registrationOpen)) throw new Error("Acceptez les textes légaux actuels. Les inscriptions restent indisponibles tant que les informations légales sont incomplètes.");
        try {
          await communityRequest(`/auth/${mode}`, mode === "login" ? { login, password, captchaToken } : { username, email, password, captchaToken, ...legalAcceptance(acceptedLegal, config.data?.legal) });
        } finally { resetCaptcha(); }
        setLoginChallenge(false);
        await config.refetch();
        setPassword(""); setParams({}, { replace: true }); await refresh();
        navigate("/app/studio", { replace: true });
      }
    });
  };
  const oauthError = params.get("error");
  const uploadAvatar = (file: File) => void run(async () => {
    if (file.size > 8 * 1024 * 1024) throw new Error(fr ? "Icône : 8 Mo maximum." : "Profile picture: maximum 8 MB.");
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) throw new Error(fr ? "Choisis une image PNG, JPEG, WebP ou GIF." : "Choose a PNG, JPEG, WebP or GIF image.");
    const avatar = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(fr ? "Impossible de lire l’image." : "Unable to read the image."));
      reader.readAsDataURL(file);
    });
    await communityRequest("/auth/avatar", { avatar }); await refresh();
    await client.invalidateQueries({ queryKey: ["film-activity"] });
    await client.invalidateQueries({ queryKey: ["admin-users"] });
    setNotice(fr ? "Icône enregistrée." : "Profile picture saved.");
  });
  const field = (label: string, id: string, value: string, setter: (s: string) => void, attributes: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block space-y-2" htmlFor={id}><span className="typewriter text-sm">{localizeNode(label)}</span>
      <Input id={id} value={value} onChange={e => setter(e.target.value)} required disabled={busy} {...attributes} /></label>
  );
  return <div className="min-h-screen">{localizeNode(appView ? <AppHeader title={localizeText(fr ? "Mon compte" : "My account")} /> : <Header />)}<main className={`container max-w-xl ${appView ? "pt-24 sm:pt-6 md:pt-10" : "pt-28 md:pt-36"} pb-20`}>
    {localizeNode(!appView && <Link to="/" className="typewriter text-sm hover:text-accent">← {localizeNode(fr ? "Retour au site" : "Back to the site")}</Link>)}
    <p className="typewriter text-xs tracking-widest uppercase text-accent mt-8 mb-3">{localizeText("Clap & Role · ")}{localizeNode(fr ? "Espace membre" : "Members")}</p>
    <h1 className="font-display text-5xl mb-8">{localizeNode(reset ? (fr ? "Nouveau mot de passe" : "New password") : user ? (fr ? "Mon compte" : "My account") : (fr ? "Bienvenue en coulisses" : "Welcome backstage"))}</h1>
    {!user && !reset && <p className="text-sm text-muted-foreground mb-6">{fr ? "Le compte permet d’attribuer les notes, commentaires et publications autorisées à leur auteur. Le site et les outils locaux restent utilisables sans compte. Vos données ne sont jamais vendues ni utilisées à des fins publicitaires." : "An account attributes ratings, comments and authorised publications to their author. Browsing and local tools do not require an account. Your data is never sold or used for advertising."}</p>}
    <Tabs value={mode === "register" ? "register" : "login"} onValueChange={value => { setMode(value === "register" ? "register" : "login"); setAcceptedLegal(false); setError(""); setNotice(""); }}>
    <section className="paper-card p-6 sm:p-8 space-y-6">
      {localizeNode(!loading && !user && !reset && <TabsList aria-label={localizeText(fr ? "Accès au compte" : "Account access")} className="grid grid-cols-2 h-auto rounded-none bg-transparent p-0 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 border-b border-ink/20">
        <TabsTrigger value="login" disabled={busy} className="rounded-none py-5 px-2 border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-accent/5 data-[state=active]:shadow-none">{localizeNode(fr ? "Connexion" : "Sign in")}</TabsTrigger>
        <TabsTrigger value="register" disabled={busy} className="rounded-none py-5 px-2 border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-accent data-[state=active]:bg-accent/5 data-[state=active]:shadow-none">{localizeNode(fr ? "Créer un compte" : "Create an account")}</TabsTrigger>
      </TabsList>)}
      {loading ? <p role="status">{localizeNode(fr ? "Chargement…" : "Loading…")}</p> : <>
        {localizeNode(accountError && <p role="alert">{localizeNode(fr ? "Impossible de vérifier ta connexion." : "Unable to check your session.")} <button className="underline" onClick={() => void refresh()}>{localizeNode(fr ? "Réessayer" : "Retry")}</button></p>)}
        {localizeNode(oauthError && !["legal", "captcha"].includes(oauthError) && <p role="alert" className="text-destructive">{localizeNode(oauthError === "provider" ? (fr ? "Ce mode de connexion n’est pas encore configuré." : "This sign-in method is not configured yet.") : (fr ? "La connexion ou l’association a échoué. Réessaie depuis cette page ; ce compte externe est peut-être déjà associé à un autre membre." : "Sign-in or linking failed. Try again; this external account may already belong to another member."))}</p>)}
        {localizeNode(oauthError === "captcha" && <p role="alert" className="text-destructive">{localizeText("Validez la vérification anti-robot avant de créer votre compte Google ou Discord. Aucun compte n’a été créé.")}</p>)}
        {localizeNode(oauthError === "legal" && <p role="alert" className="text-destructive">{localizeText("La création d’un compte Google ou Discord nécessite l’acceptation des CGU et la lecture de la politique de confidentialité. Aucun compte n’a été créé : acceptez les textes puis recommencez.")}</p>)}
        {user && !reset && <div className="typewriter space-y-2"><p>{localizeNode(fr ? "Connecté en tant que" : "Signed in as")} <strong>{user.username}</strong></p>{user.email && <p className="text-sm text-muted-foreground break-all">{user.email}</p>}
          <p className="text-xs break-all">{localizeText("ID : ")}{localizeNode(user.id)}</p>{localizeNode(user.admin && <p>{localizeNode(fr ? "Administrateur" : "Administrator")}</p>)}</div>}
        {localizeNode(!appView && user?.admin && !reset && <Button className="w-full" asChild><Link to="/admin">{localizeNode(fr ? "Gérer les comptes" : "Manage accounts")}</Link></Button>)}
        {user && !reset && <section className="border-t border-ink/20 pt-5 space-y-4" aria-labelledby="avatar-title">
          <h2 id="avatar-title" className="font-display text-2xl">{localizeNode(fr ? "Icône de profil" : "Profile picture")}</h2>
          <div className="flex items-center gap-4"><AccountAvatar username={user.username} avatar={user.avatar} className="h-20 w-20 text-3xl" /><p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "8 Mo maximum · PNG, JPEG, WebP ou GIF. Recadrée au centre en 256 × 256 pixels. Les animations deviennent une image fixe." : "Maximum 8 MB · PNG, JPEG, WebP or GIF. Center-cropped to 256 × 256 pixels. Animations become a still image.")}</p></div>
          <label className="block space-y-2"><span className="typewriter text-sm">{localizeNode(fr ? "Choisir une icône" : "Choose a profile picture")}</span><Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) uploadAvatar(file); event.target.value = ""; }} /></label>
          {localizeNode(user.avatar && <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
            await communityRequest("/auth/avatar", { avatar: null }); await refresh();
            await client.invalidateQueries({ queryKey: ["film-activity"] });
            await client.invalidateQueries({ queryKey: ["admin-users"] });
            setNotice(fr ? "Icône supprimée." : "Profile picture removed.");
          })}>{localizeNode(fr ? "Retirer l’icône" : "Remove profile picture")}</Button>)}
        </section>}
        <TabsContent value={mode === "register" ? "register" : "login"} className="mt-0">
        <form onSubmit={submit} className="space-y-5">
          {!reset && (user || mode === "register") && field(fr ? "Pseudo" : "Username", "username", username, setUsername, { minLength: 3, maxLength: 30, pattern: "[A-Za-z0-9_-]{3,30}", autoComplete: "username" })}
          {user && !reset && <div className="space-y-2"><label htmlFor="description" className="block typewriter text-sm">{fr ? "Description publique" : "Public description"}</label><textarea id="description" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} rows={5} disabled={busy} className="w-full rounded-md border border-input bg-background p-3 text-sm" /><p className="typewriter text-xs text-muted-foreground">{description.length}/1000 · {localizeNode(fr ? "Visible sur ton profil, même sans connexion." : "Visible on your profile, including to visitors.")}</p>{localizeNode(!appView && <Link to={`/membres/${encodeURIComponent(user.id)}`} className="typewriter text-sm underline">{localizeNode(fr ? "Voir mon profil public" : "View my public profile")}</Link>)}</div>}
          {!reset && !user && mode === "login" && field(fr ? "Pseudo ou email" : "Username or email", "login", login, setLogin, { autoComplete: "username", maxLength: 254 })}
          {!reset && !user && mode !== "login" && field("Email", "email", email, setEmail, { type: "email", autoComplete: "email", maxLength: 254 })}
          {localizeNode((reset || (!user && mode !== "forgot")) && field(fr ? "Mot de passe" : "Password", "password", password, setPassword, { type: "password", minLength: reset || mode === "register" ? 12 : 1, maxLength: 128, autoComplete: reset || mode === "register" ? "new-password" : "current-password" }))}
          {localizeNode((reset || (!user && mode === "register")) && <p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "Au moins 12 caractères. Le pseudo accepte lettres, chiffres, tirets et underscores." : "At least 12 characters. Usernames accept letters, numbers, hyphens and underscores.")}</p>)}
          {localizeNode(!user && !reset && mode === "register" && <><LegalAcceptance accepted={acceptedLegal} onChange={setAcceptedLegal} appView={appView} required disabled={busy} />{localizeNode(!registrationOpen && <p role="status" className="text-sm text-muted-foreground">{localizeText("Les nouvelles inscriptions seront disponibles après finalisation des informations légales. Les comptes existants peuvent se connecter.")}</p>)}</>)}
          {localizeNode(!user && !reset && mode === "register" && registrationOpen && !config.data?.legal?.ready && <p role="status" className="text-sm text-muted-foreground">{localizeText("Inscriptions ouvertes pour les tests. Les informations légales sont encore en préparation.")}</p>)}
          {localizeNode(showCaptcha && <>
            {localizeNode(mode === "login" && <p className="text-sm">{localizeText("Après trois échecs de connexion, une vérification anti-robot est nécessaire.")}</p>)}
            <TurnstileChallenge siteKey={config.data?.captcha?.siteKey} action={captchaAction} revision={captchaRevision} onToken={setCaptchaToken} language={lang} />
          </>)}
          <Button type="submit" disabled={busy || (showCaptcha && !captchaToken) || (!user && !reset && mode === "register" && (!acceptedLegal || !registrationOpen)) || (!user && !reset && mode === "forgot" && !config.data?.reset)} className="w-full">{localizeNode(busy ? (fr ? "Patiente…" : "Please wait…") : reset ? (fr ? "Enregistrer le mot de passe" : "Save password") : user ? (fr ? "Enregistrer le profil" : "Save profile") : mode === "register" ? (fr ? "Créer mon compte" : "Create my account") : mode === "forgot" ? (fr ? "Recevoir un lien" : "Send recovery link") : (fr ? "Se connecter" : "Sign in"))}</Button>
        </form>
        </TabsContent>
        {user && !reset && <section className="border-t border-ink/20 pt-5 space-y-4" aria-labelledby="password-title">
          <h2 id="password-title" className="font-display text-2xl">{localizeNode(user.hasPassword ? (fr ? "Changer le mot de passe" : "Change password") : (fr ? "Ajouter un mot de passe" : "Add a password"))}</h2>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(async () => {
            if (newPassword !== confirmPassword) throw new Error(fr ? "Les nouveaux mots de passe ne correspondent pas." : "The new passwords do not match.");
            await communityRequest("/auth/password", { currentPassword, password: newPassword, email: passwordEmail });
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordEmail(""); setRemovePassword(false);
            await refresh(); setNotice(fr ? "Mot de passe enregistré. Les autres sessions ont été déconnectées." : "Password saved. Other sessions have been signed out.");
          }); }}>
            {localizeNode(user.hasPassword && field(fr ? "Mot de passe actuel" : "Current password", "current-password", currentPassword, setCurrentPassword, { type: "password", maxLength: 128, autoComplete: "current-password" }))}
            {!user.email && field(fr ? "Email pour la connexion" : "Email for sign-in", "password-email", passwordEmail, setPasswordEmail, { type: "email", maxLength: 254, autoComplete: "email" })}
            {localizeNode(field(fr ? "Nouveau mot de passe" : "New password", "new-password", newPassword, setNewPassword, { type: "password", minLength: 12, maxLength: 128, autoComplete: "new-password" }))}
            {localizeNode(field(fr ? "Confirmer le nouveau mot de passe" : "Confirm new password", "confirm-password", confirmPassword, setConfirmPassword, { type: "password", minLength: 12, maxLength: 128, autoComplete: "new-password" }))}
            <p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "12 caractères minimum. Ta session reste ouverte ; les autres appareils devront se reconnecter." : "At least 12 characters. You stay signed in; other devices will need to sign in again.")}</p>
            <Button type="submit" disabled={busy} className="w-full">{localizeNode(fr ? "Enregistrer le mot de passe" : "Save password")}</Button>
          </form>
          {localizeNode(user.hasPassword && user.providers.length > 0 && <div className="space-y-3">
            <Button variant="outline" disabled={busy} onClick={() => setRemovePassword(!removePassword)}>{localizeNode(fr ? "Retirer la connexion par mot de passe" : "Remove password sign-in")}</Button>
            {localizeNode(removePassword && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => {
              await communityRequest("/auth/password/remove", { currentPassword }); setCurrentPassword(""); setRemovePassword(false);
              await refresh(); setNotice(fr ? "Connexion par mot de passe retirée. Utilise Google ou Discord pour te connecter." : "Password sign-in removed. Use Google or Discord to sign in.");
            }); }}>
              <p className="typewriter text-sm">{localizeNode(fr ? "Tu te connecteras uniquement avec les comptes Google ou Discord associés." : "You will sign in only with your linked Google or Discord accounts.")}</p>
              {localizeNode(field(fr ? "Mot de passe actuel pour confirmer" : "Current password to confirm", "remove-password-confirm", currentPassword, setCurrentPassword, { type: "password", maxLength: 128, autoComplete: "current-password" }))}
              <Button type="submit" variant="destructive" disabled={busy}>{localizeNode(fr ? "Confirmer le retrait" : "Confirm removal")}</Button>
            </form>)}
          </div>)}
        </section>}
        {localizeNode(!user && !reset && <button className="typewriter text-sm underline" disabled={busy} onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setError(""); setNotice(""); }}>{localizeNode(mode === "forgot" ? (fr ? "Retour à la connexion" : "Back to sign in") : (fr ? "Mot de passe oublié ?" : "Forgot password?"))}</button>)}
        {mode === "forgot" && !config.data?.reset && <p className="typewriter text-sm">{fr ? "La récupération par email sera disponible après configuration de la messagerie." : "Email recovery will be available once mail delivery is configured."}</p>}
        {!reset && <div className="border-t border-ink/20 pt-5 space-y-3">
          {localizeNode(user ? <><h2 className="font-display text-2xl">{localizeNode(fr ? "Modes de connexion" : "Sign-in methods")}</h2><p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "Associe ou retire Google et Discord. Tu dois conserver au moins un mode de connexion." : "Link or unlink Google and Discord. Keep at least one sign-in method.")}</p><p className="typewriter text-sm">{localizeNode(fr ? "Mot de passe : " : "Password: ")}{localizeNode(user.hasPassword ? (fr ? "actif" : "enabled") : (fr ? "non défini" : "not set"))}</p></> : <p className="typewriter text-sm">{localizeNode(fr ? "Ou continuer avec" : "Or continue with")}</p>)}
          {localizeNode(!user && mode !== "register" && <p className="text-xs text-muted-foreground">{localizeText("Pour créer un nouveau compte via Google ou Discord, choisissez d’abord l’onglet « Créer un compte » afin d’accepter les conditions et de valider la vérification anti-robot.")}</p>)}
          {(["google", "discord"] as const).map(provider => {
            const name = provider === "google" ? "Google" : "Discord";
            const style = provider === "google" ? "w-full h-12 gap-3 font-sans bg-white text-[#1f1f1f] border-[#747775] hover:bg-[#f2f2f2] hover:text-[#1f1f1f]" : "w-full h-12 gap-3 font-sans bg-[#5865F2] text-white border-[#5865F2] hover:bg-[#4752C4] hover:text-white";
            return <div key={provider}>
            {localizeNode(user?.providers.includes(provider) ? <div className="space-y-3"><div className="flex items-center justify-between gap-2"><p className="typewriter text-sm flex items-center gap-2"><ProviderIcon provider={provider} />{localizeNode(name)} {localizeNode(fr ? "associé" : "linked")}</p><Button variant="outline" size="sm" disabled={busy || (!user.hasPassword && user.providers.length === 1)} onClick={() => { setUnlinkProvider(unlinkProvider === provider ? null : provider); setUnlinkPassword(""); }}>{localizeNode(fr ? "Dissocier" : "Unlink")}</Button></div>
              {localizeNode(!user.hasPassword && user.providers.length === 1 && <p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "Ton seul mode de connexion : ajoute un mot de passe ou un autre compte avant de le retirer." : "Your only sign-in method: add a password or another account before removing it.")}</p>)}
              {localizeNode(unlinkProvider === provider && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => {
                await communityRequest("/auth/unlink", { provider, currentPassword: unlinkPassword }); setUnlinkProvider(null); setUnlinkPassword("");
                await refresh(); setNotice(fr ? `${name} dissocié. Les autres sessions ont été déconnectées.` : `${name} unlinked. Other sessions have been signed out.`);
              }); }}><p className="typewriter text-sm">{localizeNode(fr ? `Retirer ${name} des modes de connexion de ce compte ?` : `Remove ${name} as a sign-in method for this account?`)}</p>
                {localizeNode(user.hasPassword && field(fr ? "Mot de passe actuel pour dissocier" : "Current password to unlink", `unlink-${provider}-password`, unlinkPassword, setUnlinkPassword, { type: "password", maxLength: 128, autoComplete: "current-password" }))}
                <div className="flex flex-wrap gap-2"><Button variant="destructive" type="submit" disabled={busy}>{localizeNode(fr ? "Confirmer la dissociation" : "Confirm unlinking")}</Button><Button variant="outline" type="button" disabled={busy} onClick={() => { setUnlinkProvider(null); setUnlinkPassword(""); }}>{localizeNode(fr ? "Annuler" : "Cancel")}</Button></div>
              </form>)}
            </div> : config.data?.[provider] ?
              (!user && mode === "register") ? <Button variant="outline" className={style} disabled={busy || !acceptedLegal || !registrationOpen || !captchaToken} onClick={() => startOAuth(provider)}><ProviderIcon provider={provider} />{localizeText("Continuer avec ")}{localizeNode(name)}</Button> : <Button variant="outline" className={style} asChild><a href={oauthHref(provider)}><ProviderIcon provider={provider} />{localizeNode(user ? (fr ? "Associer " : "Link ") : (fr ? "Continuer avec " : "Continue with "))}{localizeNode(name)}</a></Button> :
              <Button variant="outline" className={style} disabled><ProviderIcon provider={provider} />{localizeNode(name)} — {localizeNode(fr ? "bientôt disponible" : "coming soon")}</Button>)}
          </div>; })}
          {localizeNode(config.isError && <p role="alert">{localizeNode(fr ? "Impossible de charger les modes de connexion." : "Unable to load sign-in methods.")} <button className="underline" onClick={() => void config.refetch()}>{localizeNode(fr ? "Réessayer" : "Retry")}</button></p>)}
        </div>}
        {localizeNode(user && !reset && <Button variant="outline" disabled={busy} onClick={() => void run(async () => { await communityRequest("/auth/logout", {}); await refresh(); setUsername(""); setMode("login"); })}>{localizeNode(fr ? "Se déconnecter" : "Sign out")}</Button>)}
      </>}
      {localizeNode(error && <p role="alert" className="text-destructive typewriter text-sm">{localizeNode(error)}</p>)}
      {localizeNode(notice && <p role="status" className="typewriter text-sm">{localizeNode(notice)}</p>)}
    </section>
    </Tabs>
  </main>{localizeNode(!appView && <Footer />)}</div>;
}
export default function AccountPage({ appView = false }: { appView?: boolean }) {
  const installedApp = useAppMode();
  return <LanguageProvider><AccountInner appView={appView || installedApp} /></LanguageProvider>;
}
