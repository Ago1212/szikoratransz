import React, { useEffect, useState } from "react";
import { PiShieldCheckLight, PiCrownSimpleLight, PiPlusLight, PiTrashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import SaveButton from "components/UI/SaveButton.js";
import Spinner from "components/UI/Spinner.js";
import { confirmDialog } from "utils/confirm.js";

const MODUL_LABEL = {
  kamionok: "Kamionok",
  potkocsik: "Pótkocsik",
  furgonok: "Furgonok",
  karbantartasok: "Karbantartások",
  soforok: "Sofőrök",
  bejelentesek: "Bejelentések",
  szabadsagok: "Szabadságok",
  ugyfelek: "Ügyfelek",
  naplo: "Napló",
  koltsegek: "Pénzforgalom",
  tachograf: "Tachográf kártya",
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
// zónába csomagolva (ld. a mobil audit érintési-célterület javaslatait).
// Opcionális `text` prop: a mobil kártyanézet (ld. lentebb) egy szöveges
// felirattal (Hozzáférés/Szerkesztés/Törlés) együtt jeleníti meg — ez a
// szöveg UGYANAZON a `<label>`-ön belül van, nem egy külön, körbecsomagoló
// labelben (a beágyazott `<label>` érvénytelen HTML lenne), így a felirat
// koppintása is a checkbox-ot váltja, nem csak a 44×44-es ikon-zóna. Az
// asztali táblázat-nézet (`text` nélkül) az eredeti, ikon-only alakot kapja.
function Jelolo({ checked, onChange, disabled, text, ariaLabel }) {
  return (
    <label
      className={`inline-flex items-center ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${
        text ? "gap-2 py-1" : "h-11 w-11 justify-center"
      }`}
    >
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-label={!text ? ariaLabel : undefined}
          className="h-5 w-5 rounded border-ink-300 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-600"
        />
      </span>
      {text && <span className="text-sm text-ink-600 dark:text-ink-300">{text}</span>}
    </label>
  );
}

export default function Jogosultsagok() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [szerepkorok, setSzerepkorok] = useState([]);
  const [selected, setSelected] = useState("admin");
  const [jogosultsagok, setJogosultsagok] = useState([]);
  // A legutóbb betöltött/mentett állapot pillanatképe — ebből számítjuk az
  // `isDirty`-t, hogy szerepkör-váltáskor (vagy törléskor) ne veszhessen el
  // csendben egy még nem mentett checkbox-módosítás (ld. UX-audit P0).
  const [initialJogosultsagok, setInitialJogosultsagok] = useState([]);
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
    if (kulcs === "admin") {
      setJogosultsagok([]);
      setInitialJogosultsagok([]);
      return;
    }
    setLoadingJogosultsagok(true);
    const result = await fetchAction("getJogosultsagok", { ceg_id: user.ceg_id, szerepkor: kulcs, kerelmezo_id: user.id });
    if (result?.success) {
      setJogosultsagok(result.jogosultsagok || []);
      setInitialJogosultsagok(result.jogosultsagok || []);
    } else {
      toast.error(result?.message || "Jogosultságok betöltése sikertelen.");
    }
    setLoadingJogosultsagok(false);
  };

  useEffect(() => {
    loadJogosultsagok(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const isDirty = JSON.stringify(jogosultsagok) !== JSON.stringify(initialJogosultsagok);

  // Szerepkör-pillre kattintáskor — ha van nem mentett módosítás, megkérdezzük,
  // mielőtt a `useEffect([selected])` csendben felülírná a `jogosultsagok`
  // state-et a szerveren tárolt állapottal (ld. UX-audit P0: korábban ez
  // figyelmeztetés nélkül eldobta a checkbox-változtatásokat).
  const selectSzerepkor = async (kulcs) => {
    if (kulcs === selected) return;
    if (
      isDirty &&
      !(await confirmDialog(
        "Nem mentett módosításaid vannak ezen a szerepkörön — ha most váltasz, elvesznek. Biztosan folytatod mentés nélkül?",
        { danger: false, confirmLabel: "Váltás mentés nélkül" }
      ))
    ) {
      return;
    }
    setSelected(kulcs);
  };

  // A 3 jogszint kaszkádoltan függ egymástól: Szerkesztés/Törlés önmagában
  // értelmetlen, ha a modulhoz nincs Hozzáférés — a Hozzáférés kikapcsolása
  // ezért automatikusan levonja a másik kettőt is (ld. UX-audit P1).
  const toggle = (modul, tipus) => {
    setJogosultsagok((prev) =>
      prev.map((row) => {
        if (row.modul !== modul) return row;
        const uj = { ...row, [tipus]: row[tipus] === "I" ? "N" : "I" };
        if (tipus === "hozzaferes" && uj.hozzaferes === "N") {
          if (uj.szerkesztes !== null) uj.szerkesztes = "N";
          if (uj.torles !== null) uj.torles = "N";
        }
        return uj;
      })
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
        setInitialJogosultsagok(jogosultsagok);
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
    if (!szerepkor) return;

    // Hatás-előnézet törlés előtt: hány csapattag van jelenleg ezen a
    // szerepkörön — enélkül a felhasználó csak egy generikus szöveget
    // látott, a tényleges érintettséget csak a szerver-oldali blokkolásból
    // (vagy egyáltalán nem) tudta meg (ld. UX-audit P1).
    let erintettSzam = null;
    try {
      const csapatResult = await fetchAction("getCsapattagok", { id: user.id });
      if (csapatResult?.success) {
        erintettSzam = (csapatResult.csapattagok || []).filter((tag) => tag.szerepkor === selected).length;
      }
    } catch (e) {
      // a hatás-előnézet csak kiegészítő infó — ha nem sikerül lekérni, a törlés folyamata nem áll meg emiatt
    }

    const uzenet =
      erintettSzam !== null && erintettSzam > 0
        ? `Ezt a szerepkört jelenleg ${erintettSzam} csapattag használja — törlés után az ő szerepkörüket máshova kell átállítanod. Biztosan törlöd a(z) "${szerepkor.nev}" szerepkört?`
        : `Biztosan törlöd a(z) "${szerepkor.nev}" szerepkört?`;
    if (!(await confirmDialog(uzenet))) return;
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
      <PageHeader eyebrow="Rendszer" title="Jogosultságok" />

      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
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
                onClick={() => selectSzerepkor(sz.kulcs)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors duration-150 ${
                  selected === sz.kulcs ? "bg-brand-600 text-white" : "border border-ink-100 bg-white text-ink-500 hover:bg-slate-100 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400 dark:hover:bg-ink-800"
                }`}
              >
                {sz.nev}
              </button>
            ))}

            {adding ? (
              <div className="flex items-center gap-2 rounded-full border border-ink-100 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-brand-300 dark:border-ink-800 dark:bg-ink-900">
                <input
                  autoFocus
                  id="uj-szerepkor-nev"
                  value={ujNev}
                  onChange={(e) => setUjNev(e.target.value)}
                  placeholder="Új szerepkör neve"
                  className="w-40 bg-transparent px-1.5 text-sm text-ink-900 placeholder-ink-300 focus:outline-none dark:text-ink-50 dark:placeholder-ink-600"
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
                  className="flex-shrink-0 px-1 text-xs font-semibold text-ink-400 hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-100"
                >
                  Mégse
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-dashed border-ink-200 px-4 py-2 text-xs font-bold text-ink-500 hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:text-ink-400 dark:hover:border-brand-700 dark:hover:text-brand-300"
              >
                <PiPlusLight className="h-4 w-4" />
                Új szerepkör
              </button>
            )}
          </div>

          {selected === "admin" ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
              <PiCrownSimpleLight className="h-5 w-5 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Az <strong>Adminisztrátor</strong> szerepkör mindig teljes hozzáférésű — ez nem korlátozható és nem törölhető.
              </p>
            </div>
          ) : loadingJogosultsagok ? (
            <Spinner wrapperClassName="flex justify-center py-16" />
          ) : (
            <>
              <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800">
                <div className="flex items-center justify-between gap-2.5 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                      <PiShieldCheckLight className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="font-display text-base font-semibold text-brand-900 dark:text-ink-50">
                      {selectedSzerepkor?.nev || selected} jogosultságai
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteSzerepkor}
                    disabled={isDeleting}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/50"
                  >
                    <PiTrashLight className="h-4 w-4" />
                    Szerepkör törlése
                  </button>
                </div>

                {/* Mobil nézet — kártyák modulonként */}
                <div className="divide-y divide-ink-100 dark:divide-ink-800 md:hidden">
                  {jogosultsagok.map((row) => {
                    const vanHozzaferes = row.hozzaferes === "I";
                    return (
                    <div key={row.modul} className="px-5 py-4">
                      <p className="mb-2.5 text-sm font-bold text-ink-900 dark:text-ink-50">{MODUL_LABEL[row.modul] || row.modul}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        <Jelolo
                          text="Hozzáférés"
                          checked={vanHozzaferes}
                          onChange={() => toggle(row.modul, "hozzaferes")}
                        />
                        {row.szerkesztes !== null && (
                          <Jelolo
                            text="Szerkesztés"
                            checked={row.szerkesztes === "I"}
                            onChange={() => toggle(row.modul, "szerkesztes")}
                            disabled={!vanHozzaferes}
                          />
                        )}
                        {row.torles !== null && (
                          <Jelolo
                            text="Törlés"
                            checked={row.torles === "I"}
                            onChange={() => toggle(row.modul, "torles")}
                            disabled={!vanHozzaferes}
                          />
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Asztali nézet — táblázat */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th scope="col" className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                          Modul
                        </th>
                        <th scope="col" className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                          Hozzáférés
                        </th>
                        <th scope="col" className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                          Szerkesztés
                        </th>
                        <th scope="col" className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                          Törlés
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {jogosultsagok.map((row) => {
                        const modulNev = MODUL_LABEL[row.modul] || row.modul;
                        const vanHozzaferes = row.hozzaferes === "I";
                        return (
                        <tr key={row.modul} className="border-t border-ink-100 dark:border-ink-800">
                          <td className="px-5 py-2.5 text-sm font-semibold text-ink-900 dark:text-ink-50">
                            {modulNev}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            <Jelolo
                              checked={vanHozzaferes}
                              onChange={() => toggle(row.modul, "hozzaferes")}
                              ariaLabel={`${modulNev} – Hozzáférés`}
                            />
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            {row.szerkesztes !== null ? (
                              <Jelolo
                                checked={row.szerkesztes === "I"}
                                onChange={() => toggle(row.modul, "szerkesztes")}
                                disabled={!vanHozzaferes}
                                ariaLabel={`${modulNev} – Szerkesztés${!vanHozzaferes ? " (Hozzáférés nélkül nem elérhető)" : ""}`}
                              />
                            ) : (
                              <span className="text-ink-200 dark:text-ink-700">—</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            {row.torles !== null ? (
                              <Jelolo
                                checked={row.torles === "I"}
                                onChange={() => toggle(row.modul, "torles")}
                                disabled={!vanHozzaferes}
                                ariaLabel={`${modulNev} – Törlés${!vanHozzaferes ? " (Hozzáférés nélkül nem elérhető)" : ""}`}
                              />
                            ) : (
                              <span className="text-ink-200 dark:text-ink-700">—</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                {isDirty && (
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Nem mentett módosítások vannak</p>
                )}
                <SaveButton onClick={handleSave} isSaving={isSaving} label="Jogosultságok mentése" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
