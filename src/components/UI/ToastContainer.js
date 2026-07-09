import React, { useCallback, useEffect, useState } from "react";
import { PiCheckCircleFill, PiWarningCircleFill, PiXLight } from "react-icons/pi";
import { subscribeToast } from "utils/toast";

const AUTO_DISMISS_MS = 5000;

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

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
      className="fixed inset-x-0 top-0 z-[9999] flex flex-col items-center gap-2 px-4 pt-4 md:inset-x-auto md:right-4 md:items-end"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-soft-lg transition-all duration-200 ${
            t.type === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          <span className="mt-0.5 flex-shrink-0">
            {t.type === "success" ? (
              <PiCheckCircleFill className="h-5 w-5 text-emerald-600" />
            ) : (
              <PiWarningCircleFill className="h-5 w-5 text-red-600" />
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
