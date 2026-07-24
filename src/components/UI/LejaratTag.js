import React from "react";

// UX-audit — a jármű-adatlapok (Kamion/Furgon/Pótkocsi) "Lejárati dátumok"
// szekciójában minden dátummező vizuálisan egyforma súlyú volt, függetlenül
// attól, hogy egy lejárat holnap vagy 3 év múlva esedékes — a Dashboard
// "Mire figyeljek ma" kártyája viszont már ugyanerre az adatra egy
// piros (lejárt) / borostyán (≤7 nap) sürgősségi jelölést használ. Ugyanaz
// a küszöb itt is, csak a mezőcímke mellett egy kis jelvényként, hogy a két
// felület ne mondjon vizuálisan ellent egymásnak.
export default function LejaratTag({ date }) {
  if (!date) return null;
  const napok = Math.floor(
    (new Date(`${date}T00:00:00`) - new Date(new Date().toDateString())) / 86400000
  );
  if (Number.isNaN(napok) || napok > 30) return null;

  const tone =
    napok < 0
      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  const label = napok < 0 ? "Lejárt" : napok === 0 ? "Ma jár le" : `${napok} nap múlva`;

  return <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone}`}>{label}</span>;
}
