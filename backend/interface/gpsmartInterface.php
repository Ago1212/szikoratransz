<?php

require_once __DIR__ . '/../GpsmartClient.php';

// A GPSmart flottakövetés (flottanavigacio.gpsmart.eu) fiók beállítása
// (cégenként egy sor, `admin` = ceg_id, ugyanaz a minta, mint a NAV Online
// Számla beállításnál) + a Flottakövetés oldal pozíció-lekérdezése.
class GpsmartInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // A jelszó titkosítva kerül az adatbázisba (openssl_encrypt,
    // AES-256-CBC) — ez egy valódi külső fiók jelszava, nem az app saját
    // belső titka (ld. config.php komment a navEncryptionKey mellett, amit
    // itt is újrahasználunk).
    private function titkosit($sima) {
        global $apiConfig;
        $kulcs = hash('sha256', $apiConfig['navEncryptionKey'], true);
        $iv = random_bytes(16);
        $titkositott = openssl_encrypt($sima, 'AES-256-CBC', $kulcs, OPENSSL_RAW_DATA, $iv);
        return base64_encode($iv . $titkositott);
    }

    private function visszafejt($titkositott) {
        global $apiConfig;
        $kulcs = hash('sha256', $apiConfig['navEncryptionKey'], true);
        $nyers = base64_decode($titkositott);
        $iv = substr($nyers, 0, 16);
        $adat = substr($nyers, 16);
        return openssl_decrypt($adat, 'AES-256-CBC', $kulcs, OPENSSL_RAW_DATA, $iv);
    }

    // Üres jelszó mentéskor a meglévő (már eltárolt, titkosított) értéket
    // megtartja — ugyanaz az "írás-only" UX-minta, mint a NAV-beállításnál:
    // a felület sosem mutatja vissza a valódi jelszót, csak egy "beállítva"
    // jelzést, újbóli mentéskor pedig nem kötelező újra begépelni.
    public function saveBeallitasok($ceg_id, $felhasznalonev, $jelszo, $userid) {
        try {
            $stmt = $this->db->prepare('SELECT jelszo_titkositva FROM gpsmart_beallitasok WHERE admin = :admin');
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->execute();
            $meglevo = $stmt->fetch(PDO::FETCH_ASSOC);

            $jelszoTitkositva = !empty($jelszo)
                ? $this->titkosit($jelszo)
                : ($meglevo['jelszo_titkositva'] ?? null);

            if ($jelszoTitkositva === null) {
                return ['success' => false, 'message' => 'A jelszó megadása kötelező az első beállításnál.'];
            }

            $stmt = $this->db->prepare(
                'INSERT INTO gpsmart_beallitasok (admin, felhasznalonev, jelszo_titkositva, userid)
                 VALUES (:admin, :felhasznalonev, :jelszo, :userid)
                 ON DUPLICATE KEY UPDATE felhasznalonev = :felhasznalonev2, jelszo_titkositva = :jelszo2, userid = :userid2'
            );
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindValue(':felhasznalonev', $felhasznalonev);
            $stmt->bindValue(':jelszo', $jelszoTitkositva);
            $stmt->bindValue(':userid', $userid);
            $stmt->bindValue(':felhasznalonev2', $felhasznalonev);
            $stmt->bindValue(':jelszo2', $jelszoTitkositva);
            $stmt->bindValue(':userid2', $userid);
            $stmt->execute();

            return ['success' => true, 'message' => 'GPSmart beállítások elmentve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Sosem ad vissza visszafejtett jelszót a frontend felé — csak azt
    // jelzi, van-e már beállítás, és a nem-titkos mezőket.
    public function getBeallitasokStatusz($ceg_id) {
        try {
            $stmt = $this->db->prepare('SELECT felhasznalonev, userid FROM gpsmart_beallitasok WHERE admin = :admin');
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->execute();
            $beallitas = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$beallitas) {
                return ['success' => true, 'van_beallitva' => false];
            }

            return [
                'success' => true,
                'van_beallitva' => true,
                'felhasznalonev' => $beallitas['felhasznalonev'],
                'userid' => $beallitas['userid'],
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A GPSmart-tól kapott pozíciókat rendszám alapján összepárosítja a
    // saját `kamion` táblánk soraival (csak az adott cég saját kamionjai
    // közt keresve) — a Flottakövetés oldal ez alapján tud a térkép-
    // jelölőre kattintva átugrani a kamion saját adatlapjára. Amit nem
    // talál (pl. mert a GPSmart-fiókban van olyan jármű, ami nálunk még
    // nincs felvéve), azt is visszaadja, csak `kamion_id: null`-lal — így
    // a térképen semmi nem tűnik el csendben.
    public function lekerdezPoziciok($ceg_id) {
        try {
            $stmt = $this->db->prepare('SELECT felhasznalonev, jelszo_titkositva, userid FROM gpsmart_beallitasok WHERE admin = :admin');
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->execute();
            $beallitas = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$beallitas) {
                return ['success' => false, 'message' => 'A GPSmart kapcsolat még nincs beállítva ehhez a céghez.'];
            }

            $client = new GpsmartClient(
                $beallitas['felhasznalonev'],
                $this->visszafejt($beallitas['jelszo_titkositva']),
                $beallitas['userid']
            );
            $poziciok = $client->lekerdezPoziciok();

            $kamionStmt = $this->db->prepare('SELECT id, rendszam FROM kamion WHERE admin = :admin AND torolt <> \'I\'');
            $kamionStmt->bindValue(':admin', $ceg_id);
            $kamionStmt->execute();
            $kamionokRendszamSzerint = [];
            foreach ($kamionStmt->fetchAll(PDO::FETCH_ASSOC) as $kamion) {
                $kamionokRendszamSzerint[strtoupper(trim($kamion['rendszam']))] = $kamion['id'];
            }

            // A furgon önhajtó jármű, mint a kamion — ugyanúgy GPS-követett,
            // ezért ugyanúgy rendszám szerint párosítjuk a GPSmart-tól kapott
            // pozíciókkal. A pótkocsinak nincs GPS-eszköze, ezért az nem
            // szerepel ebben az egyeztetésben.
            $furgonStmt = $this->db->prepare('SELECT id, rendszam FROM furgon WHERE admin = :admin AND torolt <> \'I\'');
            $furgonStmt->bindValue(':admin', $ceg_id);
            $furgonStmt->execute();
            $furgonokRendszamSzerint = [];
            foreach ($furgonStmt->fetchAll(PDO::FETCH_ASSOC) as $furgon) {
                $furgonokRendszamSzerint[strtoupper(trim($furgon['rendszam']))] = $furgon['id'];
            }

            // Ha a rendszám alapján sikerül azonosítani a saját kamionunkat/
            // furgonunkat, ahhoz a `user.kamion`/`user.furgon` mező alapján
            // hozzárendeljük az aktuális sofőrt is — ez a "jelenlegi"
            // hozzárendelés, nem egy adott napra visszamenőleg (a rendszer
            // nincs napi bontásban vezetve, ki melyik járművel ment); ha egy
            // sofőr aznap más járművet vitt, ez nem tükrözi azt.
            $soforStmt = $this->db->prepare('SELECT kamion, furgon, name FROM user WHERE admin = :admin AND torolt <> \'I\' AND (kamion IS NOT NULL OR furgon IS NOT NULL)');
            $soforStmt->bindValue(':admin', $ceg_id);
            $soforStmt->execute();
            $soforokKamionSzerint = [];
            $soforokFurgonSzerint = [];
            foreach ($soforStmt->fetchAll(PDO::FETCH_ASSOC) as $sofor) {
                if ($sofor['kamion']) {
                    $soforokKamionSzerint[$sofor['kamion']] = $sofor['name'];
                }
                if ($sofor['furgon']) {
                    $soforokFurgonSzerint[$sofor['furgon']] = $sofor['name'];
                }
            }

            foreach ($poziciok as &$pozicio) {
                $kulcs = strtoupper(trim($pozicio['rendszam']));
                $kamionId = $kamionokRendszamSzerint[$kulcs] ?? null;
                $furgonId = $kamionId ? null : ($furgonokRendszamSzerint[$kulcs] ?? null);
                $pozicio['kamion_id'] = $kamionId;
                $pozicio['furgon_id'] = $furgonId;
                $pozicio['jarmu_tipus'] = $kamionId ? 'kamion' : ($furgonId ? 'furgon' : null);
                $pozicio['sofor_nev'] = $kamionId
                    ? ($soforokKamionSzerint[$kamionId] ?? null)
                    : ($furgonId ? ($soforokFurgonSzerint[$furgonId] ?? null) : null);
            }
            unset($pozicio);

            return ['success' => true, 'poziciok' => $poziciok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Item: Flottakövetés "Megtett út (ma)" — SZÁNDÉKOSAN külön action,
    // nem a lekerdezPoziciok() része. Egy korábbi verzió a `km` (óraállás)
    // mező napi kezdő-vs-jelenlegi különbségéből becsülte ezt, DB-only,
    // új GPSmart-hívás nélkül — de élőben ellenőrizve az óraállás-mező a
    // legtöbb járműnél egyáltalán nem jön vissza (nincs CAN-busz/odométer-
    // integráció az adott GPS-eszközön), úgyhogy a becslés a gyakorlatban
    // szinte mindig "nincs adat" lett volna. Ehelyett ugyanazt a forrást
    // használja, amit az ElozmenyekModal.js már ma is megbízhatóan használ
    // EGY kiválasztott járműre (`lekerdezUtvonal()` napi összesítője,
    // GPS-alapú távolság — ez akkor is működik, ha nincs órállás-szenzor).
    // Itt viszont a teljes, GPSmart-tal párosított flottára fut le, tehát
    // jármű-önkénti külön bejelentkezés+lekérdezés (ld. GpsmartClient fejléc-
    // komment: minden hívás saját loginnal indul) — ez érezhetően lassabb
    // lehet, mint az egyetlen HTML-táblát betöltő pozíció-lekérdezés. A
    // frontend ezért ezt NEM köti az automatikus 60mp-es projekthez, csak a
    // kézi "Frissítés" gombhoz, a pozíció-frissítéstől függetlenül — így a
    // fő lista/térkép sosem lassul le emiatt.
    public function lekerdezMegtettUtMa($ceg_id) {
        $poziciok = $this->lekerdezPoziciok($ceg_id);
        if (!$poziciok['success']) {
            return $poziciok;
        }

        $ma = date('Y-m-d');
        $eredmeny = [];
        foreach ($poziciok['poziciok'] as $p) {
            if ((empty($p['kamion_id']) && empty($p['furgon_id'])) || empty($p['car_id'])) {
                continue;
            }

            $megtettUt = null;
            try {
                $utvonal = $this->lekerdezUtvonal($ceg_id, $p['car_id'], $ma, $ma);
                if ($utvonal['success']) {
                    $tavolsagSzoveg = $utvonal['osszesito']['tavolsag_osszesen'] ?? null;
                    if ($tavolsagSzoveg !== null) {
                        $megtettUt = $this->kmSzovegSzamra($tavolsagSzoveg);
                    }
                }
            } catch (Exception $e) {
                // Egy jármű hibás/időtúllépéses lekérdezése ne dobja el a
                // többi jármű eredményét — ugyanaz a védelmi minta, mint
                // getKihasznaltsagiRiport()-ban.
            }

            $eredmeny[] = [
                'kamion_id' => $p['kamion_id'],
                'furgon_id' => $p['furgon_id'] ?? null,
                'jarmu_tipus' => $p['jarmu_tipus'] ?? ($p['kamion_id'] ? 'kamion' : 'furgon'),
                'rendszam' => $p['rendszam'],
                'megtettUtMa' => $megtettUt,
            ];
        }

        return ['success' => true, 'jarmuvek' => $eredmeny];
    }

    // Egy jármű útvonal-előzménye egy dátumtartományra. A `carId` a
    // GPSmart saját, belső jármű-azonosítója (nem a mi `kamion.id`-nk!) —
    // ezt a frontend a korábban már lekért `lekerdezPoziciok()` válasz
    // `car_id` mezőjéből ismeri, nem kell hozzá külön feloldás/tárolás:
    // a `car_id` csak az adott cég saját GPSmart-fiókjának névterében
    // értelmezhető, amit itt a cég saját (ceg_id szerinti) beállítása
    // választ ki, tehát más cég nem tudna vele idegen adatot lekérni.
    // A GPSmart HTML-válaszát soronként dolgozzuk fel DOMDocument-tel — élő
    // teszttel megerősítve: egy kb. 1 hónapos tartomány feldolgozása
    // önmagában (nem a hálózati hívás) túllépheti a PHP alapértelmezett
    // 30 másodperces `max_execution_time`-ját, ami egy EL NEM KAPHATÓ
    // PHP Fatal Error-t (nem Exception!) okoz — a hívó nyers 500-as hibát
    // kap, a `try/catch` ezt nem tudja szépen kezelni. Ezért a tartományt
    // itt, a hívás előtt korlátozzuk.
    const MAX_UTVONAL_NAPOK = 7;

    public function lekerdezUtvonal($ceg_id, $carId, $datumTol, $datumIg) {
        try {
            $napok = (strtotime($datumIg) - strtotime($datumTol)) / 86400;
            if ($napok < 0) {
                return ['success' => false, 'message' => 'A "dátumig" nem lehet korábbi, mint a "dátumtól".'];
            }
            if ($napok > self::MAX_UTVONAL_NAPOK) {
                return ['success' => false, 'message' => 'Legfeljebb ' . self::MAX_UTVONAL_NAPOK . ' napos tartomány kérdezhető le egyszerre — szűkítsd a dátumtartományt.'];
            }

            $stmt = $this->db->prepare('SELECT felhasznalonev, jelszo_titkositva, userid FROM gpsmart_beallitasok WHERE admin = :admin');
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->execute();
            $beallitas = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$beallitas) {
                return ['success' => false, 'message' => 'A GPSmart kapcsolat még nincs beállítva ehhez a céghez.'];
            }

            $client = new GpsmartClient(
                $beallitas['felhasznalonev'],
                $this->visszafejt($beallitas['jelszo_titkositva']),
                $beallitas['userid']
            );
            $utvonal = $client->lekerdezUtvonal($carId, $datumTol, $datumIg);

            return ['success' => true] + $utvonal;
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Jármű-kihasználtsági riport — a GPSmart útvonal-lekérdezés már ma is
    // visszaadja az `allasido`/`menetido` napi összesítőt (ld.
    // `lekerdezUtvonal()`/ElozmenyekModal.js), de eddig sehol nem volt
    // trendezve/összesítve flottaszinten — pedig ez pontosan megmutatja,
    // melyik kamion áll feleslegesen sokat egy adott időszakban. A `carId`
    // hiányában (nincs GPSmart-párosítás) vagy CAN-busz integrációjú
    // járműveknél (nincs menetidő-mező) az adott jármű
    // `kihasznaltsagSzazalek: null`-lal kerül vissza, nem
    // dobja el a teljes riportot egyetlen hiányzó/hibás jármű miatt.
    public function getKihasznaltsagiRiport($ceg_id, $datumTol, $datumIg) {
        $napok = (strtotime($datumIg) - strtotime($datumTol)) / 86400;
        if ($napok < 0) {
            return ['success' => false, 'message' => 'A "dátumig" nem lehet korábbi, mint a "dátumtól".'];
        }
        if ($napok > self::MAX_UTVONAL_NAPOK) {
            return ['success' => false, 'message' => 'Legfeljebb ' . self::MAX_UTVONAL_NAPOK . ' napos tartomány kérdezhető le egyszerre — szűkítsd a dátumtartományt.'];
        }

        $poziciok = $this->lekerdezPoziciok($ceg_id);
        if (!$poziciok['success']) {
            return $poziciok;
        }

        $eredmeny = [];
        foreach ($poziciok['poziciok'] as $p) {
            if ((empty($p['kamion_id']) && empty($p['furgon_id'])) || empty($p['car_id'])) {
                continue;
            }

            $sor = [
                'kamion_id' => $p['kamion_id'],
                'furgon_id' => $p['furgon_id'] ?? null,
                'jarmu_tipus' => $p['jarmu_tipus'] ?? ($p['kamion_id'] ? 'kamion' : 'furgon'),
                'rendszam' => $p['rendszam'],
                'menetidoOra' => null,
                'allasidoOra' => null,
                'kihasznaltsagSzazalek' => null,
            ];

            try {
                $utvonal = $this->lekerdezUtvonal($ceg_id, $p['car_id'], $datumTol, $datumIg);
                if ($utvonal['success']) {
                    $menetidoOra = $this->idoSzovegOraDecimalra($utvonal['osszesito']['menetido'] ?? null);
                    $allasidoOra = $this->idoSzovegOraDecimalra($utvonal['osszesito']['allasido'] ?? null);
                    $sor['menetidoOra'] = $menetidoOra;
                    $sor['allasidoOra'] = $allasidoOra;
                    if ($menetidoOra !== null && $allasidoOra !== null && ($menetidoOra + $allasidoOra) > 0) {
                        $sor['kihasznaltsagSzazalek'] = round($menetidoOra / ($menetidoOra + $allasidoOra) * 100, 1);
                    }
                }
            } catch (Exception $e) {
                // Egy jármű hibás/időtúllépéses lekérdezése ne dobja el a
                // teljes riportot — a sor null adatokkal marad, a többi
                // jármű eredménye attól még megjelenik.
            }

            $eredmeny[] = $sor;
        }

        // A legkevésbé kihasznált jármű elöl (null a végén) — ez a
        // leginkább actionable sorrend egy flottaméretezési döntéshez.
        usort($eredmeny, function ($a, $b) {
            if ($a['kihasznaltsagSzazalek'] === null && $b['kihasznaltsagSzazalek'] === null) return 0;
            if ($a['kihasznaltsagSzazalek'] === null) return 1;
            if ($b['kihasznaltsagSzazalek'] === null) return -1;
            return $a['kihasznaltsagSzazalek'] <=> $b['kihasznaltsagSzazalek'];
        });

        return ['success' => true, 'jarmuvek' => $eredmeny];
    }

    // A GPSmart "menetidő" mezője "Ó:PP" (pl. "8:23") vagy "Ó:PP:MP" alakú
    // szöveg — élő teszttel megerősítve ez a tényleges formátum GPS-alapú
    // járműveknél (CAN-busz integrációjú járműveknél a mező hiányzik, ld.
    // fenti komment).
    private function idoSzovegOraDecimalra($ido) {
        if (empty($ido)) {
            return null;
        }
        if (!preg_match('/^(\d+):(\d{2})(?::(\d{2}))?$/', trim($ido), $m)) {
            return null;
        }
        $ora = (int) $m[1];
        $perc = (int) $m[2];
        $mp = isset($m[3]) ? (int) $m[3] : 0;
        return round($ora + $perc / 60 + $mp / 3600, 2);
    }

    // A "Megtett út" szöveg mindig "SZÁM km" alakú (pl. "30.35 km", tizedes
    // PONTTAL, nem magyar tizedesvesszővel — élő teszttel megerősítve),
    // de a `parsePenz()`-hez hasonlóan itt is defenzíven csak a
    // számjegyeket/pontot tartjuk meg, hátha egy jövőbeli GPSmart-sablon
    // mást ad vissza.
    private function kmSzovegSzamra($szoveg) {
        $szam = preg_replace('/[^0-9.]/', '', (string) $szoveg);
        return $szam === '' ? 0.0 : (float) $szam;
    }

    // A napi km-gyorsítótár (`gpsmart_napi_km`) írási oldala — egy ≤7 napos
    // GPSmart-lekérdezés `szakaszok` (útszakaszok) listáját napi bontásban
    // összegzi (a `tol` dátumrésze alapján), és soronként ír a cache-be.
    //
    // A MAI NAP SOSEM kerül a cache-be, még akkor sem, ha benne van a kért
    // tartományban — a nap még nem zárult le, a kamion estig tovább
    // mehetett (ld. korábbi beszélgetés: "délben lekérdezi, este már nem"
    // probléma). Csak LEZÁRT (tegnapi vagy korábbi) napok számítanak
    // véglegesnek; a mai napot mindig annak kell élőben lekérdeznie, akinek
    // ténylegesen kell (ez a metódus nem arra való).
    // `$kamionId`/`$furgonId`: kölcsönösen kizáró — a hívó (a cron, ld.
    // gpsmart_km_cache_frissites.php) a `lekerdezPoziciok()` `jarmu_tipus`
    // mezője alapján dönti el, melyiket adja meg.
    public function frissitNapiKm($ceg_id, $carId, $kamionId, $datumTol, $datumIg, $furgonId = null) {
        $ma = date('Y-m-d');
        $utvonal = $this->lekerdezUtvonal($ceg_id, $carId, $datumTol, $datumIg);
        if (!$utvonal['success']) {
            return $utvonal;
        }

        $napiOsszeg = [];
        foreach (($utvonal['szakaszok'] ?? []) as $sz) {
            $datum = substr((string) ($sz['tol'] ?? ''), 0, 10);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum) || $datum >= $ma) {
                continue;
            }
            $napiOsszeg[$datum] = ($napiOsszeg[$datum] ?? 0) + $this->kmSzovegSzamra($sz['megtett_ut'] ?? null);
        }

        // A tartományban lévő, de a `szakaszok`-ban egyáltalán nem szereplő
        // (lezárt) napokat is véglegesként mentjük, 0 km-rel — ez a
        // "tényleg nem ment sehova aznap" eset, nem "még nem kérdeztük le",
        // különben minden jövőbeli lekérdezés feleslegesen újra megpróbálná.
        $datumMutato = new DateTime($datumTol);
        $vegDatum = new DateTime($datumIg);
        while ($datumMutato <= $vegDatum) {
            $datum = $datumMutato->format('Y-m-d');
            if ($datum < $ma && !isset($napiOsszeg[$datum])) {
                $napiOsszeg[$datum] = 0.0;
            }
            $datumMutato->modify('+1 day');
        }

        // `jarmu_tipus`+`jarmu_id` — NEM két külön nullázható oszlop (ld. a
        // fenti paraméter-komment: élőben bizonyítottan hibás lett volna az
        // `ON DUPLICATE KEY UPDATE` NULL-lal).
        $jarmuTipus = $furgonId ? 'furgon' : 'kamion';
        $jarmuId = $furgonId ?: $kamionId;
        $stmt = $this->db->prepare(
            'INSERT INTO gpsmart_napi_km (admin, jarmu_tipus, jarmu_id, datum, km, frissitve)
             VALUES (:admin, :jarmu_tipus, :jarmu_id, :datum, :km, NOW())
             ON DUPLICATE KEY UPDATE km = :km2, frissitve = NOW()'
        );
        foreach ($napiOsszeg as $datum => $km) {
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindValue(':jarmu_tipus', $jarmuTipus);
            $stmt->bindValue(':jarmu_id', $jarmuId, PDO::PARAM_INT);
            $stmt->bindValue(':datum', $datum);
            $stmt->bindValue(':km', round($km, 2));
            $stmt->bindValue(':km2', round($km, 2));
            $stmt->execute();
        }

        return ['success' => true, 'cachelt_napok' => count($napiOsszeg)];
    }

    // A napi km-gyorsítótár olvasási/rés-kereső oldala — TISZTÁN a DB
    // cache-t nézi, sosem hív GPSmart-ot (azt csak a `frissitNapiKm()`
    // teszi, amit a cron hív). A mai napot itt is szándékosan kihagyjuk a
    // "hiányzó" napok közül, mert azt sosem várjuk el a cache-től.
    public function getNapiKmHianyzoNapok($kamion_id, $datumTol, $datumIg, $furgon_id = null) {
        $ma = date('Y-m-d');
        $vegDatumIg = min($datumIg, date('Y-m-d', strtotime('-1 day')));
        if ($vegDatumIg < $datumTol) {
            return [];
        }

        $jarmuTipus = $furgon_id ? 'furgon' : 'kamion';
        $jarmuId = $furgon_id ?: $kamion_id;
        $stmt = $this->db->prepare(
            'SELECT datum FROM gpsmart_napi_km WHERE jarmu_tipus = :jarmu_tipus AND jarmu_id = :jarmu_id AND datum BETWEEN :tol AND :ig'
        );
        $stmt->bindValue(':jarmu_tipus', $jarmuTipus);
        $stmt->bindValue(':jarmu_id', $jarmuId, PDO::PARAM_INT);
        $stmt->bindValue(':tol', $datumTol);
        $stmt->bindValue(':ig', $vegDatumIg);
        $stmt->execute();
        $meglevo = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

        $hianyzo = [];
        $datumMutato = new DateTime($datumTol);
        $vegDatum = new DateTime($vegDatumIg);
        while ($datumMutato <= $vegDatum) {
            $datum = $datumMutato->format('Y-m-d');
            if (!isset($meglevo[$datum]) && $datum < $ma) {
                $hianyzo[] = $datum;
            }
            $datumMutato->modify('+1 day');
        }
        return $hianyzo;
    }
}

$gpsmartInterface = new GpsmartInterface();
