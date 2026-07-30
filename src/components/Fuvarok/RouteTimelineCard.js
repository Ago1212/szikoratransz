import React from "react";
import { PiMapPinFill, PiPackageLight, PiMapTrifoldLight, PiBuildingsLight } from "react-icons/pi";

function Vegpont({ label, tone, adat }) {
  const toneClasses = tone === "felrako" ? "bg-brand-100 text-brand-600" : "bg-emerald-100 text-emerald-600";
  return (
    <div className="flex gap-3">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
        <PiMapPinFill className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
          <p className="flex-shrink-0 text-xs font-semibold text-ink-600">{adat.datum || "—"}</p>
        </div>
        <p className="mt-0.5 text-base font-bold text-ink-900">{adat.ceg || "—"}</p>
        {adat.cim && <p className="text-xs text-ink-400">{adat.cim}</p>}
      </div>
    </div>
  );
}

// Nagy, domináns "pickup → dropoff" kártya (Uber/Bolt Driver mintára) —
// felül a megbízó neve+címe (ha van), alatta felrakó/lerakó pont + a
// köztük futó szaggatott vonal középen a távolság-chippel, a kártya
// alján az áru megnevezése (bal) és a navigációs gomb (jobbra igazítva).
// A `felrako`/`lerako` prop alakja: { ceg, cim, datum } — mindhárom mező
// hiányozhat, "—"-ra esik vissza, sosem generálunk kitalált adatot.
export default function RouteTimelineCard({ felrako, lerako, tavolsagKm, aru, megbizoNev, megbizoCim, onUtvonalterv, eleheto }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
      {megbizoNev && (
        <div className="mb-4 flex items-center gap-2 border-b border-ink-100 pb-4 text-sm text-ink-600">
          <PiBuildingsLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <span>
            {megbizoNev}
            {megbizoCim ? ` (${megbizoCim})` : ""}
          </span>
        </div>
      )}
      <Vegpont label="Felrakás" tone="felrako" adat={felrako} />
      <div className="ml-[18px] flex h-10 items-center border-l-2 border-dashed border-ink-200 pl-5">
        {tavolsagKm ? (
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-ink-600">{tavolsagKm} km</span>
        ) : null}
      </div>
      <Vegpont label="Lerakás" tone="lerako" adat={lerako} />

      <div className="mt-4 flex items-center gap-3 border-t border-ink-100 pt-4">
        {aru && (
          <div className="flex min-w-0 items-center gap-2">
            <PiPackageLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
            <p className="truncate text-sm text-ink-700">{aru}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onUtvonalterv}
          disabled={!eleheto}
          aria-label="Útvonaltervezés indítása"
          className="ml-auto flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-ink-400"
        >
          <PiMapTrifoldLight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
