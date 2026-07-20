import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PiCheckCircleFill, PiWarningCircleFill, PiXLight } from "react-icons/pi";
import { subscribeToast } from "utils/toast";
import { useDarkMode } from "utils/useDarkMode.js";

const AUTO_DISMISS_MS = 5000;

// A `dark` osztály a layouts/Admin.js SAJÁT gyökér wrapperén ül (ld.
// useDarkMode.js komment) — ez a komponens viszont az index.js-ben, a
// Router gyökerén, minden layout-tól FÜGGETLENÜL, egyszer van mountolva,
// tehát sosem örökölné azt az osztályt DOM-ősként. Emiatt itt saját maga
// olvassa ki ugyanazt a localStorage-preferenciát, és csak akkor alkalmazza,
// ha épp egy admin route-on vagyunk — a sofőr/nyilvános oldalaknak nincs
// egyéb dark-mód vizuáluk, egy elszigetelt sötét toast ott inkonzisztens
// lenne.
export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const [isDark] = useDarkMode();
  const location = useLocation();
  const darkActive = isDark && location.pathname.startsWith("/admin");

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    return subscribeToast((item) => {
      setToasts((prev) => [...prev, item]);
      setTimeout(() => remove(item.id), AUTO_DISMISS_MS);
    });
  }, [remove]);

  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[9999] flex flex-col items-center gap-2 px-4 pt-4 md:inset-x-auto md:right-4 md:items-end ${darkActive ? "dark" : ""}`}
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-soft-lg transition-all duration-200 ${
            t.type === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200"
              : "border-red-100 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200"
          }`}
        >
          <span className="mt-0.5 flex-shrink-0">
            {t.type === "success" ? (
              <PiCheckCircleFill className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <PiWarningCircleFill className="h-5 w-5 text-red-600 dark:text-red-300" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
            {t.message}
          </p>
          <button
            type="button"
            onClick={() => remove(t.id)}
            className="flex-shrink-0 text-current/50 transition-colors duration-150 hover:text-current"
          >
            <PiXLight className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
