import React, { useEffect, useState } from "react";
import { PiListBulletsLight, PiPlusLight, PiTrashLight, PiLockSimpleLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import Spinner from "components/UI/Spinner.js";

// Az öt lista-típus maga fix (ezek konkrét, kódban is kezelt mezőkhöz
// tartoznak — kamion.meret, kamion/potkocsi.allapot, stb.), csak az egyes
// típusokon BELÜLI elemek bővíthetők/nevezhetők át egyénileg cégenként.
const LISTA_TIPUSOK = [
  { tipus: "kamion_meret", nev: "Kamion méret" },
  { tipus: "furgon_meret", nev: "Furgon méret" },
  { tipus: "jarmu_allapot", nev: "Jármű állapota" },
  { tipus: "biztositas_utem", nev: "Biztosítás fizetési ütem" },
  { tipus: "bejelentes_tipus", nev: "Bejelentés típusa" },
  { tipus: "szabadsag_tipus", nev: "Szabadság típusa" },
];

// Csak a megjelenítendő nevet kéri az admin — a belső azonosítót (amit a
// tényleges adatrekordok, pl. egy kamion `meret` mezője tárolnak) ebből
// generáljuk, ugyanúgy, mint a Jogosultsagok.js szerepkör-létrehozásánál.
const slugify = (str) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);

export default function Listak() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [selected, setSelected] = useState(LISTA_TIPUSOK[0].tipus);
  const [elemek, setElemek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [ujNev, setUjNev] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const load = async (tipus) => {
    setLoading(true);
    const result = await fetchAction("getListaElemek", { id: user.ceg_id, tipus });
    if (result?.success) {
      setElemek(result.elemek || []);
    } else {
      toast.error(result?.message || "Betöltés sikertelen.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handleCreate = async () => {
    if (!ujNev.trim()) return;
    const kulcs = slugify(ujNev);
    if (!kulcs) {
      toast.error("Adj meg egy érvényes nevet.");
      return;
    }
    setIsCreating(true);
    try {
      const result = await fetchAction("newListaElem", {
        ceg_id: user.ceg_id,
        tipus: selected,
        kulcs,
        nev: ujNev.trim(),
        kerelmezo_id: user.id,
      });
      if (result?.success) {
        toast.success("Elem hozzáadva.");
        setUjNev("");
        setAdding(false);
        await load(selected);
      } else {
        toast.error(result?.message || "Létrehozás sikertelen.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (elem) => {
    if (!window.confirm(`Biztosan törlöd a(z) "${elem.nev}" elemet?`)) return;
    const result = await fetchAction("deleteListaElem", { id: elem.id, ceg_id: user.ceg_id, kerelmezo_id: user.id });
    if (result?.success) {
      toast.success("Elem törölve.");
      load(selected);
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const selectedTipus = LISTA_TIPUSOK.find((t) => t.tipus === selected);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader eyebrow="Saját adatok" title="Listák" />

      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-500">
        Itt bővítheted/nevezheted át a rendszer különböző választható listáit — pl. milyen
        kamionméretek, jármű-állapotok vagy bejelentés-típusok közül lehet választani a
        formokon. Egy elem törlése előtt győződj meg róla, hogy már semmi nem használja.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {LISTA_TIPUSOK.map((t) => (
          <button
            key={t.tipus}
            type="button"
            onClick={() => setSelected(t.tipus)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors duration-150 ${
              selected === t.tipus ? "bg-brand-600 text-white" : "border border-ink-100 bg-white text-ink-500 hover:bg-slate-100"
            }`}
          >
            {t.nev}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-100">
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-5 py-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <PiListBulletsLight className="h-[18px] w-[18px]" />
          </span>
          <h3 className="font-display text-base font-semibold text-brand-900">{selectedTipus?.nev} — elemek</h3>
        </div>

        {loading ? (
          <Spinner wrapperClassName="flex justify-center py-16" />
        ) : (
          <div className="divide-y divide-ink-100">
            {elemek.map((elem) => (
              <div key={elem.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{elem.nev}</p>
                </div>
                {elem.vedett === "I" ? (
                  <span
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1 text-[11px] font-bold text-ink-400"
                    title="Alapértelmezett elem, nem törölhető."
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
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={ujNev}
                    onChange={(e) => setUjNev(e.target.value)}
                    placeholder="Új elem neve"
                    className="min-w-0 flex-1 rounded-lg border border-ink-100 bg-slate-50 px-3 py-2 text-sm text-ink-900 placeholder-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating || !ujNev.trim()}
                    className="flex-shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreating ? "Mentés..." : "Hozzáadás"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
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
                  Új elem hozzáadása
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
