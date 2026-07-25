import React, { useState, useRef, useEffect } from "react";
import StatusBadge from "components/UI/StatusBadge.js";

const OPTIONS = [
  { value: "rogzitett", label: "Rögzítve", tone: "neutral" },
  { value: "szamlazasra_var", label: "Számlázásra vár", tone: "warning" },
  { value: "szamlazva", label: "Számlázva", tone: "info" },
  { value: "fizetesre_var", label: "Fizetésre vár", tone: "warning" },
  { value: "teljesitve", label: "Teljesítve", tone: "success" },
];

export default function StatusChangePopover({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-ink-100 bg-white p-1 shadow-soft-lg dark:border-ink-800 dark:bg-ink-900">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (o.value !== value) onChange(o.value);
              }}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-ink-800 ${
                o.value === value ? "text-brand-700 dark:text-brand-300" : "text-ink-600 dark:text-ink-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
