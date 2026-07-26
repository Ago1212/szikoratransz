# Sofőr-oldali dokumentum-feltöltési előzmény + Dashboard átrendezés

## Cél

A sofőr jelenleg (`views/user/DokumentumFeltoltes.js`) csak feltölteni tud egy
fuvarlevelet/szállítólevelet — semmilyen betekintése nincs abba, mit töltött
fel korábban. Mivel ez a funkció a mindennapi munka egyik leggyakrabban
használt eleme lesz (minden lezárt fuvarnál), a Kezdőlapon is hangsúlyosabb
szerepet kell kapnia. Ezzel párhuzamosan a "Legutóbbi bejelentéseim" szekció
(ami egy ritkán használt, incidens-jellegű funkció) vizuálisan háttérbe
szorulhat.

**Kifejezetten NEM változik**: a `BottomNav.js` középső, piros "Bejelentés"
FAB-ja — annak dokumentált indoka (vezetés közbeni egykezes vészhelyzeti
elérés) továbbra is érvényes, ez a terv nem nyúl hozzá. Az admin-oldali
"Beérkezett dokumentumok" inbox, az OCR-folyamat és a Fuvar-modul
változatlan.

**Tudatos korlát, amit ez a terv megtart**: a sofőr továbbra sem lát bele az
OCR-eredménybe (`ocr_adatok`) vagy abba, melyik fuvarhoz lett a dokumentum
társítva (`fuvar_id`/`hozzarendelt_sofor_id`) — ez egy korábbi, explicit
hatókör-döntés (ld. `DokumentumFeltoltes.js` fejléc-kommentje), amit ez a
funkció nem bont fel. A sofőr csak azt látja: mit töltött fel, mikor, és hol
tart a feldolgozásban (feldolgozás alatt / feldolgozva / hiba).

## Backend

### `backend/interface/beerkezettDokumentumInterface.php`

Két új publikus metódus, a meglévő `getDokumentumok()`/`torol()`-tól
elkülönítve (azok admin-oldali, `ceg_id`-szintű hozzáférést adnak — ezek
sofőr-szintű, szigorúbb szűréssel és mezőkorlátozással):

- **`getSajatDokumentumok($soforId, $cegId, $limit = null)`** — csak a
  `feltolto_tipus = 'sofor' AND feltolto_id = :sofor_id AND admin = :ceg_id
  AND torolt <> 'I'` sorok, `ORDER BY letrehozva DESC`, opcionális `LIMIT`
  (a Dashboard kártya csak az utolsó 3-at kéri, a
  `DokumentumFeltoltes.js` a teljeset). A visszaadott mezők **szándékosan
  szűkítettek**: `id`, `fajl_id`, `filename` (a meglévő
  `fajlnevekFeloldasa()` helperrel), `tipus`, `ocr_allapot`, `letrehozva`,
  és egy szerver-oldalon számolt `torolheto` boolean (`fuvar_id IS NULL`).
  **Nem** adja vissza `ocr_adatok`-ot, `fuvar_id`-t vagy
  `hozzarendelt_sofor_id`-t.
- **`torolSajat($id, $soforId, $cegId)`** — a sor tulajdonjogát (`feltolto_tipus
  = 'sofor' AND feltolto_id = :sofor_id AND admin = :ceg_id`) ÉS azt, hogy
  még nem lett belőle fuvar (`fuvar_id IS NULL`) ellenőrzi, mielőtt
  `torolt = 'I'`-re állítaná. Ha bármelyik feltétel nem teljesül,
  `['success' => false, 'message' => ...]`-t ad egyértelmű szöveggel
  ("A dokumentum nem található." / "Ez a dokumentum már fuvarrá lett
  alakítva, nem törölhető.").

### `backend/ApiHandler.php`

Két új action, a `getBejelentesekSofor`/`resolveSajatSoforId` mintáját
követve (a kliens által küldött `sofor_id` csak a request-alak
visszafelé-kompatibilitásáért kötelező mező, a tényleges azonosítót mindig
`resolveSajatSoforId()` adja a munkamenetből):

```php
// getActions()
'getSajatBeerkezettDokumentumok' => ['sofor_id'],
'torolSajatBeerkezettDokumentum' => ['id', 'sofor_id'],

// process()
case 'getSajatBeerkezettDokumentumok':
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
```

Egyik action sincs a `MODULE_PERMISSION_MAP`-ban — ugyanaz a minta, mint
`getBejelentesekSofor`-nál: ez egy sofőr saját-adatos önkiszolgáló akció,
nem admin-konfigurálható modul-jogosultság alá tartozik.

A meglévő `elemezBeerkezettDokumentum` (feltöltés) action és a
`downloadFile` action (thumbnail-lekéréshez, már `resolveSajatCegId`-t
használ, sofőr-munkamenetből is hívható) változatlan marad.

## Frontend

### `src/views/user/DokumentumFeltoltes.js`

A feltöltő doboz alatt egy "Korábbi feltöltéseim" szekció:
- Mountkor (és minden sikeres feltöltés/törlés után) lekéri
  `getSajatBeerkezettDokumentumok`-ot (limit nélkül, teljes előzmény).
- Soronként: kép-előnézet (ha a fájl kép — `downloadFile` action a
  meglévő admin Fájlok-grid `IntersectionObserver`-alapú lusta betöltési
  mintáját követve, csak látótérbe kerüléskor tölt) vagy egy egyszerű
  dokumentum-ikon (PDF-nél), relatív dátum, egy státusz-jelvény
  (`ocr_allapot` alapján: `feldolgozatlan` → "Feldolgozás alatt",
  `kesz` → "Feldolgozva", `hiba` → "Hiba – admin pótolja").
- Törlés gomb **csak** `torolheto === true` eseténél jelenik meg,
  megerősítő dialógussal (`confirmDialog`, a projekt meglévő
  `utils/confirm.js` mintáját követve — natív `window.confirm` helyett).
- Üres állapot: "Még nincs feltöltött dokumentumod."

### `src/views/user/Dashboard.js`

- **`quickActions`-ból törölve a "Dokumentum" tile** (a Gyors műveletek
  rács 6 elemről 5-re csökken — a rács `grid-cols-3`-a ettől nem törik,
  csak egy sorral rövidebb lesz) — nem duplikáljuk ugyanazt a CTA-t két
  helyen.
- **Új, kiemelt kártya** az "Aktív jármű" rács és a "Fontos értesítések"
  sáv közé, ugyanabban a `rounded-2xl border shadow-soft` vizuális
  nyelvben, de brand-színű kiemeléssel (pl. `bg-brand-50 border-brand-200`
  háttér/keret, nagyobb kamera-ikon) — link `/user/dokumentum-feltoltes`-re.
  A kártya tartalma: cím ("Dokumentum feltöltése"), rövid alcím ("Fuvarlevél
  vagy szállítólevél lefotózása"), és alatta a `getSajatBeerkezettDokumentumok`
  (`limit: 3`) alapján egy kompakt, legfeljebb 3 elemes előnézeti sor
  (kis thumbnail + státusz-jelvény, dátum nélkül a helytakarékosság
  miatt) + egy "Összes" link ugyanoda. Üres állapotnál a kártya csak a
  CTA-t mutatja, előnézeti sor nélkül.
- **"Legutóbbi bejelentéseim" szekció zsugorítva**: a jelenlegi, teljes
  kártyás lista (cím + státusz-jelvény + dátum soronként) helyett egy
  egyetlen, alacsonyabb vizuális súlyú sor — pl. "X nyitott bejelentésed
  van" / "Nincs nyitott bejelentésed" felirat + "Megnyitás" link — ugyanott,
  a lap alján, de kevesebb helyet foglalva és kevesebb vizuális hangsúllyal
  (kisebb betűméret, nincs kártyánkénti badge-lista). A már meglévő
  `bejelentesRes`/`sajatBejelentesek` adatlekérés nem változik, csak a
  megjelenítés egyszerűsödik.

## Adatáramlás

```
DokumentumFeltoltes.js ──elemezBeerkezettDokumentum──> backend (változatlan)
DokumentumFeltoltes.js ──getSajatBeerkezettDokumentumok──> backend (új)
DokumentumFeltoltes.js ──torolSajatBeerkezettDokumentum──> backend (új)
Dashboard.js ──getSajatBeerkezettDokumentumok (limit:3)──> backend (új, ugyanaz a metódus)
mindkettő ──downloadFile (thumbnailhez)──> backend (változatlan, meglévő action)
```

## Hibakezelés

- Lista-lekérés/törlés hibája: a meglévő `toast.error(...)` minta
  (`DokumentumFeltoltes.js` már használja feltöltésnél).
- Törlés jogosultsági/állapot-hibája (már fuvarrá alakítva, vagy nem a
  sajátja): a backend `success:false` + `message` válasza megy toast-ra,
  nincs csendes elnyelés.
- Thumbnail-betöltési hiba (pl. törölt/hibás fájl): dokumentum-ikon
  fallback, nem tört kép.

## Tesztelés

Élőben, helyi `sessions` táblába szúrt valódi `sofor`-típusú
munkamenettel, Playwright-tal: feltöltés → megjelenik a Dashboard kártyán
ÉS a `DokumentumFeltoltes.js` teljes listáján → egy `fuvar_id IS NULL`
dokumentum törölhető, egy fuvarrá alakított nem (a törlés gomb nincs is
rajta) → üres állapot egy vadonatúj teszt-sofőrnél. A "Legutóbbi
bejelentéseim" zsugorított nézet és a Gyors műveletek 5-tilés rácsa is
vizuálisan ellenőrizve. A teszt-adatok (feltöltött fájlok,
`beerkezett_dokumentumok` sorok, ideiglenes sofőr/session) utána törölve
lesznek.
