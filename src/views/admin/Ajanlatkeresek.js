import React, { useCallback, useEffect, useState } from "react";
import { PiEnvelopeSimpleLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Modal from "components/UI/Modal.js";

// R01 (fejlesztési audit, 2026-07-19): a nyilvános Landing oldal ajánlatkérő/
// jelentkező űrlapjaiból (QuoteForm.js) beérkező leadek eddig kizárólag
// e-mailben landoltak — a backend (getAjanlatkeresek/updateAjanlatkeresStatusz,
// ADMIN_ONLY_ACTIONS) már audit során elkészült, csak felület nem fogyasztotta.
// Egy törölt/félreolvasott e-mail eddig nyomtalanul elveszthetett egy leadet.
const PAGE_SIZE = 15;

const TIPUS_LABEL = { ajanlatkeres: "Ajánlatkérés", jelentkezes: "Jelentkezés" };
const TIPUS_TONE = { ajanlatkeres: "info", jelentkezes: "success" };

const STATUSZ_LABEL = { uj: "Új", felvette: "Felvette", lezart: "Lezárva" };
const STATUSZ_OPTIONS = ["uj", "felvette", "lezart"];
const STATUSZ_SELECT_CLASS = {
  uj: "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300",
  felvette: "border-sky-300 text-sky-800 dark:border-sky-700 dark:text-sky-300",
  lezart: "border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300",
};

export default function Ajanlatkeresek() {
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [frissitesAlatt, setFrissitesAlatt] = useState(null);
  // UX-audit — a "levágott" (line-clamp-2) üzenet mobilon (nincs hover a
  // `title` tooltiphez) és asztalon is csak részlegesen olvasható a
  // listában; ez a részletnézet a teljes szöveget mutatja meg.
  const [reszletSor, setReszletSor] = useState(null);

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
      // UX-audit — korábban a jelvény ÉS a select egyszerre, ugyanazt az
      // értéket mutatta egy cellában (vizuális zaj) — a select maga is
      // szemantikusan színezett (a STATUSZ_TONE-nal megegyező szegély/szín),
      // ez önmagában elég.
      render: (row) => (
        <select
          value={row.statusz}
          disabled={frissitesAlatt === row.id}
          onChange={(e) => {
            e.stopPropagation();
            handleStatuszValt(row.id, e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          className={`rounded-lg border bg-white px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50 dark:bg-ink-800 ${
            STATUSZ_SELECT_CLASS[row.statusz] || STATUSZ_SELECT_CLASS.lezart
          }`}
        >
          {STATUSZ_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {STATUSZ_LABEL[opt]}
            </option>
          ))}
        </select>
      ),
      exportValue: (row) => STATUSZ_LABEL[row.statusz] || row.statusz,
    },
  ];

  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Rendszer" title="Ajánlatkérések" />
      </div>
      <div className="min-h-0 flex-1">
        <DataTable
          icon={PiEnvelopeSimpleLight}
          title="Beérkezett érdeklődések"
          columns={columns}
          rows={sorok}
          onRowDoubleClick={setReszletSor}
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

      <Modal open={!!reszletSor} onClose={() => setReszletSor(null)} title={reszletSor?.nev || "Ajánlatkérés"}>
        {reszletSor && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={TIPUS_TONE[reszletSor.tipus] || "neutral"}>
                {TIPUS_LABEL[reszletSor.tipus] || reszletSor.tipus}
              </StatusBadge>
              <span className="text-ink-400 dark:text-ink-500">
                {new Date(reszletSor.beerkezett).toLocaleString("hu-HU")}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Elérhetőség</div>
              <div className="mt-1 text-ink-900 dark:text-ink-50">{reszletSor.email}</div>
              {reszletSor.telefon && <div className="text-ink-600 dark:text-ink-300">{reszletSor.telefon}</div>}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">Üzenet</div>
              <p className="mt-1 whitespace-pre-wrap text-ink-900 dark:text-ink-50">{reszletSor.uzenet || "—"}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
