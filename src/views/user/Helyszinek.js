import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PiMagnifyingGlassLight,
  PiMapPinLight,
  PiCaretRightLight,
  PiPlusLight,
  PiCrosshairLight,
  PiCheckCircleFill,
  PiChatCircleTextLight,
  PiImageLight,
  PiNavigationArrowLight,
  PiWifiSlashLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";
import Spinner from "components/UI/Spinner.js";
import HibaKartya from "components/UI/HibaKartya.js";
import { gyorsitotarazottLekeres, offlineCimke } from "utils/soforCache";
import { normalizaltNev, navigacioUrl } from "utils/helyEgyeztetes";

function tavolsagKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function tavolsagSzoveg(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString("hu-HU", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

function UjHelyUrlap({ kezdoNev, kezdoCim, onMegse, onKesz }) {
  const [nev, setNev] = useState(kezdoNev || "");
  const [cim, setCim] = useState(kezdoCim || "");
  const [pozicio, setPozicio] = useState(null);
  const [helyKeres, setHelyKeres] = useState(false);
  const [saving, setSaving] = useState(false);

  const itVagyok = () => {
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
        toast.error(
          err?.code === 1
            ? "A helyhozzáférés le van tiltva. Engedélyezd a böngésző / telefon beállításaiban."
            : "Nem sikerült lekérni a helyzetet. Próbáld újra.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const mentes = async (e) => {
    e.preventDefault();
    if (!nev.trim()) return;
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const result = await fetchAction("newHelyszin", {
        admin: user.admin,
        nev: nev.trim(),
        cim: cim.trim() || null,
        lat: pozicio?.lat ?? null,
        lng: pozicio?.lng ?? null,
      });
      if (result?.success) {
        toast.success("Hely rögzítve. Most már hozzáadhatsz megjegyzést és fotót.");
        onKesz(result.helyszin);
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setSaving(false);
    }
  };

  const mezo =
    "min-h-11 w-full rounded-xl border border-ink-100 bg-slate-50 px-3 text-base text-ink-900 placeholder-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300";

  return (
    <form onSubmit={mentes} className="flex flex-col gap-2.5 rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
      <p className="text-base font-bold text-brand-900">Új hely</p>
      <input
        autoFocus={!kezdoNev}
        value={nev}
        onChange={(e) => setNev(e.target.value)}
        placeholder="Név (pl. Solymár Auchan, rámpa 3)"
        enterKeyHint="next"
        className={mezo}
      />
      <input
        value={cim}
        onChange={(e) => setCim(e.target.value)}
        placeholder="Cím (opcionális)"
        autoComplete="street-address"
        enterKeyHint="done"
        className={mezo}
      />
      <button
        type="button"
        onClick={itVagyok}
        disabled={helyKeres}
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${
          pozicio ? "bg-emerald-50 text-emerald-700" : "border border-ink-200 bg-white text-ink-700"
        }`}
      >
        {pozicio ? <PiCheckCircleFill className="h-5 w-5" /> : <PiCrosshairLight className="h-5 w-5" />}
        {helyKeres ? "Helyzet lekérése…" : pozicio ? "Pozíció rögzítve — ide navigál majd" : "Itt vagyok most — mentsd a pozíciót"}
      </button>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button type="button" onClick={onMegse} className="min-h-11 rounded-xl text-sm font-semibold text-ink-600 active:bg-slate-100">
          Mégse
        </button>
        <button
          type="submit"
          disabled={saving || !nev.trim()}
          className="min-h-11 rounded-xl bg-brand-600 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Mentés…" : "Hely mentése"}
        </button>
      </div>
    </form>
  );
}

export default function Helyszinek() {
  const history = useHistory();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [helyszinek, setHelyszinek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hiba, setHiba] = useState(null);
  const [offlineIdo, setOfflineIdo] = useState(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(params.get("uj") === "1");
  const [sajatPozicio, setSajatPozicio] = useState(null);

  const load = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    setHiba(null);
    const { result, offlineIdo: ido } = await gyorsitotarazottLekeres("helyszinek", "getHelyszinek", { id: user.admin });
    if (result?.success) setHelyszinek(result.helyszinek || []);
    else setHiba(result?.message || "Nem sikerült betölteni a helyeket.");
    setOfflineIdo(ido);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => setSajatPozicio({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { maximumAge: 300000, timeout: 8000 },
        );
      })
      .catch(() => {});
  }, []);

  const lista = useMemo(() => {
    const kifejezes = normalizaltNev(search);
    const szurt = helyszinek.filter((h) => !kifejezes || normalizaltNev(`${h.nev} ${h.cim || ""}`).includes(kifejezes));
    const tavval = szurt.map((h) => ({
      ...h,
      _tav: sajatPozicio && h.lat != null && h.lng != null ? tavolsagKm(sajatPozicio, { lat: Number(h.lat), lng: Number(h.lng) }) : null,
    }));
    return tavval.sort((a, b) => {
      if (a._tav != null && b._tav != null) return a._tav - b._tav;
      if (a._tav != null) return -1;
      if (b._tav != null) return 1;
      return (a.nev || "").localeCompare(b.nev || "", "hu");
    });
  }, [helyszinek, search, sajatPozicio]);

  const megnyit = (h) => history.push("/user/helyszin-reszletek", { data: h });

  return (
    <div className="flex flex-col gap-3">
      <MobileHeader
        title="Helyek"
        back={false}
        action={
          !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-11 items-center gap-1 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white active:bg-brand-700"
            >
              <PiPlusLight className="h-4 w-4" /> Új hely
            </button>
          )
        }
      />

      {adding && (
        <UjHelyUrlap
          kezdoNev={params.get("nev")}
          kezdoCim={params.get("cim")}
          onMegse={() => {
            setAdding(false);
            if (params.get("uj")) history.replace("/user/helyszinek");
          }}
          onKesz={(h) => history.replace("/user/helyszin-reszletek", { data: h })}
        />
      )}

      {offlineIdo && (
        <p className="flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm text-white">
          <PiWifiSlashLight className="h-4 w-4 flex-shrink-0" />
          {offlineCimke(offlineIdo)}
        </p>
      )}

      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 focus-within:ring-2 focus-within:ring-brand-300">
        <PiMagnifyingGlassLight className="h-5 w-5 flex-shrink-0 text-ink-400" />
        <input
          type="search"
          enterKeyHint="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hely neve vagy címe"
          aria-label="Helyek keresése"
          className="w-full border-0 bg-transparent p-0 text-base text-ink-900 placeholder-ink-400 shadow-none focus:outline-none focus:ring-0"
        />
      </label>

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : hiba ? (
        <HibaKartya uzenet={hiba} onRetry={load} />
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-soft">
          <PiMapPinLight className="h-8 w-8 text-ink-400" />
          <p className="text-sm text-ink-500">
            {helyszinek.length === 0
              ? "Még nincs mentett hely. Rögzítsd a felrakó- és lerakóhelyeket, hogy a kollégák is lássák a bejárat, a rámpa vagy a parkolás tudnivalóit."
              : "Nincs a keresésnek megfelelő hely."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sajatPozicio && lista.some((h) => h._tav != null) && (
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Közelben elöl</p>
          )}
          {lista.map((h) => {
            const nav = navigacioUrl(h);
            return (
              <div key={h.id} className="flex items-stretch overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
                <button type="button" onClick={() => megnyit(h)} className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left active:bg-slate-50">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <PiMapPinLight className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-ink-900">{h.nev}</span>
                    <span className="flex items-center gap-3 text-sm text-ink-500">
                      {h._tav != null && <span className="font-semibold text-brand-700">{tavolsagSzoveg(h._tav)}</span>}
                      {h.megjegyzesek_szama > 0 && (
                        <span className="flex items-center gap-1">
                          <PiChatCircleTextLight className="h-4 w-4" /> {h.megjegyzesek_szama}
                        </span>
                      )}
                      {h.fajlok_szama > 0 && (
                        <span className="flex items-center gap-1">
                          <PiImageLight className="h-4 w-4" /> {h.fajlok_szama}
                        </span>
                      )}
                      {!h._tav && !h.megjegyzesek_szama && !h.fajlok_szama && <span>{h.cim || "Még nincs jegyzet"}</span>}
                    </span>
                    {h.utolso_megjegyzes && <span className="block truncate text-sm text-ink-600">„{h.utolso_megjegyzes}”</span>}
                  </span>
                  <PiCaretRightLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
                </button>
                {nav && (h.lat != null || h.cim) && (
                  <a
                    href={nav}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Navigálás ide: ${h.nev}`}
                    className="flex w-16 flex-shrink-0 flex-col items-center justify-center gap-1 border-l border-ink-100 text-xs font-semibold text-brand-600 active:bg-brand-50"
                  >
                    <PiNavigationArrowLight className="h-6 w-6" />
                    Navigálás
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
