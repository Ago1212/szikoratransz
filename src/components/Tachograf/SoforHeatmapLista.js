import React, { useMemo } from "react";
import { szintOsztaly, oraPercSzoveg, epitsNapiCellak, SZINTEK } from "components/Tachograf/Heatmap.js";

const NAPOK_SZAMA = 28;

// A "Vezetési idő, elmúlt 4 hét" panel — külön kártya marad a megfelelőségi
// listától (felhasználói visszajelzés: tetszett, hogy a kettő vizuálisan
// elkülönül), soronként, sofőrönként külön sávval.
//
// Fontos UI-részlet: minden sofőr sora korábban egy ÖNÁLLÓ, egymástól
// független `flex` konténer volt (a `Heatmap` komponens saját flex-1
// cellákkal) — ezért a 28 cella szélessége soronként KÜLÖN számolódott,
// és a böngésző a törtpixeles (`flex: 1 1 0%`) szélesség-elosztást soronként
// kicsit másképp kerekítette, ami miatt az oszlopok (napok) vizuálisan nem
// voltak pontosan egy vonalban a sorok közt (élő felhasználói visszajelzés
// alapján javítva). A fix: EGYETLEN, közös CSS Grid (`repeat(28, 1fr)`) az
// egész listára — az oszlop-szélesség egyszer számolódik, minden sofőr
// cellája ugyanabba a rácsba kerül, ezért garantáltan egy vonalban vannak.
export default function SoforHeatmapLista({ soforok, napiSorok }) {
  const soforSorokTerkep = useMemo(() => {
    const map = {};
    (napiSorok || []).forEach((s) => {
      if (!map[s.sofor_id]) map[s.sofor_id] = [];
      map[s.sofor_id].push(s);
    });
    return map;
  }, [napiSorok]);

  if (!soforok || soforok.length === 0) {
    return <p className="text-sm text-ink-400 dark:text-ink-500">Nincs még rögzített sofőr.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1.5 text-[11px] text-ink-400 dark:text-ink-500">
        <span>Kevesebb</span>
        {SZINTEK.map((sz) => (
          <span key={sz.cls} className={`h-2.5 w-2.5 flex-shrink-0 rounded-[3px] ${sz.cls}`} />
        ))}
        <span>Több</span>
      </div>
      <div className="grid gap-y-1.5 gap-x-1" style={{ gridTemplateColumns: `repeat(${NAPOK_SZAMA}, minmax(0, 1fr))` }}>
        {soforok.map((s, soforIndex) => {
          const cellak = epitsNapiCellak(soforSorokTerkep[s.sofor_id] || [], NAPOK_SZAMA);
          return (
            <React.Fragment key={s.sofor_id}>
              {soforIndex > 0 && (
                <div className="my-1 h-px bg-ink-100 dark:bg-ink-800" style={{ gridColumn: `1 / -1` }} />
              )}
              {cellak.map((c) => (
                <div
                  key={c.datum}
                  title={`${s.nev} — ${c.datum} — ${c.perc != null ? oraPercSzoveg(c.perc) : "nincs adat"}`}
                  className={`h-5 rounded-[4px] transition-shadow duration-100 ${szintOsztaly(c.perc)} hover:ring-2 hover:ring-brand-400 dark:hover:ring-brand-300`}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
