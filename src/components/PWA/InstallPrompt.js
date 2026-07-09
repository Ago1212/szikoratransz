import React, { useEffect, useState } from "react";
import { PiDownloadSimpleLight, PiShareLight, PiXLight } from "react-icons/pi";

const DISMISS_KEY = "pwaInstallDismissedAt";
// Ha a felhasználó elutasítja, ennyi ideig ne kérdezzük újra.
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 nap

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const wasRecentlyDismissed = () => {
  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
};

// A böngésző natív telepítő promptja (Chrome/Edge/Android) és egy iOS-re
// szabott kézi útmutató egyetlen kis lebegő sávban — mindkettő ugyanazt a
// UI-t használja, csak a szöveg és a gomb tér el.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS Safari sosem tüzeli el a beforeinstallprompt eseményt — ott csak
    // egy kézi útmutatót tudunk mutatni a Megosztás menüről.
    if (isIos()) {
      setIosHint(true);
      setVisible(true);
    }

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9998] flex justify-center px-4 pb-4 md:bottom-4 md:px-4"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft-lg">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          {iosHint ? (
            <PiShareLight className="h-5 w-5" />
          ) : (
            <PiDownloadSimpleLight className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-900">
            Telepítsd az alkalmazást
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
            {iosHint
              ? 'Koppints a Megosztás ikonra, majd válaszd a "Kezdőképernyőhöz adás" lehetőséget.'
              : "Gyorsabb elérés, teljes képernyős nézet és offline elérhetőség a telefonod kezdőképernyőjéről."}
          </p>
          {!iosHint && (
            <button
              type="button"
              onClick={handleInstall}
              className="mt-2.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
            >
              Telepítés
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-sand-100 hover:text-ink-700"
        >
          <PiXLight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
