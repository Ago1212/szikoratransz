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

            // Ha a rendszám alapján sikerül azonosítani a saját kamionunkat,
            // ahhoz a `user.kamion` mező alapján hozzárendeljük az aktuális
            // sofőrt is — ez a "jelenlegi" hozzárendelés, nem egy adott
            // napra visszamenőleg (a rendszer nincs napi bontásban vezetve,
            // ki melyik kamionnal ment); ha egy sofőr aznap más kamiont
            // vitt, ez nem tükrözi azt.
            $soforStmt = $this->db->prepare('SELECT kamion, name FROM user WHERE admin = :admin AND torolt <> \'I\' AND kamion IS NOT NULL');
            $soforStmt->bindValue(':admin', $ceg_id);
            $soforStmt->execute();
            $soforokKamionSzerint = [];
            foreach ($soforStmt->fetchAll(PDO::FETCH_ASSOC) as $sofor) {
                $soforokKamionSzerint[$sofor['kamion']] = $sofor['name'];
            }

            foreach ($poziciok as &$pozicio) {
                $kulcs = strtoupper(trim($pozicio['rendszam']));
                $kamionId = $kamionokRendszamSzerint[$kulcs] ?? null;
                $pozicio['kamion_id'] = $kamionId;
                $pozicio['sofor_nev'] = $kamionId ? ($soforokKamionSzerint[$kamionId] ?? null) : null;
            }

            return ['success' => true, 'poziciok' => $poziciok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
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

    // Item 6: a Vezetési idő napi bejegyzéséhez a `vezetes_ora` mező
    // becslése a GPSmart útvonal-adatból — csak a sofőr JELENLEGI
    // (`user.kamion`) kamionjához tartozó GPS-adatot tudjuk lekérni, mert
    // nincs a rendszerben napi bontású, visszamenőleges sofőr↔kamion
    // hozzárendelés-history (ld. lekerdezPoziciok() fenti komment) — ezért
    // ez a becslés csak akkor megbízható, ha a sofőr a kérdéses napon is
    // ugyanazt a kamiont vezette, mint most. A frontend ezt egy explicit
    // figyelmeztetéssel jelzi, és a visszaadott órát a felhasználó a
    // mentés előtt még szabadon módosíthatja — ez sosem ment el automatikusan,
    // csak előtölti a mezőt. Szándékosan csak a `vezetes_ora`-t becsüljük,
    // a `pihenes_ora`-t sosem (GPS-ből nem vezethető le megbízhatóan, hogy
    // a jármű állásideje közben a sofőr ténylegesen pihent-e).
    public function getVezetesJavaslat($ceg_id, $sofor_id, $datum) {
        try {
            $soforStmt = $this->db->prepare("SELECT kamion FROM user WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $soforStmt->bindValue(':id', $sofor_id);
            $soforStmt->bindValue(':ceg_id', $ceg_id);
            $soforStmt->execute();
            $sofor = $soforStmt->fetch(PDO::FETCH_ASSOC);
            if (!$sofor || empty($sofor['kamion'])) {
                return ['success' => false, 'message' => 'A sofőrhöz jelenleg nincs kamion rendelve.'];
            }

            $kamionStmt = $this->db->prepare("SELECT rendszam FROM kamion WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $kamionStmt->bindValue(':id', $sofor['kamion']);
            $kamionStmt->bindValue(':ceg_id', $ceg_id);
            $kamionStmt->execute();
            $kamion = $kamionStmt->fetch(PDO::FETCH_ASSOC);
            if (!$kamion) {
                return ['success' => false, 'message' => 'A sofőrhöz rendelt kamion nem található.'];
            }

            $poziciok = $this->lekerdezPoziciok($ceg_id);
            if (!$poziciok['success']) {
                return $poziciok;
            }

            $carId = null;
            $kulcs = strtoupper(trim($kamion['rendszam']));
            foreach ($poziciok['poziciok'] as $p) {
                if (strtoupper(trim($p['rendszam'])) === $kulcs) {
                    $carId = $p['car_id'] ?? null;
                    break;
                }
            }
            if (!$carId) {
                return ['success' => false, 'message' => 'A kamion (' . $kamion['rendszam'] . ') nem található a GPSmart flottakövetőben.'];
            }

            $utvonal = $this->lekerdezUtvonal($ceg_id, $carId, $datum, $datum);
            if (!$utvonal['success']) {
                return $utvonal;
            }

            $menetidoNyers = $utvonal['osszesito']['menetido'] ?? null;
            $oraDecimal = $this->idoSzovegOraDecimalra($menetidoNyers);
            if ($oraDecimal === null) {
                return ['success' => false, 'message' => 'Ehhez a naphoz nem érhető el vezetési idő adat a GPSmart-tól (a jármű típusától függően nem minden útvonal-adat tartalmaz menetidő-összesítést).'];
            }

            return [
                'success' => true,
                'vezetes_ora' => $oraDecimal,
                'menetido_nyers' => $menetidoNyers,
                'rendszam' => $kamion['rendszam'],
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A GPSmart "menetidő" mezője "Ó:PP" (pl. "8:23") vagy "Ó:PP:MP" alakú
    // szöveg — ld. Item 6 kutatás: élő teszttel megerősítve ez a tényleges
    // formátum GPS-alapú járműveknél (CAN-busz integrációjú járműveknél a
    // mező hiányzik, ld. fenti komment).
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
}

$gpsmartInterface = new GpsmartInterface();
