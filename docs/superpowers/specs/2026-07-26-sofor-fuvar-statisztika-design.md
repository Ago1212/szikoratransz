# Sofőrönkénti fuvar/dokumentum statisztika + Dashboard

> Ez a spec a meglévő Fuvarok / Beérkezett dokumentumok modulok **mellé** kerülő, önálló
> elemző/statisztikai felületet ír le. A két meglévő nézet (`Fuvarok.js`,
> `BeerkezettDokumentumok.js`) **változatlan marad** — ez a spec kizárólag egy új oldalt ad
> hozzájuk, semmilyen meglévő fájlt nem módosít bennük.

## 1. Áttekintés és cél

Az admin jelenleg nem lát gyors, sofőrönkénti áttekintést arról, hogy ki hány fuvart teljesített,
hány fuvarhoz van csatolt beérkezett dokumentum, és milyen heti/havi trendet mutat a flotta. Ez a
spec egy új "Statisztikák" oldalt ad a Fuvarok modulhoz: sofőrönkénti csoportosítás (fuvarszám,
dokumentált/hiányzó dokumentum, utolsó fuvar dátuma), összesítő KPI-kártyák, 3 grafikon (trend,
állapot-megoszlás, top sofőrök) és szűrők (sofőr, dátumtartomány, fuvar-állapot, dokumentum-állapot).

## 2. Előzmény és kontextus

- **`FuvarInterface`-ben már létezik egy használaton kívüli statisztika-pár**:
  `getStatisztikak($ceg_id)` (~588. sor) és `getFigyelmeztetesek($ceg_id)` (~765. sor) —
  sofőr/jármű/megbízó bontás, 12 havi trend, pénzügyi kintlévőség. Egyik akciót sem hívja
  jelenleg semmilyen frontend (`getFuvarStatisztikak`/`getFuvarFigyelmeztetesek` az
  `ApiHandler.php`-ban regisztrálva, de "élő" fogyasztó nélkül) — feltehetően egy párhuzamos,
  még be nem fejezett munka maradványa. **Ez a spec szándékosan nem nyúl hozzájuk** (nem
  ismert, függ-e tőlük már valami más, folyamatban lévő felület) — helyette egy **új,
  önálló metódust** ad melléjük, ami a hiányzó darabokat fedi le: dokumentum-linkeltség
  sofőrönként, nap/hét/hónap granularitás, egyedi dátumtartomány, állapot-szűrők.
- **Chart-könyvtár**: a projektben már telepítve van **Chart.js v2.9.4** (nem
  `react-chartjs-2`, vanília API) — a Pénzforgalom `Koltsegek.js`-ben lévő `CashflowChart`
  helyi komponens használja (`new Chart(canvasRef.current, {...})`, `<canvas>` ref, `useEffect`
  a saját state-jén). Ez a spec **ugyanezt a könyvtárat és mintát** hasznosítja újra — nincs új
  npm-függőség. **Fontos verzió-részlet**: Chart.js v2-ben a vízszintes oszlopdiagram típusa
  `horizontalBar` (nem a v3+ `indexAxis: 'y'` szintaxis).
- **Dokumentum↔sofőr kapcsolat** (a felhasználóval egyeztetve): a `beerkezett_dokumentumok`
  táblának nincs közvetlen sofőr-FK-ja (csak `feltolto_tipus`/`feltolto_id`, ami admin is
  lehet). A döntés: **fuvarhoz kötött dokumentum** a mérvadó — egy sofőr "dokumentált"
  fuvarjainak száma a `fuvarok.beerkezett_dokumentum_id IS NOT NULL` sorok száma az adott
  sofőrnél, "hiányzó" a `beerkezett_dokumentum_id IS NULL` sorok száma. Ez a már meglévő
  `fuvarok.beerkezett_dokumentum_id` oszlopra épül (a korábbi Fuvarok/Beérkezett dokumentumok
  UX-redesign vezette be), nem igényel új kapcsolatot.
- **Nincs auto-frissítés** (a felhasználóval egyeztetve) — betöltéskor, szűrő-váltáskor és egy
  explicit "Frissítés" gombra frissül, nincs periodikus poll (eltérően a sidebar apró
  darabszám-jelvényeitől, amik 60mp-enként pollnak — ez az oldal nagyobb adatmennyiséget
  mozgatna, feleslegesen terhelné a szervert egy folyamatosan nyitva hagyott fülnél).
- **`getSoforok`** (`soforokInterface.php`) már létező, újrahasznosítható action a sofőr-szűrő
  legördülőhöz.

## 3. Hatókör

### Ebben a fázisban elkészül
- Új backend action + `FuvarInterface` metódus a kombinált sofőr/dokumentum/trend statisztikához.
- Új `/admin/fuvarStatisztika` oldal: szűrősáv, KPI-kártyák, 3 grafikon, sofőrönkénti táblázat.
- Sidebar 3. nav-tétel a "Fuvarok" csoportban.

### Ebben a fázisban NEM készül el
- A meglévő `getStatisztikak()`/`getFigyelmeztetesek()` (jármű/megbízó/pénzügyi kintlévőség)
  frontend bekötése — nem ez a spec tárgya, más metódusok.
- Automata (periodikus) frissítés.
- A Fuvarok/Beérkezett dokumentumok nézetek bármilyen módosítása.
- Export (Excel/CSV) az új oldalról — a meglévő oldalak mintáját később könnyű ráépíteni, de
  nem kért funkció most.

## 4. Backend

### 4.1 Új metódus: `FuvarInterface::getSoforDashboard()`

```php
public function getSoforDashboard(
    $ceg_id,
    $datumTol = null,
    $datumIg = null,
    $soforId = null,
    $fuvarAllapot = null,
    $dokumentumSzuro = null, // 'van' | 'nincs' | null (mind)
    $granularitas = null     // 'nap' | 'het' | 'honap' | null (auto)
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

    // ... PHP-oldali aggregáció (ld. lentebb a négy blokk), a getStatisztikak()-ban
    // már bevált batchLekerdezes()-mintát újrahasznosítva a sofőr-nevekhez.
}
```

Négy visszaadott blokk:

1. **`osszesito`**: `osszesFuvar`, `aktivSoforokSzama` (distinct `sofor_id`, nem NULL),
   `hianyzoDokumentumSzama` (`beerkezett_dokumentum_id IS NULL` a SZŰRT halmazban),
   `atlagFuvarSoforonkent` (`osszesFuvar` sofőrhöz rendelt hányada / `aktivSoforokSzama`,
   kerekítve 1 tizedesre), `nemHozzarendeltFuvarSzama` (`sofor_id IS NULL` — informatív, külön
   jelezve, nem keveredik a sofőrönkénti bontásba).
2. **`soforonkent`**: `[{sofor_id, nev, fuvarokSzama, dokumentaltSzama, hianyzoSzama,
   utolsoFuvarDatuma, bevetelOsszesen}]`, `fuvarokSzama` szerint csökkenő sorrendben (ez adja a
   "legaktívabb sofőrök" listát is — a frontend csak az első N-et emeli ki külön grafikonon).
3. **`allapotMegoszlas`**: `{rogzitett, szamlazasra_var, szamlazva, fizetesre_var, teljesitve}`
   darabszámok a szűrt halmazban.
4. **`trend`**: `[{periodus, fuvarokSzama}]` — `$granularitas` szerint bucketolva
   (`teljesites_datuma` napi/`YYYY-MM-DD`, ISO-hét `date('o-\WW', ...)` → `"2026-W30"`, vagy
   hónap `substr(...,0,7)` → `"2026-07"`), időrendben. Ha `$granularitas` üres, a metódus
   maga választ a `$datumTol`/`$datumIg` közti napok száma alapján: ≤31 nap → `nap`, ≤180 nap →
   `het`, egyébként `honap` (a frontend ugyanezt a küszöböt használja az alapértelmezett
   gomb-kiválasztáshoz, de a felhasználó felülbírálhatja).

### 4.2 Wiring (`ApiHandler.php`, a szokásos 3 pont)

```php
// getActions()
'getSoforDashboard' => ['ceg_id'],

// MODULE_PERMISSION_MAP
'getSoforDashboard' => ['fuvarok', 'hozzaferes'],

// process() case
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

Nincs új interfész-fájl (a meglévő `FuvarInterface`-hez adódik), nincs új jogosultsági modul (a
meglévő `'fuvarok'`/`hozzaferes`-t használja — ugyanaz, mint a Fuvarok lista megtekintése).

## 5. Frontend

### 5.1 Route + navigáció

- `src/views/admin/FuvarStatisztika.js`, route `/admin/fuvarStatisztika` (`Admin.js`).
- Sidebar "Fuvarok" csoport 3. tétele (desktop `NavItem` + `mobileGroups[].items`), "Statisztikák"
  felirattal, a Beérkezett dokumentumok + Fuvarok alatt.

### 5.2 Oldal felépítése

1. `PageHeader eyebrow="Fuvarok" title="Statisztikák"`.
2. **Szűrősáv** (saját, helyi komponens, a Pénzforgalom `PeriodControl`-jának vizuális
   nyelvét követve, de attól függetlenül — nem nyúlunk a `Koltsegek.js`-hez): dátum-preset
   gombok (Ez a hét / Ez a hónap / Elmúlt 30 nap / Egyedi) + pontos Dátumtól/Dátumig mezők +
   Sofőr `<select>` (a meglévő `getSoforok` action-ből töltve) + Fuvar állapota `<select>` (5
   érték + "Mind") + Dokumentum `<select>` ("Van csatolva" / "Hiányzik" / "Mind") + "Frissítés"
   gomb (explicit, nincs auto-poll).
3. **KPI-kártyasor** (meglévő `CardStats`, `layout="row"`): Összes fuvar (`brand`), Aktív
   sofőrök (`neutral`), Hiányzó dokumentumok (`warning`, csak ha > 0, egyébként `positive`),
   Átlag fuvar/sofőr (`neutral`).
4. **3 grafikon** (Chart.js, a `CashflowChart` mintáját követő helyi komponensek):
   - **Trend** (`type: 'line'`): `trend` tömb, x-tengely `periodus`, y `fuvarokSzama`. Nap/Hét/
     Hónap gomb-váltó a grafikon fejlécében, ami újratölti az adatot az adott `granularitas`-szal.
   - **Állapot-megoszlás** (`type: 'doughnut'`): `allapotMegoszlas` 5 kulcsa, a projekt már
     bevett állapot-színeivel (`AllapotOsszesitoChips`/`StatusChangePopover` tónusaival
     összhangban: neutral/warning/info/warning/success).
   - **Top sofőrök** (`type: 'horizontalBar'` — Chart.js v2 szintaxis): `soforonkent` első 5
     eleme `fuvarokSzama` szerint.
5. **Sofőrönkénti táblázat** (meglévő `DataTable`, kliens-oldali rendezés, nincs szerver-lapozás):
   oszlopok Sofőr / Fuvarok száma / Dokumentált / Hiányzó (piros `StatusBadge`, ha > 0) / Utolsó
   fuvar dátuma / Bevétel.

### 5.3 Frissítés-viselkedés

Egyetlen `fetchData()` (`useCallback`, a szűrő-state-ek a dependency-listában) — lefut mountkor
és minden szűrőváltáskor, plusz a "Frissítés" gomb explicit hívja. **Nincs `setInterval`** — ez
tudatos eltérés a sidebar-jelvények mintájától, mert ez az oldal nagyobb lekérdezést futtat, amit
felesleges lenne egy nyitva hagyott fülön percenként újrafuttatni.

## 6. Amit tudatosan nem tartalmaz

- A meglévő `getStatisztikak()`/`getFigyelmeztetesek()` (jármű/megbízó/pénzügyi) bekötése.
- Automata frissítés.
- Export.
- A Fuvarok/Beérkezett dokumentumok nézetek módosítása.
