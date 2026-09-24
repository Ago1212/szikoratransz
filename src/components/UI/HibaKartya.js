import React from "react";
import { PiWarningCircleLight, PiArrowClockwiseLight } from "react-icons/pi";

export default function HibaKartya({ uzenet, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center" role="alert">
      <PiWarningCircleLight className="h-8 w-8 text-amber-600" />
      <p className="text-sm font-medium text-ink-800">{uzenet || "Nem sikerült betölteni az adatokat."}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 shadow-soft ring-1 ring-ink-100 active:bg-slate-50"
        >
          <PiArrowClockwiseLight className="h-4 w-4" />
          Újra
        </button>
      )}
    </div>
  );
}
