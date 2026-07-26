import React, { useState, useEffect, useCallback } from "react";
import {
  PiCoinsLight,
  PiWarningCircleLight,
  PiClockCountdownLight,
  PiChartLineUpLight,
  PiTrendDownLight,
  PiGasPumpLight,
  PiUsersLight,
  PiTruckLight,
  PiBuildingsLight,
  PiCalendarBlankLight,
} from "react-icons/pi";
import CardStats from "components/Cards/CardStats.js";
import { fetchAction } from "utils/fetchAction";

const forint = (ertek) => (ertek != null ? `${Number(ertek).toLocaleString("hu-HU")} Ft` : "—");

const HAVI_NEV = [
  "jan", "feb", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec",
];
const haviCimke = (honap) => {
  const [ev, ho] = honap.split("-");
  return `${HAVI_NEV[parseInt(ho, 10) - 1]} ${ev}`;
};

// Egyszerű, nem lapozott/rendezett táblázat-szekció a 4 bontáshoz — ezek
// összesítő nézetek, nem a Fuvarok lista helyettesítői (az már megvan,
// saját kereséssel/rendezéssel), ezért itt tudatosan nem a megosztott
// DataTable-t hozzuk be újra.
function Szekcio({ cim, icon: Icon, oszlopok, sorok, ures }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-800 dark:text-ink-100">
        {Icon && <Icon className="h-4 w-4 text-brand-600" />}
        {cim}
      </h3>
      {sorok.length === 0 ? (
        <p className="text-sm text-ink-400 dark:text-ink-500">{ures}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
                {oszlopok.map((o) => (
                  <th key={o.key} className={`px-2 py-1.5 ${o.align === "right" ? "text-right" : ""}`}>
                    {o.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorok.map((sor, i) => (
                <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                  {oszlopok.map((o) => (
                    <td
                      key={o.key}
                      className={`px-2 py-1.5 text-ink-700 dark:text-ink-200 ${o.align === "right" ? "text-right tabular-nums" : ""}`}
                    >
                      {o.render ? o.render(sor) : sor[o.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function StatisztikaDashboard() {
  const [adatok, setAdatok] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getFuvarStatisztikak", { ceg_id: user.ceg_id });
    setAdatok(result?.success ? result : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="py-6 text-center text-sm text-ink-400 dark:text-ink-500">Betöltés...</p>;
  }
  if (!adatok) {
    return <p className="py-6 text-center text-sm text-ink-400 dark:text-ink-500">A statisztikák betöltése sikertelen.</p>;
  }

  const p = adatok.penzugyiDashboard;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CardStats
          layout="row"
          tone={p.kintlevoseg > 0 ? "warning" : "neutral"}
          statIcon={PiCoinsLight}
          statTitle={forint(p.kintlevoseg)}
          statSubtitle="Kintlévőség"
        />
        <CardStats
          layout="row"
          tone={p.lejartSzamlakSzama > 0 ? "danger" : "neutral"}
          statIcon={PiWarningCircleLight}
          statTitle={p.lejartSzamlakSzama}
          statSubtitle="Lejárt fizetési határidő"
        />
        <CardStats
          layout="row"
          tone="neutral"
          statIcon={PiClockCountdownLight}
          statTitle={p.fizetesreVarokSzama}
          statSubtitle="Fizetésre vár"
        />
        <CardStats
          layout="row"
          tone="positive"
          statIcon={PiChartLineUpLight}
          statTitle={forint(p.varhatoBevetel)}
          statSubtitle="Várható bevétel"
        />
      </div>

      {adatok.fuvarozasiProfit.honap && (
        <div>
          <p className="mb-2 text-xs text-ink-400 dark:text-ink-500">
            Fuvarozási profit ({haviCimke(adatok.fuvarozasiProfit.honap)}) — csak a
            fuvarokból számított bevétel/kiadás, nem egyezik meg a Pénzforgalom fő Nettó
            eredményével.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CardStats
              layout="row"
              tone="neutral"
              statIcon={PiCoinsLight}
              statTitle={forint(adatok.fuvarozasiProfit.bevetel)}
              statSubtitle="Bevétel (fuvarokból)"
            />
            <CardStats
              layout="row"
              tone="neutral"
              statIcon={PiGasPumpLight}
              statTitle={forint(adatok.fuvarozasiProfit.kiadas)}
              statSubtitle="Kiadás (üzemanyag+útdíj+bér)"
            />
            <CardStats
              layout="row"
              tone={adatok.fuvarozasiProfit.profit >= 0 ? "positive" : "danger"}
              statIcon={adatok.fuvarozasiProfit.profit >= 0 ? PiChartLineUpLight : PiTrendDownLight}
              statTitle={forint(adatok.fuvarozasiProfit.profit)}
              statSubtitle="Profit"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Szekcio
          cim="Sofőr statisztika"
          icon={PiUsersLight}
          ures="Nincs sofőrhöz rendelt fuvar."
          oszlopok={[
            { key: "nev", label: "Sofőr" },
            { key: "fuvarokSzama", label: "Fuvarok", align: "right" },
            { key: "kmOsszesen", label: "Km", align: "right" },
            { key: "bevetelOsszesen", label: "Bevétel", align: "right", render: (s) => forint(s.bevetelOsszesen) },
            { key: "atlagFuvardij", label: "Átlag díj", align: "right", render: (s) => forint(s.atlagFuvardij) },
          ]}
          sorok={adatok.soforStatisztika}
        />
        <Szekcio
          cim="Jármű statisztika"
          icon={PiTruckLight}
          ures="Nincs járműhöz rendelt fuvar."
          oszlopok={[
            { key: "rendszam", label: "Rendszám" },
            { key: "fuvarokSzama", label: "Fuvarok", align: "right" },
            { key: "kmOsszesen", label: "Km", align: "right" },
            { key: "bevetelOsszesen", label: "Bevétel", align: "right", render: (s) => forint(s.bevetelOsszesen) },
            { key: "bevetelPerKm", label: "Ft/km", align: "right", render: (s) => (s.bevetelPerKm != null ? forint(s.bevetelPerKm) : "—") },
          ]}
          sorok={adatok.jarmuStatisztika}
        />
        <Szekcio
          cim="Megbízó statisztika"
          icon={PiBuildingsLight}
          ures="Nincs megbízóhoz rendelt fuvar."
          oszlopok={[
            { key: "nev", label: "Megbízó" },
            { key: "fuvarokSzama", label: "Fuvarok", align: "right" },
            { key: "arbevetel", label: "Árbevétel", align: "right", render: (s) => forint(s.arbevetel) },
            {
              key: "lejartSzamlakSzama",
              label: "Lejárt számla",
              align: "right",
              render: (s) => (s.lejartSzamlakSzama > 0 ? <span className="font-bold text-red-600 dark:text-red-400">{s.lejartSzamlakSzama}</span> : "—"),
            },
          ]}
          sorok={adatok.megbizoStatisztika}
        />
        <Szekcio
          cim="Havi alakulás (utolsó 12 hónap)"
          icon={PiCalendarBlankLight}
          ures="Nincs teljesített fuvar."
          oszlopok={[
            { key: "honap", label: "Hónap", render: (s) => haviCimke(s.honap) },
            { key: "fuvarokSzama", label: "Fuvarok", align: "right" },
            { key: "bevetelOsszesen", label: "Bevétel", align: "right", render: (s) => forint(s.bevetelOsszesen) },
            { key: "kiadasOsszesen", label: "Kiadás", align: "right", render: (s) => forint(s.kiadasOsszesen) },
            {
              key: "profit",
              label: "Profit",
              align: "right",
              render: (s) => (
                <span className={s.profit < 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                  {forint(s.profit)}
                </span>
              ),
            },
            { key: "atlagNapiProfit", label: "Átlag napi profit", align: "right", render: (s) => forint(s.atlagNapiProfit) },
            { key: "atlagFuvardij", label: "Átlag díj", align: "right", render: (s) => forint(s.atlagFuvardij) },
            { key: "atlagKmPerFuvar", label: "Átlag km/fuvar", align: "right" },
          ]}
          sorok={adatok.haviStatisztika}
        />
      </div>
    </div>
  );
}
