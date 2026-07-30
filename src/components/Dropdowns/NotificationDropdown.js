import React, { useEffect, useRef } from "react";
import { PiCheckCircleLight, PiXLight } from "react-icons/pi";

// Mobil navigáció újratervezés (2026-07-30) — swipe gesztus a jármű-váltási
// kérelem sorokon (`n.swipeActions`, ld. Sidebar.js `kerelemNotifications`):
// jobbra húzás jóváhagy, balra húzás elutasít, a küszöb alatti húzás
// visszaugrik. A meglévő gombos Jóváhagyás/Elutasítás megmarad — a swipe egy
// gyorsabb ALTERNATÍVA, nem az egyetlen út.
const SWIPE_THRESHOLD = 64;

function NotificationRow({ n, onDismiss }) {
  const [dragX, setDragX] = React.useState(0);
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => {
    if (!n.swipeActions) return;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    if (!n.swipeActions || touchStartX.current == null) return;
    setDragX(e.touches[0].clientX - touchStartX.current);
  };
  const handleTouchEnd = () => {
    if (!n.swipeActions) return;
    if (dragX > SWIPE_THRESHOLD) n.swipeActions.approve();
    else if (dragX < -SWIPE_THRESHOLD) n.swipeActions.reject();
    setDragX(0);
    touchStartX.current = null;
  };

  return (
    <div
      className="group relative flex items-start gap-2 overflow-hidden px-4 py-3 hover:bg-slate-50 dark:hover:bg-ink-800"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {n.swipeActions && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center bg-emerald-500 text-white"
            style={{ opacity: Math.min(Math.max(dragX / SWIPE_THRESHOLD, 0), 1) }}
          >
            <PiCheckCircleLight className="h-5 w-5" />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-center bg-red-500 text-white"
            style={{ opacity: Math.min(Math.max(-dragX / SWIPE_THRESHOLD, 0), 1) }}
          >
            <PiXLight className="h-5 w-5" />
          </div>
        </>
      )}
      <div className="min-w-0 flex-1 bg-inherit" style={{ transform: `translateX(${dragX}px)` }}>
        <p className="text-sm text-ink-700 dark:text-ink-100">{n.text}</p>
        {n.meta && <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">{n.meta}</p>}
        {n.actions?.length > 0 && (
          <div className="mt-2 flex gap-2">
            {n.actions.map((action, ai) => (
              <button
                key={ai}
                type="button"
                onClick={action.onClick}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  action.tone === "danger"
                    ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
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
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-300 hover:bg-slate-200 hover:text-ink-600 dark:text-ink-600 dark:hover:bg-ink-700 dark:hover:text-ink-200"
        title="Törlés"
        aria-label="Értesítés törlése"
      >
        <PiXLight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Korábban egy Popper-pozicionált, kis dropdown volt (a haranG-gombhoz
// horgonyozva) — ehelyett most a GlobalSearch.js-ben már bevált,
// konzisztens teljes-képernyős overlay mintát követi (háttér-elhomályosítás
// + középre igazított panel, Escape/háttérre kattintva zár). Ez nem csak
// vizuálisan egységesebb, hanem a haranG-gombtól függetlenül, BÁRHONNAN
// (pl. egy mobil FAB-ból is) megnyitható — a Popper-változat csak a
// deszktop Sidebar fejlécéhez volt rögzítve.
export default function NotificationDropdown({ notifications = [], open, onClose, onDismiss, onDismissAll }) {
  const closeButtonRef = useRef(null);
  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  // R23 (fejlesztési audit, 2026-07-19): billentyűzettel navigálva a fókusz
  // eddig megnyitáskor nem került be az overlay-be — a GlobalSearch.js már
  // bevált mintáját követve (fókusz az első kezelhető elemre nyitáskor).
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Értesítések"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-soft-lg ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2.5 border-b border-ink-100 px-4 py-3.5 dark:border-ink-800">
          <h3 className="text-sm font-semibold text-brand-900 dark:text-ink-50">Értesítések</h3>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => onDismissAll(notifications.map((n) => n.id))}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-400 hover:bg-slate-100 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-100"
              >
                Összes törlése
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-100"
              aria-label="Bezárás"
            >
              <PiXLight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <PiCheckCircleLight className="h-7 w-7 text-ink-300 dark:text-ink-700" />
            <p className="text-sm text-ink-400 dark:text-ink-500">
              Nincs új értesítésed. Minden naprakész.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {notifications.map((n, i) => (
              <NotificationRow key={n.id ?? i} n={n} onDismiss={onDismiss} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
