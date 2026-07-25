# Fuvar-dokumentum OCR + Fuvar modul core — tervezési spec

**Dátum**: 2026-07-25
**Állapot**: Jóváhagyott terv, implementáció előtt

## 1. Áttekintés és cél

A fuvarozó cég jelenleg Excel-ben vezeti a fuvarnyilvántartást (sofőr, kamion, útvonal,
fuvardíj, heti/napi profit-számítások). A cél egy dedikált, a jelenlegi ügyviteli
rendszerbe (`szikoratransz`) integrált **Fuvar modul**, ahol a fuvarlevél/szállítólevél
papíralapú dokumentumokból OCR-rel automatikusan kinyert adatok alapján egy fuvar
rögzítése **legfeljebb 30-60 másodperc** legyen, minimális kézi gépeléssel.

Ez a spec **csak az első alrendszert** fedi le egy nagyobb, 7 részre bontott projektből
(a teljes eredeti kérés dokumentum-OCR-t, Számlázz.hu-integrációt, NAV kimenő-számla-
követést, bank-egyeztetést és statisztikai dashboardokat is tartalmazott — ezek külön,
későbbi tervezési menetekben készülnek, ld. 8. pont).

## 2. Előzmény és kontextus

A `CLAUDE.md` szerint egy korábbi menetben **tudatosan eltávolításra került** a régi
`fuvarok` tábla és a hozzá tartozó Fuvarok/Fuvartervező modul, mert "a fuvarfeladatok és
fizetési feltételek ennél a cégnél valójában szóban, telefonon dőlnek el, így a
strukturált rekordok sosem voltak megbízhatóan naprakészek".

Ez a projekt **szándékosan más adatforrásra épül**: nem a diszpécser kézi/emlékezet-
alapú rögzítésére, hanem a **papíron úgyis kitöltött fuvarlevél OCR-jére** — az adatok
forrása a fizikai dokumentum, nem egy telefonhívás utólagos felidézése. Ezzel a korábbi
megbízhatatlansági probléma gyökere (hogy az adatbevitel elmarad/pontatlan, mert nincs
kézzelfogható forrás) elvileg megszűnik. Ha egy fuvarhoz mégsem töltenek fel
dokumentumot, a kézi rögzítési út (ld. 6.3) változatlanul elérhető marad — ez tudatos
visszaesési lehetőség, nem hiányosság.

A `ugyfelek` tábla `fizetesi_hatarido_nap` mezője is ennek a korábbi kivezetésnek
esett áldozatul — ez a spec **visszahozza**, mert az új Fuvar modul auto-kitöltési
követelménye (megbízó kiválasztásakor a fizetési határidő automatikus megjelenése)
kifejezetten igényli.

## 3. Hatókör

### Ebben a fázisban elkészül
- Dokumentum-feltöltés (admin és sofőr) + "Beérkezett dokumentumok" inbox
- OCR-alapú mezőkinyerés (Gemini API, ld. 5. pont)
- `fuvarok` tábla + teljes CRUD + autocomplete/auto-kitöltés
- Fuvar létrehozása dokumentumból (1 kattintással, felülírható mezőkkel) VAGY kézzel
- Alapvető keresés/szűrés a Fuvarok listán (nem a globális kereső bővítése — az egy
  következő fázis olcsó kiegészítése lehet, ld. 8. pont)
- `allapot` mező a fuvarokon (5 érték), de **csak kézi váltással** ebben a fázisban

### Ebben a fázisban NEM készül el
- Számlázz.hu-integráció (fuvarból számla generálása)
- NAV Online Számla kimenő-számla-követés (kiegyenlítettség automatikus lekérdezése)
- Bank-egyeztetés fuvar/számla-szinten
- `allapot` automatikus váltása (`szamlazva`/`fizetesre_var`/`teljesitve` — ezek a fenti
  integrációkra épülnek)
- Globális kereső (`GlobalSearch.js`/`keresesInterface.php`) bővítése fuvarokkal
- Statisztikai dashboardok (sofőr/kamion/megbízó/havi/pénzügyi) — ezek a `fuvarok`
  táblára épülnek majd, külön fázisban
- Többmegállós útvonal-modellezés (ld. 7.1 nyitott kérdés)

## 4. Adatmodell

### 4.1 `beerkezett_dokumentumok` (új tábla)

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | |
| `admin` | INT NOT NULL | ceg_id, tenant-szűkítés |
| `fajl_id` | INT NOT NULL | → `fajlok.id`, a nyers fájl |
| `tipus` | ENUM('fuvarlevel','szallitolevel','ismeretlen') NOT NULL DEFAULT 'ismeretlen' | OCR-becsült, admin felülírhatja |
| `ocr_allapot` | ENUM('feldolgozatlan','kesz','hiba') NOT NULL | |
| `ocr_adatok` | TEXT (JSON) NULL | kinyert mezők, ld. 5.2 |
| `feltolto_tipus` | ENUM('admin','sofor') NULL | ugyanaz a minta, mint `fajlok.feltolto_tipus` |
| `feltolto_id` | INT NULL | |
| `feltolto_nev` | VARCHAR(191) NULL | denormalizált snapshot |
| `fuvar_id` | INT NULL | → `fuvarok.id`, ha már lett belőle fuvar |
| `letrehozva` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `torolt` | ENUM('I','N') NOT NULL DEFAULT 'N' | |

Index: `(admin, torolt)`, `(admin, ocr_allapot)`, `(admin, fuvar_id)`.

### 4.2 `fuvarok` (új tábla)

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | |
| `admin` | INT NOT NULL | ceg_id |
| `sofor_id` | INT NULL | → `user.id` |
| `kamion_id` | INT NULL | → `kamion.id`, kölcsönösen kizáró `furgon_id`-vel |
| `furgon_id` | INT NULL | → `furgon.id` |
| `potkocsi_id` | INT NULL | → `potkocsi.id`, opcionális |
| `teljesites_datuma` | DATE NULL | |
| `felrako` | VARCHAR(250) NULL | |
| `lerako` | VARCHAR(250) NULL | |
| `tavolsag_km` | INT NULL | |
| `megbizo_id` | INT NULL | → `ugyfelek.id` |
| `aru_megnevezese` | VARCHAR(250) NULL | |
| `megjegyzes` | TEXT NULL | |
| `fuvardij` | DECIMAL(10,2) NULL | |
| `egyeb_koltseg` | DECIMAL(10,2) NULL | |
| `fuvarlevel_szam` | VARCHAR(100) NULL | OCR-ből, kereshető |
| `allapot` | ENUM('rogzitett','szamlazasra_var','szamlazva','fizetesre_var','teljesitve') NOT NULL DEFAULT 'rogzitett' | |
| `letrehozva` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updatedAt` | DATETIME NOT NULL | |
| `torolt` | ENUM('I','N') NOT NULL DEFAULT 'N' | |

Index: `(admin, torolt)`, `(admin, allapot)`, `(admin, teljesites_datuma)`,
`(admin, megbizo_id)`.

**"Összesen" nem tárolt mező** — mindig `fuvardij + egyeb_koltseg` a lekérdezésben
(`getFuvarok`/`getFuvar`), a redundáns tárolás elkerülése végett (konzisztens a projekt
"ne számolj ki és tárolj olyat, ami mindig levezethető" elvével).

A "Beérkezett dokumentum" állapot **nem `fuvarok.allapot` érték** — azt jelzi, hogy egy
`beerkezett_dokumentumok` sorból még nem készült fuvar (`fuvar_id IS NULL`). Fuvar
rekord mindig `rogzitett`-tel jön létre.

### 4.3 `ugyfelek` bővítés

`fizetesi_hatarido_nap INT NULL` — a megbízó alapértelmezett fizetési határideje
napokban (pl. 30), auto-kitöltéshez és később a Számlázz.hu-fázisban a számla fizetési
határidejének alapértékéhez.

### 4.4 SQL migráció

Az `backend/sql/N.sql` konvenció szerint (ellenőrizni kell implementációkor, hogy a
legutóbbi számozott fájl commitolva van-e — ha nem, ahhoz kell fűzni, nem újat nyitni).

**A `fajlok.tabla` ENUM-ot is bővíteni kell** két új értékkel: `'beerkezett_dokumentum'`
(az inbox-feltöltések átmeneti tárolási helye, ld. 5.3) és `'fuvar'` (a fuvarhoz
véglegesen hozzárendelt melléklet, ld. 6.1) — ugyanaz a mintázat, mint korábban a
`bank_import`/`mol_import`/`tachograf_import` értékek hozzáadásakor.

## 5. OCR-integráció

### 5.1 Motor: Gemini API (ingyenes kvóta)

A csatolt mintadokumentumok alapján a fuvarlevelek jellemzően **kézzel írottak**
(kurzív magyar kézírás), a szállítólevelek jellemzően nyomtatottak. A döntés a
**Google Gemini API** mellett (multimodális LLM, LLM-minőségű szemantikus
kézírás-értelmezés, közvetlen strukturált JSON-kimenet), az ingyenes kvóta-szinten —
ez a jelenlegi kisflottás volumennél (várhatóan napi néhány, havi néhány tucat
dokumentum) elegendő.

**Kvóta-kimerülés / hálózati hiba esetén nincs hibaüzenet a felhasználónak** — a
dokumentum ekkor is bekerül az inboxba, `ocr_allapot='hiba'`-val, üres mezőkkel, admin
kézzel tölti ki. Ez tudatos, graceful degradation (ld. 5.3), nem kivétel/exception út.

API-kulcs: `backend/config.php`-ban (vagy `backend/env.php`-n keresztül, ld. a meglévő
`envOrDefault()` mintát) egy új `geminiApiKey` konstans.

### 5.2 Kinyerendő mezők (`ocr_adatok` JSON)

```json
{
  "tipus": "fuvarlevel|szallitolevel|ismeretlen",
  "rendszam": "string|null",
  "sofor_neve": "string|null",
  "datum": "YYYY-MM-DD|null",
  "felrako": "string|null",
  "lerako": "string|null",
  "megbizo": "string|null",
  "aru_megnevezese": "string|null",
  "suly": "string|null",
  "fuvarlevel_szam": "string|null",
  "egyeb_megjegyzes": "string|null"
}
```

A `tipus` mező (`beerkezett_dokumentumok.tipus` kezdőértéke) **ugyanabból a Gemini-
hívásból** jön, nem külön lépésből — a promptban explicit kérve, hogy a modell saját
maga döntse el, fuvarlevelet vagy szállítólevelet lát-e.

**`sofor_neve`**: a kezdeti mezőlistából hiányzott, de a fuvar-entitásnak szüksége van
rá (ld. 2. pont) — egy élő teszt (ld. 5.4) mutatta meg a hiányt, pótolva.

### 5.4 Élő validáció (2026-07-25, Gemini API, a csatolt mintadokumentumokkal)

A tervezési fázisban egy valódi Gemini API-hívással (`gemini-3.5-flash` modell,
`responseMimeType: application/json`) leteszteltük mindkét mintadokumentumot, mielőtt
a designt implementációra vittük volna. Eredmény:

- **Szállítólevél (nyomtatott)**: szinte hibátlan kinyerés minden mezőre (dátum,
  felrakó/lerakó cím, vevő, több tétel árumegnevezése, súly, szállítólevél-szám).
- **Fuvarlevél (kézírásos)**: jó, de nem hibátlan — dátum/súly/fuvarlevél-szám pontos
  volt, de **a rendszám két külön hívásnál két eltérő eredményt adott** ("RLP-018" vs.
  "RCP-018" ugyanarról a képről), és a modell maga is jelezte bizonytalanságát az
  `egyeb_megjegyzes` mezőben. Ez empirikusan megerősíti a terv alapfeltevését: az
  OCR-eredmény **soha nem menthető vakon**, mindig admin-review kell a fuvar
  létrehozása előtt (ld. 6. pont) — ez nem csak elméleti óvatosság, hanem ténylegesen
  megfigyelt viselkedés.
- **Megbízó-azonosítási hiba, javítva**: az első próbálkozásra a modell összekeverte a
  dokumentum nyomtatott fejlécén szereplő saját cégünket (a fuvarozót) a tényleges
  megbízóval (a "Fuvaroztató neve, címe" mezőben szereplő ügyféllel). Egy explicit
  prompt-szabály hozzáadásával ("a nyomtatott fejléc cége SOSEM lehet megbízó")
  javítható, de mivel a rendszer **több céget/tenant-ot is kiszolgál** (`admin`/
  `ceg_id` architektúra), a saját cégnév **nem írható be fixen a promptba** — ld. 4.5.

### 4.5 `admin` tábla bővítés: saját cégnév

A teszt közben kiderült, hogy az `admin` táblában **jelenleg nincs tárolt cégnév
mező** (csak a bejelentkező személy neve, `admin.name`). Ez szükséges ahhoz, hogy az
OCR-prompt dinamikusan tudja megkülönböztetni "ez mi vagyunk, a fuvarozó" vs. "ez a
tényleges megbízó" — enélkül a promptba fixen beírt cégnév csak egyetlen tenant-nál
működne. Új mező: **`admin.cegnev` (VARCHAR(200) NULL)**, csak a root/tulajdonos admin
során töltendő ki (`tulajdonos_admin_id IS NULL`) — ugyanaz a hatókör, mint más,
cég-szintű beállításoknál (pl. NAV-hitelesítő adatok). Ez a mező egyébként a későbbi
Számlázz.hu-fázisban is szükséges lesz (kibocsátó adatai a számlán), itt csak korábban
kerül bevezetésre, mint eredetileg tervezve.

A Gemini-promptnak explicit tartalmaznia kell: (1) a dokumentum magyar fuvarlevél vagy
szállítólevél, (2) ha egy mező nem olvasható/nem szerepel, `null`-t adjon vissza, ne
találjon ki adatot, (3) többmegállós útvonal esetén az első és utolsó megállót
adja `felrako`/`lerako`-ként, a köztes megállókat `egyeb_megjegyzes`-be írja (ld. 7.1).

### 5.3 Folyamat: `elemezBeerkezettDokumentum($base64, $fajlnev)`

1. Gemini vision API hívás a képpel/PDF-fel (PDF esetén előbb `pdftoppm`-mel képre
   konvertálva, ugyanaz a poppler-utils-függőség, mint a `pdftotext`-nél). A prompt
   dinamikusan tartalmazza a hívó cég nevét (`admin.cegnev`, a root admin soráról,
   szerver-oldalon a `ceg_id`-ből feloldva — ld. 4.5), hogy a modell meg tudja
   különböztetni a saját cégünket (fuvarozó) a tényleges megbízótól.
2. **Sikeres OCR**: fájl mentése `fajlok`-ba (`tabla='beerkezett_dokumentum'`,
   `rowid=ceg_id`, feltöltő szerver-oldalon feloldva — ugyanaz a minta, mint Bank/MOL/
   Tachográf import), `beerkezett_dokumentumok` sor létrehozása `ocr_allapot='kesz'`-szel.
3. **Sikertelen OCR** (hálózati hiba, kvóta-limit, Gemini hibaválasz): a fájl **ekkor is**
   elmentődik, `beerkezett_dokumentumok` sor `ocr_allapot='hiba'`-val, `ocr_adatok=NULL`.
   Ez **tudatos eltérés** a Bank/MOL/Tachográf importok mintájától (ott hiba esetén
   semmi nem perzisztálódik) — itt kifejezett elvárás, hogy a feltöltés sose vesszen el.
4. Válasz: a létrehozott `beerkezett_dokumentumok` sor (`ocr_adatok`-kal együtt).

## 6. Backend API-akciók

- `elemezBeerkezettDokumentum($base64, $fajlnev)` — ld. 5.3
- `getBeerkezettDokumentumok($szures)` — admin inbox lista (`ocr_allapot`,
  `tipus`, feldolgozva-e [`fuvar_id IS NULL` vagy nem] szerint szűrhető)
- `updateBeerkezettDokumentumTipus($id, $tipus)` — admin felülírja a típus-becslést
- `letrehozFuvarDokumentumbol($dokumentum_id, $mezok)` — ld. 6.1
- `newFuvar($mezok)` — kézi rögzítés dokumentum nélkül
- `updateFuvar($id, $mezok)`
- `deleteFuvar($id)` — soft delete
- `getFuvarok($szures, $sortKey, $sortDir)` — lista, `DataTable` mintára
- `getFuvar($id)` — egy rekord részletesen
- `getUgyfelFuvarElozmeny($ugyfel_id)` — ld. 6.2

Mindegyik a szokásos szerver-oldali `ceg_id`-feloldást használja
(`resolveKerelmezo()['ceg_id']`), sosem klienstől kapott azonosítót.

### 6.1 `letrehozFuvarDokumentumbol()` logika

1. Betölti a `beerkezett_dokumentumok.ocr_adatok`-ot.
2. Rendszám-egyeztetés `kamion`/`furgon` táblákkal (alfanumerikus normalizálás, mint a
   MOL-importnál).
3. Sofőr/megbízó név-egyeztetés laza (ékezet-normalizált tartalmazás) egyezéssel
   `user`/`ugyfelek` táblákkal (mint a Tachográf sofőr-javaslatnál).
4. A `$mezok` paraméterben átadott admin-felülírásokkal egyesítve `INSERT INTO fuvarok`.
5. `beerkezett_dokumentumok.fuvar_id` beállítása.
6. **A `fajlok` sor áthelyezése**: `UPDATE fajlok SET tabla='fuvar', rowid=<új fuvar id>
   WHERE id = <fajl_id>` — a dokumentum ezután a fuvar szokásos melléklet-galériájában
   jelenik meg (ugyanaz a komponens, mint minden más modulnál), nincs duplikált tárolás.
   Ez egy a kódbázisban eddig nem használt, de egyszerű minta (egyetlen UPDATE) — nem
   hoz be új infrastruktúrát.

### 6.2 `getUgyfelFuvarElozmeny()` — referencia, nem autofill

A megbízó "szokásos fuvardíjai" **nem kerülnek vakon beírásra** a fuvardíj mezőbe, mert
útvonalanként erősen eltérhetnek. Ehelyett egy lekérdezés adja vissza az adott
megbízóhoz tartozó utolsó N fuvart (dátum, útvonal, díj) — a frontend egy referencia-
panelként jeleníti meg, kattintásra másolható értékekkel, nem automatikus kitöltéssel.

### 6.3 Kézi fuvarrögzítés

A `newFuvar` ugyanazon a formon megy, mint a dokumentum-alapú létrehozás, csak nincs
OCR-előtöltés — ez a visszaesési út, ha egy fuvarhoz mégsem készül/kerül fel dokumentum.

## 7. Auto-kitöltés részletei

| Kiválasztott mező | Automatikusan töltődik | Forrás (nincs séma-változás) |
|---|---|---|
| Megbízó | cím, adószám, fizetési határidő, kapcsolattartó neve/email/telefon | `ugyfelek.cim/adoszam/fizetesi_hatarido_nap/kapcsolattarto_*` |
| Megbízó | "szokásos fuvardíjak" (referencia, nem autofill) | `getUgyfelFuvarElozmeny()` |
| Sofőr | alap kamion/furgon/pótkocsi | `user.kamion/furgon/aktiv_potkocsi` |
| Kamion/Furgon | rendszám | `kamion.rendszam`/`furgon.rendszam` |
| Kamion/Furgon | fogyasztási adat (csak informatív megjelenítés, nem mező) | meglévő `tankolasInterface::getFogyasztasElemzes()` |

Minden választó mezőn autocomplete (meglévő minta, pl. `GlobalSearch.js`/más
kereső mezők stílusában).

### 7.1 Nyitott kérdés / feltételezés: többmegállós fuvarlevél

A csatolt minta fuvarlevél **négy megállót** tartalmaz (Dunaharaszti → Leányvár →
Bicske → Piliscsaba), az adatmodell viszont egyetlen Felrakó/Lerakó mezőt definiál (a
kérés eredeti "Fuvar adatai" listája szerint). A tervezett egyszerűsítés: az OCR az
**első és utolsó** megállót adja Felrakó/Lerakó-nak, a köztes állomásokat a Megjegyzés
mezőbe írja szöveges felsorolásként. Ez pragmatikus, nem igényel új
útvonal/megállók-táblát — ha a valós használatban ez nem elég (pl. milk-run útvonalak
km-elszámolása megállónként fontos), egy külön `fuvar_megallok` sor-tábla egy **későbbi**
fázisban hozzáadható, ez a jelen fázis szándékosan nem tervezi meg előre (YAGNI).

## 8. Frontend

- `src/views/admin/BeerkezettDokumentumok.js` — inbox lista (kártya/tábla),
  szűrők (feldolgozatlan/hiba/kész), előnézet (a Fájlok modulnál már meglévő
  `FajlPreviewPanel`-mintát követve), "Fuvar létrehozása" gomb
- `src/views/admin/Fuvarok.js` + `FuvarForm.js` — lista (megosztott `DataTable`,
  kereshető/szűrhető/rendezhető, a Pénzforgalom/Fájlok modulokban már bevált
  szerver-oldali rendezési mintával) + form (autocomplete mezőkkel)
- Sofőr-oldali egyszerű feltöltő komponens (kamera/galéria) — **csak feltölt**, listát
  nem lát (a jóváhagyott döntés szerint)
- Sidebar: új "Fuvarok" nav-csoport (vagy a "Flotta" csoport bővítése) két elemmel

## 9. Jogosultság

Egyetlen `'fuvarok'` modul a `jogosultsagInterface.php`-ban, ami mindkét nézetet
(Beérkezett dokumentumok + Fuvarok) lefedi — mindkettő admin-only, a sofőr csak a
dedikált feltöltő végponton keresztül ér el bármit (nem magán a modulon).

## 10. Kapcsolódó, későbbi fázisok

Ez a spec az eredeti 7-részes bontás első eleme. A további fázisok (külön
spec/terv/implementáció-ciklusban): Számlázz.hu-integráció, NAV kimenő-számla-követés,
bank-egyeztetés fuvar-szinten, statisztikai dashboardok, globális kereső bővítése. Ezek
mind erre az adatmodellre épülnek, de a mostani fázis nem tartalmaz semmilyen
előretervezést/csonk-kódot hozzájuk (YAGNI).
