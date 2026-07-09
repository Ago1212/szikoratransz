import React, { useEffect, useState } from "react";
import { PiArrowClockwiseBold } from "react-icons/pi";
import { subscribeSwUpdate } from "utils/swUpdate";

/**
 * Amikor a service worker új verziót talál (de az még nem aktív, mert
 * a régi tab-ok nyitva vannak), ez a sáv jelenik meg egy "Frissítés"
 * gombbal — enélkül a felhasználók a régi, cache-elt verzióban ragadnának
 * addig, amíg minden fület be nem zárnak (ami gyakorlatilag sose történik
 * meg maguktól egy nyitva hagyott flottakezelő appnál).
 */
export default function UpdateBanner() {
  const [registration, setRegistration] = useState(null);

  useEffect(() => subscribeSwUpdate(setRegistration), []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const handleControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
  }, []);

  if (!registration || !registration.waiting) return null;

  const handleUpdate = () => {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center px-4 pb-4 pointer-events-none"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-white/10 bg-[#23262B] px-5 py-3 shadow-soft-lg text-white">
        <span className="text-sm font-medium">Új verzió érhető el.</span>
        <button
          type="button"
          onClick={handleUpdate}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#1E3AA8] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors duration-200 hover:bg-[#172E86]"
        >
          <PiArrowClockwiseBold className="h-3.5 w-3.5" />
          Frissítés
        </button>
      </div>
    </div>
  );
}
