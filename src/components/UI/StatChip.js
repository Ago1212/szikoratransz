import React from "react";

// Kis, generikus infó-chip ikonnal (pl. tömeg, raklapszám, jármű) — ha
// nincs érdemi érték, nem renderelődik (nincs üres helyfoglaló chip).
export default function StatChip({ icon: Icon, value, label }) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-ink-400" />}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink-800">{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      </div>
    </div>
  );
}
