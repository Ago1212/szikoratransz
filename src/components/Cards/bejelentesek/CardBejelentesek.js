import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";
import { toast } from "utils/toast";
import {
  PiWarningCircleLight,
  PiArrowLeftLight,
  PiArrowRightLight,
  PiUploadSimpleLight,
  PiFileLight,
  PiTrashLight,
  PiWrenchLight,
  PiCheckCircleLight,
  PiInfoLight,
  PiChatCircleTextLight,
  PiPaperPlaneRightLight,
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
//
// R02 (fejlesztési audit, 2026-07-19): az `admin_valasz` mező a backendben
// (bejelentesekInterface::saveBejelentesData) már régóta létezett és a
// sofőr-oldali nézetek (Bejelentesek.js, Ertesitesek.js, Dashboard.js) meg
// is jelenítik — de ezen az admin-felületen eddig NEM volt hozzá beviteli
// mező. Emiatt a form-állapot sosem tartalmazta, és minden mentés (akár
// egy puszta státuszváltás is) csendben NULL-ra írta felül egy korábban
// már rögzített admin-választ (élő DB-n megerősített adatvesztés — ld.
// backend-oldali komment). A mostani "Admin válasz" mező pótolja ezt.
export default function CardBejelentesek({ initBejelentesek }) {
  const history = useHistory();
  const isNew = !initBejelentesek?.id;
  const user = JSON.parse(localStorage.getItem("user"));

  const [form, setForm] = useState({
    cim: initBejelentesek?.cim || "",
    leiras: initBejelentesek?.leiras || "",
    kamion_id: initBejelentesek?.kamion_id || "",
    sofor_id: initBejelentesek?.sofor_id || "",
    prioritas: initBejelentesek?.prioritas || "kozepes",
    statusz: initBejelentesek?.statusz || "uj",
    admin_valasz: initBejelentesek?.admin_valasz || "",
  });
  const [kamionok, setKamionok] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [files, setFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [karbantartasId, setKarbantartasId] = useState(initBejelentesek?.karbantartas_id || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFileUploading, setIsFileUploading] = useState(false);

  // Valódi, backenddel rendelkező üzenetfolyam (ld. a fájl tetején lévő
  // komment a korábbi, sosem működött mock-verzióról). Az "Admin válasz"
  // mező marad a hivatalos, egyszeri lezáró válasz — ez itt egy tényleges,
  // kétirányú beszélgetés a sofőrrel ugyanahhoz a bejelentéshez.
  const [uzenetek, setUzenetek] = useState([]);
  const [ujUzenet, setUjUzenet] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      const kamionResult = await fetchAction("getKamionRendszamok", { id: user.ceg_id });
      if (kamionResult?.success) setKamionok(kamionResult.kamionok);

      const soforResult = await fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id });
      if (soforResult?.success) setSoforok(soforResult.soforok);
    };
    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isNew) {
      fetchFiles();
      fetchUzenetek();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initBejelentesek?.id]);

  const fetchUzenetek = async () => {
    setIsLoadingMessages(true);
    const result = await fetchAction("getMessages", { bejelentes_id: initBejelentesek.id });
    if (result?.success) setUzenetek(result.uzenetek || []);
    setIsLoadingMessages(false);
  };

  const handleSendMessage = async () => {
    if (!ujUzenet.trim()) return;
    setIsSendingMessage(true);
    try {
      const result = await fetchAction("sendMessage", { bejelentes_id: initBejelentesek.id, szoveg: ujUzenet.trim() });
      if (result?.success) {
        setUjUzenet("");
        await fetchUzenetek();
      } else {
        toast.error(result?.message || "Az üzenet küldése sikertelen.");
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

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
        const result = await fetchAction("saveBejelentesData", { id: initBejelentesek.id, ...form, kerelmezo_id: user.id });
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
      const result = await fetchAction("generateKarbantartasFromBejelentes", { id: initBejelentesek.id, kerelmezo_id: user.id });
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
    if (result?.success) {
      await fetchFiles();
    } else {
      toast.error(result?.message || "A fájl törlése sikertelen.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/bejelentesek")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
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
              <FormSection title="Admin válasz" columns={1}>
                <FormField
                  as="textarea"
                  label="Válasz a bejelentő sofőrnek"
                  name="admin_valasz"
                  value={form.admin_valasz}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Ez a szöveg a sofőr saját Bejelentések/Értesítések nézetében is megjelenik."
                />
              </FormSection>
            )}

            {!isNew && (
              <FormSection title="Üzenetek" columns={1}>
                <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-slate-50 p-3 dark:border-ink-800 dark:bg-ink-800">
                  {isLoadingMessages ? (
                    <p className="py-4 text-center text-sm text-ink-400 dark:text-ink-500">Betöltés...</p>
                  ) : uzenetek.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                      <PiChatCircleTextLight className="h-6 w-6 text-ink-300 dark:text-ink-600" />
                      <p className="text-sm text-ink-400 dark:text-ink-500">
                        Még nincs üzenet ehhez a bejelentéshez.
                      </p>
                    </div>
                  ) : (
                    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                      {uzenetek.map((u) => (
                        <div
                          key={u.id}
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                            u.szerzo_tipus === "admin"
                              ? "self-end bg-brand-600 text-white"
                              : "self-start bg-white text-ink-700 shadow-soft dark:bg-ink-900 dark:text-ink-100"
                          }`}
                        >
                          <p className={`mb-0.5 text-xs font-semibold ${u.szerzo_tipus === "admin" ? "text-brand-100" : "text-ink-400 dark:text-ink-500"}`}>
                            {u.szerzo_nev} · {(u.letrehozva || "").slice(0, 16).replace("T", " ")}
                          </p>
                          <p className="whitespace-pre-wrap">{u.szoveg}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2 border-t border-ink-100 pt-3 dark:border-ink-700">
                    <textarea
                      value={ujUzenet}
                      onChange={(e) => setUjUzenet(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows="1"
                      placeholder="Írj üzenetet a sofőrnek..."
                      className="flex-1 resize-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={isSendingMessage || !ujUzenet.trim()}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Üzenet küldése"
                    >
                      <PiPaperPlaneRightLight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </FormSection>
            )}

            {/* Korábban a szöveg + gomb egy `justify-between` sorban élt egymás
                mellett — asztalin még elfért, de mobilon a gomb felirata
                kilógott a képernyőről, a magyarázó szöveg pedig egy pár tíz
                pixel széles oszlopba szorulva szavanként tördelődött. Az új
                elrendezés mindig egymás ALATT áll (ikon+szöveg, majd a
                gomb/akció), a gomb csak `sm:` felett igazodik jobbra és
                zsugorodik a tartalma szélességére — így ugyanaz a
                felépítés működik mobilon és asztalin is, nem két külön eset. */}
            {!isNew && (
              <FormSection title="Karbantartás" columns={1}>
                {karbantartasId ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <div className="flex items-start gap-2.5">
                      <PiCheckCircleLight className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm text-emerald-800 dark:text-emerald-200">
                        Karbantartás létrehozva ebből a bejelentésből{" "}
                        <span className="font-semibold">(#{karbantartasId})</span>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => history.push("/admin/karbantartasok")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-emerald-700 shadow-soft ring-1 ring-emerald-200 transition-colors duration-200 hover:bg-emerald-100 dark:bg-ink-900 dark:text-emerald-300 dark:ring-emerald-800 dark:hover:bg-ink-800 sm:w-fit sm:self-end"
                    >
                      Megnyitás a Karbantartásoknál
                      <PiArrowRightLight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : form.kamion_id ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-900 dark:bg-brand-950/30">
                    <div className="flex items-start gap-2.5">
                      <PiWrenchLight className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600 dark:text-brand-300" />
                      <p className="text-sm text-ink-600 dark:text-ink-300">
                        Ha a bejelentés valós hibát ír le, itt egy kattintással létrehozhat belőle egy karbantartási rekordot a kijelölt kamionhoz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateKarbantartas}
                      disabled={isGenerating}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit sm:self-end"
                    >
                      <PiWrenchLight className="h-4 w-4" />
                      {isGenerating ? "Generálás..." : "Karbantartás generálása"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-xl border border-ink-100 bg-slate-50 p-4 dark:border-ink-800 dark:bg-ink-800">
                    <PiInfoLight className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-300 dark:text-ink-600" />
                    <p className="text-sm text-ink-400 dark:text-ink-400">
                      Nincs kamion megadva a bejelentésnél — karbantartás csak kamionhoz rendelt bejelentésből generálható.
                    </p>
                  </div>
                )}
              </FormSection>
            )}

            {!isNew && (
              <FormSection title="Csatolt fájlok" columns={1}>
                <div className="rounded-xl border border-ink-100 bg-slate-50 p-3 dark:border-ink-800 dark:bg-ink-800">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 shadow-soft transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-brand-950/40 dark:hover:text-brand-300">
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
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-ink-900"
                      >
                        <button
                          type="button"
                          onClick={() => downloadFileAction(file.sorszam, file.filename)}
                          className="flex items-center gap-2 text-sm text-brand-700 hover:underline dark:text-brand-300"
                        >
                          <PiFileLight className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{file.filename}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFileDelete(file.sorszam)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 dark:text-ink-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                        >
                          <PiTrashLight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </FormSection>
            )}

            <div className="flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800">
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
