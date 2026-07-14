import React, { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { useHistory } from "react-router-dom";
import { PiArrowClockwiseLight, PiMapTrifoldLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import Modal from "components/UI/Modal.js";
import FlottaKpiKartyak from "components/Flottakovetes/FlottaKpiKartyak.js";
import FlottaSzurok from "components/Flottakovetes/FlottaSzurok.js";
import JarmuLista from "components/Flottakovetes/JarmuLista.js";
import FlottaTerkep from "components/Flottakovetes/FlottaTerkep.js";
import JarmuReszletek from "components/Flottakovetes/JarmuReszletek.js";
import { dusitottPoziciok } from "utils/gpsmartHelpers.js";

const FRISSITES_MS = 60000; // pozíció-lekérdezés gyakorisága
const ORA_FRISSITES_MS = 30000; // a relatív időkijelzések ("X perce") ehhez képest frissülnek

function KpiVaz() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100"
        >
          <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-10 animate-pulse rounded bg-slate-100" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TartalomVaz() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="h-[360px] animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 xl:col-span-3 xl:h-[640px]" />
      <div className="h-[420px] animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 md:h-[520px] xl:col-span-6 xl:h-[640px]" />
      <div className="hidden animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 xl:col-span-3 xl:block xl:h-[640px]" />
    </div>
  );
}

export default function Flottakovetes() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const history = useHistory();
  const isXl = useMediaQuery({ minWidth: 1280 });

  const [checking, setChecking] = useState(true);
  const [vanBeallitva, setVanBeallitva] = useState(false);
  const [loading, setLoading] = useState(false);
  const [poziciok, setPoziciok] = useState([]);
  const [frissitve, setFrissitve] = useState(null);

  const [kivalasztott, setKivalasztott] = useState(null);
  const [kovetesEnabled, setKovetesEnabled] = useState(false);
  const [kereses, setKereses] = useState("");
  const [statuszSzuro, setStatuszSzuro] = useState("mind");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ORA_FRISSITES_MS);
    return () => clearInterval(id);
  }, []);

  const loadPoziciok = async () => {
    setLoading(true);
    try {
      const result = await fetchAction("gpsmartPoziciok", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
      });
      if (result?.success) {
        setPoziciok(result.poziciok || []);
        setFrissitve(new Date());
      } else {
        toast.error(result?.message || "Nem sikerült lekérdezni a pozíciókat.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAction("getGpsmartBeallitasokStatusz", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    }).then((result) => {
      setVanBeallitva(!!result?.van_beallitva);
      setChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (checking || !vanBeallitva) return;
    loadPoziciok();
    // A kamionok folyamatosan mozognak, de ehhez nem kell élő, másodperces
    // push — egy perces automatikus újratöltés elég ahhoz, hogy ne kelljen
    // kézzel nyomogatni a frissítés gombot.
    const id = setInterval(loadPoziciok, FRISSITES_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, vanBeallitva]);

  // Egyetlen helyen számoljuk ki minden levezetett mezőt (állapot, relatív
  // idő, számmá alakított sebesség/üzemanyag) — a KPI-k, a lista, a térkép
  // és a részletek panel mind ugyanazt a "dúsított" tömböt kapja.
  const dusitett = useMemo(() => dusitottPoziciok(poziciok, now), [poziciok, now]);

  const szurt = useMemo(() => {
    const keresesLower = kereses.trim().toLowerCase();
    return dusitett.filter((p) => {
      if (statuszSzuro !== "mind" && p._allapot.kulcs !== statuszSzuro) return false;
      if (keresesLower) {
        const egyesitett = `${p.rendszam} ${p.cim || ""}`.toLowerCase();
        if (!egyesitett.includes(keresesLower)) return false;
      }
      return true;
    });
  }, [dusitett, kereses, statuszSzuro]);

  const kivalasztottJarmu = dusitett.find((p) => p.rendszam === kivalasztott) || null;
  const toggleKoveses = () => setKovetesEnabled((v) => !v);
  const torolKivalasztast = () => {
    setKivalasztott(null);
    setKovetesEnabled(false);
  };

  const elsoBetoltesFolyamatban = loading && poziciok.length === 0 && frissitve === null;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <PageHeader
        eyebrow="Flotta"
        title="Flottakövetés"
        className="mb-0"
        action={
          vanBeallitva && (
            <div className="flex items-center gap-3">
              {frissitve && (
                <span className="text-xs text-ink-400">
                  Frissítve: {frissitve.toLocaleTimeString("hu-HU")}
                </span>
              )}
              <button
                type="button"
                onClick={loadPoziciok}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 shadow-soft transition-all duration-300 ease-fluid hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95 disabled:cursor-wait disabled:opacity-60"
              >
                <PiArrowClockwiseLight className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Frissítés
              </button>
            </div>
          )
        }
      />
      <p className="-mt-3 max-w-2xl text-sm text-ink-500">
        A kamionok pillanatnyi pozíciója a GPSmart flottakövető rendszerből,
        percenként automatikusan frissítve.
      </p>

      {checking ? (
        <>
          <KpiVaz />
          <TartalomVaz />
        </>
      ) : !vanBeallitva ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-10 text-center shadow-soft ring-1 ring-ink-100">
          <PiMapTrifoldLight className="h-10 w-10 text-ink-200" />
          <p className="max-w-md text-sm text-ink-500">
            A GPSmart flottakövetés kapcsolat még nincs beállítva ehhez a
            céghez. Állítsd be a{" "}
            <button
              type="button"
              onClick={() => history.push("/admin/settings")}
              className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
            >
              Beállítások
            </button>{" "}
            oldalon (ugyanazokkal az adatokkal, amikkel a
            flottanavigacio.gpsmart.eu oldalra szoktatok bejelentkezni),
            utána itt megjelennek a kamionok pillanatnyi pozíciói.
          </p>
        </div>
      ) : elsoBetoltesFolyamatban ? (
        <>
          <KpiVaz />
          <TartalomVaz />
        </>
      ) : (
        <>
          <FlottaKpiKartyak dusitett={dusitett} />

          <FlottaSzurok
            kereses={kereses}
            onKeresesChange={setKereses}
            statuszSzuro={statuszSzuro}
            onStatuszSzuroChange={setStatuszSzuro}
            talalatSzam={szurt.length}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="order-2 h-[360px] xl:order-1 xl:col-span-3 xl:h-[640px]">
              <JarmuLista rows={szurt} kivalasztott={kivalasztott} onSelect={setKivalasztott} />
            </div>

            <div className="order-1 h-[420px] md:h-[520px] xl:order-2 xl:col-span-6 xl:h-[640px]">
              <FlottaTerkep
                dusitett={szurt}
                kivalasztott={kivalasztott}
                onSelect={setKivalasztott}
                kovetesEnabled={kovetesEnabled}
                onKovetesToggle={toggleKoveses}
              />
            </div>

            {isXl && (
              <div className="order-3 xl:col-span-3 xl:h-[640px]">
                <JarmuReszletek
                  jarmu={kivalasztottJarmu}
                  kovetesEnabled={kovetesEnabled}
                  onKovetesToggle={toggleKoveses}
                  onClose={torolKivalasztast}
                />
              </div>
            )}
          </div>
        </>
      )}

      {!isXl && (
        <Modal
          open={!!kivalasztottJarmu}
          onClose={torolKivalasztast}
          title={kivalasztottJarmu?.rendszam || "Jármű részletei"}
        >
          <JarmuReszletek
            jarmu={kivalasztottJarmu}
            kompakt
            kovetesEnabled={kovetesEnabled}
            onKovetesToggle={toggleKoveses}
          />
        </Modal>
      )}
    </div>
  );
}
