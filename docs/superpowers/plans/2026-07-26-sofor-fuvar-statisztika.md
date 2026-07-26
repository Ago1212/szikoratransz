# Sofőrönkénti fuvar/dokumentum statisztika + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new, standalone "Statisztikák" page under the Fuvarok sidebar group — sofőrönkénti
fuvar/dokumentum-linkeltség bontás, KPI-kártyák, 3 Chart.js grafikon (trend/állapot-megoszlás/top
sofőrök), és szűrők (sofőr, dátumtartomány, fuvar-állapot, dokumentum-állapot). A meglévő Fuvarok
és Beérkezett dokumentumok nézetek nem változnak.

**Architecture:** Egyetlen új `FuvarInterface::getSoforDashboard()` metódus (a meglévő,
használaton kívüli `getStatisztikak()`/`getFigyelmeztetesek()` érintetlenül hagyva), egyetlen új
akció, és egyetlen új frontend oldal (`src/views/admin/FuvarStatisztika.js`), aminek a 3
grafikonja helyi (fájlon belüli) komponens, a már telepített Chart.js v2.9.4-et használva —
ugyanaz a minta, mint a Pénzforgalom `CashflowChart`-ja.

**Tech Stack:** PHP 8.2 (no framework), PDO/MySQL, React 17, Chart.js v2.9.4 (vanília API, NEM
`react-chartjs-2`).

## Global Constraints

- Nincs új npm/composer függőség.
- Minden új PHP-lekérdezés `admin = :ceg_id`-vel szűkít (`resolveKerelmezo()['ceg_id']`,
  szerver-oldalon feloldva) és `torolt <> 'I'`-t is figyelembe vesz, ahol releváns.
- Minden új akció 3 ponton köttetik be `backend/ApiHandler.php`-ban: `getActions()`,
  `process()` `case`, `MODULE_PERMISSION_MAP` — ez a projekt CLAUDE.md-je szerint a
  leggyakrabban elfelejtett lépés.
- Új Tailwind osztály esetén `npm run build:tailwind` a böngészős ellenőrzés előtt.
- Nincs automata teszt-keretrendszer — minden "teszt" élő ellenőrzés: `php8.2 -l` minden
  módosított PHP-fájlon, `curl`/`mysql` a helyi API-n (`php8.2 -S localhost:8001` a
  `backend/`-ből), és/vagy valódi böngésző-ellenőrzés.
- **A meglévő `getStatisztikak()`/`getFigyelmeztetesek()` metódusokhoz és a
  `Fuvarok.js`/`BeerkezettDokumentumok.js` fájlokhoz ez a terv NEM nyúl.**
- Chart.js v2 API — `type: 'horizontalBar'` (nem v3+ `indexAxis`), `legend.labels.fontColor`
  (nem `font.color`), `scales.xAxes`/`yAxes` tömbök (nem `scales.x`/`scales.y` objektum).

---

### Task 1: `FuvarInterface::getSoforDashboard()` — backend aggregáció

**Files:**
- Modify: `backend/interface/fuvarInterface.php`

**Interfaces:**
- Produces: `getSoforDashboard($ceg_id, $datumTol, $datumIg, $soforId, $fuvarAllapot,
  $dokumentumSzuro, $granularitas)` → `{success, osszesito: {...}, soforonkent: [...],
  allapotMegoszlas: {...}, trend: [...]}`.

- [ ] **Step 1: Add the method**

Add at the end of the class, right before the closing `}` (after `getFigyelmeztetesek()`):

```php
    const TREND_GRANULARITAS = ['nap', 'het', 'honap'];

    // Sofőrönkénti fuvar/dokumentum-linkeltség + trend, egyetlen szűrt
    // SELECT-ből, PHP-oldali aggregációval (ld. getStatisztikak() ugyanezen
    // mintája) — a "dokumentált"/"hiányzó" a fuvarok.beerkezett_dokumentum_id
    // oszlopra épül (a Fuvarok/Beérkezett dokumentumok UX-redesign vezette
    // be), NEM a beerkezett_dokumentumok.feltolto_id-ra (ami a feltöltőt,
    // nem a fuvart végző sofőrt jelentené — ld. a design spec 2. pontja).
    public function getSoforDashboard(
        $ceg_id,
        $datumTol = null,
        $datumIg = null,
        $soforId = null,
        $fuvarAllapot = null,
        $dokumentumSzuro = null,
        $granularitas = null
    ) {
        $params = [':admin' => $ceg_id];
        $query = "SELECT id, sofor_id, teljesites_datuma, allapot, beerkezett_dokumentum_id,
                         fuvardij, egyeb_koltseg
                  FROM fuvarok WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($datumTol)) {
            $query .= " AND teljesites_datuma >= :datum_tol";
            $params[':datum_tol'] = $datumTol;
        }
        if (!empty($datumIg)) {
            $query .= " AND teljesites_datuma <= :datum_ig";
            $params[':datum_ig'] = $datumIg;
        }
        if (!empty($soforId)) {
            $query .= " AND sofor_id = :sofor_id";
            $params[':sofor_id'] = $soforId;
        }
        if (!empty($fuvarAllapot)) {
            $query .= " AND allapot = :allapot";
            $params[':allapot'] = $fuvarAllapot;
        }
        if ($dokumentumSzuro === 'van') {
            $query .= " AND beerkezett_dokumentum_id IS NOT NULL";
        } elseif ($dokumentumSzuro === 'nincs') {
            $query .= " AND beerkezett_dokumentum_id IS NULL";
        }

        $stmt = $this->db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($fuvarok as &$f) {
            $f['osszesen'] = (float) $f['fuvardij'] + (float) ($f['egyeb_koltseg'] ?? 0);
        }
        unset($f);

        $soforNevek = $this->batchLekerdezes('user', 'name', array_column($fuvarok, 'sofor_id'), $ceg_id);

        // 1. Sofőrönkénti bontás
        $soforStat = [];
        $nemHozzarendeltSzama = 0;
        foreach ($fuvarok as $f) {
            if (empty($f['sofor_id'])) {
                $nemHozzarendeltSzama++;
                continue;
            }
            $sid = $f['sofor_id'];
            if (!isset($soforStat[$sid])) {
                $soforStat[$sid] = [
                    'sofor_id' => (int) $sid,
                    'nev' => $soforNevek[$sid] ?? 'Ismeretlen',
                    'fuvarokSzama' => 0,
                    'dokumentaltSzama' => 0,
                    'bevetelOsszesen' => 0.0,
                    'utolsoFuvarDatuma' => null,
                ];
            }
            $soforStat[$sid]['fuvarokSzama']++;
            if (!empty($f['beerkezett_dokumentum_id'])) {
                $soforStat[$sid]['dokumentaltSzama']++;
            }
            $soforStat[$sid]['bevetelOsszesen'] += $f['osszesen'];
            if (
                !empty($f['teljesites_datuma'])
                && ($soforStat[$sid]['utolsoFuvarDatuma'] === null || $f['teljesites_datuma'] > $soforStat[$sid]['utolsoFuvarDatuma'])
            ) {
                $soforStat[$sid]['utolsoFuvarDatuma'] = $f['teljesites_datuma'];
            }
        }
        foreach ($soforStat as &$s) {
            $s['hianyzoSzama'] = $s['fuvarokSzama'] - $s['dokumentaltSzama'];
            $s['bevetelOsszesen'] = round($s['bevetelOsszesen'], 2);
        }
        unset($s);
        $soforStat = array_values($soforStat);
        usort($soforStat, fn($a, $b) => $b['fuvarokSzama'] <=> $a['fuvarokSzama']);

        // 2. Összesítő
        $aktivSoforokSzama = count($soforStat);
        $hozzarendeltFuvarSzama = count($fuvarok) - $nemHozzarendeltSzama;
        $hianyzoDokumentumSzama = 0;
        foreach ($fuvarok as $f) {
            if (empty($f['beerkezett_dokumentum_id'])) {
                $hianyzoDokumentumSzama++;
            }
        }
        $osszesito = [
            'osszesFuvar' => count($fuvarok),
            'aktivSoforokSzama' => $aktivSoforokSzama,
            'hianyzoDokumentumSzama' => $hianyzoDokumentumSzama,
            'atlagFuvarSoforonkent' => $aktivSoforokSzama > 0 ? round($hozzarendeltFuvarSzama / $aktivSoforokSzama, 1) : 0,
            'nemHozzarendeltFuvarSzama' => $nemHozzarendeltSzama,
        ];

        // 3. Állapot-megoszlás
        $allapotMegoszlas = ['rogzitett' => 0, 'szamlazasra_var' => 0, 'szamlazva' => 0, 'fizetesre_var' => 0, 'teljesitve' => 0];
        foreach ($fuvarok as $f) {
            if (isset($allapotMegoszlas[$f['allapot']])) {
                $allapotMegoszlas[$f['allapot']]++;
            }
        }

        // 4. Trend — granularitás: explicit paraméter, vagy a dátumtartomány
        // hossza alapján automatikus választás (≤31 nap: nap, ≤180 nap: hét,
        // egyébként hónap) — ugyanazt a küszöböt a frontend is használja az
        // alapértelmezett gomb-kiválasztáshoz.
        if (!in_array($granularitas, self::TREND_GRANULARITAS, true)) {
            $napokSzama = (!empty($datumTol) && !empty($datumIg))
                ? (strtotime($datumIg) - strtotime($datumTol)) / 86400
                : 9999;
            $granularitas = $napokSzama <= 31 ? 'nap' : ($napokSzama <= 180 ? 'het' : 'honap');
        }
        $trendBucket = [];
        foreach ($fuvarok as $f) {
            if (empty($f['teljesites_datuma'])) {
                continue;
            }
            if ($granularitas === 'nap') {
                $kulcs = $f['teljesites_datuma'];
            } elseif ($granularitas === 'het') {
                $kulcs = date('o-\WW', strtotime($f['teljesites_datuma']));
            } else {
                $kulcs = substr($f['teljesites_datuma'], 0, 7);
            }
            $trendBucket[$kulcs] = ($trendBucket[$kulcs] ?? 0) + 1;
        }
        ksort($trendBucket);
        $trend = [];
        foreach ($trendBucket as $periodus => $szam) {
            $trend[] = ['periodus' => $periodus, 'fuvarokSzama' => $szam];
        }

        return [
            'success' => true,
            'osszesito' => $osszesito,
            'soforonkent' => $soforStat,
            'allapotMegoszlas' => $allapotMegoszlas,
            'trend' => $trend,
            'granularitas' => $granularitas,
        ];
    }
```

- [ ] **Step 2: Lint-check**

Run: `php8.2 -l backend/interface/fuvarInterface.php`
Expected: `No syntax errors detected`.

- [ ] **Step 3: Commit**

```bash
git add backend/interface/fuvarInterface.php
git commit -m "$(cat <<'EOF'
feat(fuvar): add getSoforDashboard — per-driver fuvar/document stats

Filtered, single-query aggregation (date range, sofőr, fuvar/document
status) producing per-driver counts (fuvar/documented/missing, keyed
off the existing fuvarok.beerkezett_dokumentum_id link), a status
breakdown, and a day/week/month trend series — leaves the existing,
unused getStatisztikak()/getFigyelmeztetesek() untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire `getSoforDashboard` into `ApiHandler.php`

**Files:**
- Modify: `backend/ApiHandler.php`

**Interfaces:**
- Produces: action `getSoforDashboard`.

- [ ] **Step 1: Add to `getActions()`**

Add near the other `fuvarok`-related entries (after `'getUgyfelFuvarElozmeny'` or
`'updateFuvarAllapot'`):
```php
            'getSoforDashboard' => ['ceg_id'],
```

- [ ] **Step 2: Add to `MODULE_PERMISSION_MAP`**

```php
        'getSoforDashboard' => ['fuvarok', 'hozzaferes'],
```

- [ ] **Step 3: Add the `case`**

```php
                case 'getSoforDashboard':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($fuvarInterface->getSoforDashboard(
                        $kerelmezo['ceg_id'],
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null,
                        $request['soforId'] ?? null,
                        $request['fuvarAllapot'] ?? null,
                        $request['dokumentumSzuro'] ?? null,
                        $request['granularitas'] ?? null
                    ));
                    return;
```

- [ ] **Step 4: Lint-check**

Run: `php8.2 -l backend/ApiHandler.php`

- [ ] **Step 5: Live-verify via curl**

Ensure the local PHP server is running (`cd backend && php8.2 -S localhost:8001 &` if not
already) and get a valid admin session token:
```bash
mysql -uroot kamion -e "SELECT token FROM sessions WHERE felhasznalo_tipus='admin' AND lejarat > NOW() LIMIT 1;"
```

Unfiltered call:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "getSoforDashboard",
  "ceg_id": 1
}' | python3 -m json.tool
```
Expected: `{"success": true, "osszesito": {...}, "soforonkent": [...], "allapotMegoszlas": {...},
"trend": [...], "granularitas": "..."}`. Cross-check `osszesito.osszesFuvar` against
`SELECT COUNT(*) FROM fuvarok WHERE admin=1 AND torolt <> 'I';`.

Filtered call (date range + fuvar állapot):
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "getSoforDashboard",
  "ceg_id": 1,
  "datumTol": "2026-01-01",
  "datumIg": "2026-12-31",
  "fuvarAllapot": "teljesitve",
  "granularitas": "honap"
}' | python3 -m json.tool
```
Expected: only `allapot='teljesitve'` rows counted, `granularitas` echoed back as `"honap"`,
`trend` entries keyed as `"YYYY-MM"`.

`dokumentumSzuro` rejection/acceptance check:
```bash
curl -s -X POST http://localhost:8001/api.php -H "Content-Type: application/json" -d '{
  "authHash": "nIrINP&o!PU|+pM*Q8'"'"'j1R07U57W,qD",
  "sessionToken": "<TOKEN>",
  "action": "getSoforDashboard",
  "ceg_id": 1,
  "dokumentumSzuro": "nincs"
}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['osszesito']['osszesFuvar'], d['osszesito']['hianyzoDokumentumSzama'])"
```
Expected: the two printed numbers are equal (every returned row is, by definition, undocumented).

- [ ] **Step 6: Commit**

```bash
git add backend/ApiHandler.php
git commit -m "$(cat <<'EOF'
feat(fuvar): wire up the getSoforDashboard action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Sidebar nav item + route registration

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js`
- Modify: `src/layouts/Admin.js`

**Interfaces:**
- Produces: `/admin/fuvarStatisztika` route, reachable from the sidebar "Fuvarok" group.

- [ ] **Step 1: Add to the `mobileGroups` data array**

In the `fuvarok` group's `items` (around line 93-99), after the `Fuvarok` entry:
```js
      { to: "/admin/fuvarStatisztika", icon: PiChartBarLight, text: "Statisztikák" },
```
(`PiChartBarLight` is already imported in this file — used elsewhere for "Sofőr-riport".)

- [ ] **Step 2: Add the desktop `NavItem`**

In the `fuvarok` `GroupHeader` block (around line 715-736), after the `Fuvarok` `NavItem`:
```jsx
                <NavItem
                  to="/admin/fuvarStatisztika"
                  icon={PiChartBarLight}
                  text="Statisztikák"
                />
```

- [ ] **Step 3: Register the route**

In `src/layouts/Admin.js`, add the lazy import near the other `Fuvarok`-related ones:
```js
const FuvarStatisztika = lazy(() => import("views/admin/FuvarStatisztika.js"));
```
Add the route near `/admin/fuvarok`:
```jsx
            <PrivateRoute path="/admin/fuvarStatisztika" exact component={FuvarStatisztika} />
```

- [ ] **Step 4: No standalone verification** — the target page doesn't exist yet (Task 4); this
  task is exercised once Task 4 lands.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar/Sidebar.js src/layouts/Admin.js
git commit -m "$(cat <<'EOF'
feat(fuvar): add Statisztikák nav entry + route

Third item in the Fuvarok sidebar group, alongside Beérkezett
dokumentumok and Fuvarok — points at the new /admin/fuvarStatisztika
page (Task 4).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `FuvarStatisztika.js` — page shell, filters, KPI cards, driver table

**Files:**
- Create: `src/views/admin/FuvarStatisztika.js`

**Interfaces:**
- Consumes: `getSoforDashboard` (Task 2), `getSoforok` (existing action, `{id, kerelmezo_id}` →
  `{success, soforok}`).
- Produces: the page shell — filter bar (date presets + custom range + sofőr/állapot/dokumentum
  selects + explicit "Frissítés" button, no auto-poll), KPI card row, sofőrönkénti `DataTable`.
  Charts are added in Task 5 on top of this file.

- [ ] **Step 1: Write the file**

```jsx
import React, { useCallback, useEffect, useState } from "react";
import {
  PiChartBarLight,
  PiTruckLight,
  PiUsersLight,
  PiWarningCircleLight,
  PiArrowsClockwiseLight,
} from "react-icons/pi";
import PageHeader from "components/UI/PageHeader.js";
import CardStats from "components/Cards/CardStats.js";
import DataTable from "components/UI/DataTable.js";
import StatusBadge from "components/UI/StatusBadge.js";
import { fetchAction } from "utils/fetchAction";

const FUVAR_ALLAPOT_OPTIONS = [
  { value: "", label: "Mind" },
  { value: "rogzitett", label: "Rögzítve" },
  { value: "szamlazasra_var", label: "Számlázásra vár" },
  { value: "szamlazva", label: "Számlázva" },
  { value: "fizetesre_var", label: "Fizetésre vár" },
  { value: "teljesitve", label: "Teljesítve" },
];

const DOKUMENTUM_OPTIONS = [
  { value: "", label: "Mind" },
  { value: "van", label: "Van csatolva" },
  { value: "nincs", label: "Hiányzik" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function StatisztikaFilterBar({ filter, onPreset, onFieldChange, soforok }) {
  const today = todayIso();
  const hetElso = new Date();
  hetElso.setDate(hetElso.getDate() - hetElso.getDay() + (hetElso.getDay() === 0 ? -6 : 1));
  const hetElejeIso = hetElso.toISOString().slice(0, 10);
  const honapEleje = `${today.slice(0, 7)}-01`;
  const napja30Elott = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const presets = [
    { key: "het", label: "Ez a hét", tol: hetElejeIso, ig: today },
    { key: "honap", label: "Ez a hónap", tol: honapEleje, ig: today },
    { key: "30nap", label: "Elmúlt 30 nap", tol: napja30Elott, ig: today },
  ];
  const activePreset = presets.find((p) => p.tol === filter.datumTol && p.ig === filter.datumIg)?.key;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPreset(p.tol, p.ig)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              activePreset === p.key
                ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => document.getElementById("statisztikaDatumTol")?.focus()}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
            !activePreset ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300" : "text-ink-400 hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-100"
          }`}
        >
          Egyedi
        </button>
      </div>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Dátumtól
        <input
          id="statisztikaDatumTol"
          type="date"
          name="datumTol"
          value={filter.datumTol}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        />
      </label>
      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Dátumig
        <input
          type="date"
          name="datumIg"
          value={filter.datumIg}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        />
      </label>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Sofőr
        <select
          name="soforId"
          value={filter.soforId}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          <option value="">Mind</option>
          {soforok.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Fuvar állapota
        <select
          name="fuvarAllapot"
          value={filter.fuvarAllapot}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          {FUVAR_ALLAPOT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400">
        Dokumentum
        <select
          name="dokumentumSzuro"
          value={filter.dokumentumSzuro}
          onChange={onFieldChange}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          {DOKUMENTUM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const emptyFilter = {
  datumTol: `${todayIso().slice(0, 7)}-01`,
  datumIg: todayIso(),
  soforId: "",
  fuvarAllapot: "",
  dokumentumSzuro: "",
};

export default function FuvarStatisztika() {
  const [filter, setFilter] = useState(emptyFilter);
  const [soforok, setSoforok] = useState([]);
  const [adat, setAdat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [granularitas, setGranularitas] = useState(null); // null = szerver-oldali auto-választás

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getSoforok", { id: user.ceg_id, kerelmezo_id: user.id }).then((result) => {
      if (result?.success) setSoforok(result.soforok || []);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const result = await fetchAction("getSoforDashboard", {
      ceg_id: user.ceg_id,
      datumTol: filter.datumTol || undefined,
      datumIg: filter.datumIg || undefined,
      soforId: filter.soforId || undefined,
      fuvarAllapot: filter.fuvarAllapot || undefined,
      dokumentumSzuro: filter.dokumentumSzuro || undefined,
      granularitas: granularitas || undefined,
    });
    if (result?.success) {
      setAdat(result);
      if (!granularitas) setGranularitas(result.granularitas);
    }
    setLoading(false);
  }, [filter, granularitas]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handlePreset = (tol, ig) => setFilter((prev) => ({ ...prev, datumTol: tol, datumIg: ig }));
  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };
  const handleRefresh = () => fetchData();

  const osszesito = adat?.osszesito || {};
  const soforonkent = adat?.soforonkent || [];

  const columns = [
    { key: "nev", label: "Sofőr", sortable: true, className: "font-semibold text-brand-900 dark:text-ink-50" },
    { key: "fuvarokSzama", label: "Fuvarok száma", sortable: true },
    { key: "dokumentaltSzama", label: "Dokumentált", sortable: true },
    {
      key: "hianyzoSzama",
      label: "Hiányzó",
      sortable: true,
      render: (row) => (row.hianyzoSzama > 0 ? <StatusBadge tone="warning">{row.hianyzoSzama}</StatusBadge> : "—"),
      exportValue: (row) => row.hianyzoSzama,
    },
    { key: "utolsoFuvarDatuma", label: "Utolsó fuvar", sortable: true, render: (row) => row.utolsoFuvarDatuma || "—" },
    {
      key: "bevetelOsszesen",
      label: "Bevétel",
      sortable: true,
      render: (row) => `${Number(row.bevetelOsszesen).toLocaleString("hu-HU")} Ft`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Fuvarok"
        title="Statisztikák"
        action={
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
          >
            <PiArrowsClockwiseLight className="h-4 w-4" />
            Frissítés
          </button>
        }
      />

      <StatisztikaFilterBar filter={filter} onPreset={handlePreset} onFieldChange={handleFieldChange} soforok={soforok} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardStats statSubtitle="Összes fuvar" statTitle={String(osszesito.osszesFuvar ?? "—")} statIcon={PiTruckLight} tone="brand" layout="row" />
        <CardStats statSubtitle="Aktív sofőrök" statTitle={String(osszesito.aktivSoforokSzama ?? "—")} statIcon={PiUsersLight} tone="neutral" layout="row" />
        <CardStats
          statSubtitle="Hiányzó dokumentumok"
          statTitle={String(osszesito.hianyzoDokumentumSzama ?? "—")}
          statIcon={PiWarningCircleLight}
          tone={osszesito.hianyzoDokumentumSzama > 0 ? "warning" : "positive"}
          layout="row"
        />
        <CardStats statSubtitle="Átlag fuvar/sofőr" statTitle={String(osszesito.atlagFuvarSoforonkent ?? "—")} statIcon={PiChartBarLight} tone="neutral" layout="row" />
      </div>

      <div className="mb-4">
        <DataTable
          icon={PiChartBarLight}
          title="Sofőrönkénti bontás"
          columns={columns}
          rows={soforonkent}
          loading={loading}
          exportFilename="sofor-fuvar-statisztika"
          mobileTitleKey="nev"
          emptyLabel="Nincs a szűrésnek megfelelő adat"
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Rebuild Tailwind if needed**

Run: `npm run build:tailwind`

- [ ] **Step 3: No standalone verification** — the browser click-through happens once at the
  end (Task 6), per the agreed "no per-task Playwright" workflow. A quick sanity check now is
  still worthwhile: `npx eslint src/views/admin/FuvarStatisztika.js` should report no errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/FuvarStatisztika.js src/assets/styles/tailwind.css
git commit -m "$(cat <<'EOF'
feat(fuvar): add FuvarStatisztika page shell — filters, KPIs, driver table

Filter bar (date presets/custom range + sofőr/fuvar-állapot/dokumentum
selects + explicit Frissítés button, no auto-poll), 4 KPI cards, and
the sofőrönkénti DataTable. Charts land in the next task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add the 3 Chart.js charts

**Files:**
- Modify: `src/views/admin/FuvarStatisztika.js`

**Interfaces:**
- Consumes: `adat.trend`, `adat.allapotMegoszlas`, `adat.soforonkent` (all already fetched by
  Task 4's `fetchData()`).
- Produces: `TrendChart`, `AllapotMegoszlasChart`, `TopSoforokChart` — local components in the
  same file, Chart.js v2 (`import Chart from "chart.js"`), mirroring `Koltsegek.js`'s
  `CashflowChart` canvas-ref pattern exactly.

- [ ] **Step 1: Add the import**

```js
import Chart from "chart.js";
```

- [ ] **Step 2: Add the three chart components**

Add above `FuvarStatisztika`'s own definition:

```jsx
const ALLAPOT_LABEL = {
  rogzitett: "Rögzítve",
  szamlazasra_var: "Számlázásra vár",
  szamlazva: "Számlázva",
  fizetesre_var: "Fizetésre vár",
  teljesitve: "Teljesítve",
};
const ALLAPOT_SZIN = {
  rogzitett: "#94A3B8",
  szamlazasra_var: "#F59E0B",
  szamlazva: "#2451B5",
  fizetesre_var: "#F59E0B",
  teljesitve: "#10B981",
};

function TrendChart({ trend, granularitas, onGranularitasChange }) {
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current) return undefined;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: trend.map((t) => t.periodus),
        datasets: [
          {
            label: "Fuvarok száma",
            data: trend.map((t) => t.fuvarokSzama),
            borderColor: "#2451B5",
            backgroundColor: "rgba(36,81,181,0.1)",
            fill: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        legend: { display: false },
        scales: {
          xAxes: [{ gridLines: { display: false }, ticks: { fontColor: "#68708a" } }],
          yAxes: [{ ticks: { fontColor: "#68708a", beginAtZero: true, precision: 0 } }],
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [trend]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft dark:border-ink-800 dark:bg-ink-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-900 dark:text-ink-50">Trend</h3>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-ink-800">
          {["nap", "het", "honap"].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGranularitasChange(g)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                granularitas === g ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
              }`}
            >
              {g === "nap" ? "Nap" : g === "het" ? "Hét" : "Hónap"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function AllapotMegoszlasChart({ allapotMegoszlas }) {
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current || !allapotMegoszlas) return undefined;
    if (chartRef.current) chartRef.current.destroy();
    const kulcsok = Object.keys(allapotMegoszlas);
    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: kulcsok.map((k) => ALLAPOT_LABEL[k] || k),
        datasets: [
          {
            data: kulcsok.map((k) => allapotMegoszlas[k]),
            backgroundColor: kulcsok.map((k) => ALLAPOT_SZIN[k] || "#94A3B8"),
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        legend: { position: "bottom", labels: { fontColor: "#68708a", boxWidth: 12 } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [allapotMegoszlas]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft dark:border-ink-800 dark:bg-ink-900">
      <h3 className="mb-2 text-sm font-semibold text-brand-900 dark:text-ink-50">Állapot-megoszlás</h3>
      <div className="h-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function TopSoforokChart({ soforonkent }) {
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);
  const top5 = soforonkent.slice(0, 5);

  React.useEffect(() => {
    if (!canvasRef.current) return undefined;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "horizontalBar",
      data: {
        labels: top5.map((s) => s.nev),
        datasets: [
          {
            label: "Fuvarok száma",
            data: top5.map((s) => s.fuvarokSzama),
            backgroundColor: "#2451B5",
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        legend: { display: false },
        scales: {
          xAxes: [{ ticks: { fontColor: "#68708a", beginAtZero: true, precision: 0 } }],
          yAxes: [{ gridLines: { display: false }, ticks: { fontColor: "#68708a" } }],
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [top5]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft dark:border-ink-800 dark:bg-ink-900">
      <h3 className="mb-2 text-sm font-semibold text-brand-900 dark:text-ink-50">Top sofőrök</h3>
      <div className="h-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount the 3 charts + wire the granularity toggle**

In `FuvarStatisztika`, add a handler right after `handleRefresh`:
```js
  const handleGranularitasChange = (g) => setGranularitas(g);
```
(Its effect: `granularitas` state change is already a dep of `fetchData` — Task 4's
`useEffect(() => { fetchData(); }, [filter])` must be extended to also depend on
`granularitas`. Change that effect to:)
```js
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, granularitas]);
```

Add the chart grid right after the KPI card row, before the `DataTable` block:
```jsx
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendChart trend={adat?.trend || []} granularitas={granularitas} onGranularitasChange={handleGranularitasChange} />
        <AllapotMegoszlasChart allapotMegoszlas={adat?.allapotMegoszlas} />
        <TopSoforokChart soforonkent={soforonkent} />
      </div>
```

- [ ] **Step 4: Rebuild Tailwind if needed**

Run: `npm run build:tailwind`

- [ ] **Step 5: Eslint sanity check**

Run: `npx eslint src/views/admin/FuvarStatisztika.js` — expect no errors (warnings about
unrelated devDependencies are pre-existing noise, ignore).

- [ ] **Step 6: Commit**

```bash
git add src/views/admin/FuvarStatisztika.js src/assets/styles/tailwind.css
git commit -m "$(cat <<'EOF'
feat(fuvar): add trend/status/top-drivers charts to FuvarStatisztika

Chart.js v2 (already installed, same pattern as Koltsegek.js's
CashflowChart) — line chart with a nap/hét/hónap granularity toggle,
a doughnut for allapot breakdown, and a horizontal bar for the top 5
drivers by fuvar count.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: End-to-end browser verification

**Files:** none (verification-only task).

- [ ] **Step 1: Start servers if not already running**

`cd backend && php8.2 -S localhost:8001 &` (skip if already running per CLAUDE.md's note),
`npm start` (reuse existing dev server on port 3000 if already running).

- [ ] **Step 2: Seed an admin session and open the page**

Using the documented local-verification pattern (`localStorage` `user`/`sessionToken`, a real
row in the local `sessions` table), navigate to `/admin/fuvarStatisztika`.

- [ ] **Step 3: Click through**

- Confirm the sidebar shows "Statisztikák" as the 3rd item under "Fuvarok", and clicking it
  loads the page without console errors.
- Confirm the 4 KPI cards show numbers matching a manual `SELECT` against the local `kamion`
  DB for the default filter (this month).
- Click each date preset (Ez a hét / Ez a hónap / Elmúlt 30 nap) and confirm the data
  refetches (network tab or visible number changes) and "Egyedi" is not highlighted.
- Set custom Dátumtól/Dátumig and confirm "Egyedi" highlights, data updates.
- Change the Sofőr/Fuvar állapota/Dokumentum selects one at a time, confirm the KPI cards,
  charts, and table all update to match.
- Click "Frissítés" and confirm a fresh fetch fires (no visual regression, no duplicate charts
  stacking — the `chartRef.current?.destroy()` cleanup must prevent canvas ghosting).
- Click Nap/Hét/Hónap on the trend chart and confirm the x-axis labels change shape
  (`YYYY-MM-DD` vs `YYYY-WNN` vs `YYYY-MM`).
- Sort the sofőrönkénti table by each sortable column, confirm correct client-side ordering.
- Repeat a visual check in dark mode (toggle via the existing sidebar button) — confirm chart
  text/legend colors remain legible (the hardcoded `#68708a` tick color is a mid-gray chosen to
  work on both light and dark backgrounds, matching `CashflowChart`'s existing choice — if it
  reads poorly in dark mode, that's a pre-existing condition shared with the Pénzforgalom chart,
  not specific to this page).

- [ ] **Step 4: Report results** — note any visual bug found; fix inline if trivial (e.g. a
  wrong Tailwind class), otherwise flag it before considering this plan complete.
