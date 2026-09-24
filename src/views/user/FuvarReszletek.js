import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import { PiCameraLight, PiFilePdfLight, PiTrashLight, PiScalesLight, PiStackLight, PiImagesLight, PiCloudArrowUpLight, PiMapPinLight, PiPhoneLight, PiNotePencilLight, PiCaretRightLight, PiWifiSlashLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";
import StatChip from "components/UI/StatChip.js";
import NoteCard from "components/UI/NoteCard.js";
import { RouteCardSkeleton } from "components/UI/Skeleton.js";
import RouteTimelineCard from "components/Fuvarok/RouteTimelineCard.js";
import { sorElemei, feliratkozasSorValtozasra, sorUritese } from "utils/feltoltesiSor.js";
import { fuvarDokumentumokFeltoltese } from "utils/fuvarDokumentumFeltoltes.js";
import { gyorsitotarazottLekeres, offlineCimke } from "utils/soforCache";
import { helyKeresese } from "utils/helyEgyeztetes";

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
      <p className="min-w-0 flex-1 truncate text-sm text-ink-600">{fajl.filename}</p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={torles}
        aria-label="Fotó törlése"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <PiTrashLight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FeltoltoSzekcio({ cim, tipus, kotelezo, fajlok, fuggoben, onUploaded, onDeleted, kiemelt, szekcioRef }) {
  const [uploading, setUploading] = useState(false);
  const sajatFajlok = fajlok.filter((f) => f.cimkek === tipus);
  const sajatFuggo = fuggoben.filter((f) => f.tipus === tipus);
  const hianyzik = kotelezo && sajatFajlok.length === 0 && sajatFuggo.length === 0;

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const { sikeres } = await fuvarDokumentumokFeltoltese(onUploaded.fuvarId, tipus, files);
      if (sikeres > 0) onUploaded.reload(tipus);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      ref={szekcioRef}
      className={`scroll-mt-24 transition-shadow duration-500 ${hianyzik ? "rounded-2xl border border-amber-200 bg-amber-50/40 p-3" : ""} ${
        kiemelt ? "rounded-2xl ring-4 ring-brand-300" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">{cim}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
            kotelezo ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-ink-500"
          }`}
        >
          {kotelezo ? "Kötelező" : "Opcionális"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {sajatFajlok.map((f) => (
          <DokumentumFotoSor key={f.sorszam} fajl={f} onDeleted={onDeleted} />
        ))}
        {sajatFuggo.map((f) => (
          <div key={`sor-${f.id}`} className="flex items-center gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2.5">
            <PiCloudArrowUpLight className="h-6 w-6 flex-shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink-700">{f.nev}</p>
              <p className="text-xs text-amber-700">Függőben — feltöltjük, amint van térerő</p>
            </div>
          </div>
        ))}
        {uploading ? (
          <div className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            <span className="text-sm font-semibold text-ink-700">Feltöltés…</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white active:bg-brand-700">
              <PiCameraLight className="h-5 w-5" />
              Fotó készítése
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            </label>
            <label className="flex min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 active:bg-slate-50">
              <PiImagesLight className="h-5 w-5 text-brand-600" />
              Galéria / PDF
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileChange} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function HelyInfo({ hely, cegNev, cim }) {
  if (hely) {
    const reszletek = [
      hely.megjegyzesek_szama ? `${hely.megjegyzesek_szama} megjegyzés` : null,
      hely.fajlok_szama ? `${hely.fajlok_szama} fotó/videó` : null,
    ].filter(Boolean);
    return (
      <Link
        to={{ pathname: "/user/helyszin-reszletek", state: { data: hely } }}
        className="mt-2 flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 active:bg-emerald-100"
      >
        <PiMapPinLight className="h-5 w-5 flex-shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{reszletek.length ? reszletek.join(" · ") : "Van jegyzet erről a helyről"}</span>
          {hely.utolso_megjegyzes && <span className="block truncate text-emerald-700">„{hely.utolso_megjegyzes}”</span>}
        </span>
        <PiCaretRightLight className="h-4 w-4 flex-shrink-0" />
      </Link>
    );
  }
  if (!cegNev) return null;
  const params = new URLSearchParams({ uj: "1", nev: cegNev });
  if (cim) params.set("cim", cim);
  return (
    <Link
      to={`/user/helyszinek?${params.toString()}`}
      className="mt-2 flex min-h-11 w-fit items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-brand-600 active:bg-brand-50"
    >
      <PiNotePencilLight className="h-4 w-4" />
      Jegyzet ehhez a helyhez
    </Link>
  );
}

export default function FuvarReszletek() {
  const location = useLocation();
  const history = useHistory();
  const idParam = useQueryParam("id");

  const [fuvar, setFuvar] = useState(location.state?.data || null);
  const [fajlok, setFajlok] = useState([]);
  const [fuggoben, setFuggoben] = useState([]);
  const [helyszinek, setHelyszinek] = useState([]);
  const [diszpecser, setDiszpecser] = useState(null);
  const [offlineIdo, setOfflineIdo] = useState(null);
  const [kiemeltSzekcio, setKiemeltSzekcio] = useState(null);
  const menetlevelRef = useRef(null);
  const feltoltesCel = useQueryParam("feltoltes");
  const [loading, setLoading] = useState(!location.state?.data);

  const user = JSON.parse(localStorage.getItem("user"));

  const loadFuvar = useCallback(async () => {
    if (location.state?.data) return;
    if (!idParam) {
      history.push("/user/fuvarok");
      return;
    }
    setLoading(true);
    const { result, offlineIdo: ido } = await gyorsitotarazottLekeres(`fuvar_${idParam}`, "getSajatFuvar", { sofor_id: user.id, id: idParam });
    setOfflineIdo(ido);
    if (result?.success) {
      setFuvar(result.fuvar);
    } else if (result?.halozatiHiba) {
      toast.error("Nincs kapcsolat, és ez a fuvar még nincs elmentve a telefonon.");
      history.push("/user/fuvarok");
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

  useEffect(() => {
    if (!fuvar?.id) return undefined;
    const frissit = () => sorElemei(fuvar.id).then(setFuggoben);
    frissit();
    const leiratkozas = feliratkozasSorValtozasra(() => {
      frissit();
      if (navigator.onLine !== false) loadFajlok();
    });
    if (navigator.onLine !== false) sorUritese();
    return leiratkozas;
  }, [fuvar?.id, loadFajlok]);

  useEffect(() => {
    gyorsitotarazottLekeres("helyszinek", "getHelyszinek", { id: user.admin }).then(({ result }) => {
      if (result?.success) setHelyszinek(result.helyszinek || []);
    });
    fetchAction("getAdminElerhetoseg", { id: user.admin }).then((result) => {
      if (result?.success && result.phone) setDiszpecser({ name: result.name, phone: result.phone });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !fuvar || feltoltesCel !== "menetlevel" || !menetlevelRef.current) return undefined;
    menetlevelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    setKiemeltSzekcio("menetlevel");
    const t = setTimeout(() => setKiemeltSzekcio(null), 2500);
    return () => clearTimeout(t);
  }, [loading, fuvar, feltoltesCel]);

  const handleFeltoltve = (tipus) => {
    loadFajlok();
    if (tipus === "menetlevel") {
      setFuvar((f) => (f && !f.dokumentum_feltoltve ? { ...f, dokumentum_feltoltve: new Date().toISOString() } : f));
    }
  };

  if (loading || !fuvar) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <MobileHeader title="Fuvar" vissza="/user/fuvarok" />
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
      <MobileHeader
        vissza="/user/fuvarok"
        title="Fuvar"
        action={
          <StatusBadge tone={fuvar.dokumentum_feltoltve ? "success" : fuvar.allapot === "teljesitve" ? "neutral" : "info"}>
            {fuvar.dokumentum_feltoltve ? "Dokumentálva" : fuvar.allapot === "teljesitve" ? "Lezárva" : "Aktív"}
          </StatusBadge>
        }
      />

      {offlineIdo && (
        <p className="flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm text-white">
          <PiWifiSlashLight className="h-4 w-4 flex-shrink-0" />
          {offlineCimke(offlineIdo)}
        </p>
      )}

      <RouteTimelineCard
        felrako={{ ceg: fuvar.felrako_ceg, cim: fuvar.felrako_cim, datum: fuvar.felrakas_datuma }}
        lerako={{ ceg: fuvar.lerako_ceg, cim: fuvar.lerako_cim, datum: fuvar.lerakas_datuma }}
        tavolsagKm={fuvar.tavolsag_km}
        aru={fuvar.aru_megnevezese}
        megbizoNev={fuvar.megbizo_nev}
        megbizoCim={megbizoTeljesCim}
        onUtvonalterv={handleUtvonalterv}
        eleheto={utvonaltervEleheto}
        felrakoExtra={<HelyInfo hely={helyKeresese(helyszinek, fuvar.felrako_ceg)} cegNev={fuvar.felrako_ceg} cim={fuvar.felrako_cim} />}
        lerakoExtra={<HelyInfo hely={helyKeresese(helyszinek, fuvar.lerako_ceg)} cegNev={fuvar.lerako_ceg} cim={fuvar.lerako_cim} />}
      />

      {diszpecser?.phone && (
        <a
          href={`tel:${diszpecser.phone.replace(/[^\d+]/g, "")}`}
          className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white text-base font-semibold text-ink-800 active:bg-slate-50"
        >
          <PiPhoneLight className="h-5 w-5 text-brand-600" />
          Diszpécser hívása
        </a>
      )}

      <FeltoltoSzekcio
        cim="Menetlevél"
        tipus="menetlevel"
        kotelezo
        szekcioRef={menetlevelRef}
        kiemelt={kiemeltSzekcio === "menetlevel"}
        fajlok={fajlok}
        fuggoben={fuggoben}
        onUploaded={{ fuvarId: fuvar.id, reload: handleFeltoltve }}
        onDeleted={loadFajlok}
      />
      <FeltoltoSzekcio
        cim="Szállítólevél"
        tipus="szallitolevel"
        kotelezo={false}
        fajlok={fajlok}
        fuggoben={fuggoben}
        onUploaded={{ fuvarId: fuvar.id, reload: handleFeltoltve }}
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
