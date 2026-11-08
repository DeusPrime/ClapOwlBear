export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV) {
    // A cached Vite module can keep old routes and menus alive across edits.
    const scope = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    void navigator.serviceWorker.getRegistrations().then(async registrations => {
      await Promise.all(registrations.filter(registration => registration.scope === scope).map(registration => registration.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("clap-role-pwa-")).map(key => caches.delete(key)));
    }).catch(error => console.warn("Development service worker cleanup failed", error));
    return;
  }

  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) window.dispatchEvent(new Event("clap-update-available"));
    });
    navigator.serviceWorker.register("/ClapOwlBear/sw.js", { updateViaCache: "none" }).then(registration => {
      // Installed apps can stay alive for days without another load event.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void registration.update().catch(error => console.warn("Service worker update failed", error));
        }
      });
    }).catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
};
