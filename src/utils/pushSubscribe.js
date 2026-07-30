import { fetchAction } from "utils/fetchAction";

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function mentSubscription(subscription, kerelmezoId) {
  const json = subscription.toJSON();
  return fetchAction("savePushFeliratkozas", {
    kerelmezo_id: kerelmezoId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
}

// Bejelentkezés utáni (vagy bármely oldalbetöltéskori) néma
// szinkronizálás: ha a böngésző már korábban megkapta az értesítési
// engedélyt, de a tényleges PushSubscription időközben elveszett (pl.
// kijelentkezés/eszközváltás/service worker-frissítés miatt), csendben
// újra létrehozza és elmenti a backendnek — sosem kér új engedélyt
// (az csak felhasználói gesztusból nyílhatna meg natívan), ha a
// jelenlegi permission nem "granted", nem csinál semmit.
export async function ensurePushSubscriptionSynced() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.id) return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const statusz = await fetchAction("getPushStatusz", { kerelmezo_id: user.id });
      if (!statusz?.success || !statusz.vapidPublicKey) return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(statusz.vapidPublicKey),
      });
    }

    await mentSubscription(subscription, user.id);
  } catch (error) {
    console.error("Push-feliratkozás automatikus szinkronizálása sikertelen:", error);
  }
}
