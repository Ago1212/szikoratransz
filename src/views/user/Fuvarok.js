import React, { useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { PiClipboardTextLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Spinner from "components/UI/Spinner.js";

function FuvarSor({ fuvar, onOpen }) {
  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam || "—";
  return (
    <button
      type="button"
      onClick={() => onOpen(fuvar)}
      className="flex w-full flex-col gap-1 rounded-2xl border border-ink-100 bg-white p-3.5 text-left shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">
          {fuvar.felrako || "—"} → {fuvar.lerako || "—"}
        </p>
        {fuvar.dokumentum_feltoltve ? (
          <StatusBadge tone="success">Dokumentum ✓</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Menetlevél hiányzik</StatusBadge>
        )}
      </div>
      <p className="text-xs text-ink-400">
        {fuvar.teljesites_datuma || "Nincs dátum"} · {jarmu}
        {fuvar.megbizo_nev ? ` · ${fuvar.megbizo_nev}` : ""}
      </p>
    </button>
  );
}

export default function Fuvarok() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
  const [ful, setFul] = useState("aktiv"); // "aktiv" | "lezart"
  const [fuvarok, setFuvarok] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAction("getSajatFuvarok", {
      sofor_id: user.id,
      aktivOnly: ful === "aktiv",
    });
    setFuvarok(result?.success ? result.fuvarok || [] : []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ful]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = (fuvar) => {
    history.push("/user/fuvarReszletek", { data: fuvar });
  };

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Fuvarjaim" back={false} />

      <div className="flex gap-2 rounded-full bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setFul("aktiv")}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            ful === "aktiv" ? "bg-white text-brand-700 shadow-soft" : "text-ink-500"
          }`}
        >
          Aktívak
        </button>
        <button
          type="button"
          onClick={() => setFul("lezart")}
          className={`flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            ful === "lezart" ? "bg-white text-brand-700 shadow-soft" : "text-ink-500"
          }`}
        >
          Lezártak
        </button>
      </div>

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : fuvarok.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <PiClipboardTextLight className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-400">
            {ful === "aktiv" ? "Nincs aktív fuvarod." : "Nincs lezárt fuvarod."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fuvarok.map((f) => (
            <FuvarSor key={f.id} fuvar={f} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
