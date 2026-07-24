import React, { useMemo } from "react";
import { szintOsztaly, oraPercSzoveg, epitsNapiCellak } from "components/Tachograf/Heatmap.js";

const NAPOK_SZAMA = 28;

// A sor-magasság ugyanaz a 56px (`ROW_HEIGHT_PX`), mint a `MegfelelosegiWidget.js`
// `h-14` sorai — a két kártya egymás mellett él, soronként párban olvasandó
// (a bal oldali N. sofőr-név ⇄ a jobb oldali N. heatmap-sáv), ezért a két
// panel sorainak vízszintesen pontosan egy vonalban kell lenniük (élő
// felhasználói visszajelzés alapján javítva — korábban a két panel egymástól
// függetlenül, eltérő logikával számolt sormagasságot használt).
const ROW_HEIGHT_PX = 56;
const DIVIDER_HEIGHT_PX = 1;

// A "Vezetési idő, elmúlt 4 hét" panel — külön kártya marad a megfelelőségi
// listától (felhasználói visszajelzés: tetszett, hogy a kettő vizuálisan
// elkülönül), soronként, sofőrönként külön sávval.
//
// A "Kevesebb → Több" jelmagyarázatot SZÁNDÉKOSAN nem ez a komponens
// jeleníti meg, hanem a szülő (Tachograf.js), a panel címsorába, jobbra
// igazítva — ha ez a komponens saját, önálló sorként rajzolná ki felül,
// az egy plusz sornyi magassággal eltolná a heatmap-rácsot a szomszédos
// "Kártya-letöltés esedékessége" panel listájához képest (élő felhasználói
// visszajelzés alapján javítva).
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
//
// A SOR-magasságot (nem csak az oszlop-szélességet) is a rács explicit
// `gridTemplateRows`-a adja (nem `gap`/`margin`), hogy pixel-pontosan
// illeszkedjen a bal oldali lista sormagasságához — ha ezt csak térközzel
// közelítenénk, a két, egymástól teljesen független komponens sosem
// egyezne pixel-pontosan.
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

  const gridTemplateRows = [
    `${ROW_HEIGHT_PX}px`,
    ...Array.from({ length: soforok.length - 1 }, () => `${DIVIDER_HEIGHT_PX}px ${ROW_HEIGHT_PX}px`),
  ].join(" ");

  return (
    <div
      className="grid gap-x-1"
      style={{ gridTemplateColumns: `repeat(${NAPOK_SZAMA}, minmax(0, 1fr))`, gridTemplateRows }}
    >
      {soforok.map((s, soforIndex) => {
        const cellak = epitsNapiCellak(soforSorokTerkep[s.sofor_id] || [], NAPOK_SZAMA);
        return (
          <React.Fragment key={s.sofor_id}>
            {soforIndex > 0 && <div className="bg-ink-100 dark:bg-ink-800" style={{ gridColumn: "1 / -1" }} />}
            {cellak.map((c) => (
              <div
                key={c.datum}
                title={`${s.nev} — ${c.datum} — ${c.perc != null ? oraPercSzoveg(c.perc) : "nincs adat"}`}
                className={`h-5 self-center rounded-[4px] transition-shadow duration-100 ${szintOsztaly(c.perc)} hover:ring-2 hover:ring-brand-400 dark:hover:ring-brand-300`}
              />
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
}
