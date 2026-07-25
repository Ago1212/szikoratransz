import React, { useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PiClipboardTextLight,
  PiArrowLeftLight,
  PiUserLight,
  PiTruckLight,
  PiMapPinLight,
  PiCoinsLight,
  PiNoteLight,
} from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import AutocompleteSelect from "components/UI/AutocompleteSelect.js";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

const ALLAPOT_OPTIONS = [
  { value: "rogzitett", label: "Rögzítve" },
  { value: "szamlazasra_var", label: "Számlázásra vár" },
  { value: "szamlazva", label: "Számlázva" },
  { value: "fizetesre_var", label: "Fizetésre vár" },
  { value: "teljesitve", label: "Teljesítve" },
];

// Az öt idegenkulcs-mező (sofor_id/kamion_id/furgon_id/potkocsi_id/
// megbizo_id) `emptyFuvar`-ban mindig "" — ha ezt üres string formájában
// KÜLDJÜK EL a szervernek (nem hagyjuk el a mezőt), két külön hiba történik:
// (1) `letrehozFuvarDokumentumbol`-nál a backend `array_merge($ocrBolFeloldott,
// $felulirasok)`-ot hív — mivel `$felulirasok` (= a teljes formData) MINDIG
// tartalmazza ezt az 5 kulcsot, egy nem érintett mező "" értéke felülírná
// (kitörölné) a szerver saját, OCR-alapú rendszám/sofőr/megbízó-egyeztetését,
// még akkor is, ha a felhasználó a formon egyáltalán nem nyúlt hozzá. (2)
// `newFuvar`/`updateFuvar`-nál `bindFuvarMezok()` a hiányzó kulcsot `?? null`-
// lal NULL-ra bindolja, de egy explicit "" stringet változatlanul köt be —
// ez egy INT oszlopnál (pl. `furgon_id`) MySQL nem-strict módban csendben
// 0-ra kasztol, ami a NULL-lal ("nincs furgon rendelve") szemantikailag NEM
// egyenértékű. Mindkét hiba elkerülhető, ha az üres FK-mezőket egyszerűen
// KIHAGYJUK a kérésből (a hiányzó kulcs a fenti `?? null`/`array_merge`
// mintáknál pontosan úgy viselkedik, mint egy explicit `null`).
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
  megbizo_id: "",
  aru_megnevezese: "",
  megjegyzes: "",
  fuvardij: "",
  egyeb_koltseg: "",
  fuvarlevel_szam: "",
  allapot: "rogzitett",
};

// Az OCR-mezőnevek (ld. GeminiOcrClient.php) és a fuvarok tábla mezőnevei
// nagyrészt egyeznek (felrako/lerako/aru_megnevezese/fuvarlevel_szam) — csak
// a "datum" -> "teljesites_datuma" és "egyeb_megjegyzes" -> "megjegyzes"
// nevek térnek el. A sofor_id/kamion_id/furgon_id/megbizo_id ID-egyeztetést
// a szerver (letrehozFuvarDokumentumbol -> FuvarInterface::letrehozDokumentumbol)
// már elvégezte a dokumentum mentésekor — ez a segédfüggvény csak a
// BeerkezettDokumentumok.js oldalról átadott nyers, szöveges ocrAdatok
// mezőket teszi be induló (előnézeti) értéknek, ID-egyeztetés nélkül.
function ocrAdatokToForm(ocrAdatok) {
  if (!ocrAdatok) return {};
  return {
    teljesites_datuma: ocrAdatok.datum || "",
    felrako: ocrAdatok.felrako || "",
    lerako: ocrAdatok.lerako || "",
    aru_megnevezese: ocrAdatok.aru_megnevezese || "",
    megjegyzes: ocrAdatok.egyeb_megjegyzes || "",
    fuvarlevel_szam: ocrAdatok.fuvarlevel_szam || "",
  };
}

export default function FuvarForm() {
  const history = useHistory();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));

  const dokumentumId = location.state?.dokumentumId || null;
  const initialData = location.state?.data || ocrAdatokToForm(location.state?.ocrAdatok);
  const isNew = !initialData?.id;

  const [formData, setFormData] = useState({ ...emptyFuvar, ...initialData });
  const [isSaving, setIsSaving] = useState(false);
  const [kamionok, setKamionok] = useState([]);
  const [furgonok, setFurgonok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [ugyfelek, setUgyfelek] = useState([]);
  const [ugyfelElozmeny, setUgyfelElozmeny] = useState([]);

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let result;
      if (dokumentumId) {
        result = await fetchAction("letrehozFuvarDokumentumbol", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          dokumentumId,
          felulirasok: nelkulUresFkMezok(formData),
        });
      } else {
        const action = formData.id ? "updateFuvar" : "newFuvar";
        result = await fetchAction(action, {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          ...nelkulUresFkMezok(formData),
        });
      }

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
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/fuvarok")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza a fuvarokhoz
      </button>

      <PageHeader eyebrow="Fuvarok" title={isNew ? "Új fuvar" : "Fuvar szerkesztése"} />

      <PageCard icon={PiClipboardTextLight} title={isNew ? "Új fuvar" : "Fuvar szerkesztése"}>
        <div className="px-4 py-4 lg:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-5"
          >
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
              <AutocompleteSelect
                label="Megbízó"
                options={ugyfelek.map((u) => ({ value: u.id, label: u.nev, searchText: `${u.nev} ${u.varos || ""}` }))}
                value={formData.megbizo_id}
                onChange={handleMegbizoChange}
              />
            </FormSection>

            {kivalasztottMegbizo && (
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-xl border border-ink-100 bg-white p-3 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 md:grid-cols-2">
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
              <div className="rounded-xl border border-ink-100 bg-sand-50 p-3 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300">
                <p className="mb-1 font-semibold uppercase tracking-wide text-ink-400">
                  Korábbi fuvarok ezzel a megbízóval
                </p>
                <ul className="space-y-0.5">
                  {ugyfelElozmeny.map((f, i) => (
                    <li key={i}>
                      {f.teljesites_datuma || "—"} · {f.felrako} → {f.lerako} ·{" "}
                      {f.fuvardij != null ? `${Number(f.fuvardij).toLocaleString("hu-HU")} Ft` : "—"}
                    </li>
                  ))}
                </ul>
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
                icon={PiTruckLight}
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
                label="Megjegyzés"
                name="megjegyzes"
                value={formData.megjegyzes || ""}
                onChange={handleChange}
                rows="3"
              />
            </FormSection>

            <div className="flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800">
              <SaveButton onClick={handleSave} isSaving={isSaving} label={isNew ? "Fuvar rögzítése" : "Mentés"} />
            </div>
          </form>
        </div>
      </PageCard>
    </div>
  );
}
