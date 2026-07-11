import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";
import { toast } from "utils/toast";
import {
  PiWarningCircleLight,
  PiArrowLeftLight,
  PiUploadSimpleLight,
  PiFileLight,
  PiTrashLight,
  PiWrenchLight,
  PiCheckCircleLight,
} from "react-icons/pi";
import FormField, { FormSection } from "components/UI/FormField.js";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";

// A korábbi verzió egy teljes, élő kamerás/csatolmányos üzenetfolyam-UI-t
// rajzolt ki a `getMessages`/`sendMessage` akciókra, amik sosem léteztek a
// backendben — a felület látszatra működött, valójában semmit sem küldött
// el sehova. Ez a verzió a ténylegesen létező mezőkre (cím, leírás,
// prioritás, admin válasz, státusz) épül, és a már meglévő generikus
// fájlfeltöltő mechanizmust használja (tabla='bejelentesek').
export default function CardBejelentesek({ initBejelentesek }) {
  const history = useHistory();
  const isNew = !initBejelentesek?.id;
  const user = JSON.parse(sessionStorage.getItem("user"));

  const [form, setForm] = useState({
    cim: initBejelentesek?.cim || "",
    leiras: initBejelentesek?.leiras || "",
    kamion_id: initBejelentesek?.kamion_id || "",
    sofor_id: initBejelentesek?.sofor_id || "",
    prioritas: initBejelentesek?.prioritas || "kozepes",
    statusz: initBejelentesek?.statusz || "uj",
  });
  const [kamionok, setKamionok] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [files, setFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [karbantartasId, setKarbantartasId] = useState(initBejelentesek?.karbantartas_id || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFileUploading, setIsFileUploading] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      const kamionResult = await fetchAction("getKamionRendszamok", { id: user.ceg_id });
      if (kamionResult?.success) setKamionok(kamionResult.kamionok);

      const soforResult = await fetchAction("getSoforok", { id: user.ceg_id });
      if (soforResult?.success) setSoforok(soforResult.soforok);
    };
    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isNew) {
      fetchFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initBejelentesek?.id]);

  const fetchFiles = async () => {
    const result = await fetchAction("getFiles", { id: initBejelentesek.id, tabla: "bejelentesek" });
    if (result?.success) setFiles(result.files || []);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isNew) {
        const result = await fetchAction("newBejelentes", { admin: user.ceg_id, ...form });
        if (result?.success) {
          toast.success("Bejelentés rögzítve.");
          history.push("/admin/bejelentesek");
        } else {
          toast.error(result?.message || "Mentés sikertelen.");
        }
      } else {
        const result = await fetchAction("saveBejelentesData", { id: initBejelentesek.id, ...form });
        if (result?.success) {
          toast.success("Bejelentés frissítve.");
        } else {
          toast.error(result?.message || "Mentés sikertelen.");
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateKarbantartas = async () => {
    setIsGenerating(true);
    try {
      const result = await fetchAction("generateKarbantartasFromBejelentes", { id: initBejelentesek.id });
      if (result?.success) {
        toast.success("Karbantartás létrehozva a bejelentésből.");
        setKarbantartasId(result.karbantartas_id);
        if (form.statusz === "uj") {
          setForm((prev) => ({ ...prev, statusz: "folyamatban" }));
        }
      } else {
        toast.error(result?.message || "Karbantartás generálása sikertelen.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setIsFileUploading(true);
    try {
      const uploads = selectedFiles.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64File = reader.result.split(",")[1];
              const result = await fetchAction("fileUpload", {
                admin: user.ceg_id,
                id: initBejelentesek.id,
                tabla: "bejelentesek",
                file: base64File,
                name: file.name,
                size: file.size,
              });
              resolve(result?.success);
            };
            reader.readAsDataURL(file);
          })
      );
      const results = await Promise.all(uploads);
      if (results.every(Boolean)) {
        await fetchFiles();
      } else {
        toast.error("Néhány fájl feltöltése sikertelen volt.");
      }
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleFileDelete = async (fileId) => {
    if (!window.confirm("Biztosan törölni szeretné ezt a fájlt?")) return;
    const result = await fetchAction("deleteFile", { id: fileId });
    if (result?.success) await fetchFiles();
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/bejelentesek")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza a bejelentésekhez
      </button>

      <PageCard icon={PiWarningCircleLight} title={isNew ? "Új bejelentés" : "Bejelentés"}>
        <div className="px-4 py-4 lg:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-5"
          >
            <FormSection columns={2}>
              <FormField
                label="Cím"
                name="cim"
                value={form.cim}
                onChange={handleChange}
                required
              />
              <FormField
                as="select"
                label="Prioritás"
                name="prioritas"
                value={form.prioritas}
                onChange={handleChange}
              >
                <option value="alacsony">Alacsony</option>
                <option value="kozepes">Közepes</option>
                <option value="magas">Magas</option>
              </FormField>
              <FormField
                as="select"
                label="Kamion"
                name="kamion_id"
                value={form.kamion_id}
                onChange={handleChange}
              >
                <option value="">Nincs megadva</option>
                {kamionok.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.rendszam}
                  </option>
                ))}
              </FormField>
              <FormField
                as="select"
                label="Sofőr"
                name="sofor_id"
                value={form.sofor_id}
                onChange={handleChange}
              >
                <option value="">Nincs megadva</option>
                {soforok.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </FormField>
              {!isNew && (
                <FormField
                  as="select"
                  label="Státusz"
                  name="statusz"
                  value={form.statusz}
                  onChange={handleChange}
                >
                  <option value="uj">Új</option>
                  <option value="folyamatban">Folyamatban</option>
                  <option value="lezart">Lezárt</option>
                </FormField>
              )}
            </FormSection>

            <FormSection columns={1}>
              <FormField
                as="textarea"
                label="Leírás"
                name="leiras"
                value={form.leiras}
                onChange={handleChange}
                rows="4"
                required
              />
            </FormSection>

            {!isNew && (
              <FormSection title="Karbantartás" columns={1}>
                {karbantartasId ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <PiCheckCircleLight className="h-4 w-4 flex-shrink-0" />
                    Karbantartás létrehozva ebből a bejelentésből (#{karbantartasId}) — részletek a Karbantartások listában.
                  </div>
                ) : form.kamion_id ? (
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-ink-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm text-ink-500">
                      Ha a bejelentés valós hibát ír le, itt egy kattintással létrehozhat belőle egy karbantartási rekordot a kijelölt kamionhoz.
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateKarbantartas}
                      disabled={isGenerating}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <PiWrenchLight className="h-4 w-4" />
                      {isGenerating ? "Generálás..." : "Karbantartás generálása"}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-400">
                    Nincs kamion megadva a bejelentésnél — karbantartás csak kamionhoz rendelt bejelentésből generálható.
                  </p>
                )}
              </FormSection>
            )}

            {!isNew && (
              <FormSection title="Csatolt fájlok" columns={1}>
                <div className="rounded-xl border border-ink-100 bg-slate-50 p-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 shadow-soft transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700">
                    <PiUploadSimpleLight className="h-4 w-4" />
                    Fájlok feltöltése
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isFileUploading}
                      multiple
                    />
                  </label>
                  <div className="mt-2 space-y-1.5">
                    {files.map((file) => (
                      <div
                        key={file.sorszam}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => downloadFileAction(file.sorszam, file.filename)}
                          className="flex items-center gap-2 text-sm text-brand-700 hover:underline"
                        >
                          <PiFileLight className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{file.filename}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFileDelete(file.sorszam)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <PiTrashLight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </FormSection>
            )}

            <div className="flex justify-end border-t border-ink-100 pt-4">
              <SaveButton
                onClick={handleSave}
                isSaving={isSaving}
                label={isNew ? "Bejelentés rögzítése" : "Mentés"}
              />
            </div>
          </form>
        </div>
      </PageCard>
    </div>
  );
}
