import React, { useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import {
  PiPlayFill,
  PiFileLight,
  PiXLight,
  PiUploadSimpleLight,
  PiPencilSimpleLight,
  PiCheckLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";
import Spinner from "components/UI/Spinner.js";
import HelyszinMegjegyzesek from "components/Helyszin/HelyszinMegjegyzesek.js";

const getKind = (filename) => {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video";
  return "other";
};

// A helyszín fotóit/videóit közvetlenül a képernyőn mutatjuk meg
// (nem böngésző-letöltést indítunk), hogy vezetés előtt/közben egy
// koppintással meg lehessen nézni a bejáratot/rámpát stb. Képeknél a
// rácsban is a valódi kép jelenik meg (nem csak egy ikon), videóknál egy
// lejátszás-ikonnal jelölt előnézeti "poszter" — magát a (jellemzően nagy)
// videófájlt csak koppintásra töltjük le, hogy a lista gyors maradjon.
export default function HelyszinReszletek() {
  const location = useLocation();
  const history = useHistory();
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [helyszin, setHelyszin] = useState(location.state?.data);
  const [nev, setNev] = useState(location.state?.data?.nev || "");
  const [editingNev, setEditingNev] = useState(false);
  const [savingNev, setSavingNev] = useState(false);
  const [files, setFiles] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadFiles = async () => {
    const result = await fetchAction("getFiles", { id: helyszin.id, tabla: "helyszin" });
    if (result?.success) setFiles(result.files || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!helyszin?.id) {
      history.push("/user/helyszinek");
      return;
    }
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Csak a képeket töltjük be előre, hogy a rácsban valódi
    // képelőnézet legyen — a videók (jellemzően jóval nagyobbak)
    // csak koppintásra töltődnek be.
    const imageFiles = files.filter((f) => getKind(f.filename) === "image" && !thumbs[f.sorszam]);
    imageFiles.forEach(async (f) => {
      const result = await fetchAction("downloadFile", { id: f.sorszam });
      if (result?.success) {
        setThumbs((prev) => ({ ...prev, [f.sorszam]: `data:${result.mime};base64,${result.file}` }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const openPreview = async (file) => {
    const kind = getKind(file.filename);
    if (kind === "image" && thumbs[file.sorszam]) {
      setPreview({ src: thumbs[file.sorszam], filename: file.filename, kind });
      return;
    }
    setPreviewLoading(true);
    const result = await fetchAction("downloadFile", { id: file.sorszam });
    setPreviewLoading(false);
    if (result?.success) {
      setPreview({ src: `data:${result.mime};base64,${result.file}`, filename: file.filename, kind });
    } else {
      toast.error(result?.message || "A fájl nem tölthető be.");
    }
  };

  const handleSaveNev = async () => {
    if (!nev.trim()) return;
    setSavingNev(true);
    try {
      const result = await fetchAction("saveHelyszinData", { id: helyszin.id, nev: nev.trim() });
      if (result?.success) {
        setHelyszin((prev) => ({ ...prev, nev: nev.trim() }));
        setEditingNev(false);
        toast.success("Mentve.");
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setSavingNev(false);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const uploads = selectedFiles.map(async (file) => {
        const base64File = await fileToBase64(file);
        return fetchAction("fileUpload", {
          admin: user.admin,
          id: helyszin.id,
          tabla: "helyszin",
          file: base64File,
          name: file.name,
          size: file.size,
        });
      });
      const results = await Promise.all(uploads);
      if (results.every((r) => r?.success)) {
        await loadFiles();
      } else {
        toast.error("Néhány fájl feltöltése sikertelen volt.");
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  if (!helyszin) return null;

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Helyszín" />

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        {editingNev ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nev}
              onChange={(e) => setNev(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-ink-100 bg-slate-50 px-3 py-2 text-sm font-bold text-ink-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="button"
              onClick={handleSaveNev}
              disabled={savingNev || !nev.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Mentés"
            >
              <PiCheckLight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-base font-bold text-ink-900">{helyszin.nev}</h2>
            <button
              type="button"
              onClick={() => setEditingNev(true)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100 hover:text-ink-700"
              aria-label="Név szerkesztése"
            >
              <PiPencilSimpleLight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Fotók / videók</h2>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
            <PiUploadSimpleLight className="h-4 w-4" />
            {isUploading ? "Feltöltés..." : "Feltöltés"}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
        {loading ? (
          <Spinner wrapperClassName="flex justify-center py-10" />
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-6 text-center text-sm text-ink-400 shadow-soft">
            Ehhez a helyszínhez még nincs feltöltött fotó/videó.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f) => {
              const kind = getKind(f.filename);
              return (
                <button
                  key={f.sorszam}
                  type="button"
                  onClick={() => openPreview(f)}
                  className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft"
                >
                  {kind === "image" ? (
                    thumbs[f.sorszam] ? (
                      <img src={thumbs[f.sorszam]} alt={f.filename} className="h-full w-full object-cover" />
                    ) : (
                      <Spinner wrapperClassName="flex" />
                    )
                  ) : kind === "video" ? (
                    <div className="flex h-full w-full items-center justify-center bg-ink-900/90">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-900">
                        <PiPlayFill className="h-4 w-4" />
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 p-2">
                      <PiFileLight className="h-6 w-6 text-ink-400" />
                      <span className="w-full truncate text-center text-[10px] text-ink-500">{f.filename}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Megjegyzések</h2>
        <HelyszinMegjegyzesek
          helyszinId={helyszin.id}
          szerzoTipus="sofor"
          szerzoId={user.id}
          szerzoNev={user.name}
        />
      </div>

      {previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Spinner className="h-10 w-10 border-2 border-white/30 border-t-white" wrapperClassName="" />
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <p className="truncate pr-4 text-sm font-semibold text-white">{preview.filename}</p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Bezárás"
            >
              <PiXLight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-4">
            {preview.kind === "image" && (
              <img src={preview.src} alt={preview.filename} className="max-h-full max-w-full rounded-lg object-contain" />
            )}
            {preview.kind === "video" && (
              <video src={preview.src} controls autoPlay className="max-h-full max-w-full rounded-lg" />
            )}
            {preview.kind === "other" && (
              <a href={preview.src} download={preview.filename} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink-900">
                Fájl letöltése
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
