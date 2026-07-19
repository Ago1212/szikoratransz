import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { useHistory } from "react-router-dom";
import { PiArrowClockwiseLight, PiMapTrifoldLight, PiGaugeLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import Modal from "components/UI/Modal.js";
import FlottaKpiKartyak from "components/Flottakovetes/FlottaKpiKartyak.js";
import FlottaSzurok from "components/Flottakovetes/FlottaSzurok.js";
import JarmuLista from "components/Flottakovetes/JarmuLista.js";
import FlottaTerkep from "components/Flottakovetes/FlottaTerkep.js";
import JarmuReszletek from "components/Flottakovetes/JarmuReszletek.js";
import ElozmenyekModal from "components/Flottakovetes/ElozmenyekModal.js";
import KihasznaltsagiModal from "components/Flottakovetes/KihasznaltsagiModal.js";
import { dusitottPoziciok } from "utils/gpsmartHelpers.js";

const FRISSITES_MS = 60000; // pozíció-lekérdezés gyakorisága
const ORA_FRISSITES_MS = 30000; // a relatív időkijelzések ("X perce") ehhez képest frissülnek

function KpiVaz() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800"
        >
          <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-ink-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-10 animate-pulse rounded bg-slate-100 dark:bg-ink-800" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100 dark:bg-ink-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TartalomVaz() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="h-[360px] animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800 xl:col-span-3 xl:h-[640px]" />
      <div className="h-[420px] animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800 md:h-[520px] xl:col-span-6 xl:h-[640px]" />
      <div className="hidden animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800 xl:col-span-3 xl:block xl:h-[640px]" />
    </div>
  );
}

export default function Flottakovetes() {
  const user = JSON.parse(localStorage.getItem("user"));
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
  const [elozmenyekOpen, setElozmenyekOpen] = useState(false);
  const [utvonalPontok, setUtvonalPontok] = useState(null);
  const [kihasznaltsagOpen, setKihasznaltsagOpen] = useState(false);

  // "Megtett út (ma)" — SZÁNDÉKOSAN külön állapot/hívás a pozícióktól. A
  // gpsmartMegtettUtMa action jármű-önkénti élő útvonal-lekérdezést futtat
  // (ld. gpsmartInterface.php komment), ami érezhetően lassabb lehet, mint
  // az egyetlen HTML-táblát betöltő pozíció-lekérdezés — ezért ez NEM
  // csatlakozik az automatikus 60mp-es projekthez, csak a kézi "Frissítés"
  // gombhoz (ld. handleFrissites lent), hogy a lista/térkép frissülése
  // sosem várjon meg rá.
  const [megtettUtLoading, setMegtettUtLoading] = useState(false);
  const [megtettUtAdatok, setMegtettUtAdatok] = useState({});
  const [megtettUtFrissitve, setMegtettUtFrissitve] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ORA_FRISSITES_MS);
    return () => clearInterval(id);
  }, []);

  // R34 (fejlesztési audit, 2026-07-19): a 60mp-es automatikus poll és a
  // kézi "Frissítés" gomb (handleFrissites) néha egymáshoz közel indulhat
  // (pl. valaki pont akkor kattint, amikor az automatikus kör is lefut) —
  // enélkül egy lassabb, korábban indult hívás válasza egy közben indult,
  // gyorsabb hívás eredményét írhatta volna felül, elavult adatot mutatva.
  // Ugyanaz a "csak a legutóbb indított hívás eredménye számít" minta, mint
  // amit a GlobalSearch.js már használ a keresésre.
  const poziciokKerelemId = useRef(0);
  const loadPoziciok = async () => {
    const sajatKerelemId = ++poziciokKerelemId.current;
    setLoading(true);
    try {
      const result = await fetchAction("gpsmartPoziciok", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
      });
      if (sajatKerelemId !== poziciokKerelemId.current) return;
      if (result?.success) {
        setPoziciok(result.poziciok || []);
        setFrissitve(new Date());
      } else {
        toast.error(result?.message || "Nem sikerült lekérdezni a pozíciókat.");
      }
    } finally {
      if (sajatKerelemId === poziciokKerelemId.current) setLoading(false);
    }
  };

  const loadMegtettUt = async () => {
    setMegtettUtLoading(true);
    try {
      const result = await fetchAction("gpsmartMegtettUtMa", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
      });
      if (result?.success) {
        // A `kamion_id`/`furgon_id` külön-külön ütközhetne (pl. 1-es
        // kamion és 1-es furgon egyaránt létezik) — a térkép kulcsa ezért
        // `jarmu_tipus:id` összetett kulcs, ugyanaz a minta, mint a
        // gpsmart_napi_km táblánál és a CardUzemanyagElemzes.js-ben.
        const terkep = {};
        (result.jarmuvek || []).forEach((j) => {
          const tipus = j.jarmu_tipus || (j.kamion_id ? "kamion" : "furgon");
          const id = j.kamion_id ?? j.furgon_id;
          terkep[`${tipus}:${id}`] = j.megtettUtMa;
        });
        setMegtettUtAdatok(terkep);
        setMegtettUtFrissitve(new Date());
      } else {
        toast.error(result?.message || "Nem sikerült lekérdezni a megtett utat.");
      }
    } finally {
      setMegtettUtLoading(false);
    }
  };

  // A fejléc "Frissítés" gombja mindkettőt elindítja, de két FÜGGETLEN
  // hívásként (nem `await`-elik egymást) — a lassabb megtett-út-lekérdezés
  // sosem tartja vissza a pozíciók/térkép frissülését.
  const handleFrissites = () => {
    loadPoziciok();
    loadMegtettUt();
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
    loadMegtettUt();
    // A kamionok folyamatosan mozognak, de ehhez nem kell élő, másodperces
    // push — egy perces automatikus újratöltés elég ahhoz, hogy ne kelljen
    // kézzel nyomogatni a frissítés gombot. A "Megtett út" NINCS ebben az
    // intervallumban — csak induláskor tölt egyszer, utána a kézi
    // "Frissítés" gomb (handleFrissites) tölti újra, ld. fenti komment.
    const id = setInterval(loadPoziciok, FRISSITES_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, vanBeallitva]);

  // Egyetlen helyen számoljuk ki minden levezetett mezőt (állapot, relatív
  // idő, számmá alakított sebesség) — a KPI-k, a lista, a térkép és a
  // részletek panel mind ugyanazt a "dúsított" tömböt kapja. A
  // "megtettUtMa" a KÜLÖN állapotból kerül ide (ld. fent) — a pozíció-
  // lekérdezés önmagában nem tartalmazza.
  const dusitett = useMemo(() => {
    const alap = dusitottPoziciok(poziciok, now);
    return alap.map((p) => {
      const tipus = p.jarmu_tipus || (p.kamion_id != null ? "kamion" : "furgon");
      const id = p.kamion_id ?? p.furgon_id;
      const kulcs = id != null ? `${tipus}:${id}` : null;
      return {
        ...p,
        megtettUtMa: kulcs && megtettUtAdatok[kulcs] !== undefined ? megtettUtAdatok[kulcs] : null,
      };
    });
  }, [poziciok, now, megtettUtAdatok]);

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
    setUtvonalPontok(null);
  };
  // Egy másik jármű kiválasztásakor a korábbi útvonal-előzmény (ha volt)
  // már nem hozzá tartozik — töröljük, hogy ne maradjon a térképen egy
  // másik kamion rajzolt útvonala a most kiválasztott mellett.
  const valasszJarmuvet = (rendszam) => {
    setKivalasztott(rendszam);
    setUtvonalPontok(null);
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
                <span className="text-xs text-ink-400 dark:text-ink-500">
                  Frissítve: {frissitve.toLocaleTimeString("hu-HU")}
                </span>
              )}
              <button
                type="button"
                onClick={() => setKihasznaltsagOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 shadow-soft transition-all duration-300 ease-fluid hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
              >
                <PiGaugeLight className="h-4 w-4" />
                Kihasználtság
              </button>
              <button
                type="button"
                onClick={handleFrissites}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 shadow-soft transition-all duration-300 ease-fluid hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95 disabled:cursor-wait disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
              >
                <PiArrowClockwiseLight className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Frissítés
              </button>
            </div>
          )
        }
      />
      <p className="-mt-3 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
        A kamionok és furgonok pillanatnyi pozíciója a GPSmart flottakövető
        rendszerből, percenként automatikusan frissítve.
      </p>

      {checking ? (
        <>
          <KpiVaz />
          <TartalomVaz />
        </>
      ) : !vanBeallitva ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-10 text-center shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800">
          <PiMapTrifoldLight className="h-10 w-10 text-ink-200 dark:text-ink-700" />
          <p className="max-w-md text-sm text-ink-500 dark:text-ink-400">
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
        // EGYETLEN rács minden méretnél (a korábbi különálló flex-col
        // KPI+Szűrők szekció + beágyazott Lista/Térkép/Részletek rács
        // helyett) — ez kell ahhoz, hogy a `order-*` mobilon a térképet a
        // KPI-csempék és a szűrők ELÉ tudja hozni: a CSS `order` csak
        // ugyanazon a rács-/flex-szülőn belüli testvérek között rendez át,
        // két különálló konténer között nem. Mobilon a sorrend Térkép →
        // KPI → Szűrők → Lista (a térkép, a lap fő funkciója, ne kerüljön
        // ~700px görgetés mögé, ahogy élőben, UX-audit során kiderült).
        // `xl:`-től (1280px+) az `xl:order-*`/`xl:col-span-*` visszaállítja
        // az eredeti, 3 oszlopos elrendezést (Lista/Térkép/Részletek egy
        // sorban, KPI és Szűrők fölötte, teljes szélességben).
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="order-2 xl:order-1 xl:col-span-12">
            <FlottaKpiKartyak
              dusitett={dusitett}
              megtettUtLoading={megtettUtLoading}
              megtettUtFrissitve={megtettUtFrissitve}
            />
          </div>

          <div className="order-3 xl:order-1 xl:col-span-12">
            <FlottaSzurok
              kereses={kereses}
              onKeresesChange={setKereses}
              statuszSzuro={statuszSzuro}
              onStatuszSzuroChange={setStatuszSzuro}
              talalatSzam={szurt.length}
            />
          </div>

          {/* xl:col-span-4 (a korábbi 3 helyett) — az 5. oszlop
              ("Megtett út") hozzáadása után 3/12-nél a rendszám
              csonkolódott/az oszlopok nem fértek ki (élőben ellenőrizve).
              A térkép 6→5-re csökkent, hogy a lista extra helye ne a
              jármű-részletek rovására menjen.
              `md:h-[360px]` (nem feltétel nélküli `h-[360px]`): mobilon
              (<768px) a JarmuLista a saját kártyalistáját a lap normál
              folyásába illeszti (nincs belső görgetés, ld. JarmuLista.js
              komментje) — egy itt ráerőltetett fix magasság ezt a mobil
              nézetet zárná vissza egy alacsony, önmagában görgethető
              dobozba. `md:`-től (táblázat-nézet) a fix magasság + belső
              görgetés helyénvaló, ott visszaáll. */}
          <div className="order-4 md:h-[360px] xl:order-1 xl:col-span-4 xl:h-[640px]">
            <JarmuLista rows={szurt} kivalasztott={kivalasztott} onSelect={valasszJarmuvet} />
          </div>

          <div className="order-1 h-[420px] md:h-[520px] xl:order-2 xl:col-span-5 xl:h-[640px]">
            <FlottaTerkep
              dusitett={szurt}
              kivalasztott={kivalasztott}
              onSelect={valasszJarmuvet}
              kovetesEnabled={kovetesEnabled}
              onKovetesToggle={toggleKoveses}
              utvonalPontok={utvonalPontok}
            />
          </div>

          {isXl && (
            <div className="order-5 xl:col-span-3 xl:h-[640px]">
              <JarmuReszletek
                jarmu={kivalasztottJarmu}
                kovetesEnabled={kovetesEnabled}
                onKovetesToggle={toggleKoveses}
                onClose={torolKivalasztast}
                onElozmenyekOpen={() => setElozmenyekOpen(true)}
              />
            </div>
          )}
        </div>
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
            onElozmenyekOpen={() => setElozmenyekOpen(true)}
          />
        </Modal>
      )}

      <ElozmenyekModal
        open={elozmenyekOpen}
        onClose={() => setElozmenyekOpen(false)}
        jarmu={kivalasztottJarmu}
        cegId={user.ceg_id}
        kerelmezoId={user.id}
        onUtvonalBetoltve={setUtvonalPontok}
      />

      <KihasznaltsagiModal
        open={kihasznaltsagOpen}
        onClose={() => setKihasznaltsagOpen(false)}
        cegId={user.ceg_id}
        kerelmezoId={user.id}
      />
    </div>
  );
}
