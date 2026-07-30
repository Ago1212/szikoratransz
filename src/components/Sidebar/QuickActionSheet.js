import React from "react";
import { Link } from "react-router-dom";

// Mobil navigáció újratervezés (2026-07-30) — a bottom nav FAB-jának
// (➕ Gyors műveletek) csúszó lapja, ugyanazzal a max-h-0/max-h-* csúszó
// mintával, amit korábban a mobileGroups csoport-fülek panelje használt.
// Pozicionálást (fixed/bottom) NEM ez a komponens végzi — a Sidebar.js
// rendereli a saját, meglévő `fixed inset-x-0 bottom-0` konténerén belül,
// közvetlenül a bottom nav `<nav>` fölé, hogy egy fixed helyett ne kelljen
// külön pixel-matekot végezni a nav-sáv magasságával.
export default function QuickActionSheet({ open, actions, onClose, onKerelmekClick }) {
  return (
    <div
      className={`overflow-y-auto rounded-t-2xl border-t border-ink-100 bg-white shadow-soft-lg transition-all duration-300 ease-fluid dark:border-ink-800 dark:bg-ink-900 ${
        open ? "max-h-96" : "max-h-0"
      }`}
    >
      <ul className="px-2 py-1.5">
        <li className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          Gyors művelet
        </li>
        {actions.map((a) => (
          <li key={a.key}>
            {a.action === "kerelmek" ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onKerelmekClick();
                }}
                className="flex w-full min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <a.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {a.text}
                {a.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {a.badge}
                  </span>
                )}
              </button>
            ) : (
              <Link
                to={a.to}
                onClick={onClose}
                className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <a.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {a.text}
                {a.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {a.badge}
                  </span>
                )}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
