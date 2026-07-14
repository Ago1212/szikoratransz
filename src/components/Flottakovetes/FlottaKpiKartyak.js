import React from "react";
import {
  PiTruckLight,
  PiNavigationArrowLight,
  PiPauseCircleLight,
  PiWifiSlashLight,
  PiGaugeLight,
  PiGasPumpLight,
} from "react-icons/pi";

const KpiKartya = React.memo(function KpiKartya({
  icon: Icon,
  label,
  value,
  masodlagos,
  accentClass,
}) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg">
      <span
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ease-fluid group-hover:scale-105 ${accentClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold leading-tight tabular-nums text-brand-900">
          {value}
        </p>
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          {label}
        </p>
        {masodlagos && (
          <p className="truncate text-xs text-ink-500">{masodlagos}</p>
        )}
      </div>
    </div>
  );
});

// A 6 KPI mindegyike a ténylegesen visszakapott GPSmart-mezőkből (sebesség,
// üzemanyag %, utolsó jelzés időbélyege) számolható — nincs köztük olyan,
// ami sofőr-, akkumulátor- vagy riasztás-adatot igényelne, amit a jelenlegi
// integráció nem ad vissza (ld. gpsmartHelpers.js fejléc-kommentje).
export default function FlottaKpiKartyak({ dusitett }) {
  const osszesen = dusitett.length;
  const mozgasban = dusitett.filter((p) => p._allapot.kulcs === "mozgasban").length;
  const allo = dusitett.filter((p) => p._allapot.kulcs === "all").length;
  const offline = dusitett.filter((p) => p._allapot.kulcs === "offline").length;

  const mozgasbanSebessegek = dusitett
    .filter((p) => p._allapot.kulcs === "mozgasban" && p._sebessegSzam !== null)
    .map((p) => p._sebessegSzam);
  const atlagSebesseg = mozgasbanSebessegek.length
    ? Math.round(
        mozgasbanSebessegek.reduce((sum, v) => sum + v, 0) / mozgasbanSebessegek.length,
      )
    : null;

  const alacsonyUzemanyagSzam = dusitett.filter((p) => p._alacsonyUzemanyag).length;

  const kartyak = [
    {
      icon: PiTruckLight,
      label: "Aktív járművek",
      value: osszesen,
      accentClass: "bg-brand-50 text-brand-600",
    },
    {
      icon: PiNavigationArrowLight,
      label: "Mozgásban",
      value: mozgasban,
      accentClass: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: PiPauseCircleLight,
      label: "Álló",
      value: allo,
      accentClass: "bg-amber-50 text-amber-600",
    },
    {
      icon: PiWifiSlashLight,
      label: "Offline",
      value: offline,
      masodlagos: offline > 0 ? "30 percnél régebbi jelzés" : undefined,
      accentClass: "bg-red-50 text-red-600",
    },
    {
      icon: PiGaugeLight,
      label: "Átlagsebesség",
      value: atlagSebesseg !== null ? `${atlagSebesseg} km/h` : "—",
      masodlagos: "mozgásban lévők közt",
      accentClass: "bg-ink-100 text-ink-600",
    },
    {
      icon: PiGasPumpLight,
      label: "Alacsony üzemanyag",
      value: alacsonyUzemanyagSzam,
      masodlagos: "20% alatt, ahol van adat",
      accentClass: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {kartyak.map((k) => (
        <KpiKartya key={k.label} {...k} />
      ))}
    </div>
  );
}
