import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { PiCameraLight, PiFilePdfLight, PiTrashLight, PiScalesLight, PiStackLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import StatChip from "components/UI/StatChip.js";
import NoteCard from "components/UI/NoteCard.js";
import { RouteCardSkeleton } from "components/UI/Skeleton.js";
import RouteTimelineCard from "components/Fuvarok/RouteTimelineCard.js";

// A push-értesítésből érkező kattintás egy sima URL-t nyit meg (a service
// worker-nek nincs React Router state-je, amit átadhatna), ezért ez az
// oldal MINDKÉT belépési utat kezeli: `location.state?.data` a lista felől
// navigálva (gyors, nincs extra lekérdezés), `?id=` query paraméter a
// push-deep-linkből érkezve (ekkor frissen lekérdezzük getSajatFuvar()-ral).
function useQueryParam(name) {
  const location = useLocation();
  return new URLSearchParams(location.search).get(name);
}

function DokumentumFotoSor({ fajl, onDeleted }) {
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const [torles, setTorles] = useState(false);
  const isKep = fajl.fajl_kategoria === "kep";
  const rowRef = useRef(null);

  useEffect(() => {
    if (!isKep || thumbSrc || thumbHiba) return undefined;
    const node = rowRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        fetchAction("downloadFile", { id: fajl.sorszam })
          .then((result) => {
            if (result?.success && result.mime?.startsWith("image/")) {
              setThumbSrc(`data:${result.mime};base64,${result.file}`);
            } else {
              setThumbHiba(true);
            }
          })
          .catch(() => setThumbHiba(true));
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKep, fajl.sorszam]);

  const handleDelete = async () => {
    const ok = await confirmDialog(`Biztosan törlöd a(z) "${fajl.filename}" fotót?`, { confirmLabel: "Törlés" });
    if (!ok) return;
    setTorles(true);
    const result = await fetchAction("torolSajatFuvarDokumentumot", { fajlId: fajl.sorszam });
    if (result?.success) {
      onDeleted(fajl.sorszam);
    } else {
      toast.error(result?.message || "A törlés sikertelen.");
      setTorles(false);
    }
  };

  return (
    <div ref={rowRef} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-2.5">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
        {isKep && thumbSrc ? (
          <img src={thumbSrc} alt={fajl.filename} className="h-full w-full object-cover" />
        ) : (
          <PiFilePdfLight className="h-6 w-6 text-ink-400" />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-xs text-ink-600">{fajl.filename}</p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={torles}
        aria-label="Fotó törlése"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <PiTrashLight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FeltoltoSzekcio({ cim, tipus, kotelezo, fajlok, onUploaded, onDeleted }) {
  const [uploading, setUploading] = useState(false);
  const sajatFajlok = fajlok.filter((f) => f.cimkek === tipus);
  const hianyzik = kotelezo && sajatFajlok.length === 0;

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        // eslint-disable-next-line no-await-in-loop
        const result = await fetchAction("feltoltFuvarDokumentumot", {
          fuvarId: onUploaded.fuvarId,
          tipus,
          file: base64,
          name: file.name,
          size: file.size,
        });
        if (!result?.success) {
          toast.error(result?.message || `${file.name}: a feltöltés sikertelen.`);
        }
      }
      toast.success("Feltöltve.");
      onUploaded.reload();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className={hianyzik ? "rounded-2xl border border-amber-200 bg-amber-50/40 p-3" : ""}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{cim}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            kotelezo ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-ink-400"
          }`}
        >
          {kotelezo ? "Kötelező" : "Opcionális"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {sajatFajlok.map((f) => (
          <DokumentumFotoSor key={f.sorszam} fajl={f} onDeleted={onDeleted} />
        ))}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white py-4 text-center">
          {uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          ) : (
            <PiCameraLight className="h-5 w-5 text-brand-600" />
          )}
          <span className="text-sm font-semibold text-ink-700">
            {uploading ? "Feltöltés…" : "Fotó hozzáadása"}
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>
    </div>
  );
}

export default function FuvarReszletek() {
  const location = useLocation();
  const history = useHistory();
  const idParam = useQueryParam("id");

  const [fuvar, setFuvar] = useState(location.state?.data || null);
  const [fajlok, setFajlok] = useState([]);
  const [loading, setLoading] = useState(!location.state?.data);

  const user = JSON.parse(localStorage.getItem("user"));

  const loadFuvar = useCallback(async () => {
    if (location.state?.data) return;
    if (!idParam) {
      history.push("/user/fuvarok");
      return;
    }
    setLoading(true);
    const result = await fetchAction("getSajatFuvar", { sofor_id: user.id, id: idParam });
    if (result?.success) {
      setFuvar(result.fuvar);
    } else {
      toast.error(result?.message || "A fuvar nem található.");
      history.push("/user/fuvarok");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  useEffect(() => {
    loadFuvar();
  }, [loadFuvar]);

  const loadFajlok = useCallback(async () => {
    if (!fuvar?.id) return;
    const result = await fetchAction("getSajatFuvarDokumentumai", { fuvarId: fuvar.id });
    if (result?.success) setFajlok(result.files || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuvar?.id]);

  useEffect(() => {
    loadFajlok();
  }, [loadFajlok]);

  if (loading || !fuvar) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <MobileHeader title="Fuvar" />
        <RouteCardSkeleton />
      </div>
    );
  }

  const felrakoTeljesCim = [fuvar.felrako_ceg, fuvar.felrako_cim].filter(Boolean).join(", ");
  const lerakoTeljesCim = [fuvar.lerako_ceg, fuvar.lerako_cim].filter(Boolean).join(", ");
  const megbizoTeljesCim = [fuvar.megbizo_irsz, fuvar.megbizo_varos, fuvar.megbizo_cim].filter(Boolean).join(", ");
  const utvonaltervEleheto = Boolean(felrakoTeljesCim && lerakoTeljesCim);

  const handleUtvonalterv = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(felrakoTeljesCim)}&destination=${encodeURIComponent(lerakoTeljesCim)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <MobileHeader title="Fuvar" />
        <StatusBadge tone={fuvar.dokumentum_feltoltve ? "success" : "brand"}>
          {fuvar.dokumentum_feltoltve ? "Dokumentálva" : "Aktív"}
        </StatusBadge>
      </div>

      <RouteTimelineCard
        felrako={{ ceg: fuvar.felrako_ceg, cim: fuvar.felrako_cim, datum: fuvar.felrakas_datuma }}
        lerako={{ ceg: fuvar.lerako_ceg, cim: fuvar.lerako_cim, datum: fuvar.lerakas_datuma }}
        tavolsagKm={fuvar.tavolsag_km}
        aru={fuvar.aru_megnevezese}
        megbizoNev={fuvar.megbizo_nev}
        megbizoCim={megbizoTeljesCim}
        onUtvonalterv={handleUtvonalterv}
        eleheto={utvonaltervEleheto}
      />

      <FeltoltoSzekcio
        cim="Menetlevél"
        tipus="menetlevel"
        kotelezo
        fajlok={fajlok}
        onUploaded={{ fuvarId: fuvar.id, reload: loadFajlok }}
        onDeleted={loadFajlok}
      />
      <FeltoltoSzekcio
        cim="Szállítólevél"
        tipus="szallitolevel"
        kotelezo={false}
        fajlok={fajlok}
        onUploaded={{ fuvarId: fuvar.id, reload: loadFajlok }}
        onDeleted={loadFajlok}
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatChip icon={PiScalesLight} value={fuvar.tomeg_tonna != null ? `${fuvar.tomeg_tonna} t` : null} label="Tömeg" />
        <StatChip icon={PiStackLight} value={fuvar.raklapszam ?? null} label="Raklap" />
      </div>

      <NoteCard text={fuvar.megjegyzes} />
    </div>
  );
}
