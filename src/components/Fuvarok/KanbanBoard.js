import React, { useState } from "react";
import FuvarKanbanCard from "components/Fuvarok/FuvarKanbanCard.js";

const OSZLOPOK = [
  { key: "rogzitett", label: "Rögzítve" },
  { key: "szamlazasra_var", label: "Számlázásra vár" },
  { key: "szamlazva", label: "Számlázva" },
  { key: "fizetesre_var", label: "Fizetésre vár" },
  { key: "teljesitve", label: "Teljesítve" },
];

export default function KanbanBoard({ fuvarok, onAllapotChange }) {
  const [dragOverKulcs, setDragOverKulcs] = useState(null);

  const handleDrop = (e, ujAllapot) => {
    e.preventDefault();
    setDragOverKulcs(null);
    const fuvarId = Number(e.dataTransfer.getData("text/plain"));
    if (!fuvarId) return;
    const fuvar = fuvarok.find((f) => f.id === fuvarId);
    if (fuvar && fuvar.allapot !== ujAllapot) {
      onAllapotChange(fuvarId, ujAllapot);
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {OSZLOPOK.map((oszlop) => {
        const idevalok = fuvarok.filter((f) => f.allapot === oszlop.key);
        return (
          <div
            key={oszlop.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverKulcs(oszlop.key);
            }}
            onDragLeave={() => setDragOverKulcs((k) => (k === oszlop.key ? null : k))}
            onDrop={(e) => handleDrop(e, oszlop.key)}
            className={`flex w-64 flex-shrink-0 flex-col rounded-2xl p-2 transition-colors ${
              dragOverKulcs === oszlop.key ? "bg-brand-50 dark:bg-brand-950/30" : "bg-slate-50 dark:bg-ink-800/50"
            }`}
          >
            <p className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {oszlop.label}
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] dark:bg-ink-900">{idevalok.length}</span>
            </p>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {idevalok.map((fuvar) => (
                <FuvarKanbanCard key={fuvar.id} fuvar={fuvar} onDragStart={() => {}} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
