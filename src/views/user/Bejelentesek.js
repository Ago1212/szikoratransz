import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PiWarningCircleLight, PiChatCircleTextLight, PiPaperPlaneRightLight, PiPlusLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { useListaElemek } from "utils/useListaElemek.js";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";
import HibaKartya from "components/UI/HibaKartya.js";
import { toast } from "utils/toast";
import { formatDatumIdo } from "utils/formatDatum";

const STATUSZ_TONE = { uj: "info", folyamatban: "warning", lezart: "success" };
const STATUSZ_LABEL = { uj: "Új", folyamatban: "Folyamatban", lezart: "Lezárva" };

// Valódi, backenddel rendelkező üzenetfolyam a bejelentéshez — korábban az
// admin-oldali CardBejelentesek.js egy sosem működött mock-verziót
// rajzolt ki erre, a sofőr-oldalon meg egyáltalán nem volt semmilyen
// beszélet-UI, csak az egyszeri `admin_valasz` mező (ami marad, ez alatta
// egy tényleges, kétirányú beszélgetés). Csak akkor tölt üzenetet, ha a
// sofőr ténylegesen kinyitja — nem minden kártyához előre, feleslegesen.
function BejelentesUzenetek({ bejelentesId }) {
  const [nyitva, setNyitva] = useState(false);
  const [uzenetek, setUzenetek] = useState([]);
  const [ujUzenet, setUjUzenet] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const betolt = async () => {
    setLoading(true);
    const result = await fetchAction("getMessages", { bejelentes_id: bejelentesId });
    if (result?.success) setUzenetek(result.uzenetek || []);
    setLoading(false);
  };

  const handleToggle = () => {
    const ujAllapot = !nyitva;
    setNyitva(ujAllapot);
    if (ujAllapot) betolt();
  };

  const handleKuldes = async () => {
    if (!ujUzenet.trim()) return;
    setSending(true);
    try {
      const result = await fetchAction("sendMessage", { bejelentes_id: bejelentesId, szoveg: ujUzenet.trim() });
      if (result?.success) {
        setUjUzenet("");
        await betolt();
      } else {
        toast.error(result?.message || "Az üzenet küldése sikertelen. Próbáld újra.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 border-t border-ink-100 pt-2">
      <button
        type="button"
        onClick={handleToggle}
        className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-600"
      >
        <PiChatCircleTextLight className="h-4 w-4" />
        {nyitva ? "Üzenetek elrejtése" : "Üzenetek"}
      </button>

      {nyitva && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl bg-slate-50 p-2.5">
          {loading ? (
            <Spinner wrapperClassName="flex justify-center py-3" />
          ) : uzenetek.length === 0 ? (
            <p className="py-2 text-center text-xs text-ink-400">Még nincs üzenet.</p>
          ) : (
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {uzenetek.map((u) => (
                <div
                  key={u.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    u.szerzo_tipus === "sofor" ? "self-end bg-brand-600 text-white" : "self-start bg-white text-ink-700 shadow-soft"
                  }`}
                >
                  <p className={`mb-0.5 text-xs font-semibold ${u.szerzo_tipus === "sofor" ? "text-brand-100" : "text-ink-500"}`}>
                    {u.szerzo_nev} · {formatDatumIdo(u.letrehozva)}
                  </p>
                  <p className="whitespace-pre-wrap">{u.szoveg}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <textarea
              value={ujUzenet}
              onChange={(e) => setUjUzenet(e.target.value)}
              rows={Math.min(5, Math.max(2, ujUzenet.split("\n").length))}
              placeholder="Írj üzenetet..."
              className="min-h-11 flex-1 resize-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="button"
              onClick={handleKuldes}
              disabled={sending || !ujUzenet.trim()}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Üzenet küldése"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <PiPaperPlaneRightLight className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Bejelentesek() {
  const [bejelentesek, setBejelentesek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hiba, setHiba] = useState(null);
  const { elemek: tipusok } = useListaElemek("bejelentes_tipus");

  const betolt = useCallback(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    setLoading(true);
    setHiba(null);
    fetchAction("getBejelentesekSofor", { sofor_id: user.id }).then((result) => {
      if (result?.success) setBejelentesek(result.bejelentesek || []);
      else setHiba(result?.message || "Nem sikerült betölteni a bejelentéseidet.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    betolt();
  }, [betolt]);

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader
        title="Bejelentéseim"
        action={
          <Link
            to="/user/bejelentes/uj"
            className="flex min-h-11 items-center gap-1 rounded-full bg-red-600 px-3.5 text-sm font-semibold text-white active:bg-red-700"
          >
            <PiPlusLight className="h-4 w-4" /> Új
          </Link>
        }
      />

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : hiba ? (
        <HibaKartya uzenet={hiba} onRetry={betolt} />
      ) : bejelentesek.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiWarningCircleLight className="h-8 w-8 text-ink-400" />
          <p className="text-sm text-ink-500">Még nem küldtél bejelentést.</p>
          <Link to="/user/bejelentes/uj" className="flex min-h-11 items-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white">
            Új bejelentés
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bejelentesek.map((b) => (
            <div key={b.id} className="rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{b.cim}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {[
                      (tipusok.find((t) => t.kulcs === b.tipus)?.nev || b.tipus) !== b.cim
                        ? tipusok.find((t) => t.kulcs === b.tipus)?.nev || b.tipus
                        : null,
                      b.kamion_rendszam,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {b.admin_valasz && (
                    <StatusBadge tone="success">Válaszolt</StatusBadge>
                  )}
                  <StatusBadge tone={STATUSZ_TONE[b.statusz] || "neutral"}>
                    {STATUSZ_LABEL[b.statusz] || b.statusz}
                  </StatusBadge>
                </div>
              </div>
              {b.leiras && b.leiras !== b.cim && <p className="mt-2 text-sm text-ink-700">{b.leiras}</p>}
              <div className="mt-2">
                <span className="text-sm text-ink-500">{formatDatumIdo(b.bejelentve)}</span>
              </div>
              {b.admin_valasz && (
                <div className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm text-ink-700">
                  <span className="font-semibold text-emerald-700">Válasz: </span>
                  {b.admin_valasz}
                </div>
              )}
              <BejelentesUzenetek bejelentesId={b.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
