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

const APP_VERSION = "1.8.9";
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

/* Installation : on met la coquille en cache.

   `cache: "reload"` est ici la pièce maîtresse. Sans lui, ces
   fichiers sont pris dans le cache HTTP du navigateur, qui peut
   encore détenir la version précédente : le nouveau service
   worker enfermerait alors un ancien index.html dans un cache
   portant le nouveau numéro, et l'app resterait indéfiniment sur
   la version d'avant tout en annonçant une mise à jour réussie.
   Avec ce réglage, chaque fichier est réclamé au serveur.        */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL.map((chemin) => new Request(chemin, { cache: "reload" })))
    )
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

/* Stratégie de réponse, en deux régimes.

   1. La page elle-même (requête de navigation) : réseau d'abord,
      cache en secours. C'est le fichier qui porte toute l'app ;
      mieux vaut attendre quelques dixièmes de seconde que servir
      une version périmée. Hors connexion, le cache prend le
      relais et l'app s'ouvre normalement.
   2. Le reste (icônes, manifeste) : cache d'abord, réseau en
      secours. Ces fichiers ne changent presque jamais et gagnent
      à être instantanés.                                          */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return; // on ne touche pas aux requêtes externes (ex. Google Maps)
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((reponse) => {
          if (reponse.ok) {
            const copie = reponse.clone();
            caches.open(CACHE_NAME).then((c) => c.put("./index.html", copie));
          }
          return reponse;
        })
        .catch(() =>
          caches.match("./index.html").then((cache) => cache || caches.match("./"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cache) => {
      return (
        cache ||
        fetch(event.request).then((reponse) => {
          if (reponse.ok) {
            const copie = reponse.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copie));
          }
          return reponse;
        })
      );
    })
  );
});
