import React from "react";

export default function FuvarKanbanCard({ fuvar, onDragStart, onClick }) {
  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam || "—";
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(fuvar.id));
        onDragStart(fuvar.id);
      }}
      onDoubleClick={onClick}
      className="cursor-grab rounded-xl border border-ink-100 bg-white p-3 text-xs shadow-soft hover:border-brand-300 hover:shadow-md active:cursor-grabbing dark:border-ink-800 dark:bg-ink-900"
    >
      <p className="mb-1 font-semibold text-ink-700 dark:text-ink-200">
        {fuvar.felrako || "—"} → {fuvar.lerako || "—"}
      </p>
      <p className="text-ink-500 dark:text-ink-400">
        {fuvar.megbizo_nev || "—"}
      </p>
      <div className="mt-2 flex items-center justify-between text-ink-400 dark:text-ink-500">
        <span>{fuvar.teljesites_datuma || "—"}</span>
        <span>{jarmu}</span>
      </div>
      {fuvar.osszesen != null && (
        <p className="mt-1 font-semibold text-ink-600 dark:text-ink-300">
          {Number(fuvar.osszesen).toLocaleString("hu-HU")} Ft
        </p>
      )}
    </div>
  );
}
