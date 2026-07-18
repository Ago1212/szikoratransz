import React, { useEffect, useState } from "react";
import { PiCoinsLight, PiPlusLight, PiTrashLight, PiLockSimpleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import Spinner from "components/UI/Spinner.js";

// A devizák a Listák oldal (Listak.js) generikus, "gépeld be a nevet, mi
// szlugosítjuk kulccsá" mintájától SZÁNDÉKOSAN eltérő, önálló oldalt kapnak
// (ld. ListaInterface TIPUSOK 'deviza' bejegyzése — a backend action-ök
// ugyanazok, csak a felület más): egy deviza `kulcs`-a egy valódi ISO 4217
// kód (pl. "EUR") kell legyen, amit a Piaci árak/Pénzforgalom MNB-lekérdezése
// (piaciArakInterface.php getArfolyam()) nagybetűs kódként keres — egy
// szlugosított "euro" sosem találna árfolyamot. Ezért itt Kód+Név két külön,
// explicit mező, nem egyetlen névből generált kulcs.
export default function Devizak() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [elemek, setElemek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [ujKod, setUjKod] = useState("");
  const [ujNev, setUjNev] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await fetchAction("getListaElemek", { id: user.ceg_id, tipus: "deviza" });
    if (result?.success) {
      setElemek(result.elemek || []);
    } else {
      toast.error(result?.message || "Betöltés sikertelen.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const kod = ujKod.trim().toUpperCase();
    const nev = ujNev.trim();
    if (!/^[A-Z]{3}$/.test(kod)) {
      toast.error("A devizakód 3 nagybetűből álló ISO kód legyen (pl. EUR, USD, GBP).");
      return;
    }
    if (!nev) {
      toast.error("Adj meg egy megjelenítendő nevet.");
      return;
    }
    setIsCreating(true);
    try {
      const result = await fetchAction("newListaElem", {
        ceg_id: user.ceg_id,
        tipus: "deviza",
        kulcs: kod,
        nev,
        kerelmezo_id: user.id,
      });
      if (result?.success) {
        toast.success("Deviza hozzáadva.");
        setUjKod("");
        setUjNev("");
        setAdding(false);
        await load();
      } else {
        toast.error(result?.message || "Létrehozás sikertelen.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (elem) => {
    if (!window.confirm(`Biztosan törlöd a(z) "${elem.kulcs}" devizát?`)) return;
    const result = await fetchAction("deleteListaElem", { id: elem.id, ceg_id: user.ceg_id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Deviza törölve.");
      load();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader eyebrow="Pénzügyek" title="Devizák" />

      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-500">
        Itt kezelheted, mely devizák választhatók a Pénzforgalom tétel-felviteli űrlapján. A
        HUF (forint) mindig elérhető, alapértelmezett bázisdeviza. Devizás tétel rögzítésekor a
        rendszer az MNB aznapi hivatalos árfolyamán számítja át forintra az összeget.
      </p>

      <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-100">
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-5 py-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <PiCoinsLight className="h-[18px] w-[18px]" />
          </span>
          <h3 className="font-display text-base font-semibold text-brand-900">Devizák</h3>
        </div>

        {loading ? (
          <Spinner wrapperClassName="flex justify-center py-16" />
        ) : (
          <div className="divide-y divide-ink-100">
            {elemek.map((elem) => (
              <div key={elem.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {elem.kulcs}
                    <span className="ml-2 font-normal text-ink-500">{elem.nev}</span>
                  </p>
                </div>
                {elem.vedett === "I" ? (
                  <span
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1 text-[11px] font-bold text-ink-400"
                    title="Alapértelmezett bázisdeviza, nem törölhető."
                  >
                    <PiLockSimpleLight className="h-3.5 w-3.5" />
                    Alapértelmezett
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(elem)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Törlés"
                  >
                    <PiTrashLight className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}

            <div className="px-5 py-3">
              {adding ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    autoFocus
                    value={ujKod}
                    onChange={(e) => setUjKod(e.target.value.toUpperCase().slice(0, 3))}
                    placeholder="Kód (pl. GBP)"
                    maxLength={3}
                    className="w-28 min-w-0 flex-shrink-0 rounded-lg border border-ink-100 bg-slate-50 px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-900 placeholder-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                  <input
                    value={ujNev}
                    onChange={(e) => setUjNev(e.target.value)}
                    placeholder="Megnevezés (pl. Font sterling)"
                    className="min-w-0 flex-1 rounded-lg border border-ink-100 bg-slate-50 px-3 py-2 text-sm text-ink-900 placeholder-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating || !ujKod.trim() || !ujNev.trim()}
                    className="flex-shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreating ? "Mentés..." : "Hozzáadás"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setUjKod("");
                      setUjNev("");
                    }}
                    className="flex-shrink-0 px-1 text-xs font-semibold text-ink-400 hover:text-ink-700"
                  >
                    Mégse
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800"
                >
                  <PiPlusLight className="h-4 w-4" />
                  Új deviza hozzáadása
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
