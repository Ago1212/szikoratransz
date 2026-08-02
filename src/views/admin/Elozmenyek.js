import React, { useState } from "react";
import { PiListMagnifyingGlassLight, PiBellLight } from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import { NaploTartalom } from "views/admin/Naplo.js";
import { ErtesitesiElozmenyekTartalom } from "views/admin/ErtesitesiElozmenyek.js";

// Mobil navigáció újratervezés (2026-07-30): a korábban külön menüpontként
// élő Napló és Értesítési előzmények most egy közös "Előzmények" oldalon,
// belső fülekkel érhető el (ld. Koltsegek.js fül-mintája) — mindkét eredeti
// route (`/admin/naplo`, `/admin/ertesitesi-elozmenyek`) megmaradt
// mélylink-kompatibilitás miatt, csak a nav-regisztrációkból tűntek el.
const TABS = [
  { key: "naplo", label: "Napló", icon: PiListMagnifyingGlassLight },
  { key: "ertesitesek", label: "Értesítések", icon: PiBellLight },
];

export default function Elozmenyek() {
  const [activeTab, setActiveTab] = useState("naplo");

  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Rendszer" title="Előzmények" />
        <div className="-mt-2 mb-4 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 ${
                activeTab === t.key
                  ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                  : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {activeTab === "naplo" && <NaploTartalom />}
        {activeTab === "ertesitesek" && <ErtesitesiElozmenyekTartalom />}
      </div>
    </div>
  );
}
