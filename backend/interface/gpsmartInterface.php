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

            foreach ($poziciok as &$pozicio) {
                $kulcs = strtoupper(trim($pozicio['rendszam']));
                $pozicio['kamion_id'] = $kamionokRendszamSzerint[$kulcs] ?? null;
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
    public function lekerdezUtvonal($ceg_id, $carId, $datumTol, $datumIg) {
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
            $utvonal = $client->lekerdezUtvonal($carId, $datumTol, $datumIg);

            return ['success' => true] + $utvonal;
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$gpsmartInterface = new GpsmartInterface();
