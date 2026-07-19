import React from "react";
import {
  PiTruckLight,
  PiVanLight,
  PiNavigationArrowLight,
  PiClockCounterClockwiseLight,
  PiCrosshairSimpleLight,
  PiMapPinLight,
  PiGaugeLight,
  PiRoadHorizonLight,
  PiXLight,
  PiUserLight,
} from "react-icons/pi";
import { GradientCardHeader } from "components/UI/PageCard.js";
import StatusBadge from "components/UI/StatusBadge.js";
import { formatKm } from "utils/gpsmartHelpers.js";

function Mezo({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 dark:bg-ink-800">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{value}</p>
      </div>
    </div>
  );
}

// A kiválasztott jármű részletei — asztalon (xl+) egy állandó jobb oldali
// panelként, kisebb képernyőn a hívó oldal (Flottakovetes.js) egy Modal-
// ban jeleníti meg ugyanezt a tartalmat (`kompakt` prop: nincs saját
// kártya-fejléc/keret, mert azt már a Modal adja).
//
// Az "Előzmények" gomb a `waybill.pl` GPSmart-végpontra épülő valódi
// útvonal-előzményt nyitja meg (ld. ElozmenyekModal.js) — ehhez a jármű
// GPSmart saját `car_id`-je kell, amit a `lekerdezPoziciok()` válasz már
// tartalmaz.
export default function JarmuReszletek({
  jarmu,
  kompakt = false,
  kovetesEnabled,
  onKovetesToggle,
  onElozmenyekOpen,
  onClose,
}) {
  const tartalom = !jarmu ? (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <PiTruckLight className="h-8 w-8 text-ink-200 dark:text-ink-700" />
      <p className="text-sm text-ink-400 dark:text-ink-500">
        Válassz egy járművet a listából vagy a térképről a részletekhez.
      </p>
    </div>
  ) : (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
          {jarmu.jarmu_tipus === "furgon" ? (
            <PiVanLight className="h-6 w-6" />
          ) : (
            <PiTruckLight className="h-6 w-6" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-brand-900 dark:text-ink-50">
            {jarmu.rendszam}
          </p>
          <StatusBadge tone={jarmu._allapot.tone}>{jarmu._allapot.label}</StatusBadge>
        </div>
      </div>

      {(jarmu.kamion_id || jarmu.furgon_id) && (
        <Mezo
          icon={PiUserLight}
          label="Jelenlegi sofőr"
          value={jarmu.sofor_nev || "Nincs hozzárendelve"}
        />
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Mezo icon={PiGaugeLight} label="Sebesség" value={jarmu.sebesseg || "—"} />
        <Mezo icon={PiRoadHorizonLight} label="Óraállás" value={jarmu.km || "nincs adat"} />
        <Mezo
          icon={PiRoadHorizonLight}
          label="Megtett út (ma)"
          value={jarmu.megtettUtMa != null ? `${formatKm(jarmu.megtettUtMa)} km` : "nincs adat"}
        />
      </div>

      <Mezo icon={PiMapPinLight} label="Cím" value={jarmu.cim || "—"} />
      <Mezo icon={PiGaugeLight} label="Utolsó frissítés" value={`${jarmu.idopont} (${jarmu._relativIdo})`} />

      {/* Előzmények — SZÁNDÉKOSAN önálló, kitöltött (brand) sorban, a
          Navigálás/Követés fölött, nem velük egyenrangú gombként — ez
          egy gyakran használt funkció, ami a korábbi 4-gombos 2×2
          rácsban vizuálisan elveszett (sőt, a panel korábban túl sok
          mezőt tartalmazott ahhoz, hogy a gombsor egyáltalán látszódjon
          görgetés nélkül — ld. a Pozíció/Irány mezők fenti eltávolítása). */}
      <button
        type="button"
        onClick={onElozmenyekOpen}
        disabled={!jarmu.car_id}
        title={!jarmu.car_id ? "Ehhez a járműhöz nincs GPSmart azonosító" : undefined}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 dark:disabled:bg-ink-800 dark:disabled:text-ink-600"
      >
        <PiClockCounterClockwiseLight className="h-4 w-4" />
        Előzmények
      </button>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={
            jarmu.lat != null && jarmu.lon != null
              ? `https://www.google.com/maps/dir/?api=1&destination=${jarmu.lat},${jarmu.lon}`
              : undefined
          }
          target="_blank"
          rel="noreferrer"
          aria-disabled={jarmu.lat == null}
          className={`flex items-center justify-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 shadow-soft transition-colors duration-200 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300 ${
            jarmu.lat == null ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <PiNavigationArrowLight className="h-4 w-4" />
          Navigálás
        </a>
        <button
          type="button"
          onClick={onKovetesToggle}
          aria-pressed={kovetesEnabled}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wide shadow-soft transition-colors duration-200 ${
            kovetesEnabled
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-ink-200 bg-white text-ink-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
          }`}
        >
          <PiCrosshairSimpleLight className="h-4 w-4" />
          Követés
        </button>
      </div>
    </div>
  );

  if (kompakt) {
    return tartalom;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800">
      <GradientCardHeader
        icon={PiTruckLight}
        title="Jármű részletei"
        action={
          jarmu && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Kiválasztás törlése"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 transition-colors duration-150 hover:bg-slate-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-100"
            >
              <PiXLight className="h-4 w-4" />
            </button>
          )
        }
      />
      {tartalom}
    </div>
  );
}
