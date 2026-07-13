import React from "react";
import { PiCheckCircleLight, PiXLight } from "react-icons/pi";

// Korábban egy Popper-pozicionált, kis dropdown volt (a haranG-gombhoz
// horgonyozva) — ehelyett most a GlobalSearch.js-ben már bevált,
// konzisztens teljes-képernyős overlay mintát követi (háttér-elhomályosítás
// + középre igazított panel, Escape/háttérre kattintva zár). Ez nem csak
// vizuálisan egységesebb, hanem a haranG-gombtól függetlenül, BÁRHONNAN
// (pl. egy mobil FAB-ból is) megnyitható — a Popper-változat csak a
// deszktop Sidebar fejlécéhez volt rögzítve.
export default function NotificationDropdown({ notifications = [], open, onClose, onDismiss, onDismissAll }) {
  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-soft-lg ring-1 ring-ink-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2.5 border-b border-ink-100 px-4 py-3.5">
          <h3 className="text-sm font-semibold text-brand-900">Értesítések</h3>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => onDismissAll(notifications.map((n) => n.id))}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-400 hover:bg-slate-100 hover:text-ink-700"
              >
                Összes törlése
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100 hover:text-ink-700"
              aria-label="Bezárás"
            >
              <PiXLight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <PiCheckCircleLight className="h-7 w-7 text-ink-300" />
            <p className="text-sm text-ink-400">
              Nincs új értesítésed. Minden naprakész.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {notifications.map((n, i) => (
              <div key={n.id ?? i} className="group flex items-start gap-2 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-700">{n.text}</p>
                  {n.meta && <p className="mt-0.5 text-xs text-ink-400">{n.meta}</p>}
                  {n.actions?.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {n.actions.map((action, ai) => (
                        <button
                          key={ai}
                          type="button"
                          onClick={action.onClick}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            action.tone === "danger"
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-brand-600 text-white hover:bg-brand-700"
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(n.id)}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-300 hover:bg-slate-200 hover:text-ink-600"
                  title="Törlés"
                  aria-label="Értesítés törlése"
                >
                  <PiXLight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
