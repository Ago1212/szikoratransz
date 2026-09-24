import React, { useEffect, useRef, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import {
  PiPlayFill,
  PiFileLight,
  PiXLight,
  PiUploadSimpleLight,
  PiPencilSimpleLight,
  PiCheckLight,
  PiNavigationArrowLight,
  PiCrosshairLight,
  PiImageLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";
import Spinner from "components/UI/Spinner.js";
import HelyszinMegjegyzesek from "components/Helyszin/HelyszinMegjegyzesek.js";
import { elokeszitFeltoltesre } from "utils/feltoltesElokeszites.js";
import { navigacioUrl } from "utils/helyEgyeztetes";

const getKind = (filename) => {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video";
  return "other";
};

function KepCsempe({ fajl, src, onBetoltve }) {
  const ref = useRef(null);
  const [hiba, setHiba] = useState(false);

  useEffect(() => {
    if (src || hiba) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const betolt = () =>
      fetchAction("downloadFile", { id: fajl.sorszam }).then((result) => {
        if (result?.success && result.mime?.startsWith("image/")) onBetoltve(fajl.sorszam, `data:${result.mime};base64,${result.file}`);
        else setHiba(true);
      });
    if (typeof IntersectionObserver === "undefined") {
      betolt();
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        betolt();
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fajl.sorszam, src, hiba]);

  return (
    <span ref={ref} className="flex h-full w-full items-center justify-center">
      {src && !hiba ? (
        <img src={src} alt={fajl.filename} className="h-full w-full object-cover" onError={() => setHiba(true)} />
      ) : hiba ? (
        <PiImageLight className="h-7 w-7 text-ink-400" />
      ) : (
        <Spinner wrapperClassName="flex" />
      )}
    </span>
  );
}

// A helyszín fotóit/videóit közvetlenül a képernyőn mutatjuk meg
// (nem böngésző-letöltést indítunk), hogy vezetés előtt/közben egy
// koppintással meg lehessen nézni a bejáratot/rámpát stb. Képeknél a
// rácsban is a valódi kép jelenik meg (nem csak egy ikon), videóknál egy
// lejátszás-ikonnal jelölt előnézeti "poszter" — magát a (jellemzően nagy)
// videófájlt csak koppintásra töltjük le, hogy a lista gyors maradjon.
export default function HelyszinReszletek() {
  const location = useLocation();
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
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
  const [cim, setCim] = useState(location.state?.data?.cim || "");
  const [pozicio, setPozicio] = useState(
    location.state?.data?.lat != null ? { lat: Number(location.state.data.lat), lng: Number(location.state.data.lng) } : null,
  );
  const [helyKeres, setHelyKeres] = useState(false);

  useEffect(() => {
    if (!preview) return undefined;
    const esc = (e) => e.key === "Escape" && setPreview(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [preview]);

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
      const result = await fetchAction("saveHelyszinData", {
        id: helyszin.id,
        nev: nev.trim(),
        cim: cim.trim() || null,
        lat: pozicio?.lat ?? null,
        lng: pozicio?.lng ?? null,
      });
      if (result?.success) {
        setHelyszin((prev) => ({ ...prev, nev: nev.trim(), cim: cim.trim() || null, lat: pozicio?.lat ?? null, lng: pozicio?.lng ?? null }));
        setEditingNev(false);
        toast.success("Mentve.");
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setSavingNev(false);
    }
  };

  const pozicioFrissitese = () => {
    if (!navigator.geolocation) {
      toast.error("A helymeghatározás nem támogatott ezen az eszközön.");
      return;
    }
    setHelyKeres(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPozicio({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setHelyKeres(false);
      },
      (err) => {
        setHelyKeres(false);
        toast.error(err?.code === 1 ? "A helyhozzáférés le van tiltva. Engedélyezd a beállításokban." : "Nem sikerült lekérni a helyzetet.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    let sikeres = 0;
    try {
      for (const eredeti of selectedFiles) {
        // eslint-disable-next-line no-await-in-loop
        const { file, hiba } = await elokeszitFeltoltesre(eredeti);
        if (hiba) {
          toast.error(hiba);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const base64File = await fileToBase64(file);
        // eslint-disable-next-line no-await-in-loop
        const result = await fetchAction(
          "fileUpload",
          { admin: user.admin, id: helyszin.id, tabla: "helyszin", file: base64File, name: file.name, size: file.size },
          { timeoutMs: 120000 },
        );
        if (result?.success) sikeres += 1;
        else toast.error(`${eredeti.name}: ${result?.message || "a feltöltés sikertelen."}`);
      }
      if (sikeres > 0) toast.success(sikeres === selectedFiles.length ? "Feltöltve." : `${sikeres}/${selectedFiles.length} fájl feltöltve.`);
      await loadFiles();
    } finally {
      setIsUploading(false);
    }
  };

  const nav = navigacioUrl(helyszin);

  if (!helyszin) return null;

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader title="Hely" vissza="/user/helyszinek" />

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        {editingNev ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={nev}
              onChange={(e) => setNev(e.target.value)}
              placeholder="Név"
              className="min-h-11 rounded-xl border border-ink-100 bg-slate-50 px-3 text-base font-bold text-ink-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <input
              value={cim}
              onChange={(e) => setCim(e.target.value)}
              placeholder="Cím (opcionális)"
              autoComplete="street-address"
              className="min-h-11 rounded-xl border border-ink-100 bg-slate-50 px-3 text-base text-ink-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="button"
              onClick={pozicioFrissitese}
              disabled={helyKeres}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${
                pozicio ? "bg-emerald-50 text-emerald-700" : "border border-ink-200 bg-white text-ink-700"
              }`}
            >
              <PiCrosshairLight className="h-5 w-5" />
              {helyKeres ? "Helyzet lekérése…" : pozicio ? "Pozíció mentve — frissítés a mostanira" : "Itt vagyok most — mentsd a pozíciót"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditingNev(false)} className="min-h-11 rounded-xl text-sm font-semibold text-ink-600 active:bg-slate-100">
                Mégse
              </button>
              <button
                type="button"
                onClick={handleSaveNev}
                disabled={savingNev || !nev.trim()}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PiCheckLight className="h-5 w-5" /> {savingNev ? "Mentés…" : "Mentés"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-ink-900">{helyszin.nev}</h2>
                {helyszin.cim && <p className="text-sm text-ink-500">{helyszin.cim}</p>}
              </div>
              <button
                type="button"
                onClick={() => setEditingNev(true)}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-slate-100 hover:text-ink-700"
                aria-label="Hely adatainak szerkesztése"
              >
                <PiPencilSimpleLight className="h-5 w-5" />
              </button>
            </div>
            {nav ? (
              <a
                href={nav}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-semibold text-white active:bg-brand-700"
              >
                <PiNavigationArrowLight className="h-5 w-5" /> Navigálás ide
              </a>
            ) : null}
            {helyszin.lat == null && (
              <button
                type="button"
                onClick={() => setEditingNev(true)}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-brand-600 active:bg-brand-50"
              >
                <PiCrosshairLight className="h-4 w-4" /> Pozíció hozzáadása a pontos navigációhoz
              </button>
            )}
          </>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Fotók / videók</h2>
          <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700">
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
          <div className="rounded-2xl border border-ink-100 bg-white p-6 text-center text-sm text-ink-500 shadow-soft">
            Még nincs fotó. Fotózd le a bejáratot, a rámpát vagy a parkolást — a kollégák is látni fogják.
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
                    <KepCsempe
                      fajl={f}
                      src={thumbs[f.sorszam]}
                      onBetoltve={(id, src) => setThumbs((prev) => ({ ...prev, [id]: src }))}
                    />
                  ) : kind === "video" ? (
                    <div className="flex h-full w-full items-center justify-center bg-ink-900/90">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-900">
                        <PiPlayFill className="h-4 w-4" />
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 p-2">
                      <PiFileLight className="h-6 w-6 text-ink-400" />
                      <span className="w-full truncate text-center text-xs text-ink-500">{f.filename}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Megjegyzések</h2>
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
        <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={preview.filename}>
          <div className="flex items-center justify-between p-4" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
            <p className="truncate pr-4 text-sm font-semibold text-white">{preview.filename}</p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
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
