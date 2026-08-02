# Sofőr Fuvar részletező oldal — vizuális redesign (2026-07-30)

## Kontextus

A Fuvar mezőátalakítás (ld. `2026-07-30-fuvar-mezok-atalakitas-design.md`) után egy gyors UX-átvilágítás a sofőr-oldali `FuvarReszletek.js` oldalon (`/user/fuvarReszletek`) több konkrét problémát talált: élő screenshot + mért touch-target (40px, a projekt 44px-es `min-h-11` konvenciója alatt), cégnév-duplikáció, lapos admin-szerű `dl` lista, a fő CTA (Útvonaltervezés) a lap alján. A felhasználó ezt követően egy teljes, Uber/Bolt Driver-stílusú mobil-app redesign briefet adott.

## Cél

A meglévő funkcionalitás (fuvar adatainak megtekintése, menetlevél/szállítólevél feltöltése, útvonaltervezés) **vizuális** újratervezése: nagy, kártya-alapú, egy kézzel használható, 2-3 másodperc alatt átlátható felület, a projekt meglévő design tokenjeire (brand/ink/sand paletta, `PiXxxLight` ikonkészlet, `min-h-11` touch-target konvenció) építve.

## Nem cél (explicit kizárva, jóváhagyott döntés)

- **Nincs elfogadás/elutasítás funkció.** A jelenlegi Fuvar-first adatmodellben (ld. CLAUDE.md "Fuvar-first munkafolyamat") az admin közvetlenül hozzárendeli a fuvart a sofőrhöz, nincs "függőben lévő, elfogadásra váró" állapot. Egy ilyen funkció új `allapot` értéket, új backend action-öket és admin-oldali láthatóságot igényelne az elutasított/elfogadott fuvarokra — ez egy önálló, ebben a körben NEM vállalt feature.
- **Nincs "Hívás" CTA.** Ehhez a megbízó telefonszáma kellene a sofőr-oldali válaszban (`getSajatFuvar`/`getSajatFuvarok`), de ez a mező (`ugyfelek.kapcsolattarto_telefon`) ma nincs lekérdezve a driver-oldali enrichmentben. Nem generálunk kitalált adatot vagy hamis gombot — ha ez a funkció később kell, külön kis backend-bővítés (`dusitEgySort()`/`dusitSorokat()` bővítése `megbizo_telefon`-nal).
- **Nincs sticky/fixed CTA.** A `BottomNav` már lefoglalja a képernyő alját minden sofőr-oldali oldalon — egy új sticky elem átfedés-kockázatot hordozna (ugyanaz a hibaosztály, mint a CLAUDE.md-ben dokumentált Sidebar mobil FAB-occlusion gotcha), külön tesztelés nélkül nem vezetjük be.
- **Nincs pull-to-refresh.** PWA-ban ezt a böngésző natívan biztosítja, felesleges duplikáció lenne.
- **Nincs swipe-to-delete a fotóknál.** YAGNI — a meglévő kuka-gomb + `confirmDialog` már biztonságos, egyértelmű törlési út. Jövőbeli finomításként megemlítve, nem most.

## Új struktúra

### 1. `RouteTimelineCard` (új komponens, `src/components/Fuvarok/RouteTimelineCard.js` vagy inline a `FuvarReszletek.js`-ben — implementációs tervben döntendő a fájl-elhelyezés)

Egy nagy, domináns kártya (`rounded-2xl border border-ink-100 bg-white p-5 shadow-soft`), függőleges "pickup → dropoff" elrendezéssel:

- **Felrakás sor**: bal oldalon egy kék körbe (`bg-brand-100 text-brand-600`, `h-9 w-9 rounded-full`) rakott `PiMapPinFill` ikon; jobbra egy fejléc-sor (`FELRAKÁS` `text-xs font-semibold uppercase tracking-wide text-ink-400`, jobbra igazítva mellette a dátum `text-xs font-semibold text-ink-600`), alatta a cég neve (`text-base font-bold text-ink-900`), alatta a cím (`text-xs text-ink-400`).
- **Összekötő elem**: egy függőleges pontozott vonal (`border-l-2 border-dashed border-ink-200`, kb. 40-48px magas, a bal oldali ikon-oszlop közepén futva), középen egy km-chip (`rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-ink-600`, pl. "210 km") — csak akkor jelenik meg, ha `tavolsag_km` van.
- **Lerakás sor**: ugyanaz a minta, zöld ikon-kör (`bg-emerald-100 text-emerald-600`) `PiMapPinFill`-lel, `LERAKÁS` fejléccel.
- **CTA gomb**: a kártya alján, teljes szélességű, **56px magas** (`min-h-14`) `bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-base font-bold uppercase tracking-wide`, `PiMapTrifoldLight` ikonnal, "Útvonaltervezés" felirattal. `disabled` állapotban `bg-slate-200 text-ink-400 cursor-not-allowed`, ugyanaz a logika, mint most (`utvonaltervEleheto`).

Ha egy oldal (felrakó VAGY lerakó) teljesen üres (se cég, se cím), az az oldal `"—"`-t mutat cégnév helyén, a dátum-mező pedig `"—"`-t, ha a dátum hiányzik — konzisztensen a projekt "no fake data" konvenciójával, semmit nem találunk ki.

### 2. `StatChip` (új, kicsi, generikus komponens — `src/components/UI/StatChip.js`, újrahasznosítható másutt is)

Props: `icon`, `value`, `label`. Renderelés: `rounded-xl bg-slate-50 px-3 py-2` doboz, ikon (`h-4 w-4 text-ink-400`) + érték (`text-sm font-bold text-ink-800`) egy sorban, alatta a címke (`text-[10px] uppercase tracking-wide text-ink-400`). Ha `value` üres/null, a chip **nem renderelődik** (nincs helyfoglaló üres chip).

A route-card alatt egy `flex flex-wrap gap-2` sorban: Tömeg (`PiScalesLight`, `${tomeg_tonna} t`), Raklapszám (`PiStackLight`, `raklapszam`), Áru (`PiPackageLight`, `aru_megnevezese`).

### 3. `NoteCard` (új, kicsi komponens)

Csak akkor renderelődik, ha `fuvar.megjegyzes` nem üres. `rounded-xl bg-sand-50 border border-sand-100 p-3 flex gap-2 items-start`, `PiNotePencilLight` ikon (`text-ink-400 mt-0.5`), szöveg (`text-sm text-ink-700`).

### 4. Megbízó sor

Egyszerű, halványabb sor (nem kártya) a StatChip-ek és a NoteCard közt: `PiBuildingsLight` ikon + `fuvar.megbizo_nev` + zárójelben a cím, ha van (`megbizo_irsz`/`megbizo_varos`/`megbizo_cim` összefűzve, ugyanaz a logika, mint most). `text-sm text-ink-600`, csak akkor jelenik meg, ha van `megbizo_nev`.

### 5. `Jármű` mező

**Elrejtve, ha nincs adat** (jelenleg `fuvar.kamion_rendszam || fuvar.furgon_rendszam || "—"` mindig renderelt egy "Jármű: —" sort) — most csak akkor jelenik meg (egy kis chip vagy a megbízó-sor mellett), ha van tényleges rendszám.

### 6. Fejléc-jelvény

A `MobileHeader title="Fuvar"` jobb oldalára egy `StatusBadge` kerül: `dokumentum_feltoltve` esetén `tone="success"` "Dokumentálva", egyébként `tone="brand"` "Aktív" — ugyanaz a `StatusBadge` komponens és tone-rendszer, amit a `Fuvarok.js` lista is használ, csak itt a részletező oldalon is látszik (jelenleg csak a listán volt jelvény).

### 7. Feltöltő kártyák (a meglévő `FeltoltoSzekcio` átstílusozása, nem újraírása)

A `kotelezo && sajatFajlok.length === 0` esetben a kártya külső wrapper kap egy `border border-amber-200` szegélyt (jelenleg nincs ilyen vizuális jelzés a kártyán magán, csak a "Kötelező" badge-en) — amint van legalább egy feltöltött menetlevél-fotó, a szegély eltűnik/semlegesre vált. Ez egy tisztán CSS-szintű, feltételes classname-változtatás, nem érinti a feltöltési logikát.

### 8. Betöltési állapot

A jelenlegi `<Spinner wrapperClassName="flex justify-center py-24" />` helyett egy skeleton-kártya (a route-card alakját előrevetítő, szürke placeholder blokkok), ugyanazzal a vizuális nyelvvel, mint a meglévő `components/UI/Skeleton.js` mintái (pl. az admin Dashboard betöltési állapota, ld. CLAUDE.md "Admin mobil UX audit"). Új, kicsi komponens vagy a meglévő `Skeleton.js` bővítése egy `RouteCardSkeleton` exporttal — implementációs tervben döntendő.

## Adattérkép (meglévő mezők, nincs új backend-igény ehhez a körhöz)

| UI elem | Forrás mező (`getSajatFuvar`/`getSajatFuvarok` válasz) |
|---|---|
| Felrakás dátuma | `felrakas_datuma` |
| Lerakás dátuma | `lerakas_datuma` |
| Felrakó cég/cím | `felrako_ceg` / `felrako_cim` |
| Lerakó cég/cím | `lerako_ceg` / `lerako_cim` |
| Távolság | `tavolsag_km` |
| Tömeg | `tomeg_tonna` |
| Raklapszám | `raklapszam` |
| Áru | `aru_megnevezese` |
| Megbízó | `megbizo_nev` + `megbizo_irsz`/`megbizo_varos`/`megbizo_cim` |
| Megjegyzés | `megjegyzes` |
| Jármű | `kamion_rendszam` / `furgon_rendszam` |
| Fejléc-jelvény | `dokumentum_feltoltve` |

Mindegyik mező már ma is visszaérkezik a backendtől (a legutóbbi Fuvar mezőátalakítás körben bővült ki `getSajatFuvarok`/`getSajatFuvar` a megbízó-cím enrichmenttel) — **ehhez a redesignhoz nincs szükség backend-módosításra**, tisztán frontend-munka.

## Vizuális rendszer

- **Színek** (meglévő tokenek, nincs új paletta): `brand-600`/`brand-700` (CTA, felrakó-pont), `emerald-500`/`emerald-100` (lerakó-pont, siker-jelzés), `amber-50`/`amber-200`/`amber-700` (kötelező-hiányzó jelzés, meglévő "Kötelező" badge színe), `slate-50` (sunken chipek/timeline háttér), `sand-50`/`sand-100` (jegyzet-kártya), `ink-900`/`ink-800` (elsődleges szöveg), `ink-400` (másodlagos szöveg — **soha `ink-300`** érdemi szövegre, a projekt kontraszt-szabálya szerint).
- **Tipográfia**: cégnevek `text-base font-bold text-ink-900`; címek `text-xs text-ink-400`; stat chip érték `text-sm font-bold`, címke `text-[10px] uppercase tracking-wide text-ink-400`; CTA szöveg `text-base font-bold uppercase tracking-wide` (nagyobb, mint a jelenlegi `text-sm`, mivel ez lett az elsődleges akció).
- **Spacing**: kártyák közt `gap-4`; route-kártya belül `p-5`; minden interaktív elem **min. `min-h-11`** (44px), a fő CTA `min-h-14` (56px) — mérve ellenőrizendő ugyanúgy, mint a korábbi mobil UX audit köröknél (`getBoundingClientRect()`).
- **Ikonok**: `react-icons/pi`, `Light` súly a leíró ikonokhoz (`PiScalesLight`, `PiStackLight`, `PiPackageLight`, `PiBuildingsLight`, `PiNotePencilLight`, `PiMapTrifoldLight`, `PiCameraLight`), `Fill` súly a timeline-pontokhoz (`PiMapPinFill`, kontrasztosabb egy színes körben).

## ASCII wireframe

```
┌─────────────────────────────────┐
│ ←  Fuvar              [Aktív]   │
├─────────────────────────────────┤
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ 🔵  FELRAKÁS      08.04.    ┃ │
│ ┃     UX Teszt Felrako Kft.   ┃ │
│ ┃     9021 Győr, Felrako u. 5.┃ │
│ ┃  ┊         [ 210 km ]       ┃ │
│ ┃ 🟢  LERAKÁS       08.06.    ┃ │
│ ┃     UX Teszt Lerako Kft.    ┃ │
│ ┃     4024 Debrecen, ...      ┃ │
│ ┃ ┌─────────────────────────┐ ┃ │
│ ┃ │ 🗺  ÚTVONALTERVEZÉS      │ ┃ │
│ ┃ └─────────────────────────┘ ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│ [📦 18,75 t] [🔢 22] [🏷 alkatrész] │
│ 🏢 Teszt Ugyfel Kft. (Leányvár) │
│ ┌─────────────────────────────┐│
│ │ 📝 Kerüld el a dugót a hídon││
│ └─────────────────────────────┘│
│ MENETLEVÉL          [KÖTELEZŐ] │  ← amber border amíg hiányzik
│ ┌─────────────────────────────┐│
│ │      📷 Fotó hozzáadása      ││
│ └─────────────────────────────┘│
│ SZÁLLÍTÓLEVÉL      [OPCIONÁLIS]│
│ ┌─────────────────────────────┐│
│ │      📷 Fotó hozzáadása      ││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

## Tesztelés

Nincs automatizált frontend teszt-keret ebben a projektben (ld. CLAUDE.md). Élő ellenőrzés: helyi headless Chromium (`playwright-chromium`, a `scripts/prerender.js` már meglévő devDependency-je) — mivel a felhasználó saját, interaktív Chrome-ja ugyanazt az automatizációs profilt használhatja, amit a Playwright MCP eszköz, egy önálló Node-szkripttel kell dolgozni (ld. korábbi kör tapasztalata), NEM a megosztott böngésző-profillal. Ellenőrizendő: a route-card megjelenése valós adattal, a CTA gomb `getBoundingClientRect()`-tel mért mérete (≥44px, cél 56px), a feltöltő kártyák amber/semleges szegély-váltása feltöltés előtt/után, üres mezők (Jármű, StatChip-ek, Megjegyzés) helyes elrejtése.
