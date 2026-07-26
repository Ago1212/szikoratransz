# Sofőr dokumentum-feltöltési előzmény + Dashboard átrendezés Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the driver (sofőr) visibility into which documents they've already uploaded (fuvarlevél/szállítólevél), make the "Dokumentum feltöltése" flow visually prominent on the driver Dashboard, and de-emphasize the "Legutóbbi bejelentéseim" section on the same page.

**Architecture:** Two new sofőr-scoped backend actions (list own uploads with a deliberately narrow field set, delete an own not-yet-linked-to-a-fuvar upload), reusing the existing `beerkezett_dokumentumok` table and the existing `downloadFile` action for thumbnails. Two frontend changes: a new "Korábbi feltöltéseim" list appended to the existing upload page, and a Dashboard reshuffle (new featured card, quick-actions tile removed, bejelentések section shrunk).

**Tech Stack:** PHP 8.2 (no framework, no composer deps), PDO/MySQL, React 17 (CRA), Tailwind (pre-built `tailwind.css`, no template literals in class names), `react-icons/pi`.

## Global Constraints

- No JOIN, no UNION in any SQL query (project's own SQL linter forbids both) — resolve related data (filenames, categories) via a separate `SELECT ... IN (...)` + PHP-side merge, exactly like `fajlnevekFeloldasa()`/`soforNevekFeloldasa()` already do in this file.
- Never trust a client-submitted `sofor_id`/`ceg_id` — always resolve identity server-side via `resolveSajatSoforId($request)` / `resolveSajatCegId($request)`.
- The sofőr must never receive `ocr_adatok`, `fuvar_id`, or `hozzarendelt_sofor_id` from any new action — only a derived `torolheto` boolean.
- After any Tailwind class change, rebuild `tailwind.css` (`npm run build:tailwind`) before visual verification — new utility classes are invisible until this runs.
- Verify every change by actually running it (local PHP server + CRA dev server + a real `sofor`-type session row inserted into the local `sessions`/`user` tables), per this repo's workflow rule — no unit test suite exists for this project (PHP has no test framework, `npm test` has no test files), so "run the test" in this plan means live curl/PHP-CLI/Playwright verification, not `pytest`/`jest`.
- Follow existing code style exactly: Hungarian identifiers/comments matching the surrounding file, no comments explaining *what* the code does (only non-obvious *why*), no new abstractions beyond what's needed.

---

## File Structure

- Modify: `backend/interface/beerkezettDokumentumInterface.php` — add `getSajatDokumentumok()`, `torolSajat()`, `fajlMetaFeloldasa()`.
- Modify: `backend/ApiHandler.php` — add 2 `getActions()` entries + 2 `process()` cases.
- Modify: `src/views/user/DokumentumFeltoltes.js` — add "Korábbi feltöltéseim" history list with thumbnails, status, delete.
- Modify: `src/views/user/Dashboard.js` — remove "Dokumentum" quick-action tile, add featured document card, shrink "Legutóbbi bejelentéseim" section.

No new files are created — both frontend changes fit naturally into existing, already-focused files (`DokumentumFeltoltes.js` is a single-purpose upload page; the new list is part of the same purpose. `Dashboard.js` is already a flat composition of small sections).

---

### Task 1: Backend — sofőr-scoped list + delete methods

**Files:**
- Modify: `backend/interface/beerkezettDokumentumInterface.php:439-441` (insert new methods between the end of `updateTipus()` at line 440 and the class-closing `}` at line 441)

**Interfaces:**
- Consumes: existing `$this->db` (PDO connection, set in constructor), existing table `beerkezett_dokumentumok` (columns: `id`, `admin`, `fajl_id`, `tipus`, `ocr_allapot`, `letrehozva`, `feltolto_tipus`, `feltolto_id`, `fuvar_id`, `torolt`), existing table `fajlok` (columns: `sorszam`, `filename`, `fajl_kategoria`).
- Produces (for Task 2 to call):
  - `getSajatDokumentumok($soforId, $cegId, $limit = null)` → `['success' => true, 'dokumentumok' => [ ['id', 'fajl_id', 'tipus', 'ocr_allapot', 'letrehozva', 'torolheto' (bool), 'filename', 'fajl_kategoria'], ... ]]`
  - `torolSajat($id, $soforId, $cegId)` → `['success' => bool, 'message' => string]`

- [ ] **Step 1: Add the methods**

Insert after line 440 (`    }` closing `updateTipus`), before line 441 (`}` closing the class):

```php

    // Ugyanaz a minta, mint `fajlnevekFeloldasa()`, de a fájlnév mellett a
    // `fajl_kategoria`-t is visszaadja — a sofőr-oldali lista ez alapján dönti
    // el, mutasson-e kép-előnézetet vagy egy egyszerű dokumentum-ikont.
    private function fajlMetaFeloldasa($fajlIdk) {
        $fajlIdk = array_values(array_unique(array_filter($fajlIdk)));
        if (empty($fajlIdk)) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($fajlIdk), '?'));
        $stmt = $this->db->prepare("SELECT sorszam, filename, fajl_kategoria FROM fajlok WHERE sorszam IN ($placeholders)");
        $stmt->execute($fajlIdk);
        $meta = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $meta[$row['sorszam']] = ['filename' => $row['filename'], 'fajl_kategoria' => $row['fajl_kategoria']];
        }
        return $meta;
    }

    // Sofőr-oldali, SZŰKÍTETT mezőkészletű lekérdezés — a sofőr csak saját
    // feltöltéseit látja (feltolto_tipus='sofor' AND feltolto_id=:sofor_id),
    // és SOSEM kapja meg az `ocr_adatok`/`fuvar_id`/`hozzarendelt_sofor_id`
    // mezőket — csak egy szerver-oldalon számolt `torolheto` boolean-t
    // (fuvar_id IS NULL), hogy a frontend eldönthesse, mutasson-e törlés
    // gombot, anélkül hogy magát a fuvar-összekapcsolást ismerné.
    public function getSajatDokumentumok($soforId, $cegId, $limit = null) {
        $query = "SELECT bd.id, bd.fajl_id, bd.tipus, bd.ocr_allapot, bd.letrehozva,
                         (bd.fuvar_id IS NULL) AS torolheto
                  FROM beerkezett_dokumentumok bd
                  WHERE bd.admin = :admin AND bd.feltolto_tipus = 'sofor' AND bd.feltolto_id = :sofor_id
                        AND bd.torolt <> 'I'
                  ORDER BY bd.letrehozva DESC";
        if ($limit !== null) {
            $query .= " LIMIT " . (int) $limit;
        }
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':admin', $cegId, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $soforId, PDO::PARAM_INT);
        $stmt->execute();
        $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $fajlMeta = $this->fajlMetaFeloldasa(array_column($sorok, 'fajl_id'));
        foreach ($sorok as &$sor) {
            $sor['torolheto'] = (bool) $sor['torolheto'];
            $meta = $fajlMeta[$sor['fajl_id']] ?? null;
            $sor['filename'] = $meta['filename'] ?? null;
            $sor['fajl_kategoria'] = $meta['fajl_kategoria'] ?? null;
        }
        unset($sor);

        return ['success' => true, 'dokumentumok' => $sorok];
    }

    // Sofőr-oldali törlés — a `torol()`-tól (admin-oldali) elkülönítve: itt a
    // tulajdonjogot (feltolto_tipus='sofor' AND feltolto_id=$soforId) IS
    // ellenőrizzük, nem csak a `fuvar_id IS NULL` állapotot — egy sofőr csak
    // a SAJÁT feltöltését törölheti, nem a cég bármelyik dokumentumát.
    public function torolSajat($id, $soforId, $cegId) {
        $stmt = $this->db->prepare(
            "SELECT fuvar_id FROM beerkezett_dokumentumok
             WHERE id = :id AND admin = :admin AND feltolto_tipus = 'sofor' AND feltolto_id = :sofor_id AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $cegId, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $soforId, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($sor === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }
        if (!empty($sor['fuvar_id'])) {
            return ['success' => false, 'message' => 'Ez a dokumentum már fuvarrá lett alakítva, nem törölhető.'];
        }

        $update = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok SET torolt = 'I' WHERE id = :id AND admin = :admin"
        );
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':admin', $cegId, PDO::PARAM_INT);
        $update->execute();
        return ['success' => true, 'message' => 'Dokumentum törölve.'];
    }
```

- [ ] **Step 2: Lint the file**

Run: `php8.2 -l backend/interface/beerkezettDokumentumInterface.php`
Expected: `No syntax errors detected in backend/interface/beerkezettDokumentumInterface.php`

- [ ] **Step 3: Verify against the live local DB with a throwaway PHP CLI script**

Create a scratch script (not committed) to exercise the two new methods directly, using the already-running local MariaDB (`kamion` DB, `mysql -uroot kamion` works passwordless on this machine per the CLAUDE.md "Local dev environment" note). From `backend/`:

```bash
cd backend && php8.2 -r '
require "db.php";
require "interface/filesInterface.php";
$filesInterface = new FilesInterface();
require "interface/beerkezettDokumentumInterface.php";

// egy valós céghez/sofőrhöz kell kötni a teszt-sort — cseréld le a WHERE-t
// egy ténylegesen létező admin/user párra a helyi DB-ben, pl.:
$db = (new Database())->connect();
$admin = $db->query("SELECT id FROM admin WHERE torolt <> \"I\" LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$sofor = $db->query("SELECT id FROM user WHERE admin = " . (int)$admin["id"] . " AND torolt <> \"I\" LIMIT 1")->fetch(PDO::FETCH_ASSOC);
if (!$sofor) { echo "Nincs teszt-sofőr ehhez a céghez, hozz létre egyet előbb.\n"; exit(1); }

$fajlId = $filesInterface->fileUpload($admin["id"], "beerkezett_dokumentum", $admin["id"], base64_encode("teszt-tartalom"), "teszt.jpg", 14, null, "sofor", $sofor["id"], "Teszt Sofőr")["id"];
$db->prepare("INSERT INTO beerkezett_dokumentumok (admin, fajl_id, tipus, ocr_allapot, feltolto_tipus, feltolto_id, feltolto_nev) VALUES (?, ?, ?, ?, ?, ?, ?)")
   ->execute([$admin["id"], $fajlId, "ismeretlen", "kesz", "sofor", $sofor["id"], "Teszt Sofőr"]);
$ujId = $db->lastInsertId();

$lista = $beerkezettDokumentumInterface->getSajatDokumentumok($sofor["id"], $admin["id"]);
echo "Lista: " . json_encode($lista) . "\n";

$torles = $beerkezettDokumentumInterface->torolSajat($ujId, $sofor["id"], $admin["id"]);
echo "Törlés: " . json_encode($torles) . "\n";

$masodikTorles = $beerkezettDokumentumInterface->torolSajat($ujId, $sofor["id"], $admin["id"]);
echo "Ismételt törlés (már torolt): " . json_encode($masodikTorles) . "\n";

// takarítás
$db->prepare("DELETE FROM beerkezett_dokumentumok WHERE id = ?")->execute([$ujId]);
$db->prepare("DELETE FROM fajlok WHERE sorszam = ?")->execute([$fajlId]);
'
```

Expected output:
- `Lista: {"success":true,"dokumentumok":[{"id":...,"fajl_id":...,"tipus":"ismeretlen","ocr_allapot":"kesz","letrehozva":"...","torolheto":true,"filename":"teszt.jpg","fajl_kategoria":"kep"}]}`
- `Törlés: {"success":true,"message":"Dokumentum törölve."}`
- `Ismételt törlés (már torolt): {"success":false,"message":"A dokumentum nem található."}` (the row's `torolt` is now `'I'`, so the ownership-check SELECT no longer matches it)

- [ ] **Step 4: Commit**

```bash
git add backend/interface/beerkezettDokumentumInterface.php
git commit -m "$(cat <<'EOF'
feat: add sofőr-scoped list/delete methods for own uploaded documents

EOF
)"
```

---

### Task 2: Backend — wire the two new actions into ApiHandler

**Files:**
- Modify: `backend/ApiHandler.php:370` (insert 2 lines into `getActions()` right after the `torolBeerkezettDokumentum` entry)
- Modify: `backend/ApiHandler.php:1721` (insert 2 new `case` blocks into `process()` right after the `torolBeerkezettDokumentum` case's `return;`, before `case 'newFuvar':`)

**Interfaces:**
- Consumes: `BeerkezettDokumentumInterface::getSajatDokumentumok($soforId, $cegId, $limit)` and `::torolSajat($id, $soforId, $cegId)` from Task 1; existing private methods `$this->resolveSajatSoforId($request)` and `$this->resolveSajatCegId($request)` (already defined in this file at lines ~601 and ~614); the existing global `$beerkezettDokumentumInterface` instance (already in the `global` list at line 715).
- Produces (for Task 3/4 to call): two new POST actions —
  - `getSajatBeerkezettDokumentumok` — payload `{ sofor_id, limit? }` (payload `sofor_id` is required-shape only, ignored server-side), response `{ success, dokumentumok: [...] }` matching Task 1's shape.
  - `torolSajatBeerkezettDokumentum` — payload `{ id, sofor_id }`, response `{ success, message }`.

- [ ] **Step 1: Add the two `getActions()` entries**

In `backend/ApiHandler.php`, find:

```php
            'torolBeerkezettDokumentum' => ['id', 'ceg_id'],
```

Change to:

```php
            'torolBeerkezettDokumentum' => ['id', 'ceg_id'],
            'getSajatBeerkezettDokumentumok' => ['sofor_id'],
            'torolSajatBeerkezettDokumentum' => ['id', 'sofor_id'],
```

- [ ] **Step 2: Add the two `process()` cases**

Find:

```php
                case 'torolBeerkezettDokumentum':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $beerkezettDokumentumInterface->torol($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'beerkezett_dokumentumok', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'newFuvar':
```

Change to:

```php
                case 'torolBeerkezettDokumentum':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $beerkezettDokumentumInterface->torol($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'beerkezett_dokumentumok', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getSajatBeerkezettDokumentumok':
                    // Sofőr-önkiszolgáló akció (ld. getBejelentesekSofor
                    // mintáját) — nincs MODULE_PERMISSION_MAP-bejegyzése,
                    // mert nem admin-konfigurálható modul-jogosultság alá
                    // tartozik, a sofőr mindig látja a SAJÁT feltöltéseit.
                    echo json_encode($beerkezettDokumentumInterface->getSajatDokumentumok(
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request),
                        $request['limit'] ?? null
                    ));
                    return;
                case 'torolSajatBeerkezettDokumentum':
                    echo json_encode($beerkezettDokumentumInterface->torolSajat(
                        $request['id'],
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request)
                    ));
                    return;
                case 'newFuvar':
```

- [ ] **Step 3: Lint the file**

Run: `php8.2 -l backend/ApiHandler.php`
Expected: `No syntax errors detected in backend/ApiHandler.php`

- [ ] **Step 4: Start the local PHP server (if not already running) and verify live via curl with a real sofőr session**

```bash
cd backend && php8.2 -S localhost:8001 &
```

Insert a real `sofor`-type session for a driver that already exists in the local DB (adjust the `felhasznalo_id`/`admin_id` to a real row — reuse the same `admin`/`user` pair queried in Task 1, or find one via `mysql -uroot kamion -e "SELECT id, admin FROM user WHERE torolt<>'I' LIMIT 1"`):

```bash
mysql -uroot kamion -e "
INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, letrehozva, lejarat)
VALUES ('teszt-sofor-token-12345', 'sofor', <SOFOR_ID>, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY))"
```

Then (the app's hardcoded `authHash` is `nIrINP&o!PU|+pM*Q8'j1R07U57W,qD`, per `src/utils/fetchAction.js`):

```bash
curl -s -X POST http://localhost:8001/api.php -H 'Content-Type: application/json' -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "action": "getSajatBeerkezettDokumentumok",
  "sofor_id": <SOFOR_ID>,
  "sessionToken": "teszt-sofor-token-12345"
}'
```

Expected: `{"success":true,"dokumentumok":[]}` (or existing rows if the driver already has uploads) — confirms the action resolves correctly end-to-end through session validation, not just in isolation like Task 1's script.

Clean up the test session afterward:

```bash
mysql -uroot kamion -e "DELETE FROM sessions WHERE token = 'teszt-sofor-token-12345'"
```

- [ ] **Step 5: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat: wire getSajatBeerkezettDokumentumok/torolSajatBeerkezettDokumentum actions

EOF
)"
```

---

### Task 3: Frontend — upload history list on `DokumentumFeltoltes.js`

**Files:**
- Modify: `src/views/user/DokumentumFeltoltes.js` (full rewrite of the component body — the file is currently 85 lines, single-purpose, stays single-purpose)

**Interfaces:**
- Consumes: `fetchAction("getSajatBeerkezettDokumentumok", { sofor_id, limit? })` and `fetchAction("torolSajatBeerkezettDokumentum", { id, sofor_id })` from Task 2; `fetchAction("downloadFile", { id })` (existing action, returns `{ success, mime, file (base64) }`, already used this way in `src/components/Fajlok/FajlGrid.js:32-38`); `confirmDialog` from `utils/confirm.js` (existing, `confirmDialog(message, { danger, confirmLabel })` → `Promise<boolean>`); `StatusBadge` from `components/UI/StatusBadge.js` (existing, `tone` + `children` props, tones: `success`/`warning`/`danger`/`info`/`neutral`); `toast` from `utils/toast.js` (existing, already used in this file).
- Produces: nothing new consumed by other tasks — this is a leaf page.

- [ ] **Step 1: Write the updated component**

Replace the full contents of `src/views/user/DokumentumFeltoltes.js`:

```javascript
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiCameraLight,
  PiFilePdfLight,
  PiTrashLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";
import { confirmDialog } from "utils/confirm.js";
import MobileHeader from "components/UI/MobileHeader.js";
import StatusBadge from "components/UI/StatusBadge.js";

// Sofőr-oldali, kizárólag feltöltésre szolgáló oldal — a sofőr lefotózza a
// fuvarlevelet/szállítólevelet, ez bekerül az admin-oldali "Beérkezett
// dokumentumok" inboxba (Task 12) OCR-feldolgozásra/fuvar-létrehozásra.
// A sofőrnek magának NINCS betekintése az inboxba/az OCR eredményébe —
// ez szándékos hatókör-döntés (ld. a terv), nem hiányzó funkció. A saját
// feltöltési ELŐZMÉNY (ld. lentebb) ettől független: csak azt mutatja meg,
// mit töltött fel és hol tart a feldolgozásban, az OCR-eredményt magát nem.
//
// `user.admin`/`user.id` — NEM `user.ceg_id` — ugyanaz a sofőr-munkamenet
// mezőnév-minta, mint amit Tankolas.js/BejelentesUj.js is használ: a
// driver-oldali `user` objektum `admin`-t (a tulajdonos cég admin.id-ja)
// és `id`-t (a sofőr saját user.id-ja) hordoz, `ceg_id` mezőt nem.

const OCR_STATUSZ_TONE = { feldolgozatlan: "info", kesz: "success", hiba: "danger" };
const OCR_STATUSZ_LABEL = {
  feldolgozatlan: "Feldolgozás alatt",
  kesz: "Feldolgozva",
  hiba: "Hiba – admin pótolja",
};

function DokumentumSor({ dokumentum, onDeleted }) {
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbHiba, setThumbHiba] = useState(false);
  const [torles, setTorles] = useState(false);
  const isKep = dokumentum.fajl_kategoria === "kep";
  const rowRef = useRef(null);

  useEffect(() => {
    if (!isKep || thumbSrc || thumbHiba) return undefined;
    const node = rowRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        fetchAction("downloadFile", { id: dokumentum.fajl_id })
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
  }, [isKep, dokumentum.fajl_id]);

  const handleDelete = async () => {
    const ok = await confirmDialog(
      `Biztosan törlöd a(z) "${dokumentum.filename || "dokumentum"}" feltöltést?`,
      { confirmLabel: "Törlés" },
    );
    if (!ok) return;
    setTorles(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("torolSajatBeerkezettDokumentum", {
      id: dokumentum.id,
      sofor_id: user.id,
    });
    if (result?.success) {
      toast.success("Dokumentum törölve.");
      onDeleted(dokumentum.id);
    } else {
      toast.error(result?.message || "A törlés sikertelen.");
      setTorles(false);
    }
  };

  return (
    <div
      ref={rowRef}
      className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-soft"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-50">
        {isKep && thumbSrc ? (
          <img src={thumbSrc} alt={dokumentum.filename || "dokumentum előnézet"} className="h-full w-full object-cover" />
        ) : (
          <PiFilePdfLight className="h-6 w-6 text-ink-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">
          {dokumentum.filename || "Dokumentum"}
        </p>
        <p className="text-xs text-ink-400">
          {(dokumentum.letrehozva || "").slice(0, 16).replace("T", " ")}
        </p>
      </div>
      <StatusBadge tone={OCR_STATUSZ_TONE[dokumentum.ocr_allapot] || "neutral"}>
        {OCR_STATUSZ_LABEL[dokumentum.ocr_allapot] || dokumentum.ocr_allapot}
      </StatusBadge>
      {dokumentum.torolheto && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={torles}
          aria-label="Dokumentum törlése"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <PiTrashLight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function DokumentumFeltoltes() {
  const history = useHistory();
  const [uploading, setUploading] = useState(false);
  const [elozmeny, setElozmeny] = useState([]);
  const [elozmenyBetoltve, setElozmenyBetoltve] = useState(false);

  const betoltElozmeny = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getSajatBeerkezettDokumentumok", {
      sofor_id: user.id,
    });
    if (result?.success) setElozmeny(result.dokumentumok || []);
    setElozmenyBetoltve(true);
  }, []);

  useEffect(() => {
    betoltElozmeny();
  }, [betoltElozmeny]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const user = JSON.parse(localStorage.getItem("user"));
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
        betoltElozmeny();
      } else {
        toast.error(result?.message || "A feltöltés sikertelen.");
      }
    } catch (err) {
      toast.error(err.message || "A feltöltés sikertelen.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleted = (id) => {
    setElozmeny((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <MobileHeader title="Dokumentum feltöltése" />

      <p className="text-sm text-ink-500">
        Fotózd le a fuvarlevelet vagy a szállítólevelet — az admin fogja feldolgozni és
        fuvart készíteni belőle.
      </p>

      <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-white py-8 text-center shadow-soft">
        {uploading ? (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        ) : (
          <PiCameraLight className="h-8 w-8 text-brand-600" />
        )}
        <span className="text-sm font-semibold text-ink-700">
          {uploading ? "Feldolgozás folyamatban…" : "Fotó készítése / kiválasztása"}
        </span>
        {/* A feltöltés maga gyors, de a szerver ezután egy Gemini OCR-hívást
            futtat a képen (dokumentáltan ~3-13 másodperc, néha több egy
            rate-limit-retry miatt) — enélkül a szöveg nélkül a sofőr úgy
            látná, mintha a feltöltés elakadt volna. */}
        {uploading && <span className="text-xs text-ink-400">Ez néhány másodpercig eltarthat, ne zárd be az oldalt.</span>}
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />
      </label>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Korábbi feltöltéseim
        </h2>
        {!elozmenyBetoltve ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-center text-sm text-ink-400 shadow-soft">
            Betöltés…
          </div>
        ) : elozmeny.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-center text-sm text-ink-400 shadow-soft">
            Még nincs feltöltött dokumentumod.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {elozmeny.map((d) => (
              <DokumentumSor key={d.id} dokumentum={d} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify live with Playwright, using a real sofőr session**

Ensure the CRA dev server is running (`npm start`, reuse if already running per this repo's convention — see the "Local dev environment" CLAUDE.md note) and the PHP server from Task 2 Step 4 is up. Insert a real `sofor`-session row into `sessions` (same pattern as Task 2 Step 4), then drive a browser to `/user/dokumentum-feltoltes` with `localStorage` seeded (`user` = the full driver row shape, `sessionToken` = the session's token — mirror what `Login.js` stores).

Concretely, using the `mcp__plugin_playwright_playwright__browser_navigate`/`browser_evaluate`/`browser_click`/`browser_file_upload` tools (or an equivalent local Playwright script):
1. Navigate to `http://localhost:3000/user/dokumentum-feltoltes`.
2. `browser_evaluate` to set `localStorage.setItem('user', JSON.stringify({...real user row...}))` and `localStorage.setItem('sessionToken', 'teszt-sofor-token-12345')`, then reload.
3. Confirm "Még nincs feltöltött dokumentumod." renders (empty state) if the test driver has no prior uploads.
4. Use `browser_file_upload` to upload a small real JPEG through the file input, wait for the "Dokumentum feltöltve…" toast.
5. Confirm a new row appears under "Korábbi feltöltéseim" with a thumbnail (once scrolled into view) and a status badge, and a delete (trash) button.
6. Click the delete button, confirm the `confirmDialog` modal appears, click "Törlés", confirm the row disappears and a "Dokumentum törölve." toast shows.
7. Take a screenshot to confirm no visual breakage.

Expected: all of the above happen without console errors; clean up the test session and any leftover `beerkezett_dokumentumok`/`fajlok` DB rows/files afterward.

- [ ] **Step 3: Commit**

```bash
git add src/views/user/DokumentumFeltoltes.js
git commit -m "$(cat <<'EOF'
feat: show sofőr's own document-upload history with thumbnail + delete

EOF
)"
```

---

### Task 4: Frontend — Dashboard reprioritization

**Files:**
- Modify: `src/views/user/Dashboard.js` (full file — remove one quick-action tile, add a new section, shrink another section)

**Interfaces:**
- Consumes: `fetchAction("getSajatBeerkezettDokumentumok", { sofor_id, limit: 3 })` from Task 2; `fetchAction("downloadFile", { id })` (existing, same as Task 3) for the mini-thumbnails; existing `Link` (react-router-dom), existing icons already imported in this file plus `PiCameraLight` (already imported) and `PiFilePdfLight` (new import, same as Task 3).
- Produces: nothing consumed elsewhere — this is the top-level page.

- [ ] **Step 1: Remove the "Dokumentum" tile from `quickActions`**

In `src/views/user/Dashboard.js`, find the `quickActions` array (lines 34-71) and remove this entry (keep the rest — Kamion/Pótkocsi/Furgon/Helyszínek/Tankolás stay):

```javascript
  {
    to: "/user/dokumentum-feltoltes",
    icon: PiCameraLight,
    label: "Dokumentum",
    tone: "brand",
  },
```

Update the comment right above `const quickActions = [` (currently explains why "Bejelentés" isn't in the grid) to also note why "Dokumentum" isn't:

```javascript
// A "Bejelentés" csempe szándékosan NINCS itt — a BottomNav középső,
// mindig piros FAB-ja már ugyanoda vezet, egy második, azonos célú
// csempe a Gyors műveletek rácsban felesleges duplikáció lenne.
// A "Dokumentum" csempe SEM itt van — saját, kiemelt kártyát kapott
// feljebb (ld. a "Dokumentum feltöltése" szekciót), mert ez lett a
// leggyakrabban használt napi művelet; egy második, azonos célú tile itt
// ugyanolyan felesleges duplikáció lenne, mint a Bejelentésé.
const quickActions = [
```

- [ ] **Step 2: Add state + data loading for the featured document card**

In the `useEffect`'s `Promise.all` array (around line 104-122), add a new fetch. Change:

```javascript
      const [
        freshRes,
        kamionRes,
        potkocsiRes,
        furgonRes,
        bejelentesRes,
        adminRes,
        kerelemRes,
        elbiraltRes,
      ] = await Promise.all([
        fetchAction("getSajatSofor", { id: userData.id }),
        fetchAction("getKamionok", { id: userData.admin }),
        fetchAction("getPotkocsik", { id: userData.admin }),
        fetchAction("getFurgonok", { id: userData.admin }),
        fetchAction("getBejelentesekSofor", { sofor_id: userData.id }),
        fetchAction("getAdminElerhetoseg", { id: userData.admin }),
        fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: userData.id }),
        fetchAction("getElbiraltJarmuValtasok", { sofor_id: userData.id }),
      ]);
```

to:

```javascript
      const [
        freshRes,
        kamionRes,
        potkocsiRes,
        furgonRes,
        bejelentesRes,
        adminRes,
        kerelemRes,
        elbiraltRes,
        dokumentumRes,
      ] = await Promise.all([
        fetchAction("getSajatSofor", { id: userData.id }),
        fetchAction("getKamionok", { id: userData.admin }),
        fetchAction("getPotkocsik", { id: userData.admin }),
        fetchAction("getFurgonok", { id: userData.admin }),
        fetchAction("getBejelentesekSofor", { sofor_id: userData.id }),
        fetchAction("getAdminElerhetoseg", { id: userData.admin }),
        fetchAction("getSajatJarmuValtasKerelmek", { sofor_id: userData.id }),
        fetchAction("getElbiraltJarmuValtasok", { sofor_id: userData.id }),
        fetchAction("getSajatBeerkezettDokumentumok", { sofor_id: userData.id, limit: 3 }),
      ]);
```

Add a new state near the other `useState` declarations (line 84-89):

```javascript
  const [legutobbiDokumentumok, setLegutobbiDokumentumok] = useState([]);
```

And, alongside the other `if (...Res?.success) set...` lines (around line 138-141), add:

```javascript
      if (dokumentumRes?.success) setLegutobbiDokumentumok(dokumentumRes.dokumentumok || []);
```

- [ ] **Step 3: Insert the featured "Dokumentum feltöltése" card**

Add a new `PiFilePdfLight` import alongside the existing `react-icons/pi` imports at the top of the file (the existing import block already includes `PiCameraLight`):

```javascript
import {
  PiBellLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
  PiWarningCircleLight,
  PiGasPumpLight,
  PiPhoneLight,
  PiCaretRightLight,
  PiMapPinLight,
  PiCameraLight,
  PiFilePdfLight,
} from "react-icons/pi";
```

Insert the new card between the "Aktív jármű" grid (ends around line 290, `</div>` closing the 3-column grid) and the "Fontos értesítések" block (starts around line 293). Insert this JSX right after that `</div>` and before the `{/* Fontos értesítések */}` comment:

```javascript
      {/* Dokumentum feltöltése — kiemelt, mert ez a leggyakrabban használt
          napi művelet lesz (minden lezárt fuvarnál). Csak a fájl típusát/
          feldolgozási státuszát mutatja, az OCR-eredményt nem — ld.
          DokumentumFeltoltes.js fejléc-kommentje. */}
      <Link
        to="/user/dokumentum-feltoltes"
        className="rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-soft"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-brand-600">
              <PiCameraLight className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-brand-900">
                Dokumentum feltöltése
              </p>
              <p className="text-xs text-brand-700">
                Fuvarlevél vagy szállítólevél lefotózása
              </p>
            </div>
          </div>
          <PiCaretRightLight className="h-5 w-5 flex-shrink-0 text-brand-500" />
        </div>
        {legutobbiDokumentumok.length > 0 && (
          <div className="mt-3 flex gap-2 border-t border-brand-100 pt-3">
            {legutobbiDokumentumok.map((d) => (
              <span
                key={d.id}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
              >
                {d.fajl_kategoria === "kep" ? (
                  <DokumentumMiniElonezet fajlId={d.fajl_id} filename={d.filename} />
                ) : (
                  <PiFilePdfLight className="h-5 w-5 text-ink-400" />
                )}
              </span>
            ))}
          </div>
        )}
      </Link>
```

Add the small helper component (used only by the featured card above) right before `export default function UserDashboard()`:

```javascript
function DokumentumMiniElonezet({ fajlId, filename }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let elve = false;
    fetchAction("downloadFile", { id: fajlId }).then((result) => {
      if (!elve && result?.success && result.mime?.startsWith("image/")) {
        setSrc(`data:${result.mime};base64,${result.file}`);
      }
    });
    return () => {
      elve = true;
    };
  }, [fajlId]);

  if (!src) return <PiFilePdfLight className="h-5 w-5 text-ink-400" />;
  return <img src={src} alt={filename || "dokumentum előnézet"} className="h-full w-full object-cover" />;
}
```

(This mini-card only ever shows up to 3 thumbnails, so it fetches eagerly on mount rather than using the `IntersectionObserver` lazy-load pattern from Task 3 — that pattern exists to protect against long lists, which doesn't apply to a fixed 3-item strip.)

- [ ] **Step 4: Shrink "Legutóbbi bejelentéseim"**

Replace the entire `{/* Legutóbbi bejelentéseim */}` block (from that comment down to its closing `</div>` before the component's final `</div>`) with a lower-emphasis single-row version:

```javascript
      {/* Legutóbbi bejelentéseim — a Dokumentum-kártya feljebb kapta a fő
          hangsúlyt (ld. a terv indoklását), a Bejelentés-funkció maga
          változatlanul elérhető a BottomNav piros FAB-ján és itt, csak
          kevesebb vizuális súllyal, egyetlen összegző sorként. */}
      <Link
        to="/user/bejelentesek"
        className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-soft"
      >
        <span className="text-sm text-ink-500">
          {sajatBejelentesek.length === 0
            ? "Nincs bejelentésed"
            : `${sajatBejelentesek.length} legutóbbi bejelentésed`}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-brand-600">
          Megnyitás
          <PiCaretRightLight className="h-4 w-4" />
        </span>
      </Link>
```

(`sajatBejelentesek` is already loaded and capped at 3 by the existing `setSajatBejelentesek(osszes.slice(0, 3))` call — its length now only feeds this summary count instead of rendering 3 full cards. Leave the data-loading code for `sajatBejelentesek`/`bejelentesValaszolt` untouched, since `bejelentesValaszolt` still feeds the notification-bell dot logic above.)

- [ ] **Step 5: Rebuild Tailwind**

Run: `npm run build:tailwind`
Expected: exits 0, `src/assets/styles/tailwind.css` updated (the new classes used above — `bg-brand-50`, `border-brand-200`, `text-brand-900`, `text-brand-700`, `border-brand-100`, `text-brand-500` — should already exist from other brand-colored elements elsewhere in the app, but rebuild regardless per this repo's standing rule so a genuinely new combination isn't silently missing).

- [ ] **Step 6: Verify live with Playwright**

Using the same seeded `sofor` session as Task 3:
1. Navigate to `http://localhost:3000/user/dashboard`.
2. Confirm the Gyors műveletek grid no longer shows a "Dokumentum" tile (5 tiles instead of 6, plus the optional Diszpécser tile).
3. Confirm the new brand-colored "Dokumentum feltöltése" card renders between the vehicle grid and the "Fontos értesítések"/quick-actions area, and that clicking it navigates to `/user/dokumentum-feltoltes`.
4. If the test driver has ≥1 upload (upload one via Task 3's flow first if needed), confirm its thumbnail/PDF icon shows in the card's mini-strip.
5. Confirm "Legutóbbi bejelentéseim" now renders as a single compact row with a count + "Megnyitás" link, not 3 stacked cards.
6. Take a full-page screenshot to visually confirm no overlap/breakage, and check the browser console for errors.

Expected: all confirmed, no console errors, no visual breakage. Clean up the test session/data afterward.

- [ ] **Step 7: Commit**

```bash
git add src/views/user/Dashboard.js src/assets/styles/tailwind.css
git commit -m "$(cat <<'EOF'
feat: promote document upload to a featured Dashboard card, shrink bejelentések section

EOF
)"
```

---

### Task 5: Update project documentation

**Files:**
- Modify: `CLAUDE.md` (append a short new subsection, following this file's existing style of dated changelog-style entries)

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing (documentation only).

- [ ] **Step 1: Add a new dated subsection**

Append to `CLAUDE.md` (find a natural insertion point near the end of the existing changelog-style sections, e.g. after the most recent dated section) a short entry, following the file's established terse, fact-plus-why style:

```markdown
## Sofőr dokumentum-feltöltési előzmény + Dashboard átrendezés (2026-07-26)

A sofőr eddig csak feltölteni tudott egy fuvarlevelet/szállítólevelet
(`DokumentumFeltoltes.js`), semmilyen betekintése nem volt a saját korábbi
feltöltéseibe. Két új, sofőr-önkiszolgáló backend action
(`getSajatBeerkezettDokumentumok`/`torolSajatBeerkezettDokumentum`,
`beerkezettDokumentumInterface.php::getSajatDokumentumok()`/`torolSajat()`)
egy szigorúan szűkített mezőkészletet ad vissza — a sofőr továbbra sem lát
bele az OCR-eredménybe (`ocr_adatok`) vagy a fuvar-összekapcsolásba
(`fuvar_id`), csak egy szerver-oldalon számolt `torolheto` boolean-t kap,
ami azt jelzi, a dokumentum még nem lett fuvarrá alakítva. Egy sofőr csak a
SAJÁT (`feltolto_tipus='sofor' AND feltolto_id=<saját id>`) feltöltéseit
törölheti, és csak addig, amíg `fuvar_id IS NULL`.

A Dashboardon (`Dashboard.js`) a "Dokumentum" csempe kikerült a Gyors
műveletek rácsból, helyette egy kiemelt, brand-színű kártyát kapott (a
legutóbbi 3 feltöltés mini-előnézetével) — mert ez lett a leggyakrabban
használt napi művelet. A "Legutóbbi bejelentéseim" szekció cserébe egy
alacsonyabb vizuális súlyú, egysoros összegzésre zsugorodott (darabszám +
"Megnyitás" link, 3 teljes kártya helyett). **A BottomNav piros
"Bejelentés" FAB-ja szándékosan változatlan maradt** — annak vészhelyzeti
egykezes-elérés indoka továbbra is érvényes, ez a változtatás kizárólag a
Kezdőlap belső elrendezésére korlátozódik.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document sofőr document-upload history + Dashboard reprioritization

EOF
)"
```
