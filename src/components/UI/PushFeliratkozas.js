import React, { useEffect, useState } from "react";
import { PiBellRingingLight, PiBellSlashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

// R11 (fejlesztési audit, 2026-07-19): Web Push feliratkozás/leiratkozás
// vezérlő — a service-worker.js `push`/`notificationclick` kezelője már
// megvan, ez a hiányzó másik fele: a böngésző natív `PushManager`
// feliratkoztatása + a kapott endpoint/kulcsok elküldése a backendnek
// (savePushFeliratkozas/deletePushFeliratkozas, ld. pushInterface.php).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushFeliratkozas() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      setLoading(false);
      return;
    }
    const user = JSON.parse(localStorage.getItem("user") || "null");
    fetchAction("getPushStatusz", { kerelmezo_id: user?.id })
      .then((result) => {
        if (result?.success) {
          setSubscribed(!!result.van);
          setVapidPublicKey(result.vapidPublicKey);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Az értesítési engedély megadása nélkül nem lehet push-t küldeni.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = subscription.toJSON();
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const result = await fetchAction("savePushFeliratkozas", {
        kerelmezo_id: user?.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (result?.success) {
        setSubscribed(true);
        toast.success("Push-értesítések bekapcsolva ezen az eszközön.");
      } else {
        toast.error(result?.message || "A feliratkozás mentése sikertelen.");
      }
    } catch (error) {
      console.error("Push feliratkozás sikertelen:", error);
      toast.error("A push-feliratkozás sikertelen volt.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (subscription) {
        await fetchAction("deletePushFeliratkozas", {
          kerelmezo_id: user?.id,
          endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Push-értesítések kikapcsolva ezen az eszközön.");
    } catch (error) {
      console.error("Push leiratkozás sikertelen:", error);
      toast.error("A leiratkozás sikertelen volt.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  if (!supported) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-ink-100 bg-slate-50 p-4 text-sm text-ink-400 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-500">
        <PiBellSlashLight className="h-5 w-5 flex-shrink-0" />
        Ez a böngésző nem támogatja a push-értesítéseket.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-slate-50 p-4 dark:border-ink-800 dark:bg-ink-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <PiBellRingingLight className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600 dark:text-brand-300" />
        <div>
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Push-értesítések</p>
          <p className="text-xs text-ink-400 dark:text-ink-500">
            {subscribed
              ? "Ezen az eszközön be vannak kapcsolva — új bejelentésnél/kérelemnél azonnal értesítést kapsz."
              : "Kapj azonnali értesítést ezen az eszközön, amint egy új bejelentés/jármű-váltási kérelem érkezik."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={subscribed ? handleDisable : handleEnable}
        disabled={busy}
        className={`flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-soft transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${
          subscribed
            ? "border border-ink-200 bg-white text-ink-500 hover:bg-red-50 hover:text-red-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {busy ? "Feldolgozás..." : subscribed ? "Kikapcsolás" : "Bekapcsolás"}
      </button>
    </div>
  );
}
