# Jármű-egység (VU) import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, vehicle-centric data source to the Tachográf modul — parsing Generation 2 Vehicle Unit (VU) `.ddd` downloads (distinct from the existing driver-card downloads), exposed as a "Jármű-egység" source alongside the existing "Sofőrkártya" source, per the published UX concept (Artifact `fb19f966-0553-403a-8ebe-28da66820cad`, 13. melléklet).

**Architecture:** A new `backend/VuParser.php` (sibling to the existing `DddParser.php`, same "pure, DB-independent binary decoder" pattern) decodes the VU-specific block structure (certificate skip + plain-text field extraction, confirmed against 7 real sample files — see Global Constraints). A new `backend/interface/tachografVuInterface.php` mirrors `tachografInterface.php`'s digest/apply pattern, but keyed by jármű (rendszám/VIN), not sofőr. Frontend gets a "forrás-váltó" (segmented control) inside `Tachograf.js` that swaps the tab set between the existing sofőr-centric tabs and a new, parallel jármű-centric tab set.

**Tech Stack:** PHP 8.2 (no new dependencies — same "pure binary parser, no composer package" convention as `DddParser.php`), React/Tailwind, same app primitives as the rest of the Tachográf modul.

## Global Constraints

- **No test framework in this repo.** Every step's "verify" action is a real, concrete manual check (PHP CLI against the actual sample files, or a browser click-through) — per this project's own convention (see `CLAUDE.md`'s repeated "élőben tesztelve" methodology), not a fictional unit test.
- **7 real sample files exist** at `~/Letöltések/kiolvassszikratransz/` — 6 driver-card downloads (already handled by the existing `DddParser.php`) and — critically — **7 vehicle-named files** (`HU_PHR 862_______202607160609.DDD`, `HU_RLP 018_______202607160627.DDD`, `HU_RZW_002_______202607171830.DDD`, `HU_SLZ 010_______202607200541.DDD`, `HU_SNF_128_______202607101518.DDD`, `HU_SWU 609_______202607160619.DDD`, `HU_AAEO_881______202607171811.DDD`) which are the actual VU downloads this plan targets. **Every parser change in this plan must be re-validated against all 7 vehicle-named files before being considered done**, not just one.
- **Facts already VERIFIED by direct byte-level inspection in this session** (do not re-derive, but do re-confirm against all 7 files in Task 1):
  - The file starts with an ASN.1 Card-Verifiable-Certificate chain (`7F21`/`7F4E`/`5F29` tags) — this must be skipped, not parsed as data (no signature/certificate validation is in scope, same stance as the existing driver-card parser).
  - **VIN**: a 17-byte plain ASCII field (e.g. `WMA06XZZ2GP076638`), found immediately before the registration-number field.
  - **Vehicle registration number**: a 14-byte field immediately after the VIN — 1 byte codepage + 13 bytes space-padded ASCII (e.g. `RLP 018      `).
  - **Company name/address**: plain space-padded ASCII strings (e.g. `SZIKORA TRANSZ KFT`, `2518 LEANYVAR BECSI UT 86`) appear elsewhere in the file — company-lock record content.
  - **Driver-card cross-references**: driver surname/first name and card number (e.g. `KIGLICS`/`BALAZS`/`HUG0000184199001`) appear as plain ASCII inside the VU file — the vehicle unit records which driver cards were inserted, independent of which card the admin separately uploads.
  - **Timestamps are 4-byte big-endian Unix epoch seconds, UTC** (standard `unpack("N", ...)`) — confirmed by finding an exact `2026-07-16 00:00:00` epoch value at a fixed offset relative to the registration-number field, matching the file's own download-date filename component.
  - The registration number repeats **once per downloaded day** in the file (46 occurrences in a ~46-day download) — this is the anchor for locating each day's record.
- **NOT yet verified — must be confirmed empirically in Task 1/2 before being used in real parsing code** (do not guess these into existence): the exact byte layout of a full `VuActivityDailyRecord` (odometer-at-day-start/end field width and offset, the day record's total length/stride, and whether the per-minute `ActivityChangeInfo` bitfield is byte-identical to the one already decoded in `DddParser.php::parseDailyActivity()` for driver cards — the EU spec defines this as the same primitive type for both Gen2 card and VU downloads, which is why reuse is attempted first, but it must be confirmed against real bytes, not assumed).
- **No cryptographic signature/certificate verification** — same stance as `DddParser.php`: certificates are skipped, never validated.
- **No SQL `JOIN`/`UNION`** (project's custom SQL linter) — resolve names via a second query + PHP merge, matching every existing interface.
- Server-side scoping: every new query/action scopes by `resolveKerelmezo($request)['ceg_id']`.
- Tailwind rebuild (`npx tailwindcss -i ./src/assets/styles/index.css -o ./src/assets/styles/tailwind.css`) after any new utility class, per this project's standing convention.
- SQL migrations append to `backend/sql/31.sql` if still uncommitted at execution time (check `git status` first — this project's own numbering convention).

---

## Task 1: Confirm the day-record structure across all 7 real files

**Files:**
- Create: `backend/scratch/vu_probe.php` (temporary investigation script — delete in Task 1's last step, not shipped)

**Interfaces:**
- Produces: a confirmed, written-down byte layout for one `VuActivityDailyRecord` (offsets for: registration-number anchor, date, odometer-start, odometer-end, activity-change-info list start + count, list stride) that Task 2 codes against. This is a research task — its deliverable is *knowledge*, written into this plan's Task 2 as concrete offsets, not shippable code.

- [ ] **Step 1: Write the probe script**

```php
<?php
// Ideiglenes vizsgáló szkript — NEM kerül be a végleges kódba (ld. Task 1
// utolsó lépése). Egy adott VU-mintafájlon dumpolja a rendszám-mező körüli
// kontextust minden előfordulásnál, hogy a napi rekord pontos hossza és
// mezőszerkezete megállapítható legyen.
$fajl = $argv[1] ?? die("usage: php vu_probe.php <fajl.ddd>\n");
$bin = file_get_contents($fajl);
$len = strlen($bin);

// A rendszámot a fájlnévből vesszük (a "HU_XXX YYY______..." minta alapján),
// hogy ne kelljen kézzel átírni fájlonként.
preg_match('/^HU_(.+?)_+\d{12}\.DDD$/i', basename($fajl), $m);
$rendszamNyers = trim(str_replace('_', ' ', $m[1] ?? ''));
echo "Keresett rendszám-töredék: '$rendszamNyers'\n";

$offsets = [];
$off = 0;
while (($pos = strpos($bin, substr($rendszamNyers, 0, 3), $off)) !== false) {
    $offsets[] = $pos;
    $off = $pos + 1;
}
echo "Előfordulások száma: " . count($offsets) . "\n";
$stridek = [];
for ($i = 1; $i < count($offsets); $i++) {
    $stridek[] = $offsets[$i] - $offsets[$i-1];
}
echo "Stride-ok (gyakoriság szerint): \n";
$gyak = array_count_values($stridek);
arsort($gyak);
foreach (array_slice($gyak, 0, 10, true) as $s => $db) {
    echo "  stride=$s  előfordulás=$db\n";
}

// Az első "tiszta" (leggyakoribb stride-nak megfelelő) rekord-pár közötti
// teljes bájttartományt kiírjuk hex+ASCII-ban, hogy a mezőket be lehessen
// azonosítani.
$fostride = array_key_first($gyak);
$elso = $offsets[0];
$masodik = null;
foreach ($offsets as $o) {
    if ($o - $elso == $fostride) { $masodik = $o; break; }
}
if ($masodik) {
    $blokk = substr($bin, $elso - 20, ($masodik - $elso) + 20);
    echo "\nEgy teljes napi-rekord-hossznyi blokk ($fostride bájt + kontextus), hex:\n";
    echo chunk_split(bin2hex($blokk), 2, " ") . "\n";
    echo "\nUgyanez ASCII-ban (. = nem nyomtatható):\n";
    echo preg_replace('/[^\x20-\x7E]/', '.', $blokk) . "\n";
}
```

- [ ] **Step 2: Run against all 7 vehicle files, record the stride + a sample block for each**

Run for each of the 7 files:
```bash
for f in ~/Letöltések/kiolvassszikratransz/HU_{"PHR 862_______202607160609","RLP 018_______202607160627","RZW_002_______202607171830","SLZ 010_______202607200541","SNF_128_______202607101518","SWU 609_______202607160619","AAEO_881______202607171811"}.DDD; do
  echo "=== $f ==="
  php8.2 backend/scratch/vu_probe.php "$f"
done
```
Expected: a dominant, consistent stride value appears in most/all files (this is the day-record length) — record it. If the dominant stride varies file-to-file, that itself is a finding (e.g. it may correlate with number of `ActivityChangeInfo` entries that day, meaning the record is variable-length and starts with its own length prefix — check the 2 bytes immediately before the registration-number anchor in that case).

- [ ] **Step 3: From the printed hex/ASCII blocks, manually identify and write down (in this plan file, replacing this step) the confirmed offsets**

Specifically locate, using the already-confirmed anchors from Global Constraints (VIN before plate, 4-byte epoch dates, plate 14 bytes):
- Where the day's date (4-byte epoch, midnight) sits relative to the registration-number anchor
- Where an odometer-like value sits (per EU spec, `OdometerShort` is a 3-byte unsigned big-endian km count — search for 3-byte values in a plausible range, e.g. 0–999999, near the record boundary, and sanity-check against the file's overall size/day-count for a plausible daily-km delta)
- Whether a 2-byte "number of activity changes" count precedes a repeating 2-byte-per-entry list (each entry `unpack("n", ...)`, matching `DddParser.php::parseDailyActivity()`'s existing bit-layout — same test: does `slot/vezetes/munka/piheno` decode to plausible values using the SAME bitmask logic already in `DddParser.php`?)

- [ ] **Step 4: Delete the scratch script**

```bash
rm backend/scratch/vu_probe.php
rmdir backend/scratch 2>/dev/null || true
```

- [ ] **Step 5: Commit the plan update only (no shipped code from this task)**

```bash
git add docs/superpowers/plans/2026-07-24-vu-import-implementation.md
git commit -m "docs: confirm VU day-record byte layout ahead of parser implementation"
```

---

## Task 2: `backend/VuParser.php` — core decoder

**Files:**
- Create: `backend/VuParser.php`

**Interfaces:**
- Consumes: raw binary string (same constructor contract as `DddParser`: `new VuParser($binaryData)`).
- Produces: `public function parse(): array` returning
  `['vehicleIdentification' => ['vin' => string, 'registrationNation' => string|null, 'registrationNumber' => string], 'companyLocks' => [...], 'napiAktivitas' => [...same shape as DddParser's napiAktivitas, keyed by date...], 'kartyaReferenciak' => [['kartyaszam'=>, 'nev'=>, 'datum'=>], ...], 'warnings' => [...]]`.
  This shape deliberately mirrors `DddParser::parse()`'s `napiAktivitas`/`warnings` keys so `TachografVuInterface` (Task 4) can reuse as much of `TachografInterface`'s existing digest-building logic as possible.

- [ ] **Step 1: Scaffold the class using Task 1's confirmed offsets**

```php
<?php

// Jármű-egység (VU) Generation 2 letöltés — nyers, DB-független bináris
// dekóder, ugyanaz az elv, mint a DddParser.php-nál: csak a bájtokat
// értelmezi, semmilyen adatbázis-hívást nem csinál. A tanúsítvány-láncot
// (ASN.1 CVC, 7F21/7F4E/5F29 tagek) csak átugorjuk, nem validáljuk — nincs
// kriptográfiai aláírás-ellenőrzés, ugyanaz a szándékos korlát, mint a
// sofőrkártya-oldalon.
//
// A mezők pontos bájt-elrendezését (VIN, rendszám, dátum, km-óraállás,
// aktivitás-változás lista) 7 valós mintafájlon (ld. Task 1 ehhez a
// tervhez) ellenőriztük — a lentebbi konstansok ebből az elemzésből
// származnak, nem a hivatalos specifikációból kitalálva.
class VuParser {
    private $bin;
    private $len;
    private $warnings = [];

    public function __construct($binaryData) {
        $this->bin = (string) $binaryData;
        $this->len = strlen($this->bin);
    }

    public function getWarnings() {
        return $this->warnings;
    }

    // TODO(Task 2, Step 2): a tanúsítvány-lánc hosszának megállapítása —
    // a 7F21/7F4E BER-TLV struktúra tényleges hossz-mezőiből (nem fix
    // offset), hogy a jármű-azonosítás blokk kezdete megbízhatóan
    // megtalálható legyen minden fájlon, függetlenül a tanúsítvány
    // tényleges méretétől.
    private function tanusitvanyLancHossza() {
        // Task 1 evidence: a 7F21 tag utáni bájt(ok) BER-hossz-kódolást
        // tartalmaznak (0x81 prefix = 1 következő bájt adja a hosszt,
        // 0x82 prefix = 2 következő bájt). Ezt kell itt lépésenként
        // bejárni a valós fájlokon ellenőrizve, nem egy fix számmal
        // kiváltva.
        throw new Exception('VuParser::tanusitvanyLancHossza() még nincs a Task 1 mérések alapján kitöltve.');
    }

    public function parseVehicleIdentification() {
        // Task 1 Step 3 eredménye alapján töltendő ki: a VIN (17 bájt) és
        // a rendszám (1 bájt kódlap + 13 bájt szöveg) pontos offszete a
        // tanúsítvány-lánc vége után.
    }

    public function parseNapiAktivitas() {
        // Task 1 Step 3 eredménye alapján: a napi rekord pontos hossza/
        // mezői (dátum, km-óraállás kezdő/záró, aktivitás-változás lista).
        // Az aktivitás-változás bitmintát a DddParser.php már meglévő,
        // működő logikájával kell dekódolni (ugyanaz a primitív típus,
        // ld. a terv Global Constraints szakasza) — nem újraírni.
    }

    public function parseKartyaReferenciak() {
        // A fájlban talált sofőr-kártya kereszthivatkozások (név +
        // kártyaszám + dátum) kinyerése — Task 1 Step 3 alapján.
    }

    public function parse() {
        try {
            $vehicleIdentification = $this->parseVehicleIdentification();
            $napiAktivitas = $this->parseNapiAktivitas();
            $kartyaReferenciak = $this->parseKartyaReferenciak();
            return [
                'vehicleIdentification' => $vehicleIdentification,
                'napiAktivitas' => $napiAktivitas,
                'kartyaReferenciak' => $kartyaReferenciak,
                'warnings' => $this->warnings,
            ];
        } catch (Exception $e) {
            $this->warnings[] = $e->getMessage();
            return [
                'vehicleIdentification' => null,
                'napiAktivitas' => [],
                'kartyaReferenciak' => [],
                'warnings' => $this->warnings,
            ];
        }
    }
}
```

**Note to implementer:** the three `parse*` method bodies are placeholders on purpose — this step only scaffolds the class shape. Do not mark this task's Step 2 done until Task 1's confirmed offsets are filled in with real, tested code (see Step 2 below). This scaffold exists so Task 2/Step 2 has a class to fill in incrementally, one method at a time, testing after each.

- [ ] **Step 2: Fill in `parseVehicleIdentification()` first, test immediately**

Using Task 1's confirmed VIN/registration-number offsets, implement the method to return real data, then run:

```bash
php8.2 -r '
require "backend/VuParser.php";
foreach (glob($_SERVER["HOME"]."/Letöltések/kiolvassszikratransz/HU_*.DDD") as $f) {
    $bin = file_get_contents($f);
    if (strlen($bin) < 400) continue; // skip driver-card files by rough size if needed
    $p = new VuParser($bin);
    $r = $p->parse();
    echo basename($f) . ": " . json_encode($r["vehicleIdentification"]) . "\n";
}
'
```
Expected: for each of the 7 vehicle files, a VIN + registration number that visually matches the plate embedded in that file's own name (e.g. the `HU_RLP 018_...` file reports registration number `RLP 018`). This is the pass/fail check for this step — if any file's decoded plate doesn't match its filename's plate, the offset logic is wrong and must be fixed before proceeding.

- [ ] **Step 3: Fill in `parseNapiAktivitas()`, test immediately**

Implement using Task 1's confirmed day-record stride/offsets, reusing (not reimplementing) `DddParser.php`'s activity-change-info bit-decode logic — either by extracting that specific bit-decode into a small shared static helper both classes call, or by duplicating the exact same bitmask constants with a comment pointing at the original (implementer's choice, but the bitmask values themselves must be copied verbatim from `DddParser.php`, not re-derived). Then run:

```bash
php8.2 -r '
require "backend/DddParser.php";
require "backend/VuParser.php";
$f = $_SERVER["HOME"]."/Letöltések/kiolvassszikratransz/HU_RLP 018_______202607160627.DDD";
$p = new VuParser(file_get_contents($f));
$r = $p->parse();
echo "Napok száma: " . count($r["napiAktivitas"]) . "\n";
echo "Warnings: " . json_encode($r["warnings"]) . "\n";
print_r(array_slice($r["napiAktivitas"], 0, 3));
print_r(array_slice($r["napiAktivitas"], -3));
'
```
Expected: a plausible number of days (roughly matching the file size / known download-period expectations, cross-checked against the earlier stride-count from Task 1 — e.g. ~46 for the RLP-018 file), each with a real calendar date in 2026, and driving-minute values in a sane 0–1440 range (not garbage/negative/absurdly large numbers — if any value is out of range, the offset or stride is still wrong).

- [ ] **Step 4: Fill in `parseKartyaReferenciak()`, test immediately**

```bash
php8.2 -r '
require "backend/VuParser.php";
$f = $_SERVER["HOME"]."/Letöltések/kiolvassszikratransz/HU_RLP 018_______202607160627.DDD";
$p = new VuParser(file_get_contents($f));
$r = $p->parse();
print_r($r["kartyaReferenciak"]);
'
```
Expected: at least one entry with a name/card-number pair that's human-recognizable (e.g. matches "BALAZS KIGLICS" / `HUG0000184199001`, already confirmed present in this file by Task 1's raw-string search).

- [ ] **Step 5: Re-run Step 2–4's checks against all 7 vehicle files (not just RLP-018), fix any file-specific breakage**

- [ ] **Step 6: Commit**

```bash
git add backend/VuParser.php
git commit -m "feat: add VuParser for Generation 2 vehicle-unit .ddd downloads"
```

---

## Task 3: Database schema — jármű-centric tables

**Files:**
- Modify: `backend/sql/31.sql` (append, per this project's migration convention — check `git status` first; if `31.sql` is already committed by execution time, create `32.sql` instead and adjust this task's file path accordingly)

- [ ] **Step 1: Append the schema**

```sql
-- Jármű-egység (VU) import — jármű-központú párja a sofőrkártya-alapú
-- tachograf_napi_aktivitas/tachograf_import_naplo tábláknak. Külön tábla,
-- nem ugyanaz, mert a kulcs jármű (jarmu_tipus+jarmu_id), nem sofor_id, és a
-- forrás-adat (VIN, km-óraállás) is más jellegű.
CREATE TABLE IF NOT EXISTS tachograf_vu_napi_aktivitas (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    jarmu_tipus ENUM('kamion','furgon') NOT NULL,
    jarmu_id INT NOT NULL,
    vin VARCHAR(20) NOT NULL,
    datum DATE NOT NULL,
    km_kezdo INT NULL,
    km_zaro INT NULL,
    vezetes_perc INT NOT NULL DEFAULT 0,
    aktivitas_json TEXT NULL,
    kartya_referenciak_json TEXT NULL,
    forras_fajlnev VARCHAR(191) NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_jarmu_datum (admin, jarmu_tipus, jarmu_id, datum),
    INDEX idx_admin_jarmu (admin, jarmu_tipus, jarmu_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tachograf_vu_import_naplo (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    jarmu_tipus ENUM('kamion','furgon') NOT NULL,
    jarmu_id INT NOT NULL,
    vin VARCHAR(20) NOT NULL,
    fajlnev VARCHAR(191) NULL,
    feltolto_tipus ENUM('admin','sofor') NULL,
    feltolto_id INT NULL,
    feltolto_nev VARCHAR(191) NULL,
    uj_nap INT NOT NULL DEFAULT 0,
    kihagyott_nap INT NOT NULL DEFAULT 0,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_admin_datum (admin, letrehozva)
) ENGINE=InnoDB;
```

- [ ] **Step 2: Apply and verify**

```bash
mysql -uroot kamion < backend/sql/31.sql
mysql -uroot kamion -e "DESCRIBE tachograf_vu_napi_aktivitas; DESCRIBE tachograf_vu_import_naplo;"
```
Expected: both tables listed with the columns above, no errors, and re-running the whole file a second time doesn't error (idempotency, matching this project's migration convention).

- [ ] **Step 3: Commit**

```bash
git add backend/sql/31.sql
git commit -m "feat: add VU import schema (tachograf_vu_napi_aktivitas, tachograf_vu_import_naplo)"
```

---

## Task 4: `backend/interface/tachografVuInterface.php`

**Files:**
- Create: `backend/interface/tachografVuInterface.php`

**Interfaces:**
- Consumes: `VuParser` (Task 2), existing `kamion`/`furgon` tables (rendszám matching, same normalization helper pattern as `tachografInterface.php::normalizalRendszam()` — copy it, don't import across classes per this codebase's convention of small per-file private helpers).
- Produces:
  - `public function elemezVuDdd($base64, $ceg_id, $fajlnev = null, $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null): array` — digest-only, same contract shape as `TachografInterface::elemezDdd()` but returns `['success'=>true,'jarmuAzonosito'=>[...],'javasoltJarmu'=>['jarmu_tipus'=>,'jarmu_id'=>]|null,'javaslatForras'=>'rendszam'|'vin'|null,'napok'=>[...],'kartyaReferenciak'=>[...]]`.
  - `public function alkalmazVuImport($napok, $jarmuTipus, $jarmuId, $vin, $forrasFajlnev, $ceg_id, $feltoltoTipus=null, $feltoltoId=null, $feltoltoNev=null): array` — same shape as `TachografInterface::alkalmazImport()`.
  - `public function getJarmuAttekintes($ceg_id): array` — per-vehicle rollup (utolsoDatum, vezetesPerc7Nap, km30Nap — same aggregation SQL pattern as `TachografInterface::getSoforOsszesito()`, just grouped by `jarmu_tipus, jarmu_id` instead of `sofor_id`).
  - `public function getVuMegfelelosegiLista($ceg_id): array` — same shape as `getMegfelelosegiLista()` but with a **90-day** threshold (not 28) — per Global Constraints' EU 165/2014 fact from the published concept doc.
  - `public function getVuImportNaplo($ceg_id): array`.
  - `public function getVuNapiAktivitas($jarmuTipus=null, $jarmuId=null, $datumTol=null, $datumIg=null, $ceg_id): array`.

- [ ] **Step 1: Write the file, mirroring `tachografInterface.php`'s structure method-for-method**

(Full code omitted here for length — implementer follows the exact patterns already in `backend/interface/tachografInterface.php` for: scoping every query by `ceg_id`, the try/catch-wrapped public methods returning `['success'=>bool,...]`, the `UNIQUE KEY`-collision-as-skip pattern in the apply method, and the `soforNevekTomb()`-style "second query, PHP merge" name resolution — but resolving **rendszám** across `kamion`+`furgon` tables the same way `getRendszamok()` already does in `tachografInterface.php`.)

Rendszám-matching normalization (copy verbatim from `tachografInterface.php::normalizalRendszam()`):
```php
private function normalizalRendszam($rendszam) {
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $rendszam));
}
```

Vehicle-match confidence, mirroring the sofőr-side `javaslatForras` pattern from the main Tachográf plan:
```php
$javasoltJarmu = $this->keresJarmuRendszamAlapjan($ceg_id, $vuEredmeny['vehicleIdentification']['registrationNumber']);
$javaslatForras = $javasoltJarmu ? 'rendszam' : null;
// nincs "VIN alapján" másodlagos keresés ebben a körben — a kamion/furgon
// táblákban ma nincs VIN-oszlop tárolva, csak rendszám; ha a rendszám nem
// egyezik, a admin kézzel választ a review-n, ugyanúgy, mint a sofőrnél a
// név-alapú javaslat hiányakor.
```

- [ ] **Step 2: Verify against all 7 real files via PHP CLI**

```bash
php8.2 -r '
require "backend/db.php";
require "backend/DddParser.php";
require "backend/VuParser.php";
require "backend/interface/tachografVuInterface.php";
global $tachografVuInterface;
foreach (glob($_SERVER["HOME"]."/Letöltések/kiolvassszikratransz/HU_*.DDD") as $f) {
    $base64 = base64_encode(file_get_contents($f));
    $r = $tachografVuInterface->elemezVuDdd($base64, 1, basename($f));
    echo basename($f) . ": success=" . ($r["success"]?"1":"0") . " napok=" . count($r["napok"] ?? []) . "\n";
}
'
```
Expected: `success=1` for all 7 vehicle-named files, with a plausible day count each. The 6 driver-card files are expected to fail gracefully here (this method is not for them) — confirm they return `success=false` with a clear message, not a PHP fatal error.

- [ ] **Step 3: Commit**

```bash
git add backend/interface/tachografVuInterface.php
git commit -m "feat: add TachografVuInterface for vehicle-unit digest/apply/rollup"
```

---

## Task 5: `ApiHandler.php` wiring for VU actions

**Files:**
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `TachografVuInterface` (Task 4).
- Produces: actions `elemezTachografVuDdd`, `alkalmazTachografVuImport`, `getTachografVuNapiAktivitas`, `getTachografVuMegfeleloseg`, `getTachografVuJarmuOsszesito`, `getTachografVuImportNaplo`.

- [ ] **Step 1: `require`, instantiate, and add to the `process()` global list**

Mirror the exact 3-step pattern this project's `CLAUDE.md` documents for adding a new interface file (near the existing `require 'interface/tachografInterface.php';` line, and in the `global $tachografInterface, ...;` statement inside `process()`).

- [ ] **Step 2: `getActions()` required-params entries**

```php
'elemezTachografVuDdd' => ['ddd', 'ceg_id', 'kerelmezo_id'],
'alkalmazTachografVuImport' => ['napok', 'jarmuTipus', 'jarmuId', 'vin', 'ceg_id', 'kerelmezo_id'],
'getTachografVuNapiAktivitas' => ['ceg_id', 'kerelmezo_id'],
'getTachografVuMegfeleloseg' => ['ceg_id', 'kerelmezo_id'],
'getTachografVuJarmuOsszesito' => ['ceg_id', 'kerelmezo_id'],
'getTachografVuImportNaplo' => ['ceg_id', 'kerelmezo_id'],
```

- [ ] **Step 3: `MODULE_PERMISSION_MAP` entries** — reuse the existing `'tachograf'` module (same permission scope as the sofőr-side actions, not a new module):

```php
'elemezTachografVuDdd' => ['tachograf', 'hozzaferes'],
'alkalmazTachografVuImport' => ['tachograf', 'szerkesztes'],
'getTachografVuNapiAktivitas' => ['tachograf', 'hozzaferes'],
'getTachografVuMegfeleloseg' => ['tachograf', 'hozzaferes'],
'getTachografVuJarmuOsszesito' => ['tachograf', 'hozzaferes'],
'getTachografVuImportNaplo' => ['tachograf', 'hozzaferes'],
```

- [ ] **Step 4: `process()` case blocks** — mirror the existing sofőr-side cases exactly (resolveKerelmezo + resolveFeltolto where needed, delegate to `$tachografVuInterface`).

- [ ] **Step 5: Verify end-to-end via curl, same pattern as the main Tachográf plan's Task 3/Step 6**

- [ ] **Step 6: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "feat: wire VU import actions into ApiHandler"
```

---

## Task 6: Frontend — forrás-váltó és Jármű-egység fülek

**Files:**
- Create: `src/components/Tachograf/JarmuvekLista.js` (Járművek fül — mirrors `SoforokLista.js`)
- Create: `src/components/Tachograf/JarmuDrawer.js` (jármű-részletek modal — mirrors `SoforDrawer.js`, no reassignment control since there's no equivalent "wrong vehicle" correction need in v1)
- Create: `src/components/Tachograf/VuMegfelelosegiWidget.js` (90-napos küszöb, mirrors `MegfelelosegiWidget.js` — kept separate rather than parameterizing the existing one, since the threshold and row content genuinely differ, matching this project's "don't force an unrelated abstraction" convention)
- Create: `src/components/Tachograf/VuImportWizard.js` (mirrors `ImportWizard.js`, jármű-egyeztetés sofőr-egyeztetés helyett)
- Create: `src/components/Tachograf/VuImportElozmenyek.js` (mirrors `ImportElozmenyek.js`)
- Modify: `src/views/admin/Tachograf.js` (add the forrás-váltó + swap tab sets)

**Interfaces:**
- Consumes: the 6 new backend actions (Task 5).

- [ ] **Step 1: Add the forrás-váltó state and UI to `Tachograf.js`**

```jsx
const [forras, setForras] = useState("sofor"); // "sofor" | "jarmu"
```

Segmented-control UI (reusing the visual language already established in the published concept doc's `.segswitch` mockup, translated to real Tailwind):
```jsx
<div className="inline-flex gap-0.5 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
  <button type="button" onClick={() => setForras("sofor")} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${forras === "sofor" ? "bg-white text-brand-900 shadow-soft dark:bg-ink-900 dark:text-ink-50" : "text-ink-400 hover:text-ink-600 dark:text-ink-500"}`}>Sofőrkártya</button>
  <button type="button" onClick={() => setForras("jarmu")} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${forras === "jarmu" ? "bg-white text-brand-900 shadow-soft dark:bg-ink-900 dark:text-ink-50" : "text-ink-400 hover:text-ink-600 dark:text-ink-500"}`}>Jármű-egység</button>
</div>
```

The existing `FULEK` tab bar becomes forrás-dependent: when `forras === "jarmu"`, render `[{key:"attekintes",...},{key:"jarmuvek",label:"Járművek"},{key:"naplo",...},{key:"import",...}]` instead of the sofőr-side tab set, and each tab's content branches on `forras` (Sofőrök↔Járművek swap; Áttekintés/Napló/Import előzmények reuse the same tab *keys* but render different components/data per `forras`).

- [ ] **Step 2: Build the 4 new components, mirroring their sofőr-side counterparts field-for-field** (km-óraállás replaces vezetési-idő as the primary daily column, jármű-egyeztetés replaces sofőr-egyeztetés in the wizard, 90-day threshold in the compliance widget).

- [ ] **Step 3: Rebuild Tailwind, then manual browser verification**

```bash
npx tailwindcss -i ./src/assets/styles/index.css -o ./src/assets/styles/tailwind.css
```

Manually: toggle the forrás-váltó, confirm the tab set swaps and each tab loads its own data; upload one of the 7 real VU files through the new wizard end-to-end (digest → apply → see it appear in Jármű-egység Áttekintés/Járművek/Import előzmények); confirm dark mode on the new segmented control and all new panels.

- [ ] **Step 4: Commit**

```bash
git add src/components/Tachograf/JarmuvekLista.js src/components/Tachograf/JarmuDrawer.js src/components/Tachograf/VuMegfelelosegiWidget.js src/components/Tachograf/VuImportWizard.js src/components/Tachograf/VuImportElozmenyek.js src/views/admin/Tachograf.js src/assets/styles/tailwind.css
git commit -m "feat: add Jármű-egység (VU) source switcher and vehicle-centric tabs"
```

---

## Task 7: Full validation against all 7 real files + cleanup

- [ ] **Step 1: Import all 7 vehicle files through the real UI (not just CLI)**, confirm each lands correctly, no duplicate-day bugs on re-upload (re-run the same file, confirm "already imported" behavior matches the sofőr-side convention).
- [ ] **Step 2: Confirm the existing sofőrkártya-oldal (Sofőrök/Napló/Import előzmények) is byte-for-byte unaffected** — the forrás-váltó must be additive, not a regression risk to the shipped MVP+V2 work.
- [ ] **Step 3: Update `CLAUDE.md`** with a new section documenting the VU import feature, following this project's own convention (marking VERIFIED facts vs. explicitly-deferred items — VuDetailedSpeed, driver-slot reconstruction, VuEventsAndFaults — as NOT implemented, per the published concept doc's roadmap).
- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document VU import feature in CLAUDE.md"
```

## Self-Review Notes

- **Spec coverage:** every element of the published concept's 13. melléklet (forrás-váltó, Járművek fül, 90-napos küszöb, jármű-egyeztetés bizalmi jelzéssel, km-óraállás elsődleges oszlopként, explicit V1-exclusions) is covered by Tasks 3–6.
- **No placeholders except where explicitly flagged as a research deliverable**: Task 2's scaffold intentionally leaves 3 method bodies as `throw`-ing placeholders — this is called out explicitly in that task's own text as intentional (the plan cannot respons­ibly contain fabricated byte offsets for facts not yet confirmed in Task 1), and Task 2's own steps immediately fill each one in with tested code before moving on. This is the one deliberate exception to the "no placeholders" rule, and it exists specifically to avoid the worse failure mode of inventing unverified binary-format details.
- **Known risk carried forward, not hidden:** if Task 1 finds the day-record is variable-length (not fixed-stride), Task 2/Step 3's implementation approach changes (length-prefixed parsing instead of fixed-offset slicing) — flagged in Task 1/Step 2's own expected-outcome text so the implementer isn't surprised.
