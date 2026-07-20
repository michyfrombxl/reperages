/* ============================================================
   Repérages — Service worker
   Rôle : faire fonctionner l'app hors ligne et gérer proprement
   les mises à jour (nouvelle version publiée = proposée à
   l'utilisateur à l'ouverture suivante).

   RÈGLE DE MISE À JOUR : à chaque nouvelle version de l'app,
   incrémenter APP_VERSION ci-dessous (elle doit correspondre au
   numéro affiché dans index.html). Le changement de nom de cache
   force le rechargement des fichiers.
   ============================================================ */

const APP_VERSION = "1.7.1";
const CACHE_NAME = "reperages-v" + APP_VERSION;

// Fichiers constituant la « coquille » de l'app (les données,
// elles, vivent dans IndexedDB et ne passent jamais par ici).
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

// Installation : on met la coquille en cache.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// Activation : on supprime les caches des anciennes versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("reperages-v") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Message envoyé par la page quand l'utilisateur accepte la mise
// à jour (« Recharger ») : la nouvelle version prend la main.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Stratégie de réponse : cache d'abord (rapidité + hors ligne),
// réseau en secours. Uniquement pour les fichiers de l'app.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return; // on ne touche pas aux requêtes externes (ex. Google Maps)
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // Petite mise en cache opportuniste des fichiers de l'app.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          }
          return response;
        })
      );
    })
  );
});
