import React, { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { PiFilesLight, PiHardDrivesLight, PiClockCountdownLight, PiTagLight, PiCaretDownLight } from "react-icons/pi";
import CardStats from "components/Cards/CardStats.js";
import { formatFileSize, kategoriaInfo } from "components/Fajlok/fajlKategoriaInfo.js";

// 4 stat-kártya, kizárólag a `getFajlStatisztika` valós adatából (ld.
// filesInterface.php::getStatisztika()) — nincs Megosztás/Kedvenc kártya,
// mert azok a mezők ma nem léteznek (ld. audit + felhasználói döntés).
//
// UX-audit — a dashboard-blokk (ez + a felette/alatta lévő upload-sáv,
// keresés, kategória-chipek) mobilon jelentős "above the fold" magasságot
// foglalt, mielőtt egyetlen fájl is látszott volna. Mobilon (ugyanaz a
// media query-alapú minta, mint a Karbantartasok.js szűrő-panelje) alapból
// összecsukva indul, egy kompakt összegző sorral; asztalon változatlan.
export default function FajlDashboardStats({ statisztika }) {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [open, setOpen] = useState(!isMobile);

  if (!statisztika) return null;
  const leggyakoribb = statisztika.leggyakoribbKategoria ? kategoriaInfo(statisztika.leggyakoribbKategoria) : null;

  const grid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CardStats
        statSubtitle="Összes fájl"
        statTitle={statisztika.osszesFajl.toLocaleString("hu-HU")}
        statIcon={PiFilesLight}
        tone="brand"
        layout="row"
      />
      <CardStats
        statSubtitle="Teljes tárhely"
        statTitle={formatFileSize(statisztika.osszesMeret)}
        statIcon={PiHardDrivesLight}
        tone="neutral"
        layout="row"
      />
      <CardStats
        statSubtitle="Ez a hét"
        statTitle={`+${statisztika.ujAHeten}`}
        statCaption="új feltöltés"
        statIcon={PiClockCountdownLight}
        tone="positive"
        layout="row"
      />
      <CardStats
        statSubtitle="Leggyakoribb típus"
        statTitle={leggyakoribb ? leggyakoribb.label : "—"}
        statIcon={PiTagLight}
        tone="neutral"
        layout="row"
      />
    </div>
  );

  if (!isMobile) return grid;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm font-semibold text-brand-900 shadow-soft dark:border-ink-800 dark:bg-ink-900 dark:text-ink-50"
        aria-expanded={open}
      >
        <span>
          Statisztikák — {statisztika.osszesFajl.toLocaleString("hu-HU")} fájl, {formatFileSize(statisztika.osszesMeret)}
        </span>
        <PiCaretDownLight className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3">{grid}</div>}
    </div>
  );
}
