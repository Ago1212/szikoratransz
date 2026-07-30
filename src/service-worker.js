/* eslint-disable no-restricted-globals */

// PWA service worker — a create-react-app beépített Workbox
// (workbox-webpack-plugin `InjectManifest`) build lépése automatikusan
// felismeri ezt a fájlt (`npm run build` esetén, csak production build-nél)
// és belegenerálja a `self.__WB_MANIFEST` precache listát a build kimenet
// hashelt fájlnevei alapján — nincs hozzá külön konfiguráció szükséges.

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkFirst } from "workbox-strategies";

clientsClaim();

// Az app shell (JS/CSS bundle, index.html, ikonok, stb.) előcachelése —
// ez teszi lehetővé, hogy a telepített app offline is legalább megnyíljon.
precacheAndRoute(self.__WB_MANIFEST);

// Minden navigációs kérést (URL-sávba írt cím, link-kattintás) az
// index.html app shell szolgál ki — a react-router kliensoldalon veszi át
// az útvonal-kezelést innentől.
const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");
registerRoute(
  ({ request, url }) => {
    if (request.mode !== "navigate") {
      return false;
    }
    if (url.pathname.startsWith("/_")) {
      return false;
    }
    if (url.pathname.match(fileExtensionRegexp)) {
      return false;
    }
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html")
);

// Képek (logó, ikonok) — stale-while-revalidate: azonnal a cache-elt
// verziót adja, közben háttérben frissíti.
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    /\.(png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: "images",
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Backend API hívások (api.php) — mindig hálózatról próbáljuk először
// (az adatok sose legyenek elavultak), rövid timeout után a legutóbb
// cache-elt válaszra esünk vissza, ha épp nincs net. Csak GET kéréseket
// cache-elünk (a `fetchAction` POST-jait a Workbox alapból nem cacheli).
registerRoute(
  ({ url, request }) =>
    request.method === "GET" && url.pathname.endsWith("/api.php"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 })],
  })
);

// Lehetővé teszi, hogy az app a `registration.waiting.postMessage({type: 'SKIP_WAITING'})`
// hívással azonnal aktiválja az új service worker verziót (frissítés esetén).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// R11 (fejlesztési audit, 2026-07-19): Web Push — a szerver (WebPushSender,
// backend/WebPushSender.php) egy JSON payloadot küld ({title, body, url}),
// amit itt a böngésző natív Notification API-jával jelenítünk meg. A
// payload hiánya (pl. egy jövőbeli, adat nélküli "csendes" push) nem dob
// hibát, csak egy generikus szöveget mutat.
self.addEventListener("push", (event) => {
  let data = { title: "Szikora Transz", body: "Új értesítésed érkezett." };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    // nem JSON payload — marad az alapértelmezett szöveg
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      // A nagy ikon (`icon`) a márkázott wordmark — jól olvasható a
      // közlemény-listában. A `badge` viszont Androidon mindig
      // monokróm sziluettként, ~24dp-re kicsinyítve jelenik meg (a
      // rendszer maga tintázza), ezért ennek egy külön, erre a célra
      // rajzolt, vastag kontúrú monogramnak kell lennie — a wordmark
      // ugyanerre a méretre zsugorítva felismerhetetlen folttá mosódna.
      icon: "/icon-192.png",
      badge: "/badge-192.png",
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      actions: [{ action: "megnyitas", title: "Megnyitás" }],
      data: { url: data.url || "/admin/dashboard" },
    })
  );
});

// Értesítésre kattintva a már nyitott app-fület hozza előtérbe, ha van
// ilyen (ne nyisson feleslegesen egy második lapot) — csak ha nincs, akkor
// nyit egy újat a push payload `url`-jére.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
