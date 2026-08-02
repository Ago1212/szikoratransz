<?php

require_once __DIR__ . '/../WebPushSender.php';

// R11 (fejlesztési audit, 2026-07-19): Web Push feliratkozások tárolása +
// tényleges küldés. A `public/service-worker.js` (ld. ott a `push` event
// listener) már a meglévő PWA-infrastruktúrára épül — ez csak a hiányzó
// másik felét adja hozzá: a feliratkozás perzisztálását és a szerver
// oldali küldést (WebPushSender, composer-függőség nélkül).
//
// 2026-07-28: admin+sofőr címzettre általánosítva (ld. docs/superpowers/
// specs/2026-07-28-fuvar-first-workflow-design.md 4.3/5.5) — korábban
// kizárólag admin-munkamenetre épült (`admin_id` oszlop). A
// `felhasznalo_tipus`/`felhasznalo_id` pár ugyanaz a minta, mint
// `beerkezett_dokumentumok.feltolto_tipus`/`feltolto_id`.
class PushInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Ugyanaz a böngészőnkénti "írás-only" minta, mint a GPSmart/NAV
    // jelszavaknál: egy adott `endpoint` (böngésző-eszköz) mindig csak egy
    // felhasználóhoz tartozhat — újra-feliratkozáskor (pl. kulcs-csere) az
    // `ON DUPLICATE KEY UPDATE` frissíti a meglévő sort ahelyett, hogy
    // duplikálná.
    public function saveFeliratkozas($felhasznaloTipus, $felhasznaloId, $endpoint, $p256dh, $auth) {
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO push_feliratkozasok (felhasznalo_tipus, felhasznalo_id, endpoint, p256dh, auth_kulcs)
                 VALUES (:felhasznalo_tipus, :felhasznalo_id, :endpoint, :p256dh, :auth_kulcs)
                 ON DUPLICATE KEY UPDATE felhasznalo_tipus = :felhasznalo_tipus2, felhasznalo_id = :felhasznalo_id2, p256dh = :p256dh2, auth_kulcs = :auth_kulcs2'
            );
            $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
            $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
            $stmt->bindValue(':endpoint', $endpoint);
            $stmt->bindValue(':p256dh', $p256dh);
            $stmt->bindValue(':auth_kulcs', $auth);
            $stmt->bindValue(':felhasznalo_tipus2', $felhasznaloTipus);
            $stmt->bindValue(':felhasznalo_id2', $felhasznaloId);
            $stmt->bindValue(':p256dh2', $p256dh);
            $stmt->bindValue(':auth_kulcs2', $auth);
            $stmt->execute();
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteFeliratkozas($felhasznaloTipus, $felhasznaloId, $endpoint) {
        $stmt = $this->db->prepare(
            'DELETE FROM push_feliratkozasok WHERE felhasznalo_tipus = :felhasznalo_tipus AND felhasznalo_id = :felhasznalo_id AND endpoint = :endpoint'
        );
        $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
        $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
        $stmt->bindValue(':endpoint', $endpoint);
        $stmt->execute();
        return ['success' => true];
    }

    public function vanFeliratkozva($felhasznaloTipus, $felhasznaloId) {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM push_feliratkozasok WHERE felhasznalo_tipus = :felhasznalo_tipus AND felhasznalo_id = :felhasznalo_id'
        );
        $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
        $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
        $stmt->execute();
        return ['success' => true, 'van' => (int) $stmt->fetchColumn() > 0];
    }

    // Egy adott felhasználó MINDEN feliratkozott eszközének elküldi
    // ugyanazt az üzenetet. A már érvénytelen (404/410) feliratkozásokat
    // rögtön törli is.
    private function kuldMinden($felhasznaloTipus, $felhasznaloId, $cim, $szoveg, $url, $alapertelmezettUrl, $tag = null) {
        global $apiConfig;
        if (empty($apiConfig['vapidPrivateKeyPem']) || empty($apiConfig['vapidPublicKey'])) {
            return;
        }

        $stmt = $this->db->prepare(
            'SELECT endpoint, p256dh, auth_kulcs FROM push_feliratkozasok WHERE felhasznalo_tipus = :felhasznalo_tipus AND felhasznalo_id = :felhasznalo_id'
        );
        $stmt->bindValue(':felhasznalo_tipus', $felhasznaloTipus);
        $stmt->bindValue(':felhasznalo_id', $felhasznaloId);
        $stmt->execute();
        $feliratkozasok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($feliratkozasok)) {
            return;
        }

        $sender = new WebPushSender($apiConfig['vapidPrivateKeyPem'], $apiConfig['vapidPublicKey'], $apiConfig['vapidSubject']);
        $payload = ['title' => $cim, 'body' => $szoveg, 'url' => $url ?: $alapertelmezettUrl];
        if ($tag) {
            $payload['tag'] = $tag;
        }

        foreach ($feliratkozasok as $f) {
            try {
                $status = $sender->send([
                    'endpoint' => $f['endpoint'],
                    'p256dh' => $f['p256dh'],
                    'auth' => $f['auth_kulcs'],
                ], $payload);

                if ($status === 404 || $status === 410) {
                    $this->deleteFeliratkozas($felhasznaloTipus, $felhasznaloId, $f['endpoint']);
                }
            } catch (Exception $e) {
                error_log('Web push küldés sikertelen: ' . $e->getMessage());
            }
        }
    }

    public function sendPushAdminnak($admin_id, $cim, $szoveg, $url = null, $tag = null) {
        $this->kuldMinden('admin', $admin_id, $cim, $szoveg, $url, '/admin/dashboard', $tag);
    }

    // Új: sofőr-címzett push (ld. docs/superpowers/specs/2026-07-28-fuvar-
    // first-workflow-design.md 5.4/5.5) — jelenleg egyetlen hívója az "új
    // fuvar hozzárendelve" esemény (ApiHandler newFuvar/updateFuvar).
    // `$tag` opcionális: ha meg van adva, egy UGYANARRA a fuvarra érkező
    // ismételt push (pl. admin javítja az útvonalat) lecseréli a
    // korábbi értesítést a sofőr eszközén ahelyett, hogy halmozódna —
    // ld. src/service-worker.js `renotify`/`tag` kezelése.
    public function sendPushSofornak($sofor_id, $cim, $szoveg, $url = null, $tag = null) {
        $this->kuldMinden('sofor', $sofor_id, $cim, $szoveg, $url, '/user/dashboard', $tag);
    }
}

$pushInterface = new PushInterface();
