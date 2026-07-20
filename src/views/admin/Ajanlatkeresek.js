import React, { useCallback, useEffect, useState } from "react";
import { PiEnvelopeSimpleLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

// R01 (fejlesztési audit, 2026-07-19): a nyilvános Landing oldal ajánlatkérő/
// jelentkező űrlapjaiból (QuoteForm.js) beérkező leadek eddig kizárólag
// e-mailben landoltak — a backend (getAjanlatkeresek/updateAjanlatkeresStatusz,
// ADMIN_ONLY_ACTIONS) már audit során elkészült, csak felület nem fogyasztotta.
// Egy törölt/félreolvasott e-mail eddig nyomtalanul elveszthetett egy leadet.
const PAGE_SIZE = 15;

const TIPUS_LABEL = { ajanlatkeres: "Ajánlatkérés", jelentkezes: "Jelentkezés" };
const TIPUS_TONE = { ajanlatkeres: "info", jelentkezes: "success" };

const STATUSZ_LABEL = { uj: "Új", felvette: "Felvette", lezart: "Lezárva" };
const STATUSZ_TONE = { uj: "warning", felvette: "info", lezart: "neutral" };
const STATUSZ_OPTIONS = ["uj", "felvette", "lezart"];

export default function Ajanlatkeresek() {
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [frissitesAlatt, setFrissitesAlatt] = useState(null);

  const betoltes = useCallback(() => {
    setLoading(true);
    fetchAction("getAjanlatkeresek", {})
      .then((result) => {
        setSorok(result?.success ? result.ajanlatkeresek || [] : []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    betoltes();
  }, [betoltes]);

  const handleStatuszValt = async (id, statusz) => {
    setFrissitesAlatt(id);
    // Optimista UI-frissítés — a lista ne villanjon egy teljes újratöltéssel,
    // csak az érintett sor státusza váltson azonnal; hiba esetén visszaáll.
    const elozoSorok = sorok;
    setSorok((prev) => prev.map((s) => (s.id === id ? { ...s, statusz } : s)));
    const result = await fetchAction("updateAjanlatkeresStatusz", { id, statusz });
    if (!result?.success) {
      setSorok(elozoSorok);
    }
    setFrissitesAlatt(null);
  };

  const columns = [
    {
      key: "beerkezett",
      label: "Beérkezett",
      render: (row) => new Date(row.beerkezett).toLocaleString("hu-HU"),
      exportValue: (row) => row.beerkezett,
    },
    {
      key: "tipus",
      label: "Típus",
      render: (row) => (
        <StatusBadge tone={TIPUS_TONE[row.tipus] || "neutral"}>
          {TIPUS_LABEL[row.tipus] || row.tipus}
        </StatusBadge>
      ),
      exportValue: (row) => TIPUS_LABEL[row.tipus] || row.tipus,
    },
    { key: "nev", label: "Név", className: "font-semibold text-brand-900 dark:text-ink-50" },
    {
      key: "elerhetoseg",
      label: "Elérhetőség",
      render: (row) => (
        <div className="whitespace-normal">
          <div>{row.email}</div>
          {row.telefon && <div className="text-ink-400 dark:text-ink-500">{row.telefon}</div>}
        </div>
      ),
      exportValue: (row) => [row.email, row.telefon].filter(Boolean).join(" · "),
    },
    {
      key: "uzenet",
      label: "Üzenet",
      render: (row) => (
        <span className="line-clamp-2 block max-w-md whitespace-normal" title={row.uzenet || ""}>
          {row.uzenet || "—"}
        </span>
      ),
      mobileHidden: false,
    },
    {
      key: "statusz",
      label: "Státusz",
      render: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge tone={STATUSZ_TONE[row.statusz] || "neutral"}>
            {STATUSZ_LABEL[row.statusz] || row.statusz}
          </StatusBadge>
          <select
            value={row.statusz}
            disabled={frissitesAlatt === row.id}
            onChange={(e) => handleStatuszValt(row.id, e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
          >
            {STATUSZ_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {STATUSZ_LABEL[opt]}
              </option>
            ))}
          </select>
        </div>
      ),
      exportValue: (row) => STATUSZ_LABEL[row.statusz] || row.statusz,
    },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Rendszer" title="Ajánlatkérések" />
      </div>
      <div className="min-h-0 flex-1">
        <DataTable
          icon={PiEnvelopeSimpleLight}
          title="Beérkezett érdeklődések"
          columns={columns}
          rows={sorok}
          loading={loading}
          exportFilename="ajanlatkeresek"
          mobileTitleKey="nev"
          emptyLabel="Még nem érkezett ajánlatkérés vagy jelentkezés"
          fill
          searchable
          searchPlaceholder="Keresés név, email, üzenet szerint..."
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}
