import React from "react";
import { PiFloppyDiskLight } from "react-icons/pi";
import Spinner from "components/UI/Spinner.js";

// A 3 "varázsló" kártya (kamion/pótkocsi/sofőr) mindegyike saját maga
// rajzolta ki ugyanazt a mentés-gombot + spinner-t.
export default function SaveButton({
  onClick,
  isSaving,
  savingLabel = "Mentés...",
  label = "Mentés",
  tone = "solid",
  className = "",
}) {
  const toneClass =
    tone === "light"
      ? "bg-white text-brand-700 hover:bg-brand-50"
      : "bg-brand-600 text-white hover:bg-brand-700";
  const spinnerClass =
    tone === "light"
      ? "h-4 w-4 border-2 border-brand-200 border-t-brand-600"
      : "h-4 w-4 border-2 border-white/30 border-t-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-soft transition-all duration-300 ease-fluid active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${toneClass} ${className}`}
    >
      {isSaving ? (
        <>
          <Spinner className={spinnerClass} wrapperClassName="" />
          {savingLabel}
        </>
      ) : (
        <>
          <PiFloppyDiskLight className="h-4 w-4" />
          {label}
        </>
      )}
    </button>
  );
}
