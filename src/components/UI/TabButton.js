import React from "react";

// UX-audit — a fültár (Kamion/Furgon/Pótkocsi/Sofőr/Helyszín kártyák) csak
// vizuálisan (alsó vonal) jelezte az aktív fület, screen readerrel egy sima
// gombsornak tűnt, a "hányadik fülön vagyok / hány fül van" kontextus
// elveszett. `id`/`panelId` opcionális — a hívó adja meg, ha ARIA-tab
// szemantikát is akar (a meglévő hívási helyek `id`/`panelId` nélkül is
// működnek tovább, csak akkor nem kapják meg az extra attribútumokat).
export default function TabButton({ active, onClick, icon: Icon, children, id, panelId }) {
  return (
    <button
      type="button"
      role={id ? "tab" : undefined}
      id={id}
      aria-selected={id ? active : undefined}
      aria-controls={panelId}
      tabIndex={id ? (active ? 0 : -1) : undefined}
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-lg px-1 py-2.5 text-sm font-semibold transition-colors duration-200 ease-fluid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        active ? "text-brand-700 dark:text-brand-300" : "text-ink-400 hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-100"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      <span
        className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors duration-200 ease-fluid ${
          active ? "bg-brand-600" : "bg-transparent"
        }`}
      />
    </button>
  );
}
