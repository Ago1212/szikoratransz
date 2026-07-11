import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { PiChatCircleTextLight, PiTrashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

// Megosztott jegyzet-szál a Helyszínekhez — mind az admin (CardHelyszin.js),
// mind a sofőr oldal (HelyszinReszletek.js) ugyanezt a komponenst használja,
// hogy a "ki és mikor írta" megjelenítés egy helyen éljen.
export default function HelyszinMegjegyzesek({ helyszinId, szerzoTipus, szerzoId, szerzoNev }) {
  const [megjegyzesek, setMegjegyzesek] = useState([]);
  const [szoveg, setSzoveg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const result = await fetchAction("getHelyszinMegjegyzesek", { helyszin_id: helyszinId });
    if (result?.success) setMegjegyzesek(result.megjegyzesek || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helyszinId]);

  const handleAdd = async () => {
    if (!szoveg.trim()) return;
    setSaving(true);
    try {
      const result = await fetchAction("newHelyszinMegjegyzes", {
        helyszin_id: helyszinId,
        szerzo_tipus: szerzoTipus,
        szerzo_id: szerzoId,
        szerzo_nev: szerzoNev,
        szoveg: szoveg.trim(),
      });
      if (result?.success) {
        setSzoveg("");
        await load();
      } else {
        toast.error(result?.message || "Megjegyzés mentése sikertelen.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Biztosan törlöd ezt a megjegyzést?")) return;
    const result = await fetchAction("deleteHelyszinMegjegyzes", { id });
    if (result?.success) {
      await load();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const formatDate = (value) => {
    const d = new Date(value.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? value : format(d, "yyyy. MM. dd. HH:mm");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <textarea
          value={szoveg}
          onChange={(e) => setSzoveg(e.target.value)}
          placeholder="Új megjegyzés hozzáfűzése (pl. bejárati útvonal, rakodási tudnivaló)..."
          rows={3}
          className="w-full rounded-xl border border-ink-100 bg-slate-50 px-4 py-3 text-sm text-brand-900 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !szoveg.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PiChatCircleTextLight className="h-4 w-4" />
            {saving ? "Mentés..." : "Hozzáfűzés"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Betöltés...</p>
      ) : megjegyzesek.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-4 text-center text-sm text-ink-400">
          Még nincs megjegyzés ehhez a helyszínhez.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {megjegyzesek.map((m) => (
            <li key={m.id} className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-soft">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-ink-700">{m.szerzo_nev}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-400">{formatDate(m.letrehozva)}</span>
                  {String(m.szerzo_id) === String(szerzoId) && m.szerzo_tipus === szerzoTipus && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors duration-200 hover:bg-red-50 hover:text-red-600"
                      aria-label="Megjegyzés törlése"
                    >
                      <PiTrashLight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink-600">{m.szoveg}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
