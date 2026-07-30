# Mobil navigáció újratervezése (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az admin mobil alsó navigációt a mai 6 egyenrangú fülből (Menü, Profil, Flotta, Csapat, Rendszer, Értesítések) egy frekvencia-alapú, 5 slot + FAB szerkezetre cserélni (Kezdőlap, Fuvarok, ➕ Gyors műveletek, Értesítések, Több-drawer), a napi zóna pin-rendszer mobilra is kiterjesztésével, három képernyő-összevonással és két érintőképernyő-gesztussal.

**Architecture:** Tisztán frontend munka a meglévő React/Tailwind admin felületen (`src/components/Sidebar/Sidebar.js` a nav-mag, két új komponens — `QuickActionSheet.js`, `MobileMoreDrawer.js` — a sávból kiszervezve). Nincs backend/DB-változás; minden felhasznált adat (`getSajatJogosultsagok`, `getFuggoJarmuValtasok`, `getNyitottBejelentesek` stb.) már ma is be van kötve.

**Tech Stack:** React 17 (CRA), react-router-dom v5, Tailwind (előre lefordított `tailwind.css`, `npm run build:tailwind` szükséges új osztályokhoz), `react-icons/pi` (Phosphor ikonok).

## Global Constraints

- Nincs Jest/automatizált teszt-suite ebben a repóban (`npm test` nem talál teszteket) — minden "teszt" lépés **manuális böngészős ellenőrzés** (`npm start`, mobil viewport DevTools-ban vagy Playwright), a CLAUDE.md "Szerver oldali módosítások kritikus tesztelése" és a session workflow-szabály szerint: UI-változást tényleges futtatással kell ellenőrizni, nem csak kód-olvasással.
- Bármely ÚJ Tailwind utility-osztály bevezetése után **`npm run build:tailwind`** kötelező, mielőtt böngészőben ellenőrizhető lenne — enélkül az új osztály csendben nem létezik a lefordított stíluslapban.
- A desktop sidebar (`Sidebar.js` `<nav className="... hidden w-64 flex-col ... md:flex">` ága, kb. a fájl 685-1018. sora) **egy karakternyit sem változik** egyik feladatban sem.
- Nincs backend-módosítás egyik feladatban sem — minden `fetchAction`-hívás már létező, változatlan action-t céloz.
- Új interaktív mobil elemeknél (gombok, sorok) a projekt `min-h-11` (44px) érintésicélpont-konvencióját kell követni.
- `dark:` variánsok mindenhol kötelezők, ugyanazon `isDark`/`onToggleDark` propok mentén, amit a `Sidebar` már ma is kap az `Admin.js`-től.
- A teljes terv alapja: `docs/superpowers/specs/2026-07-30-mobil-navigacio-ujratervezes-design.md` — minden feladat előtt érdemes belenézni, ha valami nem egyértelmű.

---

## Task 1: Sofőrök + Sofőr-riport képernyő-összevonás

**Files:**
- Modify: `src/views/admin/SoforScorecard.js` (teljes fájl)
- Modify: `src/views/admin/Soforok.js` (teljes fájl)
- Modify: `src/components/Table/CardTableForSoforok.js:9,76-98`

**Interfaces:**
- Produces: `SoforRiportTartalom` — új, named export a `views/admin/SoforScorecard.js`-ből (props nélküli komponens, saját adatbetöltéssel, `<DataTable fill ...>`-t renderel PageHeader/outer-wrapper NÉLKÜL). Ezt importálja a Task 1 lépés 3 a `Soforok.js`-ben.
- Consumes: semmi korábbi taskból (ez az első task).

- [ ] **Step 1: `SoforScorecard.js` szétbontása — tartalom kiemelése named exportba**

A jelenlegi fájl (123 sor) `columns`/`JARMU_LABEL`/`percToOraPerc`/adatbetöltés/`<DataTable>` blokkja egy új, named export `SoforRiportTartalom` komponensbe kerül; a default export csak ezt csomagolja be a `PageHeader`-rel (a `/admin/sofor-riport` route változatlanul ezt a default exportot mountolja, ld. `layouts/Admin.js:206-209` — mélylink-kompatibilitás megmarad).

```jsx
import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { PiChartBarLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

const JARMU_LABEL = { kamion: "Kamion", furgon: "Furgon" };

const percToOraPerc = (perc) => `${Math.floor(perc / 60)}:${String(perc % 60).padStart(2, "0")}`;

export function SoforRiportTartalom() {
  const history = useHistory();
  const [sorok, setSorok] = useState([]);
  const [loading, setLoading] = useState(true);

  const betoltes = useCallback(() => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getSoforScorecard", { id: user.ceg_id, kerelmezo_id: user.id })
      .then((result) => setSorok(result?.success ? result.soforok || [] : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    betoltes();
  }, [betoltes]);

  const columns = [
    { key: "nev", label: "Sofőr", sortable: true, className: "font-semibold text-brand-900 dark:text-ink-50" },
    {
      key: "jarmu_tipus",
      label: "Jármű",
      render: (row) => (row.jarmu_tipus ? JARMU_LABEL[row.jarmu_tipus] : "—"),
      exportValue: (row) => (row.jarmu_tipus ? JARMU_LABEL[row.jarmu_tipus] : "—"),
    },
    {
      key: "tachograf_km_30nap",
      label: "Km (elmúlt 30 nap)",
      sortable: true,
      sortValue: (row) => (row.tachograf_utolso_datum == null ? -1 : row.tachograf_km_30nap || 0),
      render: (row) =>
        row.tachograf_utolso_datum == null
          ? "—"
          : `${(row.tachograf_km_30nap || 0).toLocaleString("hu-HU")} km`,
      exportValue: (row) =>
        row.tachograf_utolso_datum == null ? "—" : row.tachograf_km_30nap ?? 0,
    },
    {
      key: "fogyasztas_atlag",
      label: "Átlagfogyasztás",
      sortable: true,
      sortValue: (row) => (row.fogyasztas_atlag == null ? -1 : row.fogyasztas_atlag),
      render: (row) => (row.fogyasztas_atlag == null ? "—" : `${row.fogyasztas_atlag} l/100km`),
      exportValue: (row) => (row.fogyasztas_atlag == null ? "—" : `${row.fogyasztas_atlag} l/100km`),
    },
    {
      key: "bejelentesek",
      label: "Bejelentések",
      sortable: true,
      sortValue: (row) => row.bejelentes_osszes || 0,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.bejelentes_osszes} összesen</span>
          {row.bejelentes_nyitott > 0 && (
            <StatusBadge tone="info">{row.bejelentes_nyitott} nyitott</StatusBadge>
          )}
        </div>
      ),
      exportValue: (row) => `${row.bejelentes_osszes} összesen, ${row.bejelentes_nyitott} nyitott`,
    },
    {
      key: "tachograf",
      label: "Vezetés (elmúlt 7 nap)",
      sortable: true,
      sortValue: (row) => (row.tachograf_utolso_datum == null ? -1 : row.tachograf_vezetes_perc_7nap || 0),
      render: (row) => {
        if (row.tachograf_utolso_datum == null) return "—";
        return (
          <button
            type="button"
            onClick={() => history.push(`/admin/tachograf?sofor=${row.sofor_id}`)}
            className="flex items-center gap-2 hover:underline"
          >
            <span>{percToOraPerc(row.tachograf_vezetes_perc_7nap || 0)} óra</span>
            {row.tachograf_tul_ora_napok > 0 && (
              <StatusBadge tone="warning">{row.tachograf_tul_ora_napok} nap 9ó felett</StatusBadge>
            )}
          </button>
        );
      },
      exportValue: (row) =>
        row.tachograf_utolso_datum == null
          ? "—"
          : `${percToOraPerc(row.tachograf_vezetes_perc_7nap || 0)} óra (utolsó adat: ${row.tachograf_utolso_datum})`,
    },
  ];

  return (
    <DataTable
      icon={PiChartBarLight}
      title="Sofőrönkénti összesítő"
      columns={columns}
      rows={sorok}
      loading={loading}
      exportFilename="sofor-riport"
      mobileTitleKey="nev"
      emptyLabel="Nincs megjeleníthető sofőr-adat"
      fill
      searchable
      searchPlaceholder="Keresés név szerint..."
    />
  );
}

export default function SoforScorecard() {
  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Csapat" title="Sofőr-riport" />
      </div>
      <div className="min-h-0 flex-1">
        <SoforRiportTartalom />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manuális ellenőrzés — regresszió a `/admin/sofor-riport` route-on**

`npm start`, admin bejelentkezés után nyisd meg `/admin/sofor-riport`-ot közvetlenül. Elvárt: a táblázat, a rendezhető oszlopok, a "Vezetés (elmúlt 7 nap)" gomb (tachográf oldalra navigál) és az export pontosan úgy működik, mint a refaktor előtt (ez egy tiszta kód-mozgatás, vizuálisan/funkcionálisan nem szabadna változnia semminek).

- [ ] **Step 3: `CardTableForSoforok.js` — `fill` prop bevezetése**

```jsx
const CardTable = ({ soforok = [], loading, total, page, pageSize, onPageChange, onSearchChange, onExportAll, sortKey, sortDir, onSortChange, fill = false }) => {
```

...és a fájl alján lévő `<DataTable ...>` hívásba egy sor bekerül: `fill={fill}` (a többi prop változatlan).

- [ ] **Step 4: `Soforok.js` — fül-váltó bevezetése, `flex h-full flex-col` + `min-h-0 flex-1` szerkezetre állítás**

A `fill` mód (ld. `DataTable.js:564-574` kommentje) explicit megköveteli, hogy a szülő már `h-full flex-col` legyen — ugyanez a réteg-szerkezet, amit a `Naplo.js`/`SoforScorecard.js` is használ (ld. Step 1).

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { PiUsersLight, PiChartBarLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";

import CardTable from "components/Table/CardTableForSoforok.js";
import PageHeader from "components/UI/PageHeader.js";
import { SoforRiportTartalom } from "views/admin/SoforScorecard.js";

const PAGE_SIZE = 10;

const TABS = [
  { key: "lista", label: "Sofőrök", icon: PiUsersLight },
  { key: "riport", label: "Riport", icon: PiChartBarLight },
];

export default function Soforok() {
  const [activeTab, setActiveTab] = useState("lista");
  const [soforok, setSoforok] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user"));
      const result = await fetchAction("getSoforok", {
        id: user.ceg_id,
        kerelmezo_id: user.id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortKey: sortKey || undefined,
        sortDir,
      });
      if (cancelled) return;
      if (result.success) {
        setSoforok(result.soforok || []);
        setTotal(result.total ?? (result.soforok || []).length);
      } else {
        setSoforok([]);
        setTotal(0);
        console.error("Error fetching stats:", result.message);
      }
      setLoading(false);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [page, search, sortKey, sortDir]);

  const handleSortChange = (key, dir) => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleExportAll = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getSoforok", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
    });
    return result.success ? result.soforok || [] : [];
  }, [search]);

  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Csapat" title="Sofőrök" />
        <div className="-mt-2 mb-4 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 ${
                activeTab === t.key
                  ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                  : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {activeTab === "lista" && (
          <CardTable
            fill
            soforok={soforok}
            loading={loading}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onSearchChange={setSearch}
            onExportAll={handleExportAll}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={handleSortChange}
          />
        )}
        {activeTab === "riport" && <SoforRiportTartalom />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manuális ellenőrzés — `Soforok.js` mindkét füle**

`npm start`, `/admin/soforok` megnyitása. Ellenőrizendő: (a) "Sofőrök" fül — a lista, keresés, oldalazás, rendezés, "+ Új"/szerkesztés/törlés pontosan úgy működik, mint korábban, mind mobil kártya-nézetben, mind desktop táblázat-nézetben (a `fill` mód bevezetése miatt ez a legkockázatosabb pont — ha a lista összecsuklana vagy görgetési gond lenne, itt derül ki); (b) "Riport" fül — ugyanazt mutatja, mint a `/admin/sofor-riport` route.

- [ ] **Step 6: Commit**

```bash
git add src/views/admin/SoforScorecard.js src/views/admin/Soforok.js src/components/Table/CardTableForSoforok.js
git commit -m "Sofőrök és Sofőr-riport összevonása belső tabokkal"
```

---

## Task 2: Napló + Értesítési előzmények képernyő-összevonás

**Files:**
- Modify: `src/views/admin/Naplo.js` (teljes fájl)
- Modify: `src/views/admin/ErtesitesiElozmenyek.js` (teljes fájl)
- Create: `src/views/admin/Elozmenyek.js`
- Modify: `src/layouts/Admin.js:30,44` (lazy import) és a `<Switch>`-en belül egy új route

**Interfaces:**
- Produces: `NaploTartalom` (named export, `Naplo.js`), `ErtesitesiElozmenyekTartalom` (named export, `ErtesitesiElozmenyek.js`) — mindkettő props nélküli, saját adatbetöltésű komponens, `<DataTable fill>`-t renderel.
- Consumes: semmi korábbi taskból.

- [ ] **Step 1: `Naplo.js` szétbontása**

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { PiListMagnifyingGlassLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";

const PAGE_SIZE = 20;

const TABLA_LABEL = {
  kamion: "Kamion",
  potkocsi: "Pótkocsi",
  furgon: "Furgon",
  user: "Sofőr",
  bejelentesek: "Bejelentés",
  sofor_szabadsag: "Szabadság",
  ugyfelek: "Ügyfél",
  helyszinek: "Helyszín",
  admin: "Csapattag",
  jogosultsagok: "Jogosultságok",
  szerepkorok: "Szerepkörök",
  listaelemek: "Listaelem",
  egyeb_koltsegek: "Pénzforgalom tétel",
  fuvarok: "Fuvar",
  beerkezett_dokumentumok: "Beérkezett dokumentum",
  vezetesi_naplo: "Vezetési napló",
  jarmu_valtas_kerelmek: "Jármű-váltási kérelem",
  gpsmart_beallitasok: "GPSmart beállítások",
  nav_szamla_beallitasok: "NAV számla beállítások",
};

const MUVELET_TONE = {
  letrehozas: "success",
  modositas: "warning",
  torles: "danger",
};
const MUVELET_LABEL = {
  letrehozas: "Létrehozás",
  modositas: "Módosítás",
  torles: "Törlés",
};

export function NaploTartalom() {
  const [naplo, setNaplo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    setLoading(true);
    fetchAction("getAuditLog", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (result?.success) {
          setNaplo(result.naplo || []);
          setTotal(result.total ?? (result.naplo || []).length);
        } else {
          setTotal(0);
        }
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  const handleExportAll = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getAuditLog", {
      id: user.ceg_id,
      kerelmezo_id: user.id,
      search: search || undefined,
    });
    return result?.success ? result.naplo || [] : [];
  }, [search]);

  const columns = [
    {
      key: "tabla",
      label: "Entitás",
      className: "font-semibold text-brand-900 dark:text-ink-50",
      render: (row) => TABLA_LABEL[row.tabla] || row.tabla,
      exportValue: (row) => TABLA_LABEL[row.tabla] || row.tabla,
    },
    {
      key: "modosito_nev",
      label: "Módosította",
      render: (row) => row.modosito_nev || "—",
      exportValue: (row) => row.modosito_nev || "—",
    },
    {
      key: "muvelet",
      label: "Művelet",
      render: (row) => (
        <StatusBadge tone={MUVELET_TONE[row.muvelet] || "neutral"}>
          {MUVELET_LABEL[row.muvelet] || row.muvelet}
        </StatusBadge>
      ),
      exportValue: (row) => MUVELET_LABEL[row.muvelet] || row.muvelet,
    },
    { key: "leiras", label: "Leírás", render: (row) => row.leiras || "—" },
    { key: "datum", label: "Időpont" },
  ];

  return (
    <DataTable
      icon={PiListMagnifyingGlassLight}
      title="Napló"
      columns={columns}
      rows={naplo}
      loading={loading}
      exportFilename="naplo"
      mobileTitleKey="tabla"
      emptyLabel="Még nincs naplózott módosítás"
      fill
      searchable
      searchPlaceholder="Keresés entitás, leírás szerint..."
      serverSide
      totalRows={total}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      onSearchChange={setSearch}
      onExportAll={handleExportAll}
    />
  );
}

export default function Naplo() {
  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader title="Módosítási napló" eyebrow="Rendszer" />
        <p className="-mt-6 mb-4 text-sm text-ink-500 dark:text-ink-400">Teljes előzmény, lapozva</p>
      </div>
      <div className="min-h-0 flex-1">
        <NaploTartalom />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ErtesitesiElozmenyek.js` szétbontása**

```jsx
import React, { useEffect, useState } from "react";
import { PiBellLight } from "react-icons/pi";

import { fetchAction } from "utils/fetchAction";
import PageHeader from "components/UI/PageHeader.js";
import DataTable from "components/UI/DataTable.js";

export function ErtesitesiElozmenyekTartalom() {
  const [naplo, setNaplo] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getErtesitesNaplo", { kerelmezo_id: user.id })
      .then((result) => setNaplo(result?.success ? result.naplo || [] : []))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: "letrehozva",
      label: "Időpont",
      render: (row) => new Date(row.letrehozva).toLocaleString("hu-HU"),
      exportValue: (row) => row.letrehozva,
    },
    { key: "szoveg", label: "Értesítés" },
  ];

  return (
    <DataTable
      icon={PiBellLight}
      title="Minden, ami valaha megjelent a haranG-ban"
      columns={columns}
      rows={naplo}
      loading={loading}
      exportFilename="ertesitesi-elozmenyek"
      mobileTitleKey="szoveg"
      emptyLabel="Még nincs naplózott értesítés"
      fill
      searchable
      searchPlaceholder="Keresés az értesítés szövegében..."
      pageSize={20}
    />
  );
}

export default function ErtesitesiElozmenyek() {
  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Rendszer" title="Értesítési előzmények" />
      </div>
      <div className="min-h-0 flex-1">
        <ErtesitesiElozmenyekTartalom />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manuális ellenőrzés — regresszió a két meglévő route-on**

`/admin/naplo` és `/admin/ertesitesi-elozmenyek` közvetlen megnyitása — mindkettő pontosan úgy működjön, mint korábban (tiszta kód-mozgatás).

- [ ] **Step 4: Új `Elozmenyek.js` — a két tartalom közös fül-keretben**

```jsx
import React, { useState } from "react";
import { PiListMagnifyingGlassLight, PiBellLight } from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import { NaploTartalom } from "views/admin/Naplo.js";
import { ErtesitesiElozmenyekTartalom } from "views/admin/ErtesitesiElozmenyek.js";

const TABS = [
  { key: "naplo", label: "Napló", icon: PiListMagnifyingGlassLight },
  { key: "ertesitesek", label: "Értesítések", icon: PiBellLight },
];

export default function Elozmenyek() {
  const [activeTab, setActiveTab] = useState("naplo");

  return (
    <div className="flex h-full w-full flex-col px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader eyebrow="Rendszer" title="Előzmények" />
        <div className="-mt-2 mb-4 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 ${
                activeTab === t.key
                  ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                  : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {activeTab === "naplo" && <NaploTartalom />}
        {activeTab === "ertesitesek" && <ErtesitesiElozmenyekTartalom />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Route bekötése — `layouts/Admin.js`**

A lazy import-blokkba (a `Naplo`/`ErtesitesiElozmenyek` sorok mellé):

```js
const Elozmenyek = lazy(() => import("views/admin/Elozmenyek.js"));
```

A `<Switch>`-en belül, a meglévő `/admin/naplo` route mellé (azt NEM töröljük):

```jsx
<PrivateRoute path="/admin/elozmenyek" exact component={Elozmenyek} />
```

- [ ] **Step 6: Manuális ellenőrzés — új `/admin/elozmenyek` route**

Mindkét fül helyesen tölt be adatot, a fülváltás nem indít felesleges új kérést a már betöltött fülre visszaváltáskor (mindkét fül saját `useState`-je megmarad, amíg az `Elozmenyek` komponens mountolva van).

- [ ] **Step 7: Commit**

```bash
git add src/views/admin/Naplo.js src/views/admin/ErtesitesiElozmenyek.js src/views/admin/Elozmenyek.js src/layouts/Admin.js
git commit -m "Napló és Értesítési előzmények összevonása egy Előzmények oldalba"
```

---

## Task 3: Karbantartás gyorsművelet — router-state alapú modal-nyitás

**Files:**
- Modify: `src/views/admin/Karbantartasok.js`

**Interfaces:**
- Consumes: semmi korábbi taskból.
- Produces: a `/admin/karbantartasok` route mostantól `location.state.ujKarbantartas === true` esetén automatikusan megnyitja az "Új karbantartás" modalt — ezt fogja használni a Task 5 `QuickActionSheet`-je.

- [ ] **Step 1: `useLocation`/`useHistory` import + auto-open effect**

A fájl tetején (jelenlegi importok mellé):

```js
import { useLocation, useHistory } from "react-router-dom";
```

A komponens elején, az `openDialog`/`editingId` state-ek után (a fájl 70-71. sora körül), egy új effect:

```js
const location = useLocation();
const history = useHistory();

useEffect(() => {
  if (location.state?.ujKarbantartas) {
    resetForm();
    setOpenDialog(true);
    history.replace(location.pathname);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Ez ugyanazt a két hívást futtatja le, amit a "+ Új" gomb (`onAdd={() => { resetForm(); setOpenDialog(true); }}`, ld. a fájl 672-675. sora) — a `history.replace(location.pathname)` törli a `state`-et, hogy egy vissza-navigáció ne nyissa meg újra a modalt.

- [ ] **Step 2: Manuális ellenőrzés**

Böngésző konzoljából (vagy egy ideiglenes teszt-linkkel) navigálj a `/admin/karbantartasok`-ra `history.push`-csal, ami `{ state: { ujKarbantartas: true } }`-t ad át — pl. ideiglenesen illeszd be a böngésző címsorába: nem lehetséges közvetlen URL-lel state-et átadni, ezért Playwright/DevTools console-ból hívd:
```js
window.history.pushState({ ujKarbantartas: true }, "", "/admin/karbantartasok")
```
majd egy kézi `popstate`/route-újratöltés helyett egyszerűbb: navigálj előbb egy másik oldalra, majd egy ideiglenes gombbal (pl. a Dashboard egy `<Link to={{ pathname: "/admin/karbantartasok", state: { ujKarbantartas: true } }}>` tesztlinkkel, amit a Step után eltávolítasz) ellenőrizd, hogy betöltéskor automatikusan megnyílik-e az "Új karbantartás" modal, és hogy egy "Vissza" böngésző-gomb utáni újralátogatás **nem** nyitja meg újra automatikusan.

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/Karbantartasok.js
git commit -m "Karbantartások — router state alapú gyors 'Új karbantartás' megnyitás"
```

---

## Task 4: `Sidebar.js` — nav-adatmodell átrendezése

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js:50-306` (a `mobileDirectLinks`, `mobileGroups`, `EXTRA_PINNABLE_ITEMS`, `GROUP_LABEL_OVERRIDES`, `FORM_ROUTE_TO_LIST_ROUTE` konstansok)

**Interfaces:**
- Consumes: semmi (ez pusztán adat-szintű változás, a régi render-kód még a régi `mobileGroups.map` mintával fogyasztja — a render Task 5-ben cserélődik).
- Produces: az új `mobileDirectLinks`/`mobileGroups`/`EXTRA_PINNABLE_ITEMS`/`PIN_REGISTRY` alakot, amit Task 5 és Task 8 fogyaszt.

**Megjegyzés a köztes állapotról**: ez a task **önmagában still a RÉGI render-kóddal fut** (Task 5 cseréli le a bottom nav shell-t) — a mobil sáv emiatt átmenetileg szokatlanul néz ki (a `mobileGroups.map` a régi kódban minden csoporthoz egy gombot rendel, itt most 5 csoport lesz a korábbi 3 helyett, plusz a Fuvarok külön `mobileDirectLinks` linkként jelenik meg) — ez várt, ideiglenes állapot, amit Task 5 old fel. A lényeg ezen a ponton, hogy a *tartalom* (melyik elem melyik csoportban van) helyes legyen.

- [ ] **Step 1: `mobileDirectLinks` csere**

```js
const mobileDirectLinks = [
  { to: "/admin/dashboard", icon: PiSquaresFourLight, text: "Kezdőlap" },
  { to: "/admin/fuvarok", icon: PiClipboardTextLight, text: "Fuvarok" },
];
```

(A `PiSquaresFourLight`/`PiClipboardTextLight` importok már megvannak a fájl tetején.)

- [ ] **Step 2: `mobileGroups` teljes csere**

```js
const mobileGroups = [
  {
    key: "flotta",
    label: "Flotta",
    icon: PiTruckLight,
    items: [
      {
        to: "/admin/flottakovetes",
        icon: PiMapTrifoldLight,
        text: "Flottakövetés",
      },
      { to: "/admin/kamionok", icon: PiTruckLight, text: "Kamionok" },
      { to: "/admin/potkocsi", icon: PiTruckTrailerLight, text: "Pótkocsik" },
      { to: "/admin/furgonok", icon: PiVanLight, text: "Furgonok" },
      {
        to: "/admin/karbantartasok",
        icon: PiWrenchLight,
        text: "Karbantartások",
      },
      {
        to: "/admin/fuvarStatisztika",
        icon: PiChartBarLight,
        text: "Statisztikák",
      },
    ],
  },
  {
    key: "csapat",
    label: "Csapat",
    icon: PiUsersLight,
    items: [
      { to: "/admin/soforok", icon: PiUsersLight, text: "Sofőrök" },
      {
        to: "/admin/tachograf",
        icon: PiIdentificationCardLight,
        text: "Tachográf",
      },
      {
        to: "/admin/szabadsagok",
        icon: PiCalendarBlankLight,
        text: "Szabadságok",
      },
      {
        to: "/admin/bejelentesek",
        icon: PiChatCircleTextLight,
        text: "Bejelentések",
      },
    ],
  },
  {
    key: "partnerek",
    label: "Partnerek",
    icon: PiBuildingsLight,
    items: [
      { to: "/admin/ugyfelek", icon: PiBuildingsLight, text: "Ügyfelek" },
      { to: "/admin/helyszinek", icon: PiMapPinLight, text: "Helyszínek" },
    ],
  },
  {
    key: "penzugyek",
    label: "Pénzügyek",
    icon: PiCoinsLight,
    items: [
      { to: "/admin/koltsegek", icon: PiCoinsLight, text: "Pénzforgalom" },
      {
        to: "/admin/devizak",
        icon: PiCoinsLight,
        text: "Devizák",
        adminOnly: true,
      },
    ],
  },
  {
    key: "rendszer",
    label: "Rendszerbeállítások",
    icon: PiFilesLight,
    items: [
      { to: "/admin/fajlok", icon: PiFilesLight, text: "Fájlok" },
      {
        to: "/admin/elozmenyek",
        icon: PiListMagnifyingGlassLight,
        text: "Előzmények",
      },
      {
        to: "/admin/felhasznalok",
        icon: PiUsersFourLight,
        text: "Felhasználók",
      },
      {
        to: "/admin/jogosultsagok",
        icon: PiShieldCheckLight,
        text: "Jogosultságok",
        adminOnly: true,
      },
      {
        to: "/admin/listak",
        icon: PiListBulletsLight,
        text: "Listák",
        adminOnly: true,
      },
      {
        to: "/admin/ajanlatkeresek",
        icon: PiEnvelopeSimpleLight,
        text: "Ajánlatkérések",
        adminOnly: true,
      },
    ],
  },
];
```

Megjegyzések ehhez a lépéshez:
- **Nincs többé `divider`/`action` típusú elem** a `mobileGroups`-ban — a Keresés/Sötét mód akció-elemek (korábban `rendszer.items`-ben) törlődnek innen (Task 5-ben, a `MobileMoreDrawer` fejlécében/fiók-sorában élnek tovább), az Események menüpont pedig teljesen törlődik (ld. spec "6. Események eltávolítása").
- A `buildPinRegistry()` függvény (lentebb, változatlan marad) a `divider`/`action` szűrését jelenleg feltételezi (`if (item.type === "divider") { ...; return null; }`) — mivel innentől nincs `divider`/`action` elem, ez az ág egyszerűen sosem fut le, de a kód biztonságosan megmarad (nem kell törölni).

- [ ] **Step 3: `EXTRA_PINNABLE_ITEMS` bővítése "Fuvarok"-kal**

```js
const EXTRA_PINNABLE_ITEMS = [
  {
    to: "/admin/dashboard",
    icon: PiSquaresFourLight,
    text: "Főmenü",
    group: "Áttekintés",
  },
  {
    to: "/admin/fuvarok",
    icon: PiClipboardTextLight,
    text: "Fuvarok",
    group: "Fuvarok",
  },
];
```

- [ ] **Step 4: `GROUP_LABEL_OVERRIDES` törlése**

A teljes konstans és a `buildPinRegistry()`-ben rá hivatkozó sor törlődik:

```js
// TÖRLENDŐ:
const GROUP_LABEL_OVERRIDES = {
  "/admin/koltsegek": "Pénzügyek",
  "/admin/devizak": "Pénzügyek",
};
```

A `buildPinRegistry()` függvényben a
```js
group: GROUP_LABEL_OVERRIDES[item.to] || currentLabel,
```
sor
```js
group: currentLabel,
```
-ra egyszerűsödik (a `currentLabel` innentől mindig helyes, mert a `koltsegek`/`devizak` már a `penzugyek` csoportban él, a saját `label: "Pénzügyek"`-jével).

- [ ] **Step 5: `FORM_ROUTE_TO_LIST_ROUTE` — hiányzó Fuvarok-pár pótlása**

```js
const FORM_ROUTE_TO_LIST_ROUTE = {
  "/admin/kamionForm": "/admin/kamionok",
  "/admin/potkocsiForm": "/admin/potkocsi",
  "/admin/furgonForm": "/admin/furgonok",
  "/admin/soforForm": "/admin/soforok",
  "/admin/bejelentesForm": "/admin/bejelentesek",
  "/admin/ugyfelForm": "/admin/ugyfelek",
  "/admin/helyszinForm": "/admin/helyszinek",
  "/admin/fuvarForm": "/admin/fuvarok",
};
```

- [ ] **Step 6: Manuális ellenőrzés**

`npm start`, mobil viewport. A régi render-kóddal (Task 5 előtt): (a) a bottom nav első két direkt linkje "Kezdőlap"/"Fuvarok" (nem "Menü"/"Profil"); (b) a 3 megmaradt csoport-gomb (a render még a régiek szerint jelenik meg — `mobileGroups.map`, tehát most 5 gombot rendelne egyenlő szélességben a Bell mellé, ami átmenetileg zsúfolt/csonkolt lehet, **ez elvárt, Task 5 oldja meg**) helyesen a fenti 5 csoportot listázza megnyitáskor: Flotta 6 elemmel (Statisztikák is benne), Csapat 4 elemmel, Partnerek 2 elemmel, Pénzügyek 2 elemmel (Devizák csak admin/root felhasználónál), Rendszerbeállítások 6 elemmel (Előzmények egy sorban a korábbi 2 helyett, Események sehol). (c) Deszktopon nyisd meg a Napi Zóna szerkesztőt (ceruza-ikon) — a "Hozzáadható menüpontok" lista most már tartalmazza a "Fuvarok" csoportot (Fuvarok + Statisztikák egy csoportcímke alatt a `PIN_REGISTRY`-ben, bár a desktop saját nav-ját ez nem érinti).

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar/Sidebar.js
git commit -m "Sidebar mobil nav-adatmodell átrendezése (Flotta/Csapat/Partnerek/Pénzügyek/Rendszerbeállítások)"
```

---

## Task 5: `Sidebar.js` — új bottom nav shell, FAB, Gyors műveletek lap és "Több" drawer

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js` (a mobil render-ág, kb. a fájl 1020-1243. sora + a komponens elején néhány új `useState`)
- Create: `src/components/Sidebar/QuickActionSheet.js`
- Create: `src/components/Sidebar/MobileMoreDrawer.js`

**Interfaces:**
- Consumes: Task 3 `location.state.ujKarbantartas` konvenció (a "Karbantartás rögzítése" gyorsművelet ezt használja); Task 4 végleges `mobileGroups`/`mobileDirectLinks`/`isActive`/`hasAccess`/`pinnedItems`/`badgeByPath` alakja.
- Produces: `quickActionsOpen`/`drawerOpen` state a `Sidebar`-ban (az `openGroup`/`setOpenGroup` teljes lecserélése) — Task 8 (long-press) ugyanezen render-blokkot módosítja tovább.

- [ ] **Step 1: Új fájl — `src/components/Sidebar/QuickActionSheet.js`**

```jsx
import React from "react";
import { Link } from "react-router-dom";

export default function QuickActionSheet({ open, actions, onClose, onKerelmekClick }) {
  return (
    <div
      className={`overflow-y-auto rounded-t-2xl border-t border-ink-100 bg-white shadow-soft-lg transition-all duration-300 ease-fluid dark:border-ink-800 dark:bg-ink-900 ${
        open ? "max-h-96" : "max-h-0"
      }`}
    >
      <ul className="px-2 py-1.5">
        <li className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          Gyors művelet
        </li>
        {actions.map((a) => (
          <li key={a.key}>
            {a.action === "kerelmek" ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onKerelmekClick();
                }}
                className="flex w-full min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <a.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {a.text}
                {a.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {a.badge}
                  </span>
                )}
              </button>
            ) : (
              <Link
                to={a.to}
                onClick={onClose}
                className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <a.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {a.text}
                {a.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {a.badge}
                  </span>
                )}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Új fájl — `src/components/Sidebar/MobileMoreDrawer.js`**

```jsx
import React from "react";
import { Link } from "react-router-dom";
import {
  PiMagnifyingGlassLight,
  PiCaretDownLight,
  PiGearLight,
  PiSignOutLight,
  PiSunLight,
  PiMoonLight,
} from "react-icons/pi";

const GROUP_ORDER = [
  { key: "flotta", label: "Flotta" },
  { key: "csapat", label: "Csapat" },
  { key: "partnerek", label: "Partnerek" },
  { key: "penzugyek", label: "Pénzügyek" },
  { key: "rendszer", label: "Rendszerbeállítások" },
];

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

export default function MobileMoreDrawer({
  open,
  onClose,
  onSearchOpen,
  pinnedItems,
  badgeByPath,
  groups,
  isAdmin,
  hasAccess,
  isActive,
  user,
  szerepkorNev,
  onLogout,
  isDark,
  onToggleDark,
}) {
  const [openGroups, setOpenGroups] = React.useState({});
  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!open) return null;

  const groupByKey = Object.fromEntries(groups.map((g) => [g.key, g]));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-ink-900 md:hidden">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-ink-100 px-3 py-3 dark:border-ink-800">
        <button
          type="button"
          onClick={onClose}
          aria-label="Bezárás"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-ink-500 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <PiCaretDownLight className="h-5 w-5 rotate-90" />
        </button>
        <h2 className="text-base font-semibold text-brand-900 dark:text-ink-50">Több</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            onSearchOpen();
          }}
          className="mb-3 flex min-h-11 w-full items-center gap-2 rounded-xl border border-ink-100 bg-slate-50 px-3 py-2 text-left text-ink-400 dark:border-ink-700 dark:bg-ink-800"
        >
          <PiMagnifyingGlassLight className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 text-sm">Keresés</span>
        </button>

        {pinnedItems.length > 0 && (
          <div className="mb-3 rounded-2xl bg-brand-50/70 p-2 dark:bg-brand-950/40">
            <p className="mb-1 px-1.5 pt-0.5 text-xs font-bold uppercase tracking-[0.1em] text-brand-700 dark:text-brand-300">
              Kedvencek
            </p>
            <ul className="space-y-0.5">
              {pinnedItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
                      isActive(item.to)
                        ? "bg-white text-brand-700 dark:bg-ink-800 dark:text-brand-300"
                        : "text-ink-600 dark:text-ink-300"
                    }`}
                  >
                    <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                    {item.text}
                    {badgeByPath[item.to] > 0 && (
                      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {badgeByPath[item.to]}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {GROUP_ORDER.map(({ key, label }) => {
          const group = groupByKey[key];
          if (!group) return null;
          const visibleItems = group.items.filter(
            (item) => (!item.adminOnly || isAdmin) && hasAccess(item.to),
          );
          if (visibleItems.length === 0) return null;
          const isOpen = !!openGroups[key];
          return (
            <div key={key} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                aria-expanded={isOpen}
                className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-ink-800"
              >
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500 dark:text-ink-400">
                  {label}
                </span>
                <PiCaretDownLight
                  className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {isOpen && (
                <ul className="space-y-0.5 py-1">
                  {visibleItems.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onClose}
                        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 pl-6 text-sm font-medium ${
                          isActive(item.to)
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                            : "text-ink-600 dark:text-ink-300"
                        }`}
                      >
                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                        {item.text}
                        {badgeByPath[item.to] > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {badgeByPath[item.to]}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 border-t border-ink-100 px-4 py-4 dark:border-ink-800">
        <Link
          to="/admin/settings"
          onClick={onClose}
          className="group -mx-1 mb-2 flex items-center gap-2.5 rounded-xl px-1 py-1.5 hover:bg-slate-100 dark:hover:bg-ink-800"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials(user?.name || user?.nev)}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold text-brand-900 dark:text-ink-50">
              {user?.name || user?.nev || "Fiók"}
            </span>
            <span className="block truncate text-xs text-ink-400 dark:text-ink-500">{szerepkorNev}</span>
          </span>
          <PiGearLight className="h-4 w-4 flex-shrink-0 text-ink-300 dark:text-ink-500" />
        </Link>
        <button
          type="button"
          onClick={onToggleDark}
          className="mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm font-medium text-ink-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          {isDark ? <PiSunLight className="h-4 w-4" /> : <PiMoonLight className="h-4 w-4" />}
          {isDark ? "Világos mód" : "Sötét mód"}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          <PiSignOutLight className="h-4 w-4" />
          Kijelentkezés
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `Sidebar.js` — importok + `quickActions` konfiguráció**

A fájl importjaihoz hozzáadódik `PiPlusLight` (a meglévő `react-icons/pi` import-blokkba), valamint:

```js
import QuickActionSheet from "components/Sidebar/QuickActionSheet.js";
import MobileMoreDrawer from "components/Sidebar/MobileMoreDrawer.js";
```

A `mobileGroups`/`DEFAULT_PIN_PATHS` konstansok után, modul-szinten:

```js
const quickActions = (nyitottBejelentesek, kerelmek) => [
  { key: "uj-fuvar", to: "/admin/fuvarForm", icon: PiClipboardTextLight, text: "Új fuvar" },
  {
    key: "bejelentes-valasz",
    to: "/admin/bejelentesek",
    icon: PiChatCircleTextLight,
    text: "Bejelentés megválaszolása",
    badge: nyitottBejelentesek.length,
  },
  {
    key: "jarmu-valtas",
    action: "kerelmek",
    icon: PiTruckLight,
    text: "Jármű-váltás jóváhagyása",
    badge: kerelmek.length,
  },
  {
    key: "uj-karbantartas",
    to: { pathname: "/admin/karbantartasok", state: { ujKarbantartas: true } },
    icon: PiWrenchLight,
    text: "Karbantartás rögzítése",
  },
];
```

- [ ] **Step 4: `Sidebar.js` komponensen belül — állapotcsere**

A `const [openGroup, setOpenGroup] = React.useState(null);` sor (a komponens elején) cserélődik:

```js
const [quickActionsOpen, setQuickActionsOpen] = React.useState(false);
const [drawerOpen, setDrawerOpen] = React.useState(false);
```

- [ ] **Step 5: A régi mobil render-ág teljes cseréje**

A jelenlegi JSX-ben törlendő: a `{/* Háttér — a nyitott csoport listája alatt ... */} {openGroup && (...)}` blokk (a régi `openGroup` backdrop), majd a teljes `<div className="fixed inset-x-0 bottom-0 z-40 md:hidden">...</div>` blokk (a csoport-lista panel + a `<nav>` bottom bar, a `mobileDirectLinks.map`/`mobileGroups.map`/Bell gombbal együtt) — ez a teljes szakasz az eredeti fájl kb. 1020-1222. sorai között van.

Az új, ezt felváltó JSX (ugyanoda kerül, közvetlenül a `<GlobalSearch .../>` elé):

```jsx
<div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
  <QuickActionSheet
    open={quickActionsOpen}
    onClose={() => setQuickActionsOpen(false)}
    actions={quickActions(nyitottBejelentesek, kerelmek)}
    onKerelmekClick={() => setNotifOpen(true)}
  />

  <nav className="flex items-stretch gap-1 border-t border-ink-100 bg-white px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] dark:border-ink-800 dark:bg-ink-900">
    {mobileDirectLinks.map((item) => {
      const active = isActive(item.to);
      return (
        <Link
          key={item.to}
          to={item.to}
          aria-current={active ? "page" : undefined}
          className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
            active
              ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
              : "text-ink-400 dark:text-ink-500"
          }`}
          onClick={() => setQuickActionsOpen(false)}
        >
          <item.icon className="h-6 w-6 flex-shrink-0" />
          <span className="w-full truncate text-center">{item.text}</span>
        </Link>
      );
    })}

    <button
      type="button"
      aria-label="Gyors műveletek"
      aria-expanded={quickActionsOpen}
      onClick={() => setQuickActionsOpen((v) => !v)}
      className={`relative -mt-5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full shadow-soft-lg transition-colors duration-150 ${
        quickActionsOpen ? "bg-brand-700 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
      }`}
    >
      <PiPlusLight className="h-6 w-6" />
      {nyitottBejelentesek.length + kerelmek.length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-ink-900">
          {nyitottBejelentesek.length + kerelmek.length}
        </span>
      )}
    </button>

    <button
      type="button"
      aria-expanded={notifOpen}
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
        notifOpen
          ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
          : "text-ink-400 dark:text-ink-500"
      }`}
      onClick={() => {
        setQuickActionsOpen(false);
        setNotifOpen(true);
      }}
    >
      <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center">
        <PiBellLight className="h-6 w-6" />
        {allNotifications.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ember-500 ring-2 ring-white dark:ring-ink-900" />
        )}
      </span>
      <span className="w-full truncate text-center">Értesítések</span>
    </button>

    <button
      type="button"
      aria-expanded={drawerOpen}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
        drawerOpen
          ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
          : "text-ink-400 dark:text-ink-500"
      }`}
      onClick={() => {
        setQuickActionsOpen(false);
        setDrawerOpen(true);
      }}
    >
      <PiListLight className="h-6 w-6" />
      <span className="w-full truncate text-center">Több</span>
    </button>
  </nav>
</div>

<MobileMoreDrawer
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  onSearchOpen={() => setSearchOpen(true)}
  pinnedItems={pinnedItems}
  badgeByPath={badgeByPath}
  groups={mobileGroups}
  isAdmin={isAdmin}
  hasAccess={hasAccess}
  isActive={isActive}
  user={user}
  szerepkorNev={szerepkorNev}
  onLogout={handleLogout}
  isDark={isDark}
  onToggleDark={onToggleDark}
/>
```

`PiListLight` új import a `react-icons/pi` blokkba (a "Több" gomb ikonja).

- [ ] **Step 6: Manuális ellenőrzés — teljes mobil nav élesben**

`npm start`, mobil viewport (DevTools device-emuláció, pl. iPhone 12): (a) 5 slot látszik (Kezdőlap, Fuvarok, kiemelt kör FAB, Értesítések, Több), a FAB vizuálisan kiemelkedik; (b) FAB megnyomása kinyitja a Gyors műveletek lapot, mind a 4 sor létezik, a jelvényszámok egyeznek a Bell gombéval; (c) "Új fuvar" a `/admin/fuvarForm`-ra navigál, "Karbantartás rögzítése" a `/admin/karbantartasok`-ra navigál ÉS automatikusan megnyitja az "Új karbantartás" modalt (Task 3 hatása); (d) "Több" gomb teljes képernyős drawer-t nyit, a keresőmező a `GlobalSearch` overlay-t nyitja, a Kedvencek sáv a napi zóna beállításokat mutatja, mind az 5 csoport lenyitható, admin-only elemek helyesen szűrve; (e) útvonalváltáskor a Kezdőlap/Fuvarok linkek aktív-állapota helyesen vált, a `/admin/fuvarForm`-on a "Fuvarok" link aktívnak jelölve (Task 4 `FORM_ROUTE_TO_LIST_ROUTE`-fix hatása); (f) mindez sötét módban is.

- [ ] **Step 7: `npm run build:tailwind`, majd újra-ellenőrzés**

Az új osztályok (`-mt-5`, `h-14 w-14` stb.) valószínűleg már léteznek a lefordított CSS-ben (hasonló minták máshol is előfordulnak), de mindenképpen fuss le a rebuilddal és nézd meg újra élőben, mielőtt kész jelentést tennél.

- [ ] **Step 8: Commit**

```bash
git add src/components/Sidebar/Sidebar.js src/components/Sidebar/QuickActionSheet.js src/components/Sidebar/MobileMoreDrawer.js
git commit -m "Új mobil bottom nav: 5 slot + FAB gyorsműveletek + Több drawer"
```

---

## Task 6: Dashboard — Flottakövetés gyorschip

**Files:**
- Modify: `src/views/admin/Dashboard.js`

**Interfaces:**
- Consumes: semmi korábbi taskból.
- Produces: semmi, amit más task fogyasztana — önálló, mobil-only UI-kiegészítés.

- [ ] **Step 1: Import + gyorschip komponens**

A fájl tetején lévő `react-icons/pi` import-blokkba: `PiMapTrifoldLight` hozzáadása. A `PenzugyiAllapotCard` függvény után (a fájl 105. sora körül, a `FlottaOsszesitoStrip` definíciója előtt), egy új kis komponens:

```jsx
// Mobil-only gyorslink a Flottakövetésre — a "Mire figyeljek ma" + naptár
// blokk és a Flotta összesítő sáv között, hogy a leggyakoribb "hol van most
// a kamionom" kérdés egy érintésre elérhető legyen a Kezdőlapról. Deszktopon
// nincs rá szükség (ott a sidebar Flotta csoportja/napi zóna már egy
// kattintásra van), ezért `md:hidden`.
function FlottakovetesGyorslink({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full flex-shrink-0 items-center gap-3 rounded-3xl bg-white px-5 py-4 text-left shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg dark:bg-ink-900 dark:ring-ink-800 md:hidden ${className}`}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
        <PiMapTrifoldLight className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-900 dark:text-ink-50">Élő flottakövetés</span>
        <span className="block text-xs text-ink-400 dark:text-ink-500">Hol vannak most a járműveim?</span>
      </span>
      <PiArrowRightLight className="h-4 w-4 flex-shrink-0 text-ink-300 group-hover:text-brand-600 dark:text-ink-600 dark:group-hover:text-brand-300" />
    </button>
  );
}
```

(`PiArrowRightLight` már importálva van a fájl tetején.)

- [ ] **Step 2: Beillesztés a renderbe**

A "Mire figyeljek ma + Naptár" grid (`</div>` a fájl 618. sora körül) és a `<FlottaOsszesitoStrip .../>` közé:

```jsx
<FlottakovetesGyorslink onClick={() => history.push("/admin/flottakovetes")} className="mt-4" />
```

- [ ] **Step 3: Manuális ellenőrzés**

`npm start`, mobil viewport, `/admin/dashboard`. A gyorslink megjelenik a "Mire figyeljek ma"/naptár blokk alatt, a Flotta összesítő sáv fölött, kattintásra a `/admin/flottakovetes` oldalra navigál. Deszktop nézetben (`md:` és afölött) a gyorslink nem jelenik meg.

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/Dashboard.js
git commit -m "Dashboard — mobil Flottakövetés gyorslink"
```

---

## Task 7: Swipe gesztus a jóváhagyás/elutasítás sorokon

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js` (a `kerelemNotifications` összeállítása, kb. a fájl 532-544. sora)
- Modify: `src/components/Dropdowns/NotificationDropdown.js`

**Interfaces:**
- Consumes: semmi korábbi taskból (a `Sidebar.js`-beli `handleElbiral` már ma is létezik, változatlan marad).
- Produces: `n.swipeActions` opcionális mező a notification-objektumokon — csak a jármű-váltási kérelem sorokon van jelen, a bejelentés-sorokon nincs (azoknak nincs swipe-elhető jóváhagyás/elutasítás párja).

- [ ] **Step 1: `Sidebar.js` — `swipeActions` mező hozzáadása a `kerelemNotifications`-hoz**

```js
const kerelemNotifications = kerelmek.map((k) => ({
  id: `jarmu-valtas-${k.id}`,
  text: `${k.sofor_nev || "Egy sofőr"} másik ${TIPUS_LABEL[k.tipus] || "járművet"} kér: ${k.jarmu_rendszam || "?"}`,
  meta: k.indoklas || null,
  actions: [
    { label: "Jóváhagyás", onClick: () => handleElbiral(k.id, "jovahagyva") },
    {
      label: "Elutasítás",
      tone: "danger",
      onClick: () => handleElbiral(k.id, "elutasitva"),
    },
  ],
  swipeActions: {
    approve: () => handleElbiral(k.id, "jovahagyva"),
    reject: () => handleElbiral(k.id, "elutasitva"),
  },
}));
```

(Az egyetlen új sor a `swipeActions` mező — a `bejelentesNotifications` tömb NEM kap ilyet, mert azoknak csak egy "Megnyitás" akciója van, nincs értelmes 2-irányú swipe-párjuk.)

- [ ] **Step 2: `NotificationDropdown.js` — sor-komponens kiemelése swipe-kezeléssel**

A jelenlegi, `notifications.map((n, i) => <div key={n.id ?? i} className="group flex items-start gap-2 px-4 py-3 ...">...</div>)` blokk (a fájl 72-106. sora) egy külön `NotificationRow` komponensre cserélődik:

```jsx
const SWIPE_THRESHOLD = 64;

function NotificationRow({ n, onDismiss }) {
  const [dragX, setDragX] = React.useState(0);
  const touchStartX = React.useRef(null);

  const handleTouchStart = (e) => {
    if (!n.swipeActions) return;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    if (!n.swipeActions || touchStartX.current == null) return;
    setDragX(e.touches[0].clientX - touchStartX.current);
  };
  const handleTouchEnd = () => {
    if (!n.swipeActions) return;
    if (dragX > SWIPE_THRESHOLD) n.swipeActions.approve();
    else if (dragX < -SWIPE_THRESHOLD) n.swipeActions.reject();
    setDragX(0);
    touchStartX.current = null;
  };

  return (
    <div
      className="group relative flex items-start gap-2 overflow-hidden px-4 py-3 hover:bg-slate-50 dark:hover:bg-ink-800"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {n.swipeActions && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center bg-emerald-500 text-white"
            style={{ opacity: Math.min(Math.max(dragX / SWIPE_THRESHOLD, 0), 1) }}
          >
            <PiCheckCircleLight className="h-5 w-5" />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-center bg-red-500 text-white"
            style={{ opacity: Math.min(Math.max(-dragX / SWIPE_THRESHOLD, 0), 1) }}
          >
            <PiXLight className="h-5 w-5" />
          </div>
        </>
      )}
      <div className="min-w-0 flex-1 bg-inherit" style={{ transform: `translateX(${dragX}px)` }}>
        <p className="text-sm text-ink-700 dark:text-ink-100">{n.text}</p>
        {n.meta && <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">{n.meta}</p>}
        {n.actions?.length > 0 && (
          <div className="mt-2 flex gap-2">
            {n.actions.map((action, ai) => (
              <button
                key={ai}
                type="button"
                onClick={action.onClick}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  action.tone === "danger"
                    ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
                    : "bg-brand-600 text-white hover:bg-brand-700"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(n.id)}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-300 hover:bg-slate-200 hover:text-ink-600 dark:text-ink-600 dark:hover:bg-ink-700 dark:hover:text-ink-200"
        title="Törlés"
        aria-label="Értesítés törlése"
      >
        <PiXLight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

Ez a komponens a fájl tetején, az `import`-ok után, a `NotificationDropdown` default export FÖLÖTT kerül definiálásra. Az eredeti `{notifications.map((n, i) => ( ... ))}` blokk (a `max-h-[60vh] overflow-y-auto py-1` konténeren belül) erre cserélődik:

```jsx
{notifications.map((n, i) => (
  <NotificationRow key={n.id ?? i} n={n} onDismiss={onDismiss} />
))}
```

- [ ] **Step 3: Manuális ellenőrzés**

Élőben (helyi `sessions`/`jarmu_valtas_kerelmek` teszt-sorral, ld. korábbi hasonló munkamenetek mintája a CLAUDE.md-ben) nyisd meg az Értesítések panelt egy nyitott jármű-váltási kérelemmel: (a) jobbra húzás (touch-emulation DevTools-ban, vagy tényleges mobil eszközön) a küszöb fölött jóváhagyja a kérelmet, balra húzás elutasítja; (b) a küszöb ALATTI húzás visszaugrik, nem vált ki semmit; (c) a meglévő "Jóváhagyás"/"Elutasítás" gombok továbbra is működnek; (d) egy bejelentés-sor (nincs `swipeActions`) nem reagál semmilyen húzásra, csak a "Megnyitás" gombja aktív.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar/Sidebar.js src/components/Dropdowns/NotificationDropdown.js
git commit -m "Swipe gesztus a jármű-váltási kérelmek jóváhagyás/elutasítás sorain"
```

---

## Task 8: Long press a "Fuvarok" bottom nav ikonon

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js` (a Task 5-ben létrehozott `mobileDirectLinks.map` blokk)

**Interfaces:**
- Consumes: Task 5 bottom nav shell-je (a `mobileDirectLinks.map` renderelt `<Link>` elemek).
- Produces: semmi, ez az utolsó feladat.

- [ ] **Step 1: Long-press állapot és handlerek a `Sidebar` komponensben**

A `quickActionsOpen`/`drawerOpen` state-ek mellé (Task 5 Step 4 helyén):

A `Sidebar.js` komponens elején **már létezik** egy `const history = useHistory();` sor (a `location`/`history` deklarációk mellett, a `useState`-ek után) — ezt nem kell újra létrehozni, csak a két új handler-t kell hozzáadni ugyanoda:

```js
const longPressTimerRef = React.useRef(null);
const longPressFiredRef = React.useRef(false);

const handleFuvarokTouchStart = () => {
  longPressFiredRef.current = false;
  longPressTimerRef.current = setTimeout(() => {
    longPressFiredRef.current = true;
    history.push("/admin/fuvarForm");
  }, 500);
};
const handleFuvarokTouchEnd = () => {
  if (longPressTimerRef.current) {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }
};
```

- [ ] **Step 2: A "Fuvarok" `<Link>` bővítése touch-handlerekkel**

A Task 5 Step 5-ben létrehozott `mobileDirectLinks.map` blokk módosul:

```jsx
{mobileDirectLinks.map((item) => {
  const active = isActive(item.to);
  const isFuvarok = item.to === "/admin/fuvarok";
  return (
    <Link
      key={item.to}
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[11px] font-medium leading-none transition-colors duration-150 ${
        active
          ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
          : "text-ink-400 dark:text-ink-500"
      }`}
      onClick={(e) => {
        if (isFuvarok && longPressFiredRef.current) {
          e.preventDefault();
          longPressFiredRef.current = false;
          return;
        }
        setQuickActionsOpen(false);
      }}
      onTouchStart={isFuvarok ? handleFuvarokTouchStart : undefined}
      onTouchEnd={isFuvarok ? handleFuvarokTouchEnd : undefined}
      onTouchMove={isFuvarok ? handleFuvarokTouchEnd : undefined}
    >
      <item.icon className="h-6 w-6 flex-shrink-0" />
      <span className="w-full truncate text-center">{item.text}</span>
    </Link>
  );
})}
```

A `onClick`-ben az `e.preventDefault()` + `longPressFiredRef.current = false` reset akadályozza meg, hogy a long-press UTÁN felszabaduló érintés (ami böngészőben egy `click` eseményt is kivált) még egyszer navigáljon a `/admin/fuvarok`-ra a `/admin/fuvarForm`-ra való navigálás UTÁN.

- [ ] **Step 3: Manuális ellenőrzés**

Mobil viewporton (valódi touch-emuláció, DevTools "Sensors" → touch, vagy fizikai eszköz): (a) rövid koppintás a "Fuvarok" ikonon → `/admin/fuvarok`; (b) kb. 500ms-nál hosszabb nyomás → közvetlenül `/admin/fuvarForm`, a lista-oldal rövid felvillanása nélkül; (c) a "Kezdőlap" ikon (nem `isFuvarok`) továbbra is csak sima kattintásra reagál, nincs long-press viselkedése.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar/Sidebar.js
git commit -m "Long press a Fuvarok ikonon — közvetlen ugrás Új fuvar létrehozásához"
```

---

## Végső, teljes-folyamat manuális ellenőrzés (mind a 8 task után)

1. `npm run build:tailwind` (ha bármelyik task óta nem futott le).
2. `npm start` + `php8.2 -S localhost:8001` (ld. CLAUDE.md dev-port megjegyzés), mobil viewport.
3. Végigmenni a spec "Tesztelés" szakaszának mind a 10 pontján (`docs/superpowers/specs/2026-07-30-mobil-navigacio-ujratervezes-design.md`).
4. Deszktop nézetben (`md:` fölött) ellenőrizni, hogy a sidebar semmilyen vizuális/funkcionális változást nem mutat a munka megkezdése előtti állapothoz képest (ez a teljes terv legszigorúbb, folyamatosan visszaellenőrizendő korlátja).
