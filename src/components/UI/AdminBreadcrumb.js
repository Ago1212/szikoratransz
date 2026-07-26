import React from "react";
import { Link } from "react-router-dom";
import { PiCaretRightLight } from "react-icons/pi";

// UX-audit — a *Form oldalak (Kamion/Furgon/Potkocsi/Sofor/Helyszin/Ugyfel/
// Bejelentesek) korábban egyáltalán nem mutatták a lista-oldal eyebrow+H1
// navigációs kontextusát: a belépő csak egy kis súlyú, kártya-belüli h3
// címet és egy "Vissza" linket látott, ami könnyen elveszik hosszabb
// oldalgörgetés után. Ez a sáv a `PageHeader` eyebrow-stílusát ismétli meg
// egy klikkelhető "Csoport / Lista / Aktuális elem" formában, konzisztensen
// minden *Form oldalon.
export default function AdminBreadcrumb({ group, listLabel, listPath, current }) {
  return (
    <nav aria-label="Morzsamenü" className="mb-3 flex items-center gap-1.5 text-xs">
      <span className="font-semibold uppercase tracking-[0.14em] text-brand-500 dark:text-brand-400">
        {group}
      </span>
      <PiCaretRightLight className="h-3 w-3 flex-shrink-0 text-ink-300 dark:text-ink-600" />
      <Link
        to={listPath}
        className="font-medium text-ink-500 transition-colors duration-200 hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
      >
        {listLabel}
      </Link>
      <PiCaretRightLight className="h-3 w-3 flex-shrink-0 text-ink-300 dark:text-ink-600" />
      <span className="truncate font-semibold text-ink-700 dark:text-ink-200" aria-current="page">
        {current}
      </span>
    </nav>
  );
}
