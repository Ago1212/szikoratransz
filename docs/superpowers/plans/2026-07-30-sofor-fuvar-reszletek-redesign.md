# Sofőr Fuvar részletező redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sofőr-oldali `/user/fuvarReszletek` oldal (`FuvarReszletek.js`) tisztán vizuális újratervezése egy Uber/Bolt Driver-stílusú, kártya-alapú, nagy touch-targetes felületre — funkcionalitás-változás nélkül.

**Architecture:** Három új, generikus/domain UI-építőelem (`StatChip`, `NoteCard`, `RouteTimelineCard`) plusz egy meglévő `Skeleton.js` bővítés (`RouteCardSkeleton`), majd ezek beépítése a meglévő `FuvarReszletek.js`-be a jelenlegi lapos `dl`-lista helyett. Nincs backend-változás — minden szükséges mező már ma is visszaérkezik `getSajatFuvar`/`getSajatFuvarok`-ból.

**Tech Stack:** React (CRA), Tailwind (meglévő brand/ink/sand tokenek), `react-icons/pi` (Phosphor ikonok).

## Global Constraints

- Nincs automatizált frontend teszt-keret ebben a projektben — minden lépést élő, önálló headless Chromium-szkripttel kell ellenőrizni (`node_modules/playwright-chromium`, a repo gyökeréből futtatva, NEM a `/tmp` scratchpadból a `require`-feloldás miatt), mert a felhasználó saját interaktív Chrome-ja ütközhet a Playwright MCP eszköz megosztott automatizációs profiljával.
- **A sofőr-oldali (`layouts/User.js` alatti) komponensek NEM használnak `dark:` Tailwind-variánst** — a `dark` osztály csak az admin gyökér `<div>`-en ül (ld. CLAUDE.md "Fejlesztési audit... Dark mode"), a sofőr-felületen sosem aktiválódik. Az új komponensek (StatChip/NoteCard/RouteTimelineCard) emiatt tudatosan NEM kapnak `dark:` osztályt, konzisztensen a meglévő `FuvarReszletek.js`/`Fuvarok.js` (sofőr) kóddal, ahol szintén nincs egyetlen `dark:` osztály sem.
- Minden interaktív elem `min-h-11` (44px) minimum, a fő CTA gomb `min-h-14` (56px) — mérve ellenőrizendő `getBoundingClientRect()`-tel.
- Új Tailwind utility-osztály bevezetése esetén `npm run build:tailwind` szükséges ellenőrzés előtt — ebben a tervben minden felhasznált osztály (pl. `min-h-14`, `bg-sand-50`, `bg-brand-100`, `bg-emerald-100`) már használatban van máshol a kódbázisban, tehát valószínűleg nem szükséges, de a végső élő ellenőrzésnél mindenképp ellenőrizni kell, hogy a stílusok ténylegesen érvényesülnek.
- Helyi dev környezet: `npm start` (port 3000) és `php8.2 -S localhost:8001` (backend, `backend/` alól) — mindkettő valószínűleg már fut.

---

## Task 1: Új megosztott UI-építőelemek (StatChip, NoteCard, RouteTimelineCard, RouteCardSkeleton)

**Files:**
- Create: `src/components/UI/StatChip.js`
- Create: `src/components/UI/NoteCard.js`
- Create: `src/components/Fuvarok/RouteTimelineCard.js`
- Modify: `src/components/UI/Skeleton.js` (új névvel exportált `RouteCardSkeleton`, a meglévő `TableSkeleton` default export mellett)

**Interfaces:**
- Produces: `StatChip({ icon, value, label })` — `null`-t rendereld, ha `value` üres/null/undefined. `NoteCard({ text })` — `null`-t rendereld, ha `text` üres. `RouteTimelineCard({ felrako: {ceg, cim, datum}, lerako: {ceg, cim, datum}, tavolsagKm, onUtvonalterv, eleheto })`. `RouteCardSkeleton()` (named export, paraméter nélkül).
- Ezt a 3 önálló komponenst és a skeletont a Task 2 (`FuvarReszletek.js`) fogyasztja — külön-külön nem renderelhetők/tesztelhetők élőben, amíg nincsenek beépítve, ezért ennek a tasknak nincs önálló élő-böngészős ellenőrzési lépése (a szintaktikai helyesség a Task 2 élő screenshot-jával igazolódik).

- [ ] **Step 1: Írd meg `src/components/UI/StatChip.js`-t**

```jsx
import React from "react";

// Kis, generikus infó-chip ikonnal (pl. tömeg, raklapszám, jármű) — ha
// nincs érdemi érték, nem renderelődik (nincs üres helyfoglaló chip).
export default function StatChip({ icon: Icon, value, label }) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-ink-400" />}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink-800">{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Írd meg `src/components/UI/NoteCard.js`-t**

```jsx
import React from "react";
import { PiNotePencilLight } from "react-icons/pi";

// Kiemelt "jegyzet"-doboz (pl. fuvar megjegyzés) — sand hátterű, hogy
// vizuálisan elkülönüljön a sima szövegsoroktól. Nem renderelődik, ha
// nincs szöveg.
export default function NoteCard({ text }) {
  if (!text) {
    return null;
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-sand-100 bg-sand-50 p-3">
      <PiNotePencilLight className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" />
      <p className="text-sm text-ink-700">{text}</p>
    </div>
  );
}
```

- [ ] **Step 3: Írd meg `src/components/Fuvarok/RouteTimelineCard.js`-t**

```jsx
import React from "react";
import { PiMapPinFill, PiMapTrifoldLight } from "react-icons/pi";

function Vegpont({ label, tone, adat }) {
  const toneClasses = tone === "felrako" ? "bg-brand-100 text-brand-600" : "bg-emerald-100 text-emerald-600";
  return (
    <div className="flex gap-3">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
        <PiMapPinFill className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
          <p className="flex-shrink-0 text-xs font-semibold text-ink-600">{adat.datum || "—"}</p>
        </div>
        <p className="mt-0.5 text-base font-bold text-ink-900">{adat.ceg || "—"}</p>
        {adat.cim && <p className="text-xs text-ink-400">{adat.cim}</p>}
      </div>
    </div>
  );
}

// Nagy, domináns "pickup → dropoff" kártya (Uber/Bolt Driver mintára) —
// felrakó/lerakó pont + a köztük futó szaggatott vonal középen a
// távolság-chippel, alul a fő navigációs CTA. A `felrako`/`lerako` prop
// alakja: { ceg, cim, datum } — mindhárom mező hiányozhat, "—"-ra esik
// vissza, sosem generálunk kitalált adatot.
export default function RouteTimelineCard({ felrako, lerako, tavolsagKm, onUtvonalterv, eleheto }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
      <Vegpont label="Felrakás" tone="felrako" adat={felrako} />
      <div className="ml-[18px] flex h-10 items-center border-l-2 border-dashed border-ink-200 pl-5">
        {tavolsagKm ? (
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-ink-600">{tavolsagKm} km</span>
        ) : null}
      </div>
      <Vegpont label="Lerakás" tone="lerako" adat={lerako} />

      <button
        type="button"
        onClick={onUtvonalterv}
        disabled={!eleheto}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-ink-400"
      >
        <PiMapTrifoldLight className="h-5 w-5" />
        Útvonaltervezés
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Bővítsd `src/components/UI/Skeleton.js`-t egy `RouteCardSkeleton` named exporttal**

A fájl VÉGÉRE (a meglévő `TableSkeleton` default export UTÁN), ugyanazzal az `animate-pulse` mintával:

```jsx
// A RouteTimelineCard alakját előrevetítő betöltő-állapot a sofőr Fuvar
// részletező oldalán — ugyanaz a minta, mint a fenti TableSkeleton, csak
// a route-kártya geometriájára szabva.
export function RouteCardSkeleton() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-ink-100 motion-reduce:animate-none" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="ml-[18px] h-10 border-l-2 border-dashed border-ink-100" />
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-ink-100 motion-reduce:animate-none" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mt-4 h-14 w-full animate-pulse rounded-xl bg-ink-100 motion-reduce:animate-none" />
    </div>
  );
}
```

- [ ] **Step 5: Ellenőrizd, hogy a `TableSkeleton` default export nem sérült**

Run: `grep -n "export default function TableSkeleton\|export function RouteCardSkeleton" src/components/UI/Skeleton.js`
Expected: mindkét sor megjelenik, a fájlnak pontosan egy default exportja van.

- [ ] **Step 6: Commit**

```bash
git add src/components/UI/StatChip.js src/components/UI/NoteCard.js src/components/Fuvarok/RouteTimelineCard.js src/components/UI/Skeleton.js
git commit -m "$(cat <<'EOF'
feat(ui): add StatChip/NoteCard/RouteTimelineCard building blocks

New shared components for the sofőr Fuvar detail redesign — not yet
wired into any page, verified together with the FuvarReszletek.js
integration in the next commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `FuvarReszletek.js` integráció — route timeline, stat chipek, jegyzet-kártya, állapot-jelvény, feltöltő-kártya jelzés

**Files:**
- Modify: `src/views/user/FuvarReszletek.js` (teljes átdolgozás)

**Interfaces:**
- Consumes: Task 1 `StatChip`, `NoteCard`, `RouteTimelineCard`, `RouteCardSkeleton`.
- Nincs backend-mezőigény — minden adat (`felrako_ceg`/`felrako_cim`/`lerako_ceg`/`lerako_cim`/`felrakas_datuma`/`lerakas_datuma`/`tavolsag_km`/`tomeg_tonna`/`raklapszam`/`aru_megnevezese`/`megbizo_nev`/`megbizo_irsz`/`megbizo_varos`/`megbizo_cim`/`kamion_rendszam`/`furgon_rendszam`/`dokumentum_feltoltve`/`megjegyzes`) már ma is visszajön `getSajatFuvar`/`getSajatFuvarok`-ból.

- [ ] **Step 1: Bővítsd az import-listát**

```jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { PiCameraLight, PiFilePdfLight, PiTrashLight, PiScalesLight, PiStackLight, PiPackageLight, PiTruckLight, PiBuildingsLight } from "react-icons/pi";
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
```

(A `PiMapTrifoldLight`/`Spinner` importok megszűnnek — az ikon a `RouteTimelineCard`-ba költözött, a Spinner helyét a `RouteCardSkeleton` veszi át.)

- [ ] **Step 2: Cseréld le a `FeltoltoSzekcio` komponenst — amber szegély, amíg a kötelező dokumentum hiányzik**

```jsx
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
```

(Csak a komponens `return`-je változott — egy feltételes `className`-ú wrapper `<div>` került a tartalom köré; a belső JSX és a `handleFileChange` logika változatlan.)

- [ ] **Step 3: Cseréld le a betöltési állapotot (a jelenlegi `if (loading || !fuvar) return <Spinner .../>` blokk)**

```jsx
  if (loading || !fuvar) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <MobileHeader title="Fuvar" />
        <RouteCardSkeleton />
      </div>
    );
  }
```

- [ ] **Step 4: Cseréld le a fő `return` blokkot (a `jarmu` változó definíciójától a fájl végéig)**

```jsx
  const jarmu = fuvar.kamion_rendszam || fuvar.furgon_rendszam || null;

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
        onUtvonalterv={handleUtvonalterv}
        eleheto={utvonaltervEleheto}
      />

      <div className="flex flex-wrap gap-2">
        <StatChip icon={PiScalesLight} value={fuvar.tomeg_tonna != null ? `${fuvar.tomeg_tonna} t` : null} label="Tömeg" />
        <StatChip icon={PiStackLight} value={fuvar.raklapszam ?? null} label="Raklap" />
        <StatChip icon={PiPackageLight} value={fuvar.aru_megnevezese} label="Áru" />
        <StatChip icon={PiTruckLight} value={jarmu} label="Jármű" />
      </div>

      {fuvar.megbizo_nev && (
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <PiBuildingsLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          <span>
            {fuvar.megbizo_nev}
            {megbizoTeljesCim ? ` (${megbizoTeljesCim})` : ""}
          </span>
        </div>
      )}

      <NoteCard text={fuvar.megjegyzes} />

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
    </div>
  );
}
```

- [ ] **Step 5: Ellenőrizd, hogy nem maradt hivatkozás a törölt importokra/változókra**

Run: `grep -n "Spinner\|PiMapTrifoldLight" src/views/user/FuvarReszletek.js`
Expected: nincs találat (mindkettő a `RouteTimelineCard`/`RouteCardSkeleton`-ba költözött).

- [ ] **Step 6: Élő ellenőrzés — headless Chromium (a repo gyökeréből futtatva egy eldobható szkripttel)**

Hozz létre egy teszt-fuvart (root MySQL / meglévő admin curl-minta) egy meglévő sofőrhöz, teljesen kitöltött mezőkkel (felrakó/lerakó cég+cím, dátumok, tömeg, raklapszám, áru, megjegyzés, megbízó), majd egy headless Chromium-szkripttel:
1. Navigálj `/user/fuvarReszletek?id=<id>`-re, `localStorage`-ban sofőr-session-nel.
2. Készíts teljes-oldal screenshotot, nézd át vizuálisan: route timeline card felül, stat chipek, megbízó sor, jegyzet-kártya, feltöltő kártyák.
3. Mérd le `getBoundingClientRect()`-tel az "Útvonaltervezés" gomb magasságát — **≥56px** legyen (korábban 40px volt).
4. Kattints a gombra, ellenőrizd hogy a Google Maps URL helyesen épül fel (origin/destination a felrakó/lerakó cég+cím alapján), ugyanúgy, mint a korábbi körben.
5. Hozz létre egy MÁSIK teszt-fuvart hiányos adatokkal (nincs tömeg, nincs raklapszám, nincs jármű, nincs megjegyzés) — ellenőrizd, hogy a megfelelő StatChip-ek/NoteCard/megbízó-sor NEM jelenik meg (nincs üres helyfoglaló elem).
6. Ellenőrizd a Menetlevél kártya amber szegélyét (nincs feltöltött menetlevél-fotó a teszt-fuvaron) — töltsd fel a `feltoltFuvarDokumentumot` actiont curl-lel egy fájllal, frissítsd az oldalt, ellenőrizd hogy a szegély eltűnik.
7. Takarítsd el a teszt-fuvarokat/session-t a helyi DB-ből a végén.

Expected minden lépésre: nincs böngésző-konzol hiba, a vizuális elrendezés megegyezik a design spec ASCII wireframe-jével, a gomb mérete és a Google Maps URL helyes.

- [ ] **Step 7: Commit**

```bash
git add src/views/user/FuvarReszletek.js
git commit -m "$(cat <<'EOF'
feat(sofor-fuvar): redesign detail screen with route timeline + chips

Replaces the flat admin-style dl list with a large route timeline
card, stat chips, a highlighted note card, a header status badge, and
an amber upload-state border for the still-missing required menetlevél
— pure visual redesign, no functional/backend change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
