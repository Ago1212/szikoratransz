# Fuvar-dokumentum OCR + Fuvar modul core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin (or driver, via upload-only) get a fuvarlevél/szállítólevél OCR'd by Gemini, review/correct the extracted fields, and create a `fuvarok` record from it in under a minute — plus full manual CRUD, search/filter/sort on the new Fuvarok list.

**Architecture:** Two new backend interfaces (`BeerkezettDokumentumInterface`, `FuvarInterface`) follow the codebase's established "digest, admin dönt" two-phase import pattern (like `MolTankolasInterface`), backed by two new tables (`beerkezett_dokumentumok`, `fuvarok`) plus small additions to `admin`/`ugyfelek`/`fajlok`. A new `GeminiOcrClient` PHP class wraps the (already live-tested) Gemini vision API call. Frontend follows the existing list/form/DataTable conventions verbatim (`Furgonok.js`/`CardTableForFurgonok.js`/`FurgonForm.js` as templates), plus one new reusable component (`AutocompleteSelect`) that doesn't exist yet in this codebase.

**Tech Stack:** PHP 8.2 (no framework, no composer deps), PDO/MySQL (MariaDB, InnoDB), React 17 + `react-router-dom` v5, Tailwind (pre-built `tailwind.css`, not auto-compiled), Google Gemini API (`gemini-3.5-flash`, REST via `curl`, no SDK).

## Global Constraints

- No composer/npm dependencies may be added. Backend uses raw PHP + `curl`/`exec()` for external calls, exactly like existing `pdftotext`/`GpsmartClient` usage.
- Every new PHP list/insert/update query must scope by `admin = :ceg_id` and (where the table has it) `torolt <> 'I'` — `ceg_id` is always server-resolved (`resolveKerelmezo()['ceg_id']` or `resolveSajatCegId()`), never trusted from the client.
- Every new/changed action needs 3 wiring points in `ApiHandler.php`: `getActions()` entry, `process()` `case` block, and (if a brand-new interface file) the `require`+self-instantiation+`global` list update — this is documented in `CLAUDE.md` as the single easiest step to forget.
- New Tailwind utility classes used in JSX are NOT auto-compiled by CRA dev server — run `npm run build:tailwind` after adding any class not already present in the compiled `tailwind.css`, before visually verifying in a browser.
- SQL migrations go in `backend/sql/N.sql`, sequential. The latest **committed** file as of this plan is `32.sql` — this plan's migration is `backend/sql/33.sql`.
- No PHP or JS test framework exists in this repo. "Tests" in this plan are live verification: a local PHP CLI script or `curl` call against the running local API (`php8.2 -S localhost:8001` from `backend/`), checked against the real local MariaDB (`mysql -uroot kamion`), and/or a real browser click-through. Throwaway verification scripts are written under `/tmp/`, never committed.
- The two sample documents used for live OCR verification are at:
  `/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/24977c22-efc1-4eca-a630-dad8ec693744/scratchpad/Képernyőkép 2026-07-25 06-40-43.png` (fuvarlevél, handwritten)
  `/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/24977c22-efc1-4eca-a630-dad8ec693744/scratchpad/Képernyőkép 2026-07-25 06-41-03.png` (szállítólevél, printed)
  If this plan is executed in a fresh session where these files no longer exist, ask the user to re-provide two sample documents before Task 2.
- A working Gemini API key is required for Tasks 2, 5, 7, 16. Store it in `backend/.env` as `GEMINI_API_KEY=...` (gitignored, per the existing `env.php`/`envOrDefault()` mechanism) — never hardcode it in a committed file. A key was validated during design and can be reused for local dev (see the user's actual `backend/.env`, not this doc — never paste a real key into a committed file).
- Frontend list pages must use `sortKey`/`sortDir` state in the **view** component and forward it to the `CardTableFor*` wrapper, which forwards it into `<DataTable serverSide ... />` — copy the exact `Furgonok.js`/`CardTableForFurgonok.js` pattern (Task 11).

---

### Task 1: SQL migration — schema for the new module

**Files:**
- Create: `backend/sql/33.sql`

**Interfaces:**
- Produces: tables `beerkezett_dokumentumok`, `fuvarok`; columns `admin.cegnev`, `ugyfelek.fizetesi_hatarido_nap`; extended `fajlok.tabla` ENUM (adds `'beerkezett_dokumentum'`, `'fuvar'`).

- [ ] **Step 1: Write the migration file**

```sql
-- Fuvar-dokumentum OCR + Fuvar modul core (docs/superpowers/specs/2026-07-25-fuvar-dokumentum-ocr-design.md).
-- Első alrendszer egy nagyobb, 7 részes fuvarozási-ügyviteli felújításból:
-- OCR-alapú dokumentum-beérkeztetés ("Beérkezett dokumentumok" inbox) és egy
-- új Fuvar modul (a korábban tudatosan kivezetett `fuvarok` tábla
-- újraépítése, most OCR-alapú, nem szóbeli/kézi adatforrással).

-- `fajlok.tabla` bővítése két új értékkel: 'beerkezett_dokumentum' (az OCR-
-- inbox átmeneti tárolási helye) és 'fuvar' (a fuvarhoz véglegesen
-- hozzárendelt melléklet, ld. FuvarInterface::letrehozFuvarDokumentumbol()).
-- MySQL-ben nincs "ADD VALUE TO ENUM" szintaxis, ezért a teljes, jelenleg
-- érvényes listát újra fel kell sorolni (ld. 31.sql).
ALTER TABLE fajlok MODIFY COLUMN tabla ENUM(
  'kamion','potkocsi','sofor','egyeb','admin','karbantartasok','bejelentesek',
  'dokumentum','tankolas','helyszin','furgon',
  'bank_import','mol_import','tachograf_import',
  'beerkezett_dokumentum','fuvar'
) NOT NULL;

-- A dokumentum-OCR promptjának dinamikusan tudnia kell, melyik cég a MI
-- SAJÁT cégünk (a fuvarozó), hogy meg tudja különböztetni a tényleges
-- megbízótól — élő teszttel megerősítve, hogy enélkül a modell összekeveri
-- a kettőt (ld. a design spec 4.5/5.4 pontja). Csak a root/tulajdonos admin
-- során töltendő ki.
ALTER TABLE admin ADD COLUMN cegnev VARCHAR(200) NULL AFTER name;

-- A Fuvar modul "megbízó kiválasztásakor automatikus fizetési határidő"
-- követelményéhez — ez a mező korábban létezett, a Fuvarok-modul kivezetése
-- során lett törölve, most a design spec alapján tudatosan visszakerül.
ALTER TABLE ugyfelek ADD COLUMN fizetesi_hatarido_nap INT NULL AFTER kapcsolattarto_telefon;

CREATE TABLE IF NOT EXISTS beerkezett_dokumentumok (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    fajl_id INT NOT NULL,
    tipus ENUM('fuvarlevel','szallitolevel','ismeretlen') NOT NULL DEFAULT 'ismeretlen',
    ocr_allapot ENUM('feldolgozatlan','kesz','hiba') NOT NULL DEFAULT 'feldolgozatlan',
    ocr_adatok TEXT NULL,
    feltolto_tipus ENUM('admin','sofor') NULL,
    feltolto_id INT NULL,
    feltolto_nev VARCHAR(191) NULL,
    fuvar_id INT NULL,
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    torolt ENUM('I','N') NOT NULL DEFAULT 'N',
    PRIMARY KEY (id),
    INDEX idx_admin_torolt (admin, torolt),
    INDEX idx_admin_ocr_allapot (admin, ocr_allapot),
    INDEX idx_admin_fuvar (admin, fuvar_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fuvarok (
    id INT NOT NULL AUTO_INCREMENT,
    admin INT NOT NULL,
    sofor_id INT NULL,
    kamion_id INT NULL,
    furgon_id INT NULL,
    potkocsi_id INT NULL,
    teljesites_datuma DATE NULL,
    felrako VARCHAR(250) NULL,
    lerako VARCHAR(250) NULL,
    tavolsag_km INT NULL,
    megbizo_id INT NULL,
    aru_megnevezese VARCHAR(250) NULL,
    megjegyzes TEXT NULL,
    fuvardij DECIMAL(10,2) NULL,
    egyeb_koltseg DECIMAL(10,2) NULL,
    fuvarlevel_szam VARCHAR(100) NULL,
    allapot ENUM('rogzitett','szamlazasra_var','szamlazva','fizetesre_var','teljesitve') NOT NULL DEFAULT 'rogzitett',
    letrehozva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    torolt ENUM('I','N') NOT NULL DEFAULT 'N',
    PRIMARY KEY (id),
    INDEX idx_admin_torolt (admin, torolt),
    INDEX idx_admin_allapot (admin, allapot),
    INDEX idx_admin_teljesites (admin, teljesites_datuma),
    INDEX idx_admin_megbizo (admin, megbizo_id)
) ENGINE=InnoDB;
```

- [ ] **Step 2: Run it against the local DB**

Run: `mysql -uroot kamion < backend/sql/33.sql`
Expected: no output (success). If it errors on the `fajlok` ENUM line, run `SHOW COLUMNS FROM fajlok LIKE 'tabla';` first and reconcile the enum list with whatever is actually current before re-running.

- [ ] **Step 3: Verify each change**

Run:
```bash
mysql -uroot kamion -e "SHOW COLUMNS FROM fajlok LIKE 'tabla';"
mysql -uroot kamion -e "SHOW COLUMNS FROM admin LIKE 'cegnev';"
mysql -uroot kamion -e "SHOW COLUMNS FROM ugyfelek LIKE 'fizetesi_hatarido_nap';"
mysql -uroot kamion -e "SHOW TABLES LIKE 'beerkezett_dokumentumok';"
mysql -uroot kamion -e "SHOW TABLES LIKE 'fuvarok';"
```
Expected: `tabla` shows the ENUM string ending in `...,'beerkezett_dokumentum','fuvar')`; `cegnev` and `fizetesi_hatarido_nap` each show one row; both `SHOW TABLES` calls return one matching row.

- [ ] **Step 4: Commit**

```bash
git add backend/sql/33.sql
git commit -m "$(cat <<'EOF'
feat(fuvar): add schema for fuvar-document OCR intake + fuvarok table

New beerkezett_dokumentumok (OCR inbox) and fuvarok tables, plus
admin.cegnev (own-company name for OCR prompt disambiguation) and
ugyfelek.fizetesi_hatarido_nap (reintroduced from the old, removed
Fuvarok module — see CLAUDE.md).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `GeminiOcrClient` + API key config

**Files:**
- Create: `backend/GeminiOcrClient.php`
- Modify: `backend/config.php`
- Modify: `backend/.env.example` (if it doesn't already exist as a file, check first — it's referenced in `CLAUDE.md`'s R45 section)

**Interfaces:**
- Produces: `class GeminiOcrClient { public function __construct(string $apiKey); public function extractFuvarAdatok(string $imageBytes, string $mimeType, ?string $sajatCegnev): ?array; }` — returns the parsed associative array on success, `null` on any failure (missing key, curl error, non-200, unparseable JSON).
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Add the API key to config**

Read `backend/config.php` first to get the current exact `$apiConfig` array (it was last modified by unrelated work), then add one line to the array (do not reorder/reformat existing lines):

```php
    "geminiApiKey" => envOrDefault('GEMINI_API_KEY', null),
```

Add it right after the `"authHash"` line's closing comma, keeping every other existing key untouched.

- [ ] **Step 2: Add the env template entry**

Check if `backend/.env.example` exists (`ls backend/.env.example`). If it exists, append this line (create the file with just this line if it doesn't exist yet):
```
GEMINI_API_KEY=
```

Then create/edit the real (gitignored) `backend/.env` and add your actual Gemini API key:
```
GEMINI_API_KEY=<your-real-key-here>
```
Verify it's actually gitignored: `git check-ignore backend/.env` should print `backend/.env`. If it does NOT (empty output), STOP and add `backend/.env` to `.gitignore` before proceeding — never let a real API key reach a commit.

- [ ] **Step 3: Write `GeminiOcrClient.php`**

```php
<?php

// Google Gemini vision API kliens a Fuvar-dokumentum OCR-hez (ld.
// docs/superpowers/specs/2026-07-25-fuvar-dokumentum-ocr-design.md, 5.
// pont). Nyers curl-hívás, nem SDK — a projektnek nincs composer.json-ja,
// ugyanaz az elv, mint a NavSzamlaClient/GpsmartClient osztályoknál. A
// modellválasztás (gemini-3.5-flash) és a prompt egy valódi, élő API-
// hívással lett leellenőrizve a tervezési fázisban a két mintadokumentumon
// (kézzel írott fuvarlevél + nyomtatott szállítólevél) mielőtt
// implementációra került volna.
class GeminiOcrClient {
    const MODEL = 'gemini-3.5-flash';
    const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
    const TIMEOUT_MASODPERC = 60;

    private $apiKey;

    public function __construct($apiKey) {
        $this->apiKey = $apiKey;
    }

    // `$sajatCegnev` — a hívó cég neve (admin.cegnev), hogy a modell meg
    // tudja különböztetni a saját cégünket (fuvarozó, a dokumentum
    // nyomtatott fejlécén) a tényleges megbízótól. `null`/üres esetén is
    // működik, csak kevésbé megbízhatóan tudja majd ezt a megkülönböztetést
    // megtenni.
    public function extractFuvarAdatok($imageBytes, $mimeType, $sajatCegnev = null) {
        if (empty($this->apiKey)) {
            return null;
        }

        $payload = [
            'contents' => [[
                'parts' => [
                    ['text' => $this->buildPrompt($sajatCegnev)],
                    ['inline_data' => ['mime_type' => $mimeType, 'data' => base64_encode($imageBytes)]],
                ],
            ]],
            'generationConfig' => ['responseMimeType' => 'application/json'],
        ];

        $url = self::ENDPOINT . self::MODEL . ':generateContent?key=' . urlencode($this->apiKey);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => self::TIMEOUT_MASODPERC,
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlHiba = curl_error($ch);
        curl_close($ch);

        if ($body === false || $curlHiba !== '' || $status !== 200) {
            return null;
        }

        $valasz = json_decode($body, true);
        $szoveg = $valasz['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if ($szoveg === null) {
            return null;
        }

        $adatok = json_decode($szoveg, true);
        return is_array($adatok) ? $adatok : null;
    }

    private function buildPrompt($sajatCegnev) {
        $ceg = ($sajatCegnev !== null && trim((string) $sajatCegnev) !== '') ? $sajatCegnev : '(ismeretlen)';
        return <<<PROMPT
Ez egy magyar fuvarozási cég dokumentuma (fuvarlevél vagy szállítólevél).
Nyerd ki belőle a következő adatokat, és KIZÁRÓLAG egy JSON objektumot adj vissza,
pontosan ezzel a sémával:

{
  "tipus": "fuvarlevel" | "szallitolevel" | "ismeretlen",
  "rendszam": string | null,
  "sofor_neve": string | null,
  "datum": "YYYY-MM-DD" | null,
  "felrako": string | null,
  "lerako": string | null,
  "megbizo": string | null,
  "aru_megnevezese": string | null,
  "suly": string | null,
  "fuvarlevel_szam": string | null,
  "egyeb_megjegyzes": string | null
}

Szabályok:
- Ha egy mező nem olvasható vagy nem szerepel a dokumentumon, írj null-t - SOHA ne
  találj ki adatot.
- A fuvarlevél gyakran kézzel írott (kurzív magyar kézírás) - tégy meg mindent, hogy
  ezt is elolvasd, de ha bizonytalan vagy egy karakterben/számban, inkább a
  legvalószínűbb értéket add vissza, és jelezd az egyeb_megjegyzes mezőben, hogy
  bizonytalan vagy benne.
- Ha a dokumentumon több megálló/helyszín szerepel egy útvonalban (pl. több
  lerakási pont), az ELSŐ helyszínt vedd felrakónak, az UTOLSÓT lerakónak, a
  köztes megállókat sorold fel az egyeb_megjegyzes mezőben.
- FONTOS: a dokumentumot kiállító/nyomtató cég neve "{$ceg}" - ez a MI SAJÁT
  cégünk, a fuvarozó (aki a fuvart TELJESÍTI), SOHA nem lehet a "megbizo" mező
  értéke, még akkor sem, ha a fejlécben/nyomtatott logóban szerepel.
- A "megbizo" mező a fuvart MEGRENDELŐ/megbízó céget jelenti - fuvarlevélen
  jellemzően egy "Fuvaroztató neve, címe" vagy hasonló feliratú mezőben található
  (ez NEM a fuvarozó, hanem az ügyfél, aki a fuvart megrendelte), szállítólevélen
  a "Vevő" mező.
PROMPT;
    }
}
```

- [ ] **Step 4: Write a throwaway verification script and run it against the real API + real sample images**

Create `/tmp/verify_gemini_client.php`:
```php
<?php
require '/home/psadmin/szikoratransz/szikoratransz/backend/env.php';
require '/home/psadmin/szikoratransz/szikoratransz/backend/GeminiOcrClient.php';

$apiKey = envOrDefault('GEMINI_API_KEY', null);
if (empty($apiKey)) {
    // env.php only reads backend/.env relative to __DIR__, so also allow
    // a direct override for this standalone script if needed:
    fwrite(STDERR, "No GEMINI_API_KEY found via env.php — check backend/.env\n");
    exit(1);
}

$client = new GeminiOcrClient($apiKey);

$scratch = '/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/24977c22-efc1-4eca-a630-dad8ec693744/scratchpad';
$fuvarlevel = $scratch . '/Képernyőkép 2026-07-25 06-40-43.png';
$szallitolevel = $scratch . '/Képernyőkép 2026-07-25 06-41-03.png';

foreach (['fuvarlevel' => $fuvarlevel, 'szallitolevel' => $szallitolevel] as $label => $path) {
    echo "=== $label ===\n";
    $bytes = file_get_contents($path);
    $adatok = $client->extractFuvarAdatok($bytes, 'image/png', 'SZIKORA TRANSZ KFT.');
    echo $adatok === null ? "NULL (hiba)\n" : json_encode($adatok, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
}
```

Run: `php8.2 /tmp/verify_gemini_client.php`
Expected: two JSON objects printed, neither `null`, `tipus` correctly `fuvarlevel`/`szallitolevel` for each, and — the specific regression check from the design spec's live test — the `megbizo` field for the fuvarlevél result must be `"GREEN TRANSLOG KFT"`, NOT `"SZIKORA TRANSZ KFT."` (confirms the own-company disambiguation rule in the prompt actually works when invoked from PHP, not just from the earlier Python prototype).

Delete the script after: `rm /tmp/verify_gemini_client.php`

- [ ] **Step 5: Commit**

```bash
git add backend/GeminiOcrClient.php backend/config.php backend/.env.example
git commit -m "$(cat <<'EOF'
feat(fuvar): add GeminiOcrClient for fuvar-document field extraction

Raw curl-based Gemini vision API client (no SDK, matches the project's
no-composer-dependency convention). Prompt validated live against real
sample documents (handwritten fuvarlevél + printed szállítólevél)
during design; re-verified here from the actual PHP implementation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `admin.cegnev` — save action + Settings UI

**Files:**
- Modify: `backend/ApiHandler.php` (the `saveAdminData` `case` block around line 1716-1743, and the private `saveAdminData()` method around line 2434-2478)
- Modify: `src/components/Cards/CardSettings.js`

**Interfaces:**
- Consumes: nothing new from earlier tasks (Task 1's `admin.cegnev` column).
- Produces: `admin.cegnev` becomes settable via the existing `saveAdminData` action; `FuvarInterface`/`BeerkezettDokumentumInterface` (Tasks 5-8) will read it directly from the DB, not through this action.

- [ ] **Step 1: Extend the `saveAdminData` method signature and UPDATE query**

In `backend/ApiHandler.php`, find the private `saveAdminData(...)` method (~line 2434) and change:

```php
private function saveAdminData($id, $name, $email, $phone, $szul_datum, $szemelyi, $varos, $irsz, $cim, $szemelyi_lejarat, $jogsi_lejarat, $gki_lejarat, $adr_lejarat, $szerepkor = 'admin') {
```
to:
```php
private function saveAdminData($id, $name, $email, $phone, $szul_datum, $szemelyi, $varos, $irsz, $cim, $szemelyi_lejarat, $jogsi_lejarat, $gki_lejarat, $adr_lejarat, $szerepkor = 'admin', $cegnev = null) {
```

Add `cegnev = :cegnev,` right after `name = :name,` in the `$query` string, and add the matching bind:
```php
$stmt->bindParam(':cegnev', $cegnev, PDO::PARAM_STR);
```
(bind it right after the `:name` bind line, keeping every other line unchanged).

- [ ] **Step 2: Pass `cegnev` through from the `case` block**

In the `case 'saveAdminData':` block (~line 1716), add `$request['cegnev'] ?? null` as the new last argument to the `$this->saveAdminData(...)` call, right after `$kerelmezo['szerepkor']`:

```php
case 'saveAdminData':
    $kerelmezo = $this->resolveKerelmezo($request);
    echo json_encode($this->saveAdminData(
        $kerelmezo['id'],
        $request['name'],
        $request['email'],
        $request['phone'],
        $request['szul_datum'],
        $request['szemelyi'],
        $request['varos'],
        $request['irsz'],
        $request['cim'],
        $request['szemelyi_lejarat'],
        $request['jogsi_lejarat'],
        $request['gki_lejarat'],
        $request['adr_lejarat'],
        $kerelmezo['szerepkor'],
        $request['cegnev'] ?? null
    ));
    return;
```

- [ ] **Step 3: Verify with a curl round-trip against the local API**

Start the backend if not already running: `cd backend && php8.2 -S localhost:8001 &` (skip if `CLAUDE.md`'s note about an already-running dev server applies).

You need a real session token in the local `sessions` table for an admin. Check for an existing usable row first:
```bash
mysql -uroot kamion -e "SELECT id, token, felhasznalo_id, felhasznalo_tipus, lejarat FROM sessions WHERE felhasznalo_tipus='admin' AND lejarat > NOW() LIMIT 1;"
```
If one exists, use its `token` and `felhasznalo_id`. Otherwise insert a temporary one (adjust `admin.id` to a real row from `SELECT id FROM admin LIMIT 1;`):
```bash
mysql -uroot kamion -e "INSERT INTO sessions (token, felhasznalo_id, felhasznalo_tipus, lejarat) VALUES ('teszt-token-cegnev', 1, 'admin', DATE_ADD(NOW(), INTERVAL 1 DAY));"
```

Then:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "saveAdminData",
  "id": 1,
  "name": "Teszt Admin",
  "email": "teszt@example.com",
  "phone": "06301234567",
  "szul_datum": null,
  "szemelyi": null,
  "varos": null,
  "irsz": null,
  "cim": null,
  "szemelyi_lejarat": null,
  "jogsi_lejarat": null,
  "gki_lejarat": null,
  "adr_lejarat": null,
  "cegnev": "SZIKORA TRANSZ KFT."
}'
```
Expected: `{"success":true, ...}` JSON. Then confirm the DB actually changed:
```bash
mysql -uroot kamion -e "SELECT id, name, cegnev FROM admin WHERE id = 1;"
```
Expected: `cegnev` column shows `SZIKORA TRANSZ KFT.`.

Clean up the test session row if you inserted one: `mysql -uroot kamion -e "DELETE FROM sessions WHERE token='teszt-token-cegnev';"`. Restore `admin.name`/`email`/`phone` to their original values if this was a real account (re-run `saveAdminData` with the original values, or just accept the test wrote real-looking placeholder text and fix it manually — check `SELECT name, email, phone FROM admin WHERE id=1` before this step if unsure, and skip overwriting `name`/`email`/`phone` in the curl body if the row is a real, in-use account by passing the SAME values you just read back).

- [ ] **Step 4: Add a "Cég adatai" section to `CardSettings.js`**

Read `CardSettings.js` first to find its `userData` state shape and the exact section markup style (copy the "Felhasználó adatok" section's `FormSection`/`FormField` pattern, e.g. `icon`, `label`, `name`, `value`, `onChange`). Add a new `FormSection title="Cég adatai" icon={PiBuildingsLight}` (import `PiBuildingsLight` from `react-icons/pi` if not already imported) directly before or after the existing "Felhasználó adatok" section, gated the same way the NAV/GPSmart sections are (`if (isOwnerAdmin)` — only the root/owner admin edits this, matching the migration's comment that `cegnev` is root-only), containing one `FormField` bound to `userData.cegnev`:

```jsx
{isOwnerAdmin && (
  <FormSection title="Cég adatai" icon={PiBuildingsLight} columns={4}>
    <FormField
      icon={PiBuildingsLight}
      label="Cégnév"
      name="cegnev"
      value={userData.cegnev || ""}
      onChange={handleChange}
      className="md:col-span-2"
    />
  </FormSection>
)}
```

Confirm `handleSave`'s `fetchAction("saveAdminData", { id: userData.id, ...userData })` call (or however the existing spread is structured — read the actual code) already includes every key of `userData`, so `cegnev` flows through automatically without a separate change to the save call.

- [ ] **Step 5: Verify in the browser**

Start the CRA dev server if not running (`npm start`, reuse existing if already on port 3000 per `CLAUDE.md`). Log in as an admin (or use `localStorage.setItem('user', ...)`/`sessionToken` seeding per the documented local-verification pattern), navigate to `/admin/settings`, confirm the new "Cég adatai" section renders with a "Cégnév" field, type a value, save, reload the page, and confirm the value persisted (re-fetched from the backend, not just local state).

- [ ] **Step 6: Commit**

```bash
git add backend/ApiHandler.php src/components/Cards/CardSettings.js
git commit -m "$(cat <<'EOF'
feat(fuvar): let root admin set own company name (cegnev)

Needed so the fuvar-document OCR prompt (GeminiOcrClient) can tell
"this is us, the carrier" apart from the actual megbízó across
different tenants — see design spec 4.5.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `'fuvarok'` permission module

**Files:**
- Modify: `backend/interface/jogosultsagInterface.php` (the `MODULOK` constant)
- Modify: `backend/ApiHandler.php` (the `MODULE_PERMISSION_MAP` constant)
- Modify: `src/views/admin/Jogosultsagok.js` (the `MODUL_LABEL` object)

**Interfaces:**
- Produces: a `'fuvarok'` module with `['hozzaferes', 'szerkesztes', 'torles']` permission types, gating every action added in Tasks 5-9.

- [ ] **Step 1: Add the module everywhere the `'furgonok'` entries exist**

In `backend/interface/jogosultsagInterface.php`, in the `MODULOK` array, add right after the `'furgonok'` line:
```php
    'fuvarok' => ['hozzaferes', 'szerkesztes', 'torles'],
```

In `backend/ApiHandler.php`'s `MODULE_PERMISSION_MAP` constant, add a new block (the actions listed here are the ones this plan will register in Tasks 5-9 — add this block now so later tasks don't also need to touch `MODULE_PERMISSION_MAP`):
```php
    'elemezBeerkezettDokumentum' => ['fuvarok', 'szerkesztes'],
    'getBeerkezettDokumentumok' => ['fuvarok', 'hozzaferes'],
    'updateBeerkezettDokumentumTipus' => ['fuvarok', 'szerkesztes'],
    'newFuvar' => ['fuvarok', 'szerkesztes'],
    'updateFuvar' => ['fuvarok', 'szerkesztes'],
    'deleteFuvar' => ['fuvarok', 'torles'],
    'getFuvarok' => ['fuvarok', 'hozzaferes'],
    'getFuvar' => ['fuvarok', 'hozzaferes'],
    'letrehozFuvarDokumentumbol' => ['fuvarok', 'szerkesztes'],
    'getUgyfelFuvarElozmeny' => ['fuvarok', 'hozzaferes'],
```

In `src/views/admin/Jogosultsagok.js`'s `MODUL_LABEL` object, add:
```js
  fuvarok: "Fuvarok",
```

- [ ] **Step 2: Verify the Jogosultságok admin page picks it up**

In a browser, as the root/owner admin, navigate to `/admin/jogosultsagok`, and confirm a new "Fuvarok" row with "Hozzáférés"/"Szerkesztés"/"Törlés" checkboxes appears for every role, exactly like the "Furgonok" row above/below it.

- [ ] **Step 3: Commit**

```bash
git add backend/interface/jogosultsagInterface.php backend/ApiHandler.php src/views/admin/Jogosultsagok.js
git commit -m "$(cat <<'EOF'
feat(fuvar): register the 'fuvarok' permission module

Covers the OCR-inbox and fuvar CRUD actions added across the rest of
this feature — added upfront so later backend tasks don't also need
to touch MODULE_PERMISSION_MAP.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `BeerkezettDokumentumInterface::elemez()` — OCR intake

**Files:**
- Create: `backend/interface/beerkezettDokumentumInterface.php`
- Modify: `backend/ApiHandler.php` (require block, `global` list, `getActions()`, `process()` case)

**Interfaces:**
- Consumes: `GeminiOcrClient` (Task 2), `$filesInterface->fileUpload(...)` (existing), `admin.cegnev` (Task 3).
- Produces: action `elemezBeerkezettDokumentum` → `{success: true, dokumentum: {...beerkezett_dokumentumok row incl. parsed ocr_adatok...}}` on success (which per spec 5.3 means "we got a usable response from the pipeline", not "OCR necessarily succeeded" — an `ocr_allapot: 'hiba'` row is still `success: true` at the HTTP level, since the upload itself succeeded); `{success: false, message}` only for a genuinely invalid upload (bad base64).

- [ ] **Step 1: Write `backend/interface/beerkezettDokumentumInterface.php`**

```php
<?php

// "Beérkezett dokumentumok" inbox — a fuvarlevél/szállítólevél OCR-alapú
// beérkeztetése, ld. docs/superpowers/specs/2026-07-25-fuvar-dokumentum-
// ocr-design.md 5. pont. Ugyanaz a "digest, admin dönt" kétlépéses minta,
// mint a MolTankolasInterface/BankImportInterface/TachografInterface-nél,
// EGY tudatos eltéréssel: a feltöltés MINDIG perzisztálódik, még akkor is,
// ha az OCR sikertelen (kvóta-limit/hálózati hiba) — a dokumentum sose
// veszhet el, admin kézzel pótolja a hiányzó mezőket. A többi importnál
// (MOL/Bank/Tachográf) egy sikertelen elemzés semmit nem ment el; itt ez
// a viselkedés szándékosan más.
class BeerkezettDokumentumInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function elemez($base64, $fajlnev, $ceg_id, $feltoltoTipus, $feltoltoId, $feltoltoNev) {
        global $filesInterface, $apiConfig;

        $raw = base64_decode((string) $base64, true);
        if ($raw === false || $raw === '') {
            return ['success' => false, 'message' => 'A feltöltött fájl nem érvényes.'];
        }

        $kiterjesztes = strtolower(pathinfo((string) $fajlnev, PATHINFO_EXTENSION));
        $tmpEredetiPath = null;
        $tmpKepPath = null;

        try {
            if ($kiterjesztes === 'pdf') {
                $tmpEredetiPath = tempnam(sys_get_temp_dir(), 'bdok_') . '.pdf';
                file_put_contents($tmpEredetiPath, $raw);
                $tmpKepPath = $this->pdfElsoOldalKepe($tmpEredetiPath);
                if ($tmpKepPath === null) {
                    return $this->mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, 'hiba', null);
                }
                $kepBytes = file_get_contents($tmpKepPath);
                $kepMime = 'image/png';
            } else {
                $kepBytes = $raw;
                $kepMime = 'image/' . ($kiterjesztes === 'jpg' ? 'jpeg' : $kiterjesztes);
            }

            $sajatCegnev = $this->sajatCegnev($ceg_id);
            $geminiKulcs = $apiConfig['geminiApiKey'] ?? null;

            $adatok = null;
            if (!empty($geminiKulcs)) {
                $client = new GeminiOcrClient($geminiKulcs);
                $adatok = $client->extractFuvarAdatok($kepBytes, $kepMime, $sajatCegnev);
            }

            if ($adatok === null) {
                return $this->mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, 'hiba', null);
            }

            return $this->mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, 'kesz', $adatok);
        } finally {
            if ($tmpEredetiPath !== null && file_exists($tmpEredetiPath)) {
                unlink($tmpEredetiPath);
            }
            if ($tmpKepPath !== null && file_exists($tmpKepPath)) {
                unlink($tmpKepPath);
            }
        }
    }

    // Csak az első oldalt konvertáljuk (a fuvarlevél/szállítólevél
    // egyoldalas dokumentum) — ugyanaz a poppler-utils rendszer-bináris
    // függőség, mint a `pdftotext`-nél a MOL-importnál, itt `pdftoppm`.
    private function pdfElsoOldalKepe($pdfPath) {
        $kimenetPrefix = tempnam(sys_get_temp_dir(), 'bdok_kep_');
        unlink($kimenetPrefix); // pdftoppm maga hozza létre a <prefix>-1.png fájlt
        $escapedPdf = escapeshellarg($pdfPath);
        $escapedPrefix = escapeshellarg($kimenetPrefix);
        exec("pdftoppm -png -r 150 -f 1 -l 1 $escapedPdf $escapedPrefix 2>/dev/null", $kimenet, $returnVar);
        $vartFajl = $kimenetPrefix . '-1.png';
        if ($returnVar !== 0 || !file_exists($vartFajl)) {
            return null;
        }
        return $vartFajl;
    }

    private function sajatCegnev($ceg_id) {
        $stmt = $this->db->prepare("SELECT cegnev FROM admin WHERE id = :id");
        $stmt->bindValue(':id', $ceg_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC)['cegnev'] ?? null;
    }

    private function mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, $ocrAllapot, $adatok) {
        global $filesInterface;

        $raw = base64_decode((string) $base64, true);
        $nev = $fajlnev ?: 'beerkezett_dokumentum';
        $feltoltEredmeny = $filesInterface->fileUpload($ceg_id, 'beerkezett_dokumentum', $ceg_id, $base64, $nev, strlen((string) $raw), null, $feltoltoTipus, $feltoltoId, $feltoltoNev);
        if (empty($feltoltEredmeny['success'])) {
            return ['success' => false, 'message' => $feltoltEredmeny['message'] ?? 'A fájl mentése sikertelen.'];
        }
        $fajlId = $feltoltEredmeny['id'];

        $tipus = $adatok['tipus'] ?? 'ismeretlen';
        if (!in_array($tipus, ['fuvarlevel', 'szallitolevel', 'ismeretlen'], true)) {
            $tipus = 'ismeretlen';
        }

        $stmt = $this->db->prepare(
            "INSERT INTO beerkezett_dokumentumok (admin, fajl_id, tipus, ocr_allapot, ocr_adatok, feltolto_tipus, feltolto_id, feltolto_nev)
             VALUES (:admin, :fajl_id, :tipus, :ocr_allapot, :ocr_adatok, :feltolto_tipus, :feltolto_id, :feltolto_nev)"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':fajl_id', $fajlId, PDO::PARAM_INT);
        $stmt->bindValue(':tipus', $tipus);
        $stmt->bindValue(':ocr_allapot', $ocrAllapot);
        $stmt->bindValue(':ocr_adatok', $adatok !== null ? json_encode($adatok, JSON_UNESCAPED_UNICODE) : null);
        $stmt->bindValue(':feltolto_tipus', $feltoltoTipus);
        $stmt->bindValue(':feltolto_id', $feltoltoId);
        $stmt->bindValue(':feltolto_nev', $feltoltoNev);
        $stmt->execute();

        $dokumentumId = $this->db->lastInsertId();
        return ['success' => true, 'dokumentum' => [
            'id' => (int) $dokumentumId,
            'fajl_id' => (int) $fajlId,
            'tipus' => $tipus,
            'ocr_allapot' => $ocrAllapot,
            'ocr_adatok' => $adatok,
        ]];
    }
}

$beerkezettDokumentumInterface = new BeerkezettDokumentumInterface();
```

- [ ] **Step 2: Wire it into `ApiHandler.php`**

Add near the other interface requires (after `require 'interface/tachografVuInterface.php';`):
```php
require 'interface/beerkezettDokumentumInterface.php';
```

Add `$beerkezettDokumentumInterface` to the end of the `global $kamionInterface, ..., $tachografVuInterface;` list inside `process()`.

Add to `getActions()`:
```php
'elemezBeerkezettDokumentum' => ['base64', 'fajlnev', 'ceg_id', 'kerelmezo_id'],
```

Add a `case` in `process()`'s switch:
```php
case 'elemezBeerkezettDokumentum':
    $kerelmezo = $this->resolveKerelmezo($request);
    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
    echo json_encode($beerkezettDokumentumInterface->elemez($request['base64'], $request['fajlnev'] ?? null, $kerelmezo['ceg_id'], $feltoltoTipus, $feltoltoId, $feltoltoNev));
    return;
```

- [ ] **Step 3: Lint-check the new PHP file**

Run: `php8.2 -l backend/interface/beerkezettDokumentumInterface.php`
Expected: `No syntax errors detected in backend/interface/beerkezettDokumentumInterface.php`

- [ ] **Step 4: Live-verify end-to-end via curl, with both real sample images**

Ensure the local PHP server is running (`cd backend && php8.2 -S localhost:8001 &`) and you have a valid session token (reuse from Task 3, or re-check `sessions`).

Write `/tmp/verify_elemez.sh`:
```bash
#!/bin/bash
set -e
SESSION_TOKEN="teszt-token-cegnev"
CEG_ID=1
SCRATCH="/tmp/claude-1000/-home-psadmin-szikoratransz-szikoratransz/24977c22-efc1-4eca-a630-dad8ec693744/scratchpad"

for pair in "Képernyőkép 2026-07-25 06-40-43.png:fuvarlevel.png" "Képernyőkép 2026-07-25 06-41-03.png:szallitolevel.png"; do
  src="${pair%%:*}"
  label="${pair##*:}"
  b64=$(base64 -w0 "$SCRATCH/$src")
  echo "=== $label ==="
  curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d "{
    \"authHash\": \"nIrINP&o!PU|+pM*Q8'j1R07U57W,qD\",
    \"sessionToken\": \"$SESSION_TOKEN\",
    \"action\": \"elemezBeerkezettDokumentum\",
    \"base64\": \"$b64\",
    \"fajlnev\": \"$label\",
    \"ceg_id\": $CEG_ID
  }" | python3 -m json.tool
  echo
done
```

Run: `bash /tmp/verify_elemez.sh` (re-insert the `teszt-token-cegnev` session row first if Task 3's cleanup step deleted it).

Expected: two `{"success": true, "dokumentum": {...}}` JSON blocks, each with `ocr_allapot: "kesz"` and a populated `ocr_adatok` object (`megbizo` for the fuvarlevél one must again be `"GREEN TRANSLOG KFT"`, not the own-company name).

Then verify the DB rows landed correctly:
```bash
mysql -uroot kamion -e "SELECT sorszam, tabla, filename FROM fajlok WHERE tabla='beerkezett_dokumentum' ORDER BY sorszam DESC LIMIT 2;"
mysql -uroot kamion -e "SELECT id, fajl_id, tipus, ocr_allapot FROM beerkezett_dokumentumok ORDER BY id DESC LIMIT 2;"
```
Expected: two `fajlok` rows with `tabla='beerkezett_dokumentum'`, and two matching `beerkezett_dokumentumok` rows with `ocr_allapot='kesz'`.

**Do not delete these two rows yet** — Task 7's verification reuses one of them to test `letrehozFuvarDokumentumbol()`. Clean up `/tmp/verify_elemez.sh` only: `rm /tmp/verify_elemez.sh`.

- [ ] **Step 5: Commit**

```bash
git add backend/interface/beerkezettDokumentumInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add BeerkezettDokumentumInterface::elemez() OCR intake

Two-phase "digest, admin dönt" pattern like the MOL/Bank/Tachográf
imports, with one deliberate difference: the upload always persists,
even when Gemini OCR fails (quota/network) — the document must never
be lost, admin fills in gaps by hand. Verified live against both real
sample documents through the running local API, not just unit-level.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `BeerkezettDokumentumInterface` — inbox list + type override

**Files:**
- Modify: `backend/interface/beerkezettDokumentumInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `beerkezett_dokumentumok` table (Task 1), the `elemez()` method's data shape (Task 5).
- Produces: action `getBeerkezettDokumentumok` → `{success, dokumentumok: [{id, fajl_id, filename, tipus, ocr_allapot, ocr_adatok, feltolto_nev, fuvar_id, letrehozva}]}`; action `updateBeerkezettDokumentumTipus` → `{success, message}`.

- [ ] **Step 1: Add both methods to `BeerkezettDokumentumInterface`**

Add inside the class (before the closing `}`, after `elemez()`/its private helpers):

```php
    // `$csakFeldolgozatlan` — true esetén csak azok a sorok, amikből MÉG
    // nem lett fuvar (`fuvar_id IS NULL`) — ez az admin inbox alapértelmezett
    // nézete; false esetén minden, torolt<>'I' sor (archívum-nézet).
    public function getDokumentumok($ceg_id, $ocrAllapot = null, $csakFeldolgozatlan = true) {
        $query = "SELECT bd.id, bd.fajl_id, f.filename, bd.tipus, bd.ocr_allapot, bd.ocr_adatok,
                         bd.feltolto_tipus, bd.feltolto_id, bd.feltolto_nev, bd.fuvar_id, bd.letrehozva
                  FROM beerkezett_dokumentumok bd
                  JOIN fajlok f ON f.id = bd.fajl_id
                  WHERE bd.admin = :admin AND bd.torolt <> 'I'";
        $params = [':admin' => $ceg_id];

        if ($csakFeldolgozatlan) {
            $query .= " AND bd.fuvar_id IS NULL";
        }
        if (!empty($ocrAllapot)) {
            $query .= " AND bd.ocr_allapot = :ocr_allapot";
            $params[':ocr_allapot'] = $ocrAllapot;
        }
        $query .= " ORDER BY bd.letrehozva DESC";

        $stmt = $this->db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();

        $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($sorok as &$sor) {
            $sor['ocr_adatok'] = $sor['ocr_adatok'] !== null ? json_decode($sor['ocr_adatok'], true) : null;
        }
        return ['success' => true, 'dokumentumok' => $sorok];
    }

    public function updateTipus($id, $ceg_id, $tipus) {
        if (!in_array($tipus, ['fuvarlevel', 'szallitolevel', 'ismeretlen'], true)) {
            return ['success' => false, 'message' => 'Érvénytelen dokumentumtípus.'];
        }
        $stmt = $this->db->prepare("UPDATE beerkezett_dokumentumok SET tipus = :tipus WHERE id = :id AND admin = :admin");
        $stmt->bindValue(':tipus', $tipus);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'message' => 'Dokumentumtípus frissítve.'];
    }
```

- [ ] **Step 2: Wire the two actions into `ApiHandler.php`**

Add to `getActions()`:
```php
'getBeerkezettDokumentumok' => ['ceg_id'],
'updateBeerkezettDokumentumTipus' => ['id', 'ceg_id', 'tipus'],
```

Add `case`s:
```php
case 'getBeerkezettDokumentumok':
    $kerelmezo = $this->resolveKerelmezo($request);
    echo json_encode($beerkezettDokumentumInterface->getDokumentumok($kerelmezo['ceg_id'], $request['ocrAllapot'] ?? null, $request['csakFeldolgozatlan'] ?? true));
    return;
case 'updateBeerkezettDokumentumTipus':
    $kerelmezo = $this->resolveKerelmezo($request);
    echo json_encode($beerkezettDokumentumInterface->updateTipus($request['id'], $kerelmezo['ceg_id'], $request['tipus']));
    return;
```

- [ ] **Step 3: Lint-check**

Run: `php8.2 -l backend/interface/beerkezettDokumentumInterface.php`
Expected: no syntax errors.

- [ ] **Step 4: Live-verify via curl**

```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "getBeerkezettDokumentumok",
  "ceg_id": 1
}' | python3 -m json.tool
```
Expected: `{"success": true, "dokumentumok": [...]}` including the two rows inserted in Task 5, each with a populated `ocr_adatok` object (not a JSON string) and a `filename`.

- [ ] **Step 5: Commit**

```bash
git add backend/interface/beerkezettDokumentumInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add inbox listing + type-override actions

getBeerkezettDokumentumok (defaults to fuvar_id IS NULL — the "still
needs a fuvar" view) and updateBeerkezettDokumentumTipus so the admin
can correct a misclassified fuvarlevel/szallitolevel guess.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `FuvarInterface` — core CRUD

**Files:**
- Create: `backend/interface/fuvarInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `fuvarok` table (Task 1).
- Produces: `class FuvarInterface` with `newFuvar($data, $ceg_id)`, `updateFuvar($data, $ceg_id)`, `deleteFuvar($id, $ceg_id)`, `getFuvar($id, $ceg_id)`, `getFuvarok($ceg_id, $search, $page, $pageSize, $sortKey, $sortDir, $allapot)` — actions `newFuvar`, `updateFuvar`, `deleteFuvar`, `getFuvar`, `getFuvarok`.

- [ ] **Step 1: Write `backend/interface/fuvarInterface.php`** (core CRUD only — `letrehozFuvarDokumentumbol`/`getUgyfelFuvarElozmeny` come in Tasks 8-9)

```php
<?php

// Fuvar modul — a korábban tudatosan kivezetett `fuvarok` tábla
// újraépítése (ld. docs/superpowers/specs/2026-07-25-fuvar-dokumentum-
// ocr-design.md), most OCR-alapú dokumentum-beérkeztetésre építve, nem
// szóbeli/kézi bejegyzésre. "Összesen" nincs tárolva — mindig
// `fuvardij + egyeb_koltseg` a lekérdezésben.
class FuvarInterface {
    protected $db;

    const RENDEZHETO_OSZLOPOK = [
        'teljesites_datuma' => 'f.teljesites_datuma',
        'felrako' => 'f.felrako',
        'lerako' => 'f.lerako',
        'fuvardij' => 'f.fuvardij',
        'allapot' => 'f.allapot',
    ];

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function newFuvar($data, $ceg_id) {
        try {
            $query = "INSERT INTO fuvarok (admin, sofor_id, kamion_id, furgon_id, potkocsi_id, teljesites_datuma, felrako, lerako, tavolsag_km, megbizo_id, aru_megnevezese, megjegyzes, fuvardij, egyeb_koltseg, fuvarlevel_szam, allapot)
                      VALUES (:admin, :sofor_id, :kamion_id, :furgon_id, :potkocsi_id, :teljesites_datuma, :felrako, :lerako, :tavolsag_km, :megbizo_id, :aru_megnevezese, :megjegyzes, :fuvardij, :egyeb_koltseg, :fuvarlevel_szam, :allapot)";
            $stmt = $this->db->prepare($query);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            $ujId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Fuvar rögzítve.', 'fuvar' => $this->getFuvar($ujId, $ceg_id)['fuvar']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function updateFuvar($data, $ceg_id) {
        try {
            $query = "UPDATE fuvarok SET
                        sofor_id = :sofor_id, kamion_id = :kamion_id, furgon_id = :furgon_id, potkocsi_id = :potkocsi_id,
                        teljesites_datuma = :teljesites_datuma, felrako = :felrako, lerako = :lerako, tavolsag_km = :tavolsag_km,
                        megbizo_id = :megbizo_id, aru_megnevezese = :aru_megnevezese, megjegyzes = :megjegyzes,
                        fuvardij = :fuvardij, egyeb_koltseg = :egyeb_koltseg, fuvarlevel_szam = :fuvarlevel_szam, allapot = :allapot
                      WHERE id = :id AND admin = :admin";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Fuvar frissítve.', 'fuvar' => $this->getFuvar($data['id'], $ceg_id)['fuvar']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function bindFuvarMezok($stmt, $data, $ceg_id) {
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $data['sofor_id'] ?? null);
        $stmt->bindValue(':kamion_id', $data['kamion_id'] ?? null);
        $stmt->bindValue(':furgon_id', $data['furgon_id'] ?? null);
        $stmt->bindValue(':potkocsi_id', $data['potkocsi_id'] ?? null);
        $stmt->bindValue(':teljesites_datuma', $data['teljesites_datuma'] ?? null);
        $stmt->bindValue(':felrako', $data['felrako'] ?? null);
        $stmt->bindValue(':lerako', $data['lerako'] ?? null);
        $stmt->bindValue(':tavolsag_km', empty($data['tavolsag_km']) ? null : (int) $data['tavolsag_km'], empty($data['tavolsag_km']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':megbizo_id', $data['megbizo_id'] ?? null);
        $stmt->bindValue(':aru_megnevezese', $data['aru_megnevezese'] ?? null);
        $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
        $stmt->bindValue(':fuvardij', $data['fuvardij'] === '' || $data['fuvardij'] === null ? null : (float) $data['fuvardij']);
        $stmt->bindValue(':egyeb_koltseg', $data['egyeb_koltseg'] === '' || $data['egyeb_koltseg'] === null ? null : (float) $data['egyeb_koltseg']);
        $stmt->bindValue(':fuvarlevel_szam', $data['fuvarlevel_szam'] ?? null);
        $stmt->bindValue(':allapot', $data['allapot'] ?? 'rogzitett');
    }

    public function deleteFuvar($id, $ceg_id) {
        $stmt = $this->db->prepare("UPDATE fuvarok SET torolt = 'I' WHERE id = :id AND admin = :admin");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'message' => 'Fuvar törölve.'];
    }

    // FONTOS: ez a projekt saját SQL-lintere tiltja a JOIN-t és a UNION-t
    // (ld. `koltsegInterface.php`-ban a flotta-átlag-karbantartási-költség
    // hasonló megjegyzését) — a sofőr/kamion/furgon/pótkocsi/megbízó
    // megjelenítendő nevét/rendszámát ezért KÜLÖN lekérdezésekkel, PHP-
    // oldali összefésüléssel csatoljuk a fuvar-sorokhoz, nem JOIN-nal.
    // Ugyanaz a minta, mint `BeerkezettDokumentumInterface::
    // fajlnevekFeloldasa()`-nál (Task 6) vagy `helyszinInterface::
    // hozzafuzMegjegyzesekSzama()`-nál.
    public function getFuvar($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT *, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS osszesen
             FROM fuvarok
             WHERE id = :id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvar = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($fuvar === false) {
            return ['success' => false, 'fuvar' => null];
        }
        return ['success' => true, 'fuvar' => $this->dusitEgySort($fuvar)];
    }

    public function getFuvarok($ceg_id, $search = null, $page = null, $pageSize = null, $sortKey = null, $sortDir = 'asc', $allapot = null) {
        $params = [':admin' => $ceg_id];
        $query = "SELECT *, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS osszesen
                  FROM fuvarok
                  WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($allapot)) {
            $query .= " AND allapot = :allapot";
            $params[':allapot'] = $allapot;
        }
        if (!empty($search)) {
            // A saját mezők (felrakó/lerakó/áru/fuvarlevél szám) LIKE-
            // egyezése mellett a kapcsolódó entitások (sofőr/kamion/
            // furgon/megbízó) nevét/rendszámát KÜLÖN lekérdezéssel
            // egyeztetjük a keresőszóval, és a talált id-ket egy IN(...)
            // feltételként fűzzük a fuvarok WHERE-jéhez — így nem kell
            // JOIN a keresés kiterjesztéséhez sem.
            $entitasFeltetelek = [];
            foreach ([
                ['sofor_id', 'user', 'name'],
                ['kamion_id', 'kamion', 'rendszam'],
                ['furgon_id', 'furgon', 'rendszam'],
                ['megbizo_id', 'ugyfelek', 'nev'],
            ] as [$oszlop, $tabla, $mezo]) {
                $talalt = $this->keresIdkNevAlapjan($tabla, $mezo, $ceg_id, $search);
                if (!empty($talalt)) {
                    $entitasFeltetelek[] = "$oszlop IN (" . implode(',', $talalt) . ')';
                }
            }

            $sajatMezoFeltetel = "(felrako LIKE :search OR lerako LIKE :search OR aru_megnevezese LIKE :search OR fuvarlevel_szam LIKE :search)";
            $params[':search'] = '%' . $search . '%';

            $query .= " AND (" . implode(' OR ', array_merge([$sajatMezoFeltetel], $entitasFeltetelek)) . ")";
        }

        $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'teljesites_datuma';
        $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
        $query .= " ORDER BY $rendezoOszlop $irany";

        if ($page !== null) {
            [$fuvarok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
            return ['success' => true, 'fuvarok' => $this->dusitSorokat($fuvarok), 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
        }

        $stmt = $this->db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $this->dusitSorokat($stmt->fetchAll(PDO::FETCH_ASSOC))];
    }

    // Kulcsszó szerint megegyező id-k egy adott táblából/mezőből, az adott
    // céghez szűkítve — a keresés kiterjesztéséhez (ld. getFuvarok()).
    private function keresIdkNevAlapjan($tabla, $mezo, $ceg_id, $search) {
        $stmt = $this->db->prepare("SELECT id FROM `$tabla` WHERE admin = :ceg_id AND `$mezo` LIKE :search AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->bindValue(':search', '%' . $search . '%');
        $stmt->execute();
        return array_map('intval', array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id'));
    }

    // Egyetlen fuvar-sorhoz fűzi hozzá a megjelenítendő neveket/
    // rendszámokat (getFuvar()-hoz, egy sor esetén nem kell batch-elt IN
    // lekérdezés).
    private function dusitEgySort($fuvar) {
        $fuvar['sofor_nev'] = $this->egyMezoLekerdezese('user', 'name', $fuvar['sofor_id']);
        $fuvar['kamion_rendszam'] = $this->egyMezoLekerdezese('kamion', 'rendszam', $fuvar['kamion_id']);
        $fuvar['furgon_rendszam'] = $this->egyMezoLekerdezese('furgon', 'rendszam', $fuvar['furgon_id']);
        $fuvar['potkocsi_rendszam'] = $this->egyMezoLekerdezese('potkocsi', 'rendszam', $fuvar['potkocsi_id']);
        $fuvar['megbizo_nev'] = $this->egyMezoLekerdezese('ugyfelek', 'nev', $fuvar['megbizo_id']);
        return $fuvar;
    }

    private function egyMezoLekerdezese($tabla, $mezo, $id) {
        if (empty($id)) {
            return null;
        }
        $stmt = $this->db->prepare("SELECT `$mezo` FROM `$tabla` WHERE id = :id");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        return $sor[$mezo] ?? null;
    }

    // Lista-lekérdezésekhez: táblánként EGY batch-elt IN(...) lekérdezés
    // (nem N+1), majd PHP-oldali összefésülés a sorokhoz.
    private function dusitSorokat($fuvarok) {
        if (empty($fuvarok)) {
            return $fuvarok;
        }
        $soforNevek = $this->batchLekerdezes('user', 'name', array_column($fuvarok, 'sofor_id'));
        $kamionRendszamok = $this->batchLekerdezes('kamion', 'rendszam', array_column($fuvarok, 'kamion_id'));
        $furgonRendszamok = $this->batchLekerdezes('furgon', 'rendszam', array_column($fuvarok, 'furgon_id'));
        $potkocsiRendszamok = $this->batchLekerdezes('potkocsi', 'rendszam', array_column($fuvarok, 'potkocsi_id'));
        $megbizoNevek = $this->batchLekerdezes('ugyfelek', 'nev', array_column($fuvarok, 'megbizo_id'));

        foreach ($fuvarok as &$fuvar) {
            $fuvar['sofor_nev'] = $soforNevek[$fuvar['sofor_id']] ?? null;
            $fuvar['kamion_rendszam'] = $kamionRendszamok[$fuvar['kamion_id']] ?? null;
            $fuvar['furgon_rendszam'] = $furgonRendszamok[$fuvar['furgon_id']] ?? null;
            $fuvar['potkocsi_rendszam'] = $potkocsiRendszamok[$fuvar['potkocsi_id']] ?? null;
            $fuvar['megbizo_nev'] = $megbizoNevek[$fuvar['megbizo_id']] ?? null;
        }
        unset($fuvar);
        return $fuvarok;
    }

    private function batchLekerdezes($tabla, $mezo, $idk) {
        $idk = array_values(array_unique(array_filter(array_map('intval', $idk))));
        if (empty($idk)) {
            return [];
        }
        $helyorzok = implode(',', array_fill(0, count($idk), '?'));
        $stmt = $this->db->prepare("SELECT id, `$mezo` FROM `$tabla` WHERE id IN ($helyorzok)");
        $stmt->execute($idk);
        $terkep = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
            $terkep[$sor['id']] = $sor[$mezo];
        }
        return $terkep;
    }
}

$fuvarInterface = new FuvarInterface();
```

**Fontos, ha ezt a tervet olvasod implementálás közben**: a `$tabla`/`$mezo` paraméterek a fenti négy privát helper-metódusban SOSEM kliens-bemenetből jönnek — mindig ugyanebben az osztályban, hardcode-olt string-literálokból hívva (`'user'`/`'name'`, `'kamion'`/`'rendszam'` stb.), ezért az SQL-injection kockázat nem áll fenn annak ellenére, hogy a tábla/mező-nevek nem paraméterezhetők PDO-val — csak a bind-olt `:id`/`:ceg_id`/`:search` értékek jönnek valódi bemenetből, és azok mind bind-oltak maradnak.

- [ ] **Step 2: Wire into `ApiHandler.php`**

Add the require (after `require 'interface/beerkezettDokumentumInterface.php';`):
```php
require 'interface/fuvarInterface.php';
```

Add `$fuvarInterface` to the `global` list.

Add to `getActions()`:
```php
'newFuvar' => ['ceg_id', 'kerelmezo_id'],
'updateFuvar' => ['id', 'ceg_id', 'kerelmezo_id'],
'deleteFuvar' => ['id', 'ceg_id', 'kerelmezo_id'],
'getFuvar' => ['id', 'ceg_id'],
'getFuvarok' => ['ceg_id'],
```

Add `case`s:
```php
case 'newFuvar':
    $kerelmezo = $this->resolveKerelmezo($request);
    $result = $fuvarInterface->newFuvar($request, $kerelmezo['ceg_id']);
    if ($result['success']) {
        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $result['fuvar']['id'] ?? null, 'letrehozas', $request['felrako'] ?? null);
    }
    echo json_encode($result);
    return;
case 'updateFuvar':
    $kerelmezo = $this->resolveKerelmezo($request);
    $result = $fuvarInterface->updateFuvar($request, $kerelmezo['ceg_id']);
    if ($result['success']) {
        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'modositas', $request['felrako'] ?? null);
    }
    echo json_encode($result);
    return;
case 'deleteFuvar':
    $kerelmezo = $this->resolveKerelmezo($request);
    $result = $fuvarInterface->deleteFuvar($request['id'], $kerelmezo['ceg_id']);
    if ($result['success']) {
        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'torles');
    }
    echo json_encode($result);
    return;
case 'getFuvar':
    echo json_encode($fuvarInterface->getFuvar($request['id'], $this->resolveKerelmezo($request)['ceg_id']));
    return;
case 'getFuvarok':
    $kerelmezo = $this->resolveKerelmezo($request);
    echo json_encode($fuvarInterface->getFuvarok($kerelmezo['ceg_id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc', $request['allapot'] ?? null));
    return;
```

Note: `logAudit(...)` is the existing helper already used by every other `new*`/`update*`/`delete*` case (seen in `newFurgon`/`deleteFurgon` above) — reuse it exactly the same way, no new helper needed. Check `Naplo.js`'s `TABLA_LABEL` map (`src/views/admin/Naplo.js`) and add a `fuvarok: "Fuvar"` entry if it's not already implicitly handled by a fallback — read the file first to confirm whether an unmapped `tabla` value renders acceptably (e.g. falls back to the raw string) or needs an explicit entry; add one if needed.

- [ ] **Step 3: Lint-check**

Run: `php8.2 -l backend/interface/fuvarInterface.php`
Expected: no syntax errors.

- [ ] **Step 4: Live-verify full CRUD via curl**

```bash
# Create
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "newFuvar",
  "ceg_id": 1,
  "felrako": "Teszt Felrakó",
  "lerako": "Teszt Lerakó",
  "fuvardij": 100000,
  "egyeb_koltseg": 5000
}' | python3 -m json.tool
```
Expected: `{"success": true, "fuvar": {"id": N, ..., "osszesen": "105000.00", ...}}` — note `id` for the next calls.

```bash
# List (should include the new row, osszesen computed)
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "getFuvarok",
  "ceg_id": 1,
  "search": "Teszt"
}' | python3 -m json.tool

# Update (replace N with the real id)
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "updateFuvar",
  "ceg_id": 1,
  "id": N,
  "felrako": "Teszt Felrakó Módosítva",
  "lerako": "Teszt Lerakó",
  "fuvardij": 120000,
  "allapot": "szamlazasra_var"
}' | python3 -m json.tool

# Delete (soft)
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "deleteFuvar",
  "ceg_id": 1,
  "id": N
}' | python3 -m json.tool
```
Expected: each returns `{"success": true, ...}`; after delete, confirm `mysql -uroot kamion -e "SELECT id, torolt FROM fuvarok WHERE id = N;"` shows `torolt = 'I'`, and a repeat `getFuvarok` call no longer includes it.

- [ ] **Step 5: Commit**

```bash
git add backend/interface/fuvarInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add FuvarInterface core CRUD (new/update/delete/get/list)

Search across felrakó/lerakó/áru/fuvarlevél-szám/sofőr/rendszám/
megbízó, sortable via the same RENDEZHETO_OSZLOPOK whitelist pattern
used by koltsegInterface/ugyfelInterface. "Összesen" is computed in
the query (fuvardij + egyeb_koltseg), never stored.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `letrehozFuvarDokumentumbol()` — entity matching + fájl reparenting

**Files:**
- Modify: `backend/interface/fuvarInterface.php`
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Consumes: `beerkezett_dokumentumok`/`fajlok` (Tasks 1, 5), `FuvarInterface::newFuvar()` (Task 7).
- Produces: action `letrehozFuvarDokumentumbol` → `{success, fuvar}`; on success, `beerkezett_dokumentumok.fuvar_id` is set and the underlying `fajlok` row is reparented to `tabla='fuvar', rowid=<new fuvar id>`.

- [ ] **Step 1: Add the method to `FuvarInterface`**

```php
    // A `$felulirasok` a review-formon az admin által esetlegesen módosított
    // mezőket tartalmazza (ugyanolyan alakban, mint `newFuvar()` `$data`
    // paramétere) — ahol egy kulcs szerepel benne, az felülírja az OCR-ből
    // származó javaslatot; ahol nem, az OCR/egyeztetés eredménye érvényes.
    public function letrehozDokumentumbol($dokumentumId, $ceg_id, $felulirasok = []) {
        $stmt = $this->db->prepare("SELECT * FROM beerkezett_dokumentumok WHERE id = :id AND admin = :admin AND torolt <> 'I'");
        $stmt->bindValue(':id', $dokumentumId, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $dokumentum = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($dokumentum === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }
        if (!empty($dokumentum['fuvar_id'])) {
            return ['success' => false, 'message' => 'Ehhez a dokumentumhoz már tartozik fuvar.'];
        }

        $ocrAdatok = $dokumentum['ocr_adatok'] !== null ? json_decode($dokumentum['ocr_adatok'], true) : [];
        $ocrAdatok = is_array($ocrAdatok) ? $ocrAdatok : [];

        $rendszamTalalat = $this->keresRendszamAlapjan($ceg_id, $ocrAdatok['rendszam'] ?? null);
        $soforId = $this->keresSoforNevAlapjan($ceg_id, $ocrAdatok['sofor_neve'] ?? null);
        $megbizoId = $this->keresMegbizoNevAlapjan($ceg_id, $ocrAdatok['megbizo'] ?? null);

        $adatok = array_merge([
            'sofor_id' => $soforId,
            'kamion_id' => $rendszamTalalat['tipus'] === 'kamion' ? $rendszamTalalat['id'] : null,
            'furgon_id' => $rendszamTalalat['tipus'] === 'furgon' ? $rendszamTalalat['id'] : null,
            'teljesites_datuma' => $ocrAdatok['datum'] ?? null,
            'felrako' => $ocrAdatok['felrako'] ?? null,
            'lerako' => $ocrAdatok['lerako'] ?? null,
            'megbizo_id' => $megbizoId,
            'aru_megnevezese' => $ocrAdatok['aru_megnevezese'] ?? null,
            'megjegyzes' => $ocrAdatok['egyeb_megjegyzes'] ?? null,
            'fuvarlevel_szam' => $ocrAdatok['fuvarlevel_szam'] ?? null,
        ], $felulirasok);

        $letrehozas = $this->newFuvar($adatok, $ceg_id);
        if (!$letrehozas['success']) {
            return $letrehozas;
        }
        $ujFuvarId = $letrehozas['fuvar']['id'];

        $update = $this->db->prepare("UPDATE beerkezett_dokumentumok SET fuvar_id = :fuvar_id WHERE id = :id");
        $update->bindValue(':fuvar_id', $ujFuvarId, PDO::PARAM_INT);
        $update->bindValue(':id', $dokumentumId, PDO::PARAM_INT);
        $update->execute();

        $reparent = $this->db->prepare("UPDATE fajlok SET tabla = 'fuvar', rowid = :fuvar_id WHERE sorszam = :fajl_id");
        $reparent->bindValue(':fuvar_id', $ujFuvarId, PDO::PARAM_INT);
        $reparent->bindValue(':fajl_id', $dokumentum['fajl_id'], PDO::PARAM_INT);
        $reparent->execute();

        return $letrehozas;
    }

    private function normalizaltRendszam($rendszam) {
        if ($rendszam === null || trim((string) $rendszam) === '') {
            return null;
        }
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $rendszam));
    }

    private function keresRendszamAlapjan($ceg_id, $rendszamNyers) {
        $kulcs = $this->normalizaltRendszam($rendszamNyers);
        if ($kulcs === null) {
            return ['tipus' => null, 'id' => null];
        }

        $stmt = $this->db->prepare("SELECT id, rendszam FROM kamion WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($this->normalizaltRendszam($row['rendszam']) === $kulcs) {
                return ['tipus' => 'kamion', 'id' => (int) $row['id']];
            }
        }

        $stmt = $this->db->prepare("SELECT id, rendszam FROM furgon WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($this->normalizaltRendszam($row['rendszam']) === $kulcs) {
                return ['tipus' => 'furgon', 'id' => (int) $row['id']];
            }
        }

        return ['tipus' => null, 'id' => null];
    }

    private function normalizalNev($nev) {
        $nev = mb_strtoupper(trim((string) $nev));
        $atirasok = ['Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ö' => 'O', 'Ő' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ű' => 'U'];
        return strtr($nev, $atirasok);
    }

    private function keresSoforNevAlapjan($ceg_id, $nev) {
        if ($nev === null || trim($nev) === '') {
            return null;
        }
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $keresett = $this->normalizalNev($nev);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $jelolt = $this->normalizalNev($row['name']);
            if ($jelolt !== '' && (strpos($keresett, $jelolt) !== false || strpos($jelolt, $keresett) !== false)) {
                return (int) $row['id'];
            }
        }
        return null;
    }

    private function keresMegbizoNevAlapjan($ceg_id, $nev) {
        if ($nev === null || trim($nev) === '') {
            return null;
        }
        $stmt = $this->db->prepare("SELECT id, nev FROM ugyfelek WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $keresett = $this->normalizalNev($nev);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $jelolt = $this->normalizalNev($row['nev']);
            if ($jelolt !== '' && (strpos($keresett, $jelolt) !== false || strpos($jelolt, $keresett) !== false)) {
                return (int) $row['id'];
            }
        }
        return null;
    }
```

- [ ] **Step 2: Wire into `ApiHandler.php`**

Add to `getActions()`:
```php
'letrehozFuvarDokumentumbol' => ['dokumentumId', 'ceg_id', 'kerelmezo_id'],
```

Add `case`:
```php
case 'letrehozFuvarDokumentumbol':
    $kerelmezo = $this->resolveKerelmezo($request);
    $result = $fuvarInterface->letrehozDokumentumbol($request['dokumentumId'], $kerelmezo['ceg_id'], $request['felulirasok'] ?? []);
    if ($result['success']) {
        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $result['fuvar']['id'] ?? null, 'letrehozas', 'dokumentumból');
    }
    echo json_encode($result);
    return;
```

- [ ] **Step 3: Lint-check**

Run: `php8.2 -l backend/interface/fuvarInterface.php`
Expected: no syntax errors.

- [ ] **Step 4: Live-verify against one of the real inbox rows from Task 5**

Find the fuvarlevél document's id (from Task 5's leftover row):
```bash
mysql -uroot kamion -e "SELECT id, tipus, ocr_allapot FROM beerkezett_dokumentumok WHERE tipus='fuvarlevel' ORDER BY id DESC LIMIT 1;"
```

Call the action (replace `N` with that id):
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "letrehozFuvarDokumentumbol",
  "ceg_id": 1,
  "dokumentumId": N
}' | python3 -m json.tool
```
Expected: `{"success": true, "fuvar": {...}}` with `felrako`/`lerako`/`aru_megnevezese`/`teljesites_datuma`/`fuvarlevel_szam` populated from the OCR data (whatever names/route the real document produced — `sofor_id`/`kamion_id`/`furgon_id`/`megbizo_id` will most likely be `null` since this test company's `user`/`kamion`/`ugyfelek` tables don't actually contain "Szikora Kristóf"/"RCP-018"/"GREEN TRANSLOG KFT" — that's expected, it proves the no-match path returns `null` cleanly rather than erroring).

Then verify the side effects:
```bash
mysql -uroot kamion -e "SELECT id, fuvar_id FROM beerkezett_dokumentumok WHERE id = N;"
mysql -uroot kamion -e "SELECT sorszam, tabla, rowid FROM fajlok WHERE sorszam = (SELECT fajl_id FROM beerkezett_dokumentumok WHERE id = N);"
```
Expected: `beerkezett_dokumentumok.fuvar_id` is now set; the `fajlok` row's `tabla` is now `'fuvar'` and `rowid` matches the new fuvar's id.

To also verify the entity-matching path actually finds a match (not just handles "no match" gracefully), insert one throwaway matching row first and re-run against a **second** copy of the document:
```bash
mysql -uroot kamion -e "INSERT INTO kamion (admin, rendszam) VALUES (1, 'RCP-018');"
```
(Re-run Task 5's `elemezBeerkezettDokumentum` call for the fuvarlevél once more to get a fresh, still-unlinked `beerkezett_dokumentumok` row, then re-run `letrehozFuvarDokumentumbol` on that new row's id.) Expected this time: `kamion_id` is populated in the response (a real match), assuming the OCR happened to read the same rendszám both times — if it read differently this run (the design spec's live test showed real variance), this is not a bug, just re-confirms the documented non-determinism; the goal here is only to see the match-when-equal code path exercised at least once, adjust the inserted `rendszam` value to whatever this run's OCR actually returned if needed.

Clean up: `mysql -uroot kamion -e "DELETE FROM kamion WHERE rendszam='RCP-018';"` (or whatever rendszám you inserted), and delete the test `fuvarok`/`beerkezett_dokumentumok`/`fajlok` rows created during this task's verification (soft-delete the fuvar via the `deleteFuvar` action, and `DELETE FROM beerkezett_dokumentumok WHERE id IN (...)`, `DELETE FROM fajlok WHERE tabla='fuvar' AND rowid IN (...)` for the ones created purely for this test — leave real ones alone).

- [ ] **Step 5: Commit**

```bash
git add backend/interface/fuvarInterface.php backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add letrehozFuvarDokumentumbol() entity matching

Rendszám (alfanumerikus normalizált) match against kamion/furgon,
loose accent-insensitive name match against user/ugyfelek — same
patterns as MolTankolasInterface/TachografInterface. On success,
reparents the underlying fajlok row (tabla='fuvar') so the source
document shows up in the fuvar's normal attachment gallery instead of
being duplicated. Verified live end-to-end against a real inbox row.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `getUgyfelFuvarElozmeny()` + `ugyfelek.fizetesi_hatarido_nap` wiring

**Files:**
- Modify: `backend/interface/fuvarInterface.php`
- Modify: `backend/interface/ugyfelInterface.php`
- Modify: `backend/ApiHandler.php`
- Modify: `src/components/Cards/CardUgyfel.js`

**Interfaces:**
- Produces: action `getUgyfelFuvarElozmeny` → `{success, fuvarok: [{teljesites_datuma, felrako, lerako, fuvardij}, ...]}` (last 5, most recent first); `ugyfelek.fizetesi_hatarido_nap` becomes settable via `newUgyfel`/`saveUgyfelData` and shows up in `getUgyfel`/`getUgyfelek` responses (no query change needed there — both already `SELECT *`).

- [ ] **Step 1: Add `getUgyfelFuvarElozmeny` to `FuvarInterface`**

```php
    // Referencia, NEM autofill — a megbízó "szokásos fuvardíjai" mezőnek,
    // ld. design spec 6.2. Útvonalanként erősen eltérhet a díj, ezért a
    // frontend csak megjeleníti, nem tölti be automatikusan a fuvardij
    // mezőbe.
    public function getUgyfelElozmeny($ugyfelId, $ceg_id, $limit = 5) {
        $stmt = $this->db->prepare(
            "SELECT teljesites_datuma, felrako, lerako, fuvardij
             FROM fuvarok
             WHERE megbizo_id = :megbizo_id AND admin = :admin AND torolt <> 'I'
             ORDER BY teljesites_datuma DESC
             LIMIT " . (int) $limit
        );
        $stmt->bindValue(':megbizo_id', $ugyfelId, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }
```

- [ ] **Step 2: Wire into `ApiHandler.php`**

Add to `getActions()`:
```php
'getUgyfelFuvarElozmeny' => ['ugyfelId', 'ceg_id'],
```

Add `case`:
```php
case 'getUgyfelFuvarElozmeny':
    echo json_encode($fuvarInterface->getUgyfelElozmeny($request['ugyfelId'], $this->resolveKerelmezo($request)['ceg_id']));
    return;
```

- [ ] **Step 3: Add `fizetesi_hatarido_nap` to `ugyfelInterface.php`**

In `newUgyfel($data)`, add `fizetesi_hatarido_nap` to both the column list and `VALUES` list of the `INSERT INTO ugyfelek (...)` query, and add:
```php
$stmt->bindValue(':fizetesi_hatarido_nap', empty($data['fizetesi_hatarido_nap']) ? null : (int) $data['fizetesi_hatarido_nap'], empty($data['fizetesi_hatarido_nap']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
```

In `saveUgyfelData($data)`, add `fizetesi_hatarido_nap = :fizetesi_hatarido_nap,` to the `SET` clause and the matching bind (same as above).

- [ ] **Step 4: Add the field to `CardUgyfel.js`**

Add `fizetesi_hatarido_nap: ""` to `emptyUgyfel`. Add a new `FormField` in the "Cégadatok" `FormSection` (next to "Adószám"):
```jsx
<FormField
  type="number"
  label="Fizetési határidő (nap)"
  name="fizetesi_hatarido_nap"
  value={formData.fizetesi_hatarido_nap || ""}
  onChange={handleChange}
/>
```

- [ ] **Step 5: Lint-check + verify**

Run: `php8.2 -l backend/interface/fuvarInterface.php backend/interface/ugyfelInterface.php`
Expected: no syntax errors on either file.

```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "teszt-token-cegnev",
  "action": "newUgyfel",
  "admin": 1,
  "nev": "Teszt Ügyfél Kft",
  "fizetesi_hatarido_nap": 30
}' | python3 -m json.tool
```
Expected: `{"success": true, "ugyfel": {..., "fizetesi_hatarido_nap": 30}}`. Confirm in the DB: `mysql -uroot kamion -e "SELECT id, nev, fizetesi_hatarido_nap FROM ugyfelek WHERE nev='Teszt Ügyfél Kft';"`, then delete the test row: `mysql -uroot kamion -e "DELETE FROM ugyfelek WHERE nev='Teszt Ügyfél Kft';"`.

In the browser, navigate to `/admin/ugyfelForm` (new ügyfél), confirm the new "Fizetési határidő (nap)" field renders in the "Cégadatok" section and saves correctly.

- [ ] **Step 6: Commit**

```bash
git add backend/interface/fuvarInterface.php backend/interface/ugyfelInterface.php backend/ApiHandler.php src/components/Cards/CardUgyfel.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add getUgyfelFuvarElozmeny + reintroduce fizetesi_hatarido_nap

Reference-only (not autofill) recent-fuvarok panel data source for
the megbízó picker on FuvarForm. fizetesi_hatarido_nap is the same
field name/purpose the old, removed Fuvarok module used — deliberately
reintroduced per the design spec, now feeding an OCR-sourced fuvar
model instead of the unreliable manual one that led to its removal.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `AutocompleteSelect` reusable component

**Files:**
- Create: `src/components/UI/AutocompleteSelect.js`

**Interfaces:**
- Produces: `<AutocompleteSelect label options={[{value, label, searchText?}]} value onChange={(value, option) => void} placeholder required disabled />` — a controlled, keyboard-dismissible typeahead select, matching `FormField`'s visual language. No component like this exists in the codebase yet (confirmed by research) — this is used by `FuvarForm.js` (Task 14) for sofőr/kamion/furgon/potkocsi/megbízó pickers.

- [ ] **Step 1: Write the component**

```jsx
import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { PiCaretDownLight, PiXLight } from "react-icons/pi";

export default function AutocompleteSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value)) || null;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered =
    query.trim() === ""
      ? options
      : options.filter((o) =>
          (o.searchText || o.label).toLowerCase().includes(query.trim().toLowerCase()),
        );

  const handleSelect = (option) => {
    onChange(option.value, option);
    setQuery("");
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("", null);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {label && (
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100">
        <input
          type="text"
          className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          placeholder={selected ? selected.label : placeholder || "Keresés..."}
          value={open ? query : ""}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          required={required && !selected}
        />
        {selected && !open && (
          <button
            type="button"
            onClick={handleClear}
            className="text-ink-300 hover:text-ink-500"
            aria-label="Kiválasztás törlése"
          >
            <PiXLight className="h-4 w-4" />
          </button>
        )}
        <PiCaretDownLight className="h-4 w-4 flex-shrink-0 text-ink-300" />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-200 bg-white py-1 text-sm shadow-soft dark:border-ink-700 dark:bg-ink-900">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-ink-400">Nincs találat</li>
          ) : (
            filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="block w-full px-3 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/40"
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

AutocompleteSelect.propTypes = {
  label: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      searchText: PropTypes.string,
    }),
  ).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

AutocompleteSelect.defaultProps = {
  required: false,
  disabled: false,
};
```

- [ ] **Step 2: Check Tailwind classes are already compiled**

Run: `grep -c "focus-within:border-brand-400\|focus-within:ring-brand-400" src/assets/styles/tailwind.css`
If the count is `0` for either, run `npm run build:tailwind` now — don't wait until Task 14's browser check to discover missing classes.

- [ ] **Step 3: Verify with a throwaway inline usage**

Temporarily add this component to any existing page you can reach in the browser during dev (e.g. paste a throwaway `<AutocompleteSelect label="Teszt" options={[{value: 1, label: "Alma"}, {value: 2, label: "Körte"}]} value={null} onChange={(v) => console.log(v)} />` into `src/views/admin/Dashboard.js`'s render output temporarily), start `npm start`, open the admin dashboard, click the field, type "kör", confirm only "Körte" shows, click it, confirm the console logs `2` and the input now shows "Körte" as a placeholder with a clear (×) button. Remove the throwaway usage from `Dashboard.js` afterward — do not commit it.

- [ ] **Step 4: Commit**

```bash
git add src/components/UI/AutocompleteSelect.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add AutocompleteSelect reusable typeahead component

No inline-autocomplete/combobox component existed in this codebase —
entity pickers were either plain <select> (no search) or full-page
list screens. FuvarForm's driver/vehicle/customer pickers need actual
typeahead, so this is built fresh, matching FormField's visual style.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Sidebar + routing for the new "Fuvarok" nav group

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js`
- Modify: `src/layouts/Admin.js`

**Interfaces:**
- Produces: three new routes (`/admin/beerkezettDokumentumok`, `/admin/fuvarok`, `/admin/fuvarForm`) reachable from a new desktop "Fuvarok" nav group and a matching `mobileGroups` entry. The page components themselves are stubbed as empty placeholders here and filled in by Tasks 12-14 — this task's job is purely getting navigation working end-to-end first, so each later task can verify its own page in isolation without also debugging routing.

- [ ] **Step 1: Create minimal stub pages so routes resolve**

Create `src/views/admin/BeerkezettDokumentumok.js`:
```jsx
import React from "react";
import PageHeader from "components/UI/PageHeader.js";

export default function BeerkezettDokumentumok() {
  return <PageHeader eyebrow="Fuvarok" title="Beérkezett dokumentumok" />;
}
```

Create `src/views/admin/Fuvarok.js`:
```jsx
import React from "react";
import PageHeader from "components/UI/PageHeader.js";

export default function Fuvarok() {
  return <PageHeader eyebrow="Fuvarok" title="Fuvarok" />;
}
```

Create `src/views/admin/FuvarForm.js`:
```jsx
import React from "react";
import PageHeader from "components/UI/PageHeader.js";

export default function FuvarForm() {
  return <PageHeader eyebrow="Fuvarok" title="Fuvar" />;
}
```

(Tasks 12-14 will replace these three files' contents with the real implementation — the stub above only needs to exist so `React.lazy()` has something to import.)

- [ ] **Step 2: Add routes to `Admin.js`**

Add near the other `lazy()` declarations:
```javascript
const BeerkezettDokumentumok = lazy(() => import("views/admin/BeerkezettDokumentumok.js"));
const Fuvarok = lazy(() => import("views/admin/Fuvarok.js"));
const FuvarForm = lazy(() => import("views/admin/FuvarForm.js"));
```

Add near the other `<PrivateRoute>` entries:
```jsx
<PrivateRoute path="/admin/beerkezettDokumentumok" exact component={BeerkezettDokumentumok} />
<PrivateRoute path="/admin/fuvarok" exact component={Fuvarok} />
<PrivateRoute path="/admin/fuvarForm" exact component={FuvarForm} />
```

- [ ] **Step 3: Add the "Fuvarok" desktop nav group to `Sidebar.js`**

First read the icon imports block (top of the file) and add `PiFileTextLight` (for "Beérkezett dokumentumok") and `PiTruckLight` is already imported — reuse a distinct icon for "Fuvarok" itself, e.g. `PiClipboardTextLight` (check it's not already imported under a different alias; if `react-icons/pi` doesn't export that exact name, use `PiNotepadLight` instead — verify by checking `node_modules/react-icons/pi/index.d.ts` for the exact exported name before using it: `grep -c "PiClipboardTextLight" node_modules/react-icons/pi/index.d.ts`).

Add `fuvarok: false` to the `openGroups` default-state object literal (next to `flotta`/`csapat`/`partnerek`/`penzugyek`/`rendszer`).

Add a new group `<div>` (copy the "Flotta" group's structure exactly, per the researched pattern), placed after the "Flotta" group's closing `</div>`:
```jsx
<div>
  <GroupHeader
    label="Fuvarok"
    open={openGroups.fuvarok}
    onToggle={() => toggleGroup("fuvarok")}
  />
  {openGroups.fuvarok && (
    <ul className="space-y-0.5">
      <NavItem
        to="/admin/beerkezettDokumentumok"
        icon={PiFileTextLight}
        text="Beérkezett dokumentumok"
      />
      <NavItem
        to="/admin/fuvarok"
        icon={PiClipboardTextLight}
        text="Fuvarok"
      />
    </ul>
  )}
</div>
```

Add a matching entry to the `mobileGroups` array (as its own top-level group, same shape as the "flotta" entry):
```javascript
{
  key: "fuvarok",
  label: "Fuvarok",
  icon: PiClipboardTextLight,
  items: [
    { to: "/admin/beerkezettDokumentumok", icon: PiFileTextLight, text: "Beérkezett dokumentumok" },
    { to: "/admin/fuvarok", icon: PiClipboardTextLight, text: "Fuvarok" },
  ],
},
```

- [ ] **Step 4: Verify Tailwind classes are compiled**

None of this task's JSX introduces new Tailwind utility classes beyond what `GroupHeader`/`NavItem` already use internally — no rebuild needed. Confirm by reading `GroupHeader`/`NavItem`'s own source briefly if unsure.

- [ ] **Step 5: Verify in the browser**

Start `npm start` (reuse existing dev server if already running), log in as admin, confirm: (a) desktop sidebar shows a new collapsed "Fuvarok" group between "Flotta" and "Csapat" (or wherever it landed), clicking it expands to show "Beérkezett dokumentumok" and "Fuvarok" links, both navigate and render their stub `PageHeader`; (b) resize to mobile width, confirm a new "Fuvarok" tab appears in the bottom bar, tapping it shows the same two items.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar/Sidebar.js src/layouts/Admin.js src/views/admin/BeerkezettDokumentumok.js src/views/admin/Fuvarok.js src/views/admin/FuvarForm.js
git commit -m "$(cat <<'EOF'
feat(fuvar): wire up routing + nav for the new Fuvarok module

Stub pages only — Tasks 12-14 fill in the real BeerkezettDokumentumok/
Fuvarok/FuvarForm implementations. Splitting routing out first so
each later task can verify its own page without also debugging nav.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `BeerkezettDokumentumok.js` — inbox page

**Files:**
- Modify: `src/views/admin/BeerkezettDokumentumok.js` (replace the Task 11 stub)

**Interfaces:**
- Consumes: actions `getBeerkezettDokumentumok`, `elemezBeerkezettDokumentum`, `updateBeerkezettDokumentumTipus` (Tasks 5-6); `fileToBase64` (`src/utils/fileToBase64.js`, existing); the `downloadFile` action (existing, used for preview) — check its exact response shape first by reading one existing caller (e.g. `downloadFileAction.js`) before using it.

- [ ] **Step 1: Read `src/utils/downloadFileAction.js` to confirm the `downloadFile` action's response shape**

You need to know whether it returns `{success, mime, file}` (base64) as referenced in `CLAUDE.md`'s Fájlok section — confirm the exact key names before using them in Step 2's preview code.

- [ ] **Step 2: Write the page**

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import {
  PiFileTextLight,
  PiUploadLight,
  PiWarningCircleLight,
  PiCheckCircleLight,
} from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";

const OCR_ALLAPOT_LABEL = {
  kesz: "Feldolgozva",
  hiba: "OCR sikertelen",
  feldolgozatlan: "Feldolgozás alatt",
};

const OCR_ALLAPOT_TONE = {
  kesz: "text-emerald-600",
  hiba: "text-amber-600",
  feldolgozatlan: "text-ink-400",
};

export default function BeerkezettDokumentumok() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
  const [dokumentumok, setDokumentumok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAction("getBeerkezettDokumentumok", {
      ceg_id: user.ceg_id,
    });
    setDokumentumok(result?.success ? result.dokumentumok || [] : []);
    setLoading(false);
  }, [user.ceg_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await fetchAction("elemezBeerkezettDokumentum", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        base64,
        fajlnev: file.name,
      });
      if (result?.success) {
        toast.success(
          result.dokumentum.ocr_allapot === "kesz"
            ? "Dokumentum feltöltve és feldolgozva."
            : "Dokumentum feltöltve, de az automatikus feldolgozás sikertelen — töltsd ki kézzel.",
        );
        load();
      } else {
        toast.error(result?.message || "A feltöltés sikertelen.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleFuvarLetrehozasa = (dokumentum) => {
    history.push("/admin/fuvarForm", {
      dokumentumId: dokumentum.id,
      ocrAdatok: dokumentum.ocr_adatok || {},
    });
  };

  return (
    <>
      <PageHeader eyebrow="Fuvarok" title="Beérkezett dokumentumok" />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <div className="mb-4 rounded-2xl border border-dashed border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700">
              <PiUploadLight className="h-4 w-4" />
              {uploading ? "Feldolgozás..." : "Dokumentum feltöltése"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {loading ? (
            <p className="text-sm text-ink-400">Betöltés...</p>
          ) : dokumentumok.length === 0 ? (
            <p className="text-sm text-ink-400">
              Nincs feldolgozásra váró dokumentum.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dokumentumok.map((dok) => (
                <div
                  key={dok.id}
                  className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft dark:border-ink-800 dark:bg-ink-900"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-semibold text-ink-500">
                      <PiFileTextLight className="h-4 w-4" />
                      {dok.filename}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs font-semibold ${OCR_ALLAPOT_TONE[dok.ocr_allapot]}`}
                    >
                      {dok.ocr_allapot === "hiba" ? (
                        <PiWarningCircleLight className="h-4 w-4" />
                      ) : (
                        <PiCheckCircleLight className="h-4 w-4" />
                      )}
                      {OCR_ALLAPOT_LABEL[dok.ocr_allapot]}
                    </span>
                  </div>
                  <select
                    className="mb-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:bg-ink-800"
                    value={dok.tipus}
                    onChange={async (e) => {
                      const ujTipus = e.target.value;
                      const result = await fetchAction("updateBeerkezettDokumentumTipus", {
                        ceg_id: user.ceg_id,
                        id: dok.id,
                        tipus: ujTipus,
                      });
                      if (result?.success) {
                        setDokumentumok((prev) =>
                          prev.map((d) => (d.id === dok.id ? { ...d, tipus: ujTipus } : d)),
                        );
                      } else {
                        toast.error(result?.message || "A típus módosítása sikertelen.");
                      }
                    }}
                  >
                    <option value="fuvarlevel">Fuvarlevél</option>
                    <option value="szallitolevel">Szállítólevél</option>
                    <option value="ismeretlen">Ismeretlen típus</option>
                  </select>
                  {dok.ocr_adatok && (
                    <ul className="mb-3 space-y-0.5 text-sm text-ink-700 dark:text-ink-200">
                      {dok.ocr_adatok.felrako && <li>Felrakó: {dok.ocr_adatok.felrako}</li>}
                      {dok.ocr_adatok.lerako && <li>Lerakó: {dok.ocr_adatok.lerako}</li>}
                      {dok.ocr_adatok.megbizo && <li>Megbízó: {dok.ocr_adatok.megbizo}</li>}
                      {dok.ocr_adatok.datum && <li>Dátum: {dok.ocr_adatok.datum}</li>}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => handleFuvarLetrehozasa(dok)}
                    className="w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-700"
                  >
                    Fuvar létrehozása
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

(Deliberately no separate preview-panel component in this task, to keep scope bounded — the small inline `ocr_adatok` field list above already gives the admin enough to decide "create a fuvar from this" without opening the raw file; if a full image/PDF preview turns out to be needed later, that's a follow-up, not blocking this task's deliverable.)

- [ ] **Step 2: Check for missing Tailwind classes**

Run: `grep -c "border-dashed\|bg-brand-600\|hover:bg-brand-700" src/assets/styles/tailwind.css`
If any count is `0`, run `npm run build:tailwind`.

- [ ] **Step 3: Live-verify in the browser with both real sample documents**

Start both servers (`php8.2 -S localhost:8001` from `backend/`, `npm start`). Log in as admin, navigate to `/admin/beerkezettDokumentumok`. Upload the fuvarlevél sample (`.../Képernyőkép 2026-07-25 06-40-43.png`), confirm a success toast, confirm a new card appears with "Fuvarlevél" type, "Feldolgozva" status, and the OCR'd felrakó/lerakó/megbízó/dátum. Repeat with the szállítólevél sample. Click "Fuvar létrehozása" on one card and confirm it navigates to `/admin/fuvarForm` (still a stub at this point — full verification of the prefill happens in Task 14).

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/BeerkezettDokumentumok.js
git commit -m "$(cat <<'EOF'
feat(fuvar): implement the Beérkezett dokumentumok inbox page

Upload (image/PDF), live OCR status + extracted-field summary per
card, "Fuvar létrehozása" hands off to FuvarForm with the document id
and OCR data. Verified live with both real sample documents.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `CardTableForFuvarok.js` + `Fuvarok.js` list page

**Files:**
- Create: `src/components/Table/CardTableForFuvarok.js`
- Modify: `src/views/admin/Fuvarok.js` (replace the Task 11 stub)

**Interfaces:**
- Consumes: action `getFuvarok` (Task 7), `DataTable`/`StatusBadge` (existing), `useConfirmDelete` (existing).

- [ ] **Step 1: Write `CardTableForFuvarok.js`**

```jsx
import React from "react";
import { useHistory } from "react-router-dom";
import { PiPencilSimpleLight, PiTrashLight, PiClipboardTextLight } from "react-icons/pi";

import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import { useConfirmDelete } from "components/UI/useConfirmDelete.js";
import StatusBadge from "components/UI/StatusBadge.js";

const ALLAPOT_LABEL = {
  rogzitett: "Rögzítve",
  szamlazasra_var: "Számlázásra vár",
  szamlazva: "Számlázva",
  fizetesre_var: "Fizetésre vár",
  teljesitve: "Teljesítve",
};

const ALLAPOT_TONE = {
  rogzitett: "neutral",
  szamlazasra_var: "warning",
  szamlazva: "brand",
  fizetesre_var: "warning",
  teljesitve: "positive",
};

const CardTable = ({
  fuvarok = [],
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onSearchChange,
  onExportAll,
  sortKey,
  sortDir,
  onSortChange,
}) => {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));

  const handleNewFuvar = () => {
    history.push("/admin/fuvarForm", { data: {} });
  };

  const handleEditClick = (fuvar) => {
    history.push("/admin/fuvarForm", { data: fuvar });
  };

  const handleDelete = useConfirmDelete({
    action: "deleteFuvar",
    confirmMessage: "Biztosan törölni szeretnéd a fuvart?",
    successMessage: "A fuvar sikeresen törölve.",
    listPath: "/admin/fuvarok",
    extraParams: { kerelmezo_id: user.id },
  });

  const jarmuLabel = (row) => row.kamion_rendszam || row.furgon_rendszam || "—";

  const columns = [
    { key: "teljesites_datuma", label: "Teljesítés", sortable: true, render: (row) => row.teljesites_datuma || "—" },
    { key: "felrako", label: "Felrakó", sortable: true, render: (row) => row.felrako || "—" },
    { key: "lerako", label: "Lerakó", sortable: true, render: (row) => row.lerako || "—" },
    { key: "megbizo_nev", label: "Megbízó", render: (row) => row.megbizo_nev || "—" },
    { key: "sofor_nev", label: "Sofőr", render: (row) => row.sofor_nev || "—", mobileHidden: true },
    { key: "jarmu", label: "Jármű", render: jarmuLabel, mobileHidden: true },
    {
      key: "osszesen",
      label: "Összesen",
      render: (row) => (row.osszesen != null ? `${Number(row.osszesen).toLocaleString("hu-HU")} Ft` : "—"),
    },
    {
      key: "allapot",
      label: "Állapot",
      sortable: true,
      render: (row) => <StatusBadge tone={ALLAPOT_TONE[row.allapot] || "neutral"}>{ALLAPOT_LABEL[row.allapot] || row.allapot}</StatusBadge>,
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiPencilSimpleLight />} onClick={() => handleEditClick(row)} title="Szerkesztés" />
          <ActionIcon icon={<PiTrashLight />} danger onClick={() => handleDelete(row.id)} title="Törlés" />
        </div>
      ),
    },
  ];

  const exportColumns = [
    { key: "teljesites_datuma", label: "Teljesítés" },
    { key: "felrako", label: "Felrakó" },
    { key: "lerako", label: "Lerakó" },
    { key: "megbizo_nev", label: "Megbízó" },
    { key: "sofor_nev", label: "Sofőr" },
    { key: "fuvardij", label: "Fuvardíj" },
    { key: "egyeb_koltseg", label: "Egyéb költség" },
    { key: "osszesen", label: "Összesen" },
    { key: "allapot", label: "Állapot" },
  ];

  return (
    <DataTable
      icon={PiClipboardTextLight}
      title="Fuvarok"
      onAdd={handleNewFuvar}
      exportFilename="fuvarok"
      exportColumns={exportColumns}
      columns={columns}
      rows={fuvarok}
      onRowDoubleClick={handleEditClick}
      emptyLabel="Nincsenek fuvarok megjelenítve"
      loading={loading}
      searchable
      searchPlaceholder="Keresés felrakó, lerakó, sofőr, rendszám, megbízó szerint..."
      serverSide
      totalRows={total}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onSearchChange={onSearchChange}
      onExportAll={onExportAll}
      sortKey={sortKey}
      sortDir={sortDir}
      onSortChange={onSortChange}
    />
  );
};

export default CardTable;
```

- [ ] **Step 2: Write `Fuvarok.js`**

```jsx
import React, { useState, useEffect, useCallback } from "react";

import CardTable from "components/Table/CardTableForFuvarok.js";
import PageHeader from "components/UI/PageHeader.js";
import { fetchAction } from "utils/fetchAction";

const PAGE_SIZE = 10;

export default function Fuvarok() {
  const [fuvarok, setFuvarok] = useState([]);
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
      const result = await fetchAction("getFuvarok", {
        ceg_id: user.ceg_id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortKey: sortKey || undefined,
        sortDir,
      });
      if (cancelled) return;
      if (result.success) {
        setFuvarok(result.fuvarok || []);
        setTotal(result.total ?? (result.fuvarok || []).length);
      } else {
        setFuvarok([]);
        setTotal(0);
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
    const result = await fetchAction("getFuvarok", {
      ceg_id: user.ceg_id,
      search: search || undefined,
    });
    return result.success ? result.fuvarok || [] : [];
  }, [search]);

  return (
    <>
      <PageHeader eyebrow="Fuvarok" title="Fuvarok" />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTable
            fuvarok={fuvarok}
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
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify `StatusBadge`'s `tone` prop accepts `"neutral"|"warning"|"brand"|"positive"`**

Read `src/components/UI/StatusBadge.js` and confirm these four tone strings are all valid keys in its internal tone-to-class map before relying on them — adjust the `ALLAPOT_TONE` map above to whatever tone names actually exist if they differ (e.g. it might use `"gray"` instead of `"neutral"`).

- [ ] **Step 4: Live-verify in the browser**

Navigate to `/admin/fuvarok`. Confirm the fuvarok created during Tasks 7/8/12's live verification (if any weren't cleaned up) appear, or create one via "+ Új" first. Confirm: search filters correctly, clicking the "Teljesítés"/"Felrakó"/"Lerakó"/"Állapot" column headers sorts (toggle asc/desc), the status badge renders the correct color per state, editing navigates to `/admin/fuvarForm` with the row's data in `location.state.data`, and deleting asks for confirmation and removes the row from the list.

- [ ] **Step 5: Commit**

```bash
git add src/components/Table/CardTableForFuvarok.js src/views/admin/Fuvarok.js
git commit -m "$(cat <<'EOF'
feat(fuvar): implement the Fuvarok list page

Server-side search/sort/pagination through the shared DataTable, same
pattern as Furgonok.js/CardTableForFurgonok.js. Status badge tone maps
allapot to the shared semantic-color convention.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: `FuvarForm.js` — create/edit with auto-fill

**Files:**
- Modify: `src/views/admin/FuvarForm.js` (replace the Task 11 stub)

**Interfaces:**
- Consumes: `AutocompleteSelect` (Task 10), actions `getKamionValaszto`, `getFurgonValaszto`, `getPotkocsiRendszamok`, `getSoforok`, `getUgyfelek`, `getUgyfelFuvarElozmeny`, `newFuvar`, `updateFuvar`, `letrehozFuvarDokumentumbol` (all existing/Task 7-9), `FormField`/`FormSection` (existing), `location.state` shape set by `BeerkezettDokumentumok.js` (`{dokumentumId, ocrAdatok}`) and `CardTableForFuvarok.js` (`{data: fuvarRow}`).

- [ ] **Step 1: Write the form**

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  PiClipboardTextLight,
  PiArrowLeftLight,
  PiUserLight,
  PiTruckLight,
  PiMapPinLight,
  PiCoinsLight,
  PiNoteLight,
} from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import AutocompleteSelect from "components/UI/AutocompleteSelect.js";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

const ALLAPOT_OPTIONS = [
  { value: "rogzitett", label: "Rögzítve" },
  { value: "szamlazasra_var", label: "Számlázásra vár" },
  { value: "szamlazva", label: "Számlázva" },
  { value: "fizetesre_var", label: "Fizetésre vár" },
  { value: "teljesitve", label: "Teljesítve" },
];

const emptyFuvar = {
  sofor_id: "",
  kamion_id: "",
  furgon_id: "",
  potkocsi_id: "",
  teljesites_datuma: "",
  felrako: "",
  lerako: "",
  tavolsag_km: "",
  megbizo_id: "",
  aru_megnevezese: "",
  megjegyzes: "",
  fuvardij: "",
  egyeb_koltseg: "",
  fuvarlevel_szam: "",
  allapot: "rogzitett",
};

// Az OCR-mezőnevek eltérnek a fuvarok tábla mezőneveitől ott, ahol a
// dokumentumon szereplő szöveg (pl. "sofor_neve") és az adatbázis-oszlop
// (pl. "sofor_id") közt egyeztetés szükséges — ezt a szerver már elvégezte
// (letrehozFuvarDokumentumbol), ITT csak a BeerkezettDokumentumok.js oldalról
// átadott nyers ocrAdatok szöveges mezőit tesszük be induló értéknek, ahol
// nincs ID-egyeztetés (felrako/lerako/aru/dátum/fuvarlevél szám).
function ocrAdatokToForm(ocrAdatok) {
  if (!ocrAdatok) return {};
  return {
    teljesites_datuma: ocrAdatok.datum || "",
    felrako: ocrAdatok.felrako || "",
    lerako: ocrAdatok.lerako || "",
    aru_megnevezese: ocrAdatok.aru_megnevezese || "",
    megjegyzes: ocrAdatok.egyeb_megjegyzes || "",
    fuvarlevel_szam: ocrAdatok.fuvarlevel_szam || "",
  };
}

export default function FuvarForm() {
  const history = useHistory();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));

  const dokumentumId = location.state?.dokumentumId || null;
  const initialData = location.state?.data || ocrAdatokToForm(location.state?.ocrAdatok);
  const isNew = !initialData?.id;

  const [formData, setFormData] = useState({ ...emptyFuvar, ...initialData });
  const [isSaving, setIsSaving] = useState(false);
  const [kamionok, setKamionok] = useState([]);
  const [furgonok, setFurgonok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [soforok, setSoforok] = useState([]);
  const [ugyfelek, setUgyfelek] = useState([]);
  const [ugyfelElozmeny, setUgyfelElozmeny] = useState([]);

  useEffect(() => {
    const loadLookups = async () => {
      const [kamionRes, furgonRes, potkocsiRes, soforRes, ugyfelRes] = await Promise.all([
        fetchAction("getKamionValaszto", { ceg_id: user.ceg_id }),
        fetchAction("getFurgonValaszto", { ceg_id: user.ceg_id }),
        fetchAction("getPotkocsiRendszamok", { id: user.ceg_id }),
        fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }),
        fetchAction("getUgyfelek", { id: user.ceg_id, kerelmezo_id: user.id }),
      ]);
      setKamionok(kamionRes?.success ? kamionRes.kamionok || [] : []);
      setFurgonok(furgonRes?.success ? furgonRes.furgonok || [] : []);
      setPotkocsik(potkocsiRes?.success ? potkocsiRes.potkocsik || [] : []);
      setSoforok(soforRes?.success ? soforRes.soforok || [] : []);
      setUgyfelek(ugyfelRes?.success ? ugyfelRes.ugyfelek || [] : []);
    };
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSoforChange = (soforId) => {
    const sofor = soforok.find((s) => String(s.id) === String(soforId));
    setFormData((prev) => ({
      ...prev,
      sofor_id: soforId,
      kamion_id: sofor?.kamion || prev.kamion_id,
      furgon_id: sofor?.furgon || prev.furgon_id,
      potkocsi_id: sofor?.aktiv_potkocsi || prev.potkocsi_id,
    }));
  };

  const handleMegbizoChange = useCallback(
    async (megbizoId) => {
      setFormData((prev) => ({ ...prev, megbizo_id: megbizoId }));
      if (!megbizoId) {
        setUgyfelElozmeny([]);
        return;
      }
      const result = await fetchAction("getUgyfelFuvarElozmeny", {
        ceg_id: user.ceg_id,
        ugyfelId: megbizoId,
      });
      setUgyfelElozmeny(result?.success ? result.fuvarok || [] : []);
    },
    [user.ceg_id],
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let result;
      if (dokumentumId) {
        result = await fetchAction("letrehozFuvarDokumentumbol", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          dokumentumId,
          felulirasok: formData,
        });
      } else {
        const action = formData.id ? "updateFuvar" : "newFuvar";
        result = await fetchAction(action, {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          ...formData,
        });
      }

      if (result?.success) {
        toast.success("Fuvar mentve.");
        history.push("/admin/fuvarok");
      } else {
        throw new Error(result?.message || "Mentés sikertelen.");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const kivalasztottMegbizo = ugyfelek.find((u) => String(u.id) === String(formData.megbizo_id)) || null;

  const jarmuOptions = [
    ...kamionok.map((k) => ({ value: `kamion:${k.id}`, label: k.rendszam, searchText: k.rendszam })),
    ...furgonok.map((f) => ({ value: `furgon:${f.id}`, label: f.rendszam, searchText: f.rendszam })),
  ];
  const jarmuValue = formData.kamion_id
    ? `kamion:${formData.kamion_id}`
    : formData.furgon_id
      ? `furgon:${formData.furgon_id}`
      : "";
  const handleJarmuChange = (value) => {
    if (!value) {
      setFormData((prev) => ({ ...prev, kamion_id: "", furgon_id: "" }));
      return;
    }
    const [tipus, id] = value.split(":");
    setFormData((prev) => ({
      ...prev,
      kamion_id: tipus === "kamion" ? id : "",
      furgon_id: tipus === "furgon" ? id : "",
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => history.push("/admin/fuvarok")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza a fuvarokhoz
      </button>

      <PageHeader eyebrow="Fuvarok" title={isNew ? "Új fuvar" : "Fuvar szerkesztése"} />

      <PageCard icon={PiClipboardTextLight} title={isNew ? "Új fuvar" : "Fuvar szerkesztése"}>
        <div className="px-4 py-4 lg:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-5"
          >
            <FormSection title="Résztvevők" icon={PiUserLight} columns={4}>
              <AutocompleteSelect
                label="Sofőr"
                options={soforok.map((s) => ({ value: s.id, label: s.name, searchText: s.name }))}
                value={formData.sofor_id}
                onChange={handleSoforChange}
              />
              <AutocompleteSelect
                label="Jármű (kamion/furgon)"
                options={jarmuOptions}
                value={jarmuValue}
                onChange={handleJarmuChange}
              />
              <AutocompleteSelect
                label="Pótkocsi"
                options={potkocsik.map((p) => ({ value: p.id, label: p.rendszam, searchText: p.rendszam }))}
                value={formData.potkocsi_id}
                onChange={(v) => setFormData((prev) => ({ ...prev, potkocsi_id: v }))}
              />
              <AutocompleteSelect
                label="Megbízó"
                options={ugyfelek.map((u) => ({ value: u.id, label: u.nev, searchText: `${u.nev} ${u.varos || ""}` }))}
                value={formData.megbizo_id}
                onChange={handleMegbizoChange}
              />
            </FormSection>

            {kivalasztottMegbizo && (
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-xl border border-ink-100 bg-white p-3 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 md:grid-cols-2">
                <p>
                  <span className="font-semibold uppercase tracking-wide text-ink-400">Cím: </span>
                  {[kivalasztottMegbizo.irsz, kivalasztottMegbizo.varos, kivalasztottMegbizo.cim]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
                <p>
                  <span className="font-semibold uppercase tracking-wide text-ink-400">Adószám: </span>
                  {kivalasztottMegbizo.adoszam || "—"}
                </p>
                <p>
                  <span className="font-semibold uppercase tracking-wide text-ink-400">Fizetési határidő: </span>
                  {kivalasztottMegbizo.fizetesi_hatarido_nap
                    ? `${kivalasztottMegbizo.fizetesi_hatarido_nap} nap`
                    : "—"}
                </p>
                <p>
                  <span className="font-semibold uppercase tracking-wide text-ink-400">Kapcsolattartó: </span>
                  {[kivalasztottMegbizo.kapcsolattarto_nev, kivalasztottMegbizo.kapcsolattarto_telefon]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
            )}

            {ugyfelElozmeny.length > 0 && (
              <div className="rounded-xl border border-ink-100 bg-sand-50 p-3 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300">
                <p className="mb-1 font-semibold uppercase tracking-wide text-ink-400">
                  Korábbi fuvarok ezzel a megbízóval
                </p>
                <ul className="space-y-0.5">
                  {ugyfelElozmeny.map((f, i) => (
                    <li key={i}>
                      {f.teljesites_datuma || "—"} · {f.felrako} → {f.lerako} ·{" "}
                      {f.fuvardij != null ? `${Number(f.fuvardij).toLocaleString("hu-HU")} Ft` : "—"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FormSection title="Útvonal" icon={PiMapPinLight} columns={4}>
              <FormField
                type="date"
                label="Teljesítés dátuma"
                name="teljesites_datuma"
                value={formData.teljesites_datuma || ""}
                onChange={handleChange}
              />
              <FormField label="Felrakó" name="felrako" value={formData.felrako || ""} onChange={handleChange} />
              <FormField label="Lerakó" name="lerako" value={formData.lerako || ""} onChange={handleChange} />
              <FormField
                type="number"
                label="Távolság (km)"
                name="tavolsag_km"
                value={formData.tavolsag_km || ""}
                onChange={handleChange}
              />
              <FormField
                icon={PiTruckLight}
                label="Áru megnevezése"
                name="aru_megnevezese"
                value={formData.aru_megnevezese || ""}
                onChange={handleChange}
                className="md:col-span-2"
              />
              <FormField
                label="Fuvarlevél szám"
                name="fuvarlevel_szam"
                value={formData.fuvarlevel_szam || ""}
                onChange={handleChange}
              />
            </FormSection>

            <FormSection title="Díjak" icon={PiCoinsLight} columns={4}>
              <FormField
                type="number"
                label="Fuvardíj (Ft)"
                name="fuvardij"
                value={formData.fuvardij || ""}
                onChange={handleChange}
              />
              <FormField
                type="number"
                label="Egyéb költség (Ft)"
                name="egyeb_koltseg"
                value={formData.egyeb_koltseg || ""}
                onChange={handleChange}
              />
              <FormField
                as="select"
                label="Állapot"
                name="allapot"
                value={formData.allapot || "rogzitett"}
                onChange={handleChange}
              >
                {ALLAPOT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </FormField>
            </FormSection>

            <FormSection title="Megjegyzés" icon={PiNoteLight} columns={1}>
              <FormField
                as="textarea"
                label="Megjegyzés"
                name="megjegyzes"
                value={formData.megjegyzes || ""}
                onChange={handleChange}
                rows="3"
              />
            </FormSection>

            <div className="flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800">
              <SaveButton onClick={handleSave} isSaving={isSaving} label={isNew ? "Fuvar rögzítése" : "Mentés"} />
            </div>
          </form>
        </div>
      </PageCard>
    </div>
  );
}
```

- [ ] **Step 2: Confirm `SaveButton`/`PageCard` prop names before relying on them**

Read `src/components/Cards/CardUgyfel.js`'s usage of `SaveButton`/`PageCard` again (already researched in Task 9 context) and cross-check every prop name used above (`icon`, `title`, `onClick`, `isSaving`, `label`) actually matches — fix any mismatch before running the browser check.

- [ ] **Step 3: Check for missing Tailwind classes**

Run: `grep -c "bg-sand-50\|md:col-span-2" src/assets/styles/tailwind.css`
If `0`, run `npm run build:tailwind`.

- [ ] **Step 4: Live-verify three flows in the browser**

(a) **Manual creation**: `/admin/fuvarok` → "+ Új" → confirm all pickers show real data (drivers/vehicles/customers from the local DB), pick a sofőr and confirm kamion/furgon/potkocsi auto-fill from that driver's current assignment (if the test driver has one — otherwise confirm the fields simply stay as they were, not blanked), pick a megbízó (use/create one with a `fizetesi_hatarido_nap`, `adoszam`, and `kapcsolattarto_nev` set via `/admin/ugyfelForm` first, per Task 9) and confirm the new "Cím/Adószám/Fizetési határidő/Kapcsolattartó" read-only panel shows the correct values, and that the "Korábbi fuvarok" panel appears if that customer has prior fuvarok (create one first if none exist), fill in the rest, save, confirm redirect to `/admin/fuvarok` and the new row appears.

(b) **Document-driven creation**: from `/admin/beerkezettDokumentumok`, click "Fuvar létrehozása" on one of the two real sample-document cards, confirm the form opens pre-filled with the OCR'd felrakó/lerakó/áru/dátum/fuvarlevél-szám, save, confirm it redirects and the new fuvar's data matches what was shown in the inbox card, and go back to `/admin/beerkezettDokumentumok` to confirm that document no longer appears in the (default `fuvar_id IS NULL`-filtered) inbox list.

(c) **Edit**: from `/admin/fuvarok`, click a row's edit icon, confirm the form pre-fills with its data, change the "Állapot" dropdown to "Számlázásra vár", save, confirm the list shows the updated status badge.

- [ ] **Step 5: Commit**

```bash
git add src/views/admin/FuvarForm.js
git commit -m "$(cat <<'EOF'
feat(fuvar): implement FuvarForm with auto-fill and OCR handoff

Sofőr selection auto-fills their current kamion/furgon/potkocsi;
megbízó selection shows a read-only "recent fuvarok" reference panel
(never auto-fills fuvardíj, since it varies by route); document-driven
creation calls letrehozFuvarDokumentumbol instead of newFuvar. Verified
live for manual creation, OCR-driven creation (both real sample docs),
and edit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Driver-facing upload page

**Files:**
- Create: `src/views/user/DokumentumFeltoltes.js`
- Modify: `src/layouts/User.js`
- Modify: `src/views/user/Dashboard.js`

**Interfaces:**
- Consumes: action `elemezBeerkezettDokumentum` (Task 5), `fileToBase64` (existing).

- [ ] **Step 1: Write the driver upload page**

```jsx
import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { PiArrowLeftLight, PiCameraLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";

export default function DokumentumFeltoltes() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await fetchAction("elemezBeerkezettDokumentum", {
        ceg_id: user.admin,
        kerelmezo_id: user.id,
        base64,
        fajlnev: file.name,
      });
      if (result?.success) {
        toast.success("Dokumentum feltöltve, az admin fogja feldolgozni.");
        history.push("/user/dashboard");
      } else {
        toast.error(result?.message || "A feltöltés sikertelen.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        type="button"
        onClick={() => history.push("/user/dashboard")}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        Vissza
      </button>
      <h1 className="text-lg font-bold text-ink-900">Dokumentum feltöltése</h1>
      <p className="text-sm text-ink-500">
        Fotózd le a fuvarlevelet vagy a szállítólevelet — az admin fogja feldolgozni és
        fuvart készíteni belőle.
      </p>
      <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-white py-8 text-center shadow-soft">
        <PiCameraLight className="h-8 w-8 text-brand-600" />
        <span className="text-sm font-semibold text-ink-700">
          {uploading ? "Feltöltés..." : "Fotó készítése / kiválasztása"}
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Add the route to `User.js`**

Add near the other `React.lazy()` declarations:
```javascript
const DokumentumFeltoltes = React.lazy(() => import("views/user/DokumentumFeltoltes.js"));
```

Add near the other `<PrivateRoute>` entries:
```jsx
<PrivateRoute path="/user/dokumentum-feltoltes" exact component={DokumentumFeltoltes} />
```

- [ ] **Step 3: Add a Dashboard quick-action tile**

In `src/views/user/Dashboard.js`, add `PiCameraLight` to the `react-icons/pi` import block, and add a new entry to the `quickActions` array (after the "Tankolás" entry):
```javascript
{
  to: "/user/dokumentum-feltoltes",
  icon: PiCameraLight,
  label: "Dokumentum",
  tone: "brand",
},
```

- [ ] **Step 4: Live-verify as a driver**

Seed a driver session per `CLAUDE.md`'s documented pattern (a real `sessions` row with `felhasznalo_tipus='sofor'`, `sessionStorage`/`localStorage` populated with a real `user` row shape). Navigate to `/user/dashboard`, confirm the new "Dokumentum" tile appears in "Gyors műveletek", tap it, confirm `/user/dokumentum-feltoltes` renders, upload one of the two real sample images, confirm a success toast and redirect back to the dashboard. Then, as admin, confirm the new document appears in `/admin/beerkezettDokumentumok` with `feltolto_tipus='sofor'`/the driver's name — verify directly in the DB if the admin UI doesn't surface `feltolto_nev`: `mysql -uroot kamion -e "SELECT id, feltolto_tipus, feltolto_nev FROM beerkezett_dokumentumok ORDER BY id DESC LIMIT 1;"`.

- [ ] **Step 5: Commit**

```bash
git add src/views/user/DokumentumFeltoltes.js src/layouts/User.js src/views/user/Dashboard.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add driver-facing document upload (camera capture)

Upload-only, no inbox visibility for the driver (per design spec
scope decision) — same capture="environment" pattern as
Tankolas.js/BejelentesUj.js. Verified live end-to-end: driver upload
shows up in the admin inbox with the correct feltolto_tipus/nev.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Full end-to-end pass + `CLAUDE.md` update

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1-15.

- [ ] **Step 1: Run the complete golden path once, start to finish, as both roles**

As a driver: upload the fuvarlevél sample via `/user/dokumentum-feltoltes`.
As admin: open `/admin/beerkezettDokumentumok`, confirm the driver's upload appears (OCR'd), also upload the szállítólevél sample directly from the admin inbox page. Create a fuvar from the driver-uploaded fuvarlevél via "Fuvar létrehozása", adjusting any fields the OCR got wrong (per the design spec's documented plate-number variance) before saving. Navigate to `/admin/fuvarok`, confirm the new fuvar is listed, search for it by felrakó text, sort by "Teljesítés" both directions, edit it and change `allapot` through a couple of states, delete a throwaway test fuvar and confirm it disappears from the list. Confirm dark mode renders all three new pages (`BeerkezettDokumentumok.js`/`Fuvarok.js`/`FuvarForm.js`) without unstyled/white-on-white regions (toggle dark mode from the Sidebar, per the existing R16 convention).

- [ ] **Step 2: Clean up all test data created across every task's verification**

```bash
mysql -uroot kamion -e "DELETE FROM sessions WHERE token='teszt-token-cegnev';"
mysql -uroot kamion -e "SELECT id, felrako, lerako FROM fuvarok WHERE felrako LIKE 'Teszt%' OR felrako IS NULL;"
```
Review that output and delete anything that's clearly throwaway test data from this plan's verification steps (leave any real data the golden-path pass in Step 1 intentionally created, if you want to keep it as a demo record — otherwise clean that up too). Also confirm `admin.name`/`email`/`phone` for the account used in Task 3's curl test still hold real values, not the placeholder `"Teszt Admin"`/`"teszt@example.com"` — fix via the Settings UI if needed.

- [ ] **Step 3: Update `CLAUDE.md`**

Add a new dated section (following the file's existing convention — see how the "Tachográf kártya (.ddd) import" and "Fájlok — központi fájlkezelővé bővítés" sections are structured) summarizing: the new `beerkezett_dokumentumok`/`fuvarok` tables and their relationship, the Gemini OCR integration (model, cost/quota tradeoff, graceful-degradation-on-failure behavior, the own-company-name disambiguation requirement and why), the `letrehozFuvarDokumentumbol` fajlok-reparenting mechanism, the new `AutocompleteSelect` component (noting it's the first of its kind in the codebase — future entity pickers should reuse it instead of a plain `<select>`), and explicitly cross-reference `docs/superpowers/specs/2026-07-25-fuvar-dokumentum-ocr-design.md` for the full design rationale plus a pointer that this is sub-project 1 of 7 (Számlázz.hu/NAV/bank/dashboards/search still to come).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document the fuvar-document OCR + fuvar module in CLAUDE.md

First of 7 planned sub-projects for the freight-management overhaul.
Full end-to-end golden path (driver upload → admin OCR review → fuvar
creation → list/search/sort/status) verified live, both roles, both
sample documents, dark mode checked.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
