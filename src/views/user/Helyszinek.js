import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { PiMagnifyingGlassLight, PiMapPinLight, PiCaretRightLight, PiPlusLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";
import Spinner from "components/UI/Spinner.js";

// A sofőr is szerkesztheti/bővítheti a helyszíneket (név, megjegyzés,
// fotó/videó) — ez egy közös, eligazodást segítő tudásbázis, nem csak
// admin által feltöltött, kizárólag olvasható lista.
export default function Helyszinek() {
  const history = useHistory();
  const [helyszinek, setHelyszinek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [ujNev, setUjNev] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getHelyszinek", { id: user.admin });
    if (result?.success) setHelyszinek(result.helyszinek || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = helyszinek.filter((h) => {
    if (!search.trim()) return true;
    return (h.nev || "").toLowerCase().includes(search.trim().toLowerCase());
  });

  const handleCreate = async () => {
    if (!ujNev.trim()) return;
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const result = await fetchAction("newHelyszin", { admin: user.admin, nev: ujNev.trim() });
      if (result?.success) {
        toast.success("Helyszín rögzítve.");
        setUjNev("");
        setAdding(false);
        history.push("/user/helyszin-reszletek", { data: result.helyszin });
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader
        title="Helyszínek"
        back={false}
        action={
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600"
            aria-label="Új helyszín"
          >
            <PiPlusLight className="h-5 w-5" />
          </button>
        }
      />

      {adding && (
        <div className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-white p-3 shadow-soft focus-within:ring-2 focus-within:ring-brand-300">
          <input
            autoFocus
            value={ujNev}
            onChange={(e) => setUjNev(e.target.value)}
            placeholder="Új helyszín neve (pl. Solymár Tesco)"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 placeholder-ink-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !ujNev.trim()}
            className="flex-shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Mentés..." : "Létrehozás"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-300">
        <PiMagnifyingGlassLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Név keresése"
          className="w-full bg-transparent text-sm text-ink-900 placeholder-ink-300 focus:outline-none"
        />
      </div>

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-6 text-center text-sm text-ink-400 shadow-soft">
          Nincs a keresésnek megfelelő helyszín.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => history.push("/user/helyszin-reszletek", { data: h })}
              className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 text-left shadow-soft"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <PiMapPinLight className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink-900">{h.nev}</span>
              </span>
              <PiCaretRightLight className="h-4 w-4 flex-shrink-0 text-ink-300" />
            </button>
          ))}
          {!search.trim() && filtered.length <= 2 && (
            <p className="mt-2 text-center text-xs text-ink-400">
              Tipp: koppints a <PiPlusLight className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
              gombra új helyszín hozzáadásához.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
