import React, { useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PiClipboardTextLight,
  PiArrowLeftLight,
  PiUserLight,
  PiMapPinLight,
  PiCoinsLight,
  PiNoteLight,
  PiPlusLight,
  PiCaretDownLight,
} from "react-icons/pi";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import AutocompleteSelect from "components/UI/AutocompleteSelect.js";
import FuvarFajlokPanel from "components/Cards/FuvarFajlokPanel.js";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";
import StatusBadge from "components/UI/StatusBadge.js";
import Modal from "components/UI/Modal.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

const ALLAPOT_OPTIONS = [
  { value: "rogzitett", label: "Rögzítve" },
  { value: "szamlazasra_var", label: "Számlázásra vár" },
  { value: "szamlazva", label: "Számlázva" },
  { value: "fizetesre_var", label: "Fizetésre vár" },
  { value: "teljesitve", label: "Teljesítve" },
];

// Ugyanaz a szemantikai tónus-térkép, mint a Kanban/Sofőr-szerinti
// nézeten (StatusBadge tone-jai) — az űrlap fejlécén egy pillanatra
// visszaadja, hol tart a fuvar, kártyák közti görgetés nélkül.
const ALLAPOT_TONE = {
  rogzitett: "neutral",
  szamlazasra_var: "warning",
  szamlazva: "info",
  fizetesre_var: "warning",
  teljesitve: "success",
};

// Az öt idegenkulcs-mező (sofor_id/kamion_id/furgon_id/potkocsi_id/
// megbizo_id) `emptyFuvar`-ban mindig "" — ha ezt üres string formájában
// KÜLDJÜK EL a szervernek (nem hagyjuk el a mezőt), `newFuvar`/`updateFuvar`-
// nál `bindFuvarMezok()` a hiányzó kulcsot `?? null`-lal NULL-ra bindolja,
// de egy explicit "" stringet változatlanul köt be — ez egy INT oszlopnál
// (pl. `furgon_id`) MySQL nem-strict módban csendben 0-ra kasztol, ami a
// NULL-lal ("nincs furgon rendelve") szemantikailag NEM egyenértékű. Ezt
// elkerüljük, ha az üres FK-mezőket egyszerűen KIHAGYJUK a kérésből (a
// hiányzó kulcs a fenti `?? null` mintánál pontosan úgy viselkedik, mint
// egy explicit `null`).
const FK_MEZOK = ["sofor_id", "kamion_id", "furgon_id", "potkocsi_id", "megbizo_id"];

function nelkulUresFkMezok(data) {
  const masolat = { ...data };
  FK_MEZOK.forEach((mezo) => {
    if (masolat[mezo] === "" || masolat[mezo] === null || masolat[mezo] === undefined) {
      delete masolat[mezo];
    }
  });
  return masolat;
}

const emptyFuvar = {
  sofor_id: "",
  kamion_id: "",
  furgon_id: "",
  potkocsi_id: "",
  teljesites_datuma: "",
  felrako: "",
  lerako: "",
  tavolsag_km: "",
  tomeg_kg: "",
  megbizo_id: "",
  aru_megnevezese: "",
  megjegyzes: "",
  fuvardij: "",
  egyeb_koltseg: "",
  fuvarlevel_szam: "",
  allapot: "rogzitett",
};

// Ugyanaz a mezőkészlet, mint az Ügyfelek modul teljes formjáé
// (CardUgyfel.js `emptyUgyfel`) — a gyors megbízó-felvétel modal ugyanazt
// a `newUgyfel` actiont hívja, ugyanazokkal az (opcionális) mezőkkel.
const UJ_MEGBIZO_URES = {
  nev: "",
  adoszam: "",
  fizetesi_hatarido_nap: "",
  varos: "",
  irsz: "",
  cim: "",
  kapcsolattarto_nev: "",
  kapcsolattarto_email: "",
  kapcsolattarto_telefon: "",
  megjegyzes: "",
};

export default function FuvarForm() {
  const history = useHistory();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));

  const initialData = location.state?.data || {};
  const isNew = !initialData?.id;

  const [formData, setFormData] = useState({ ...emptyFuvar, ...initialData });
  const [isSaving, setIsSaving] = useState(false);
  const [kamionok, setKamionok] = useState([]);
  const [furgonok, setFurgonok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [ugyfelek, setUgyfelek] = useState([]);
  const [ugyfelElozmeny, setUgyfelElozmeny] = useState([]);
  const [elozmenyNyitva, setElozmenyNyitva] = useState(false);
  const [ujMegbizoNyitva, setUjMegbizoNyitva] = useState(false);
  const [ujMegbizoAdatok, setUjMegbizoAdatok] = useState(UJ_MEGBIZO_URES);
  const [ujMegbizoMentes, setUjMegbizoMentes] = useState(false);

  useEffect(() => {
    const loadLookups = async () => {
      const [kamionRes, furgonRes, potkocsiRes, soforRes, ugyfelRes] = await Promise.all([
        fetchAction("getKamionValaszto", { ceg_id: user.ceg_id }),
        fetchAction("getFurgonValaszto", { ceg_id: user.ceg_id }),
        fetchAction("getPotkocsiRendszamok", { id: user.ceg_id }),
        fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }),
        fetchAction("getUgyfelek", { id: user.ceg_id, kerelmezo_id: user.id }),
      ]);
      setKamionok(kamionRes?.success ? kamionRes.kamionok || [] : []);
      setFurgonok(furgonRes?.success ? furgonRes.furgonok || [] : []);
      setPotkocsik(potkocsiRes?.success ? potkocsiRes.potkocsik || [] : []);
      setSoforok(soforRes?.success ? soforRes.soforok || [] : []);
      setUgyfelek(ugyfelRes?.success ? ugyfelRes.ugyfelek || [] : []);
    };
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Szerkesztésnél (formData.megbizo_id már ki van töltve a kezdeti adatból)
  // a "Korábbi fuvarok" panelt is be kell tölteni, nem csak amikor a felhasználó
  // kézzel vált megbízót — enélkül szerkesztéskor sosem jelenne meg a panel,
  // amíg a felhasználó újra ki nem választja ugyanazt a megbízót.
  useEffect(() => {
    if (!formData.megbizo_id) {
      return;
    }
    let elvetve = false;
    fetchAction("getUgyfelFuvarElozmeny", {
      ceg_id: user.ceg_id,
      ugyfelId: formData.megbizo_id,
    }).then((result) => {
      if (!elvetve) {
        setUgyfelElozmeny(result?.success ? result.fuvarok || [] : []);
      }
    });
    return () => {
      elvetve = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSoforChange = (soforId) => {
    const sofor = soforok.find((s) => String(s.id) === String(soforId));
    setFormData((prev) => ({
      ...prev,
      sofor_id: soforId,
      kamion_id: sofor?.kamion || prev.kamion_id,
      furgon_id: sofor?.furgon || prev.furgon_id,
      potkocsi_id: sofor?.aktiv_potkocsi || prev.potkocsi_id,
    }));
  };

  const handleMegbizoChange = useCallback(
    async (megbizoId) => {
      setFormData((prev) => ({ ...prev, megbizo_id: megbizoId }));
      setElozmenyNyitva(false);
      if (!megbizoId) {
        setUgyfelElozmeny([]);
        return;
      }
      const result = await fetchAction("getUgyfelFuvarElozmeny", {
        ceg_id: user.ceg_id,
        ugyfelId: megbizoId,
      });
      setUgyfelElozmeny(result?.success ? result.fuvarok || [] : []);
    },
    [user.ceg_id],
  );

  const handleUjMegbizoChange = (e) => {
    const { name, value } = e.target;
    setUjMegbizoAdatok((prev) => ({ ...prev, [name]: value }));
  };

  // Gyors megbízó-felvétel — ugyanazokat a mezőket veszi fel, mint az
  // Ügyfelek modul teljes formja (CardUgyfel.js), csak modálban, hogy a
  // fuvarszervezőnek ne kelljen elhagynia a Fuvar űrlapot egy hiányzó
  // megbízó miatt.
  const handleUjMegbizoMentes = async () => {
    if (!ujMegbizoAdatok.nev.trim()) {
      toast.error("A megbízó neve kötelező.");
      return;
    }
    setUjMegbizoMentes(true);
    try {
      const result = await fetchAction("newUgyfel", {
        // `newUgyfel` a required-params ellenőrzéshez az `admin` kulcs
        // MEGLÉTÉT várja (nem `ceg_id`-t) — az értékét a szerver úgyis
        // felülírja a session-ből feloldott ceg_id-vel, de a kulcs nélkül
        // a validation() "Hiányzó paraméter: admin." hibával elszáll.
        admin: user.ceg_id,
        kerelmezo_id: user.id,
        nev: ujMegbizoAdatok.nev.trim(),
        adoszam: ujMegbizoAdatok.adoszam.trim() || undefined,
        fizetesi_hatarido_nap: ujMegbizoAdatok.fizetesi_hatarido_nap || undefined,
        varos: ujMegbizoAdatok.varos.trim() || undefined,
        irsz: ujMegbizoAdatok.irsz.trim() || undefined,
        cim: ujMegbizoAdatok.cim.trim() || undefined,
        kapcsolattarto_nev: ujMegbizoAdatok.kapcsolattarto_nev.trim() || undefined,
        kapcsolattarto_email: ujMegbizoAdatok.kapcsolattarto_email.trim() || undefined,
        kapcsolattarto_telefon: ujMegbizoAdatok.kapcsolattarto_telefon.trim() || undefined,
        megjegyzes: ujMegbizoAdatok.megjegyzes.trim() || undefined,
      });
      if (result?.success) {
        const ujUgyfel = result.ugyfel;
        setUgyfelek((prev) => [...prev, ujUgyfel]);
        handleMegbizoChange(ujUgyfel.id);
        toast.success("Megbízó felvéve.");
        setUjMegbizoNyitva(false);
        setUjMegbizoAdatok(UJ_MEGBIZO_URES);
      } else {
        toast.error(result?.message || "A megbízó mentése sikertelen.");
      }
    } finally {
      setUjMegbizoMentes(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const action = formData.id ? "updateFuvar" : "newFuvar";
      const result = await fetchAction(action, {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        ...nelkulUresFkMezok(formData),
      });

      if (result?.success) {
        toast.success("Fuvar mentve.");
        history.push("/admin/fuvarok");
      } else {
        throw new Error(result?.message || "Mentés sikertelen.");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const kivalasztottMegbizo = ugyfelek.find((u) => String(u.id) === String(formData.megbizo_id)) || null;

  const jarmuOptions = [
    ...kamionok.map((k) => ({ value: `kamion:${k.id}`, label: k.rendszam, searchText: k.rendszam })),
    ...furgonok.map((f) => ({ value: `furgon:${f.id}`, label: f.rendszam, searchText: f.rendszam })),
  ];
  const jarmuValue = formData.kamion_id
    ? `kamion:${formData.kamion_id}`
    : formData.furgon_id
      ? `furgon:${formData.furgon_id}`
      : "";
  const handleJarmuChange = (value) => {
    if (!value) {
      setFormData((prev) => ({ ...prev, kamion_id: "", furgon_id: "" }));
      return;
    }
    const [tipus, id] = value.split(":");
    setFormData((prev) => ({
      ...prev,
      kamion_id: tipus === "kamion" ? id : "",
      furgon_id: tipus === "furgon" ? id : "",
    }));
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminBreadcrumb
          group="Fuvarok"
          listLabel="Fuvarok"
          listPath="/admin/fuvarok"
          current={isNew ? "Új fuvar" : initialData.fuvarlevel_szam || "Fuvar szerkesztése"}
        />
        {!isNew && (
          <StatusBadge tone={ALLAPOT_TONE[formData.allapot] || "neutral"}>
            {ALLAPOT_OPTIONS.find((o) => o.value === formData.allapot)?.label || formData.allapot}
          </StatusBadge>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="flex flex-col gap-4"
      >
        {/* A fájl-panel a form MELLETT, jobb oldalon, sticky pozícióban áll
            (ld. FuvarFajlokPanel.js komment) — a korábbi, form ALJÁN
            megjelenő CardFuvarFajlok görgetést igényelt. Új fuvarnál
            (nincs formData.id) nincs mit mutatni, a form marad teljes
            szélességű. */}
        <div className={isNew ? "" : "grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start"}>
          <PageCard
            icon={PiClipboardTextLight}
            title={isNew ? "Új fuvar" : "Fuvar adatai"}
            className={isNew ? "" : "lg:col-span-2"}
          >
            <div className="flex flex-col gap-5 px-4 py-4 lg:px-6">
              <FormSection title="Résztvevők" icon={PiUserLight} columns={4}>
                <AutocompleteSelect
                  label="Sofőr"
                  options={soforok.map((s) => ({ value: s.id, label: s.name, searchText: s.name }))}
                  value={formData.sofor_id}
                  onChange={handleSoforChange}
                />
                <AutocompleteSelect
                  label="Jármű (kamion/furgon)"
                  options={jarmuOptions}
                  value={jarmuValue}
                  onChange={handleJarmuChange}
                />
                <AutocompleteSelect
                  label="Pótkocsi"
                  options={potkocsik.map((p) => ({ value: p.id, label: p.rendszam, searchText: p.rendszam }))}
                  value={formData.potkocsi_id}
                  onChange={(v) => setFormData((prev) => ({ ...prev, potkocsi_id: v }))}
                />
                <div className="flex items-start gap-1.5">
                  <AutocompleteSelect
                    label="Megbízó"
                    className="flex-1"
                    options={ugyfelek.map((u) => ({ value: u.id, label: u.nev, searchText: `${u.nev} ${u.varos || ""}` }))}
                    value={formData.megbizo_id}
                    onChange={handleMegbizoChange}
                  />
                  <div className="flex flex-shrink-0 flex-col">
                    {/* Láthatatlan címke-helykitöltő, hogy a lenti sáv
                        (h-14 = 56px, az AutocompleteSelect input-dobozának
                        TÉNYLEGES, mért magassága) pontosan az input-doboz
                        magasságában kezdődjön, ne a címke alatt. A gomb
                        maga csak h-9 (36px), a sávon belül középre igazítva
                        — így az input dobozzal egy magasságban van, de nem
                        nyúlik szét a teljes 56px-re. */}
                    <span aria-hidden="true" className="mb-1 block text-xs font-semibold uppercase tracking-wide">
                      &nbsp;
                    </span>
                    <div className="flex h-14 w-9 items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setUjMegbizoNyitva(true)}
                        title="Új megbízó felvétele"
                        aria-label="Új megbízó felvétele"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 text-ink-500 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800"
                      >
                        <PiPlusLight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </FormSection>

              {kivalasztottMegbizo && (
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-xl border border-ink-100 bg-slate-50 p-3 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300 md:grid-cols-2">
                  <p>
                    <span className="font-semibold uppercase tracking-wide text-ink-400">Cím: </span>
                    {[kivalasztottMegbizo.irsz, kivalasztottMegbizo.varos, kivalasztottMegbizo.cim]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  <p>
                    <span className="font-semibold uppercase tracking-wide text-ink-400">Adószám: </span>
                    {kivalasztottMegbizo.adoszam || "—"}
                  </p>
                  <p>
                    <span className="font-semibold uppercase tracking-wide text-ink-400">Fizetési határidő: </span>
                    {kivalasztottMegbizo.fizetesi_hatarido_nap
                      ? `${kivalasztottMegbizo.fizetesi_hatarido_nap} nap`
                      : "—"}
                  </p>
                  <p>
                    <span className="font-semibold uppercase tracking-wide text-ink-400">Kapcsolattartó: </span>
                    {[kivalasztottMegbizo.kapcsolattarto_nev, kivalasztottMegbizo.kapcsolattarto_telefon]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              )}

              {ugyfelElozmeny.length > 0 && (
                <div className="rounded-xl border border-ink-100 bg-sand-50 dark:border-ink-800 dark:bg-ink-800">
                  <button
                    type="button"
                    onClick={() => setElozmenyNyitva((prev) => !prev)}
                    aria-expanded={elozmenyNyitva}
                    className="group flex w-full items-center justify-between p-3 text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                      Korábbi fuvarok ezzel a megbízóval ({ugyfelElozmeny.length})
                    </span>
                    <PiCaretDownLight
                      className={`h-3.5 w-3.5 flex-shrink-0 text-ink-400 transition-transform duration-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 ${elozmenyNyitva ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {elozmenyNyitva && (
                    <ul className="space-y-0.5 px-3 pb-3 text-xs text-ink-600 dark:text-ink-300">
                      {ugyfelElozmeny.map((f, i) => (
                        <li key={i}>
                          {f.teljesites_datuma || "—"} · {f.felrako} → {f.lerako} ·{" "}
                          {f.fuvardij != null ? `${Number(f.fuvardij).toLocaleString("hu-HU")} Ft` : "—"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <FormSection title="Útvonal" icon={PiMapPinLight} columns={4}>
                <FormField
                  type="date"
                  label="Teljesítés dátuma"
                  name="teljesites_datuma"
                  value={formData.teljesites_datuma || ""}
                  onChange={handleChange}
                />
                <FormField label="Felrakó" name="felrako" value={formData.felrako || ""} onChange={handleChange} />
                <FormField label="Lerakó" name="lerako" value={formData.lerako || ""} onChange={handleChange} />
                <FormField
                  type="number"
                  label="Távolság (km)"
                  name="tavolsag_km"
                  value={formData.tavolsag_km || ""}
                  onChange={handleChange}
                />
                <FormField
                  type="number"
                  label="Tömeg (kg)"
                  name="tomeg_kg"
                  value={formData.tomeg_kg || ""}
                  onChange={handleChange}
                />
                <FormField
                  label="Áru megnevezése"
                  name="aru_megnevezese"
                  value={formData.aru_megnevezese || ""}
                  onChange={handleChange}
                  className="md:col-span-2"
                />
                <FormField
                  label="Fuvarlevél szám"
                  name="fuvarlevel_szam"
                  value={formData.fuvarlevel_szam || ""}
                  onChange={handleChange}
                />
              </FormSection>

              <FormSection title="Díjak" icon={PiCoinsLight} columns={4}>
                <FormField
                  type="number"
                  label="Fuvardíj (Ft)"
                  name="fuvardij"
                  value={formData.fuvardij || ""}
                  onChange={handleChange}
                />
                <FormField
                  type="number"
                  label="Egyéb költség (Ft)"
                  name="egyeb_koltseg"
                  value={formData.egyeb_koltseg || ""}
                  onChange={handleChange}
                />
                <FormField
                  as="select"
                  label="Állapot"
                  name="allapot"
                  value={formData.allapot || "rogzitett"}
                  onChange={handleChange}
                >
                  {ALLAPOT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FormField>
              </FormSection>

              <FormSection title="Megjegyzés" icon={PiNoteLight} columns={1}>
                <FormField
                  as="textarea"
                  name="megjegyzes"
                  value={formData.megjegyzes || ""}
                  onChange={handleChange}
                  rows="3"
                />
              </FormSection>
            </div>
          </PageCard>

          {!isNew && (
            <div className="lg:sticky lg:top-4">
              <FuvarFajlokPanel fuvar_id={formData.id} />
            </div>
          )}
        </div>

        {/* Sticky action bar — a Mentés mindig elérhető, görgetés nélkül is;
            a Vissza vizuálisan alárendelt (szöveg-gomb) a mentéshez képest. */}
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white/95 px-4 py-3 shadow-soft-lg backdrop-blur-sm dark:border-ink-800 dark:bg-ink-900/95 md:px-6">
          <button
            type="button"
            onClick={() => history.push("/admin/fuvarok")}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:text-ink-400 dark:hover:bg-ink-800"
          >
            <PiArrowLeftLight className="h-4 w-4" />
            Vissza
          </button>
          <SaveButton onClick={handleSave} isSaving={isSaving} label={isNew ? "Fuvar rögzítése" : "Mentés"} />
        </div>
      </form>

      <Modal
        open={ujMegbizoNyitva}
        onClose={() => setUjMegbizoNyitva(false)}
        title="Új megbízó felvétele"
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUjMegbizoMentes();
          }}
          className="space-y-5"
        >
          <FormSection title="Cégadatok" icon={PiClipboardTextLight} columns={2}>
            <FormField
              label="Név"
              name="nev"
              value={ujMegbizoAdatok.nev}
              onChange={handleUjMegbizoChange}
              required
              className="sm:col-span-2"
            />
            <FormField label="Adószám" name="adoszam" value={ujMegbizoAdatok.adoszam} onChange={handleUjMegbizoChange} />
            <FormField
              type="number"
              label="Fizetési határidő (nap)"
              name="fizetesi_hatarido_nap"
              value={ujMegbizoAdatok.fizetesi_hatarido_nap}
              onChange={handleUjMegbizoChange}
            />
          </FormSection>

          <FormSection title="Cím" icon={PiMapPinLight} columns={2}>
            <FormField label="Város" name="varos" value={ujMegbizoAdatok.varos} onChange={handleUjMegbizoChange} />
            <FormField label="Irányítószám" name="irsz" value={ujMegbizoAdatok.irsz} onChange={handleUjMegbizoChange} />
            <FormField
              label="Cím"
              name="cim"
              value={ujMegbizoAdatok.cim}
              onChange={handleUjMegbizoChange}
              className="sm:col-span-2"
            />
          </FormSection>

          <FormSection title="Kapcsolattartó" icon={PiUserLight} columns={2}>
            <FormField
              label="Név"
              name="kapcsolattarto_nev"
              value={ujMegbizoAdatok.kapcsolattarto_nev}
              onChange={handleUjMegbizoChange}
              className="sm:col-span-2"
            />
            <FormField
              type="email"
              label="Email cím"
              name="kapcsolattarto_email"
              value={ujMegbizoAdatok.kapcsolattarto_email}
              onChange={handleUjMegbizoChange}
            />
            <FormField
              type="tel"
              label="Telefonszám"
              name="kapcsolattarto_telefon"
              value={ujMegbizoAdatok.kapcsolattarto_telefon}
              onChange={handleUjMegbizoChange}
            />
          </FormSection>

          <FormSection title="Megjegyzés" icon={PiNoteLight} columns={1}>
            <FormField
              as="textarea"
              id="ujmegbizo_megjegyzes"
              name="megjegyzes"
              value={ujMegbizoAdatok.megjegyzes}
              onChange={handleUjMegbizoChange}
              rows="2"
            />
          </FormSection>

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
            <button
              type="button"
              onClick={() => setUjMegbizoNyitva(false)}
              className="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800"
            >
              Mégse
            </button>
            <SaveButton onClick={handleUjMegbizoMentes} isSaving={ujMegbizoMentes} label="Megbízó felvétele" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
