import React, { useEffect, useState } from "react";
import { PiShieldCheckLight, PiCrownSimpleLight, PiPlusLight, PiTrashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import SaveButton from "components/UI/SaveButton.js";
import Spinner from "components/UI/Spinner.js";

const MODUL_LABEL = {
  kamionok: "Kamionok",
  potkocsik: "Pótkocsik",
  karbantartasok: "Karbantartások",
  soforok: "Sofőrök",
  bejelentesek: "Bejelentések",
  szabadsagok: "Szabadságok",
  ugyfelek: "Ügyfelek",
  naplo: "Napló",
  koltsegek: "Pénzforgalom",
  vezetesi_ido: "Vezetési idő",
};

// "Diszpécser" -> "diszpecser", "Raktáros / Logisztikus" -> "raktaros_logisztikus"
// — az admin csak egy megjelenítendő nevet ad meg, az azonosítót (amit a
// backend ténylegesen tárol az `admin.szerepkor` mezőben) ebből generáljuk.
const slugify = (str) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);

// Egyszerű, on-brand jelölőnégyzet — a projektben eddig sehol nem volt
// natív checkbox, csak select/input/textarea; itt egy 44×44px érintési
// zónába csomagolva (ld. a mobil audit érintési-célterület javaslatait),
// bár ez az oldal elsősorban asztali admin-használatra készült.
function Jelolo({ checked, onChange, disabled }) {
  return (
    <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-5 w-5 rounded border-ink-300 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

export default function Jogosultsagok() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [szerepkorok, setSzerepkorok] = useState([]);
  const [selected, setSelected] = useState("admin");
  const [jogosultsagok, setJogosultsagok] = useState([]);
  const [loadingSzerepkorok, setLoadingSzerepkorok] = useState(true);
  const [loadingJogosultsagok, setLoadingJogosultsagok] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ujNev, setUjNev] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadSzerepkorok = async () => {
    const result = await fetchAction("getSzerepkorok", { id: user.ceg_id });
    if (result?.success) {
      setSzerepkorok(result.szerepkorok || []);
    } else {
      toast.error(result?.message || "Szerepkörök betöltése sikertelen.");
    }
    setLoadingSzerepkorok(false);
  };

  useEffect(() => {
    loadSzerepkorok();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJogosultsagok = async (kulcs) => {
    if (kulcs === "admin") return;
    setLoadingJogosultsagok(true);
    const result = await fetchAction("getJogosultsagok", { ceg_id: user.ceg_id, szerepkor: kulcs, kerelmezo_id: user.id });
    if (result?.success) {
      setJogosultsagok(result.jogosultsagok || []);
    } else {
      toast.error(result?.message || "Jogosultságok betöltése sikertelen.");
    }
    setLoadingJogosultsagok(false);
  };

  useEffect(() => {
    loadJogosultsagok(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toggle = (modul, tipus) => {
    setJogosultsagok((prev) =>
      prev.map((row) => (row.modul === modul ? { ...row, [tipus]: row[tipus] === "I" ? "N" : "I" } : row))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await fetchAction("saveJogosultsagok", {
        ceg_id: user.ceg_id,
        szerepkor: selected,
        jogosultsagok,
        kerelmezo_id: user.id,
      });
      if (result?.success) {
        toast.success("Jogosultságok mentve.");
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSzerepkor = async () => {
    if (!ujNev.trim()) return;
    const kulcs = slugify(ujNev);
    if (!kulcs) {
      toast.error("Adj meg egy érvényes nevet (legalább egy betű vagy szám).");
      return;
    }
    setIsCreating(true);
    try {
      const result = await fetchAction("newSzerepkor", {
        ceg_id: user.ceg_id,
        kulcs,
        nev: ujNev.trim(),
        kerelmezo_id: user.id,
      });
      if (result?.success) {
        toast.success("Szerepkör létrehozva.");
        setUjNev("");
        setAdding(false);
        await loadSzerepkorok();
        setSelected(kulcs);
      } else {
        toast.error(result?.message || "Létrehozás sikertelen.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSzerepkor = async () => {
    const szerepkor = szerepkorok.find((s) => s.kulcs === selected);
    if (!szerepkor || !window.confirm(`Biztosan törlöd a(z) "${szerepkor.nev}" szerepkört?`)) return;
    setIsDeleting(true);
    try {
      const result = await fetchAction("deleteSzerepkor", { id: szerepkor.id, ceg_id: user.ceg_id, kerelmezo_id: user.id });
      if (result?.success) {
        toast.success("Szerepkör törölve.");
        setSelected("admin");
        await loadSzerepkorok();
      } else {
        toast.error(result?.message || "Törlés sikertelen.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedSzerepkor = szerepkorok.find((s) => s.kulcs === selected);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader eyebrow="Saját adatok" title="Jogosultságok" />

      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-500">
        Itt hozhatsz létre saját szerepköröket (pl. Diszpécser, Könyvelő), és állíthatod be
        szerepkörönként, hogy mely modulokhoz férhetnek hozzá, mit szerkeszthetnek és
        törölhetnek. Alapértelmezetten minden modul teljes hozzáférésű — csak azt kell
        kikapcsolni, amit korlátozni szeretnél.
      </p>

      {loadingSzerepkorok ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {szerepkorok.map((sz) => (
              <button
                key={sz.kulcs}
                type="button"
                onClick={() => setSelected(sz.kulcs)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors duration-150 ${
                  selected === sz.kulcs ? "bg-brand-600 text-white" : "border border-ink-100 bg-white text-ink-500 hover:bg-slate-100"
                }`}
              >
                {sz.nev}
              </button>
            ))}

            {adding ? (
              <div className="flex items-center gap-2 rounded-full border border-ink-100 bg-white px-2 py-1.5">
                <input
                  autoFocus
                  value={ujNev}
                  onChange={(e) => setUjNev(e.target.value)}
                  placeholder="Új szerepkör neve"
                  className="w-40 bg-transparent px-1.5 text-sm text-ink-900 placeholder-ink-300 focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSzerepkor()}
                />
                <button
                  type="button"
                  onClick={handleCreateSzerepkor}
                  disabled={isCreating || !ujNev.trim()}
                  className="flex-shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? "Mentés..." : "Létrehozás"}
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
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-dashed border-ink-200 px-4 py-2 text-xs font-bold text-ink-500 hover:border-brand-300 hover:text-brand-700"
              >
                <PiPlusLight className="h-4 w-4" />
                Új szerepkör
              </button>
            )}
          </div>

          {selected === "admin" ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <PiCrownSimpleLight className="h-5 w-5 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">
                Az <strong>Adminisztrátor</strong> szerepkör mindig teljes hozzáférésű — ez nem korlátozható és nem törölhető.
              </p>
            </div>
          ) : loadingJogosultsagok ? (
            <Spinner wrapperClassName="flex justify-center py-16" />
          ) : (
            <>
              <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-100">
                <div className="flex items-center justify-between gap-2.5 border-b border-ink-100 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <PiShieldCheckLight className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="font-display text-base font-semibold text-brand-900">
                      {selectedSzerepkor?.nev || selected} jogosultságai
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteSzerepkor}
                    disabled={isDeleting}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PiTrashLight className="h-4 w-4" />
                    Szerepkör törlése
                  </button>
                </div>

                {/* Mobil nézet — kártyák modulonként */}
                <div className="divide-y divide-ink-100 md:hidden">
                  {jogosultsagok.map((row) => (
                    <div key={row.modul} className="px-5 py-4">
                      <p className="mb-2.5 text-sm font-bold text-ink-900">{MODUL_LABEL[row.modul] || row.modul}</p>
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <label className="flex items-center gap-2 text-sm text-ink-600">
                          <input
                            type="checkbox"
                            checked={row.hozzaferes === "I"}
                            onChange={() => toggle(row.modul, "hozzaferes")}
                            className="h-5 w-5 rounded border-ink-300 accent-brand-600"
                          />
                          Hozzáférés
                        </label>
                        {row.szerkesztes !== null && (
                          <label className="flex items-center gap-2 text-sm text-ink-600">
                            <input
                              type="checkbox"
                              checked={row.szerkesztes === "I"}
                              onChange={() => toggle(row.modul, "szerkesztes")}
                              className="h-5 w-5 rounded border-ink-300 accent-brand-600"
                            />
                            Szerkesztés
                          </label>
                        )}
                        {row.torles !== null && (
                          <label className="flex items-center gap-2 text-sm text-ink-600">
                            <input
                              type="checkbox"
                              checked={row.torles === "I"}
                              onChange={() => toggle(row.modul, "torles")}
                              className="h-5 w-5 rounded border-ink-300 accent-brand-600"
                            />
                            Törlés
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Asztali nézet — táblázat */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          Modul
                        </th>
                        <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          Hozzáférés
                        </th>
                        <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          Szerkesztés
                        </th>
                        <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          Törlés
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {jogosultsagok.map((row) => (
                        <tr key={row.modul} className="border-t border-ink-100">
                          <td className="px-5 py-2.5 text-sm font-semibold text-ink-900">
                            {MODUL_LABEL[row.modul] || row.modul}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            <Jelolo checked={row.hozzaferes === "I"} onChange={() => toggle(row.modul, "hozzaferes")} />
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            {row.szerkesztes !== null ? (
                              <Jelolo checked={row.szerkesztes === "I"} onChange={() => toggle(row.modul, "szerkesztes")} />
                            ) : (
                              <span className="text-ink-200">—</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            {row.torles !== null ? (
                              <Jelolo checked={row.torles === "I"} onChange={() => toggle(row.modul, "torles")} />
                            ) : (
                              <span className="text-ink-200">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <SaveButton onClick={handleSave} isSaving={isSaving} label="Jogosultságok mentése" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
