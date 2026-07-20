<?php

require_once __DIR__ . '/../WebPushSender.php';

// R11 (fejlesztési audit, 2026-07-19): Web Push feliratkozások tárolása +
// tényleges küldés. A `public/service-worker.js` (ld. ott a `push` event
// listener) már a meglévő PWA-infrastruktúrára épül — ez csak a hiányzó
// másik felét adja hozzá: a feliratkozás perzisztálását és a szerver
// oldali küldést (WebPushSender, composer-függőség nélkül).
class PushInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Ugyanaz a böngészőnkénti "írás-only" minta, mint a GPSmart/NAV
    // jelszavaknál: egy adott `endpoint` (böngésző-eszköz) mindig csak egy
    // admin-hoz tartozhat — újra-feliratkozáskor (pl. kulcs-csere) az
    // `ON DUPLICATE KEY UPDATE` frissíti a meglévő sort ahelyett, hogy
    // duplikálná.
    public function saveFeliratkozas($admin_id, $endpoint, $p256dh, $auth) {
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO push_feliratkozasok (admin_id, endpoint, p256dh, auth_kulcs)
                 VALUES (:admin_id, :endpoint, :p256dh, :auth_kulcs)
                 ON DUPLICATE KEY UPDATE admin_id = :admin_id2, p256dh = :p256dh2, auth_kulcs = :auth_kulcs2'
            );
            $stmt->bindValue(':admin_id', $admin_id);
            $stmt->bindValue(':endpoint', $endpoint);
            $stmt->bindValue(':p256dh', $p256dh);
            $stmt->bindValue(':auth_kulcs', $auth);
            $stmt->bindValue(':admin_id2', $admin_id);
            $stmt->bindValue(':p256dh2', $p256dh);
            $stmt->bindValue(':auth_kulcs2', $auth);
            $stmt->execute();
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteFeliratkozas($admin_id, $endpoint) {
        $stmt = $this->db->prepare('DELETE FROM push_feliratkozasok WHERE admin_id = :admin_id AND endpoint = :endpoint');
        $stmt->bindValue(':admin_id', $admin_id);
        $stmt->bindValue(':endpoint', $endpoint);
        $stmt->execute();
        return ['success' => true];
    }

    public function vanFeliratkozva($admin_id) {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM push_feliratkozasok WHERE admin_id = :admin_id');
        $stmt->bindValue(':admin_id', $admin_id);
        $stmt->execute();
        return ['success' => true, 'van' => (int) $stmt->fetchColumn() > 0];
    }

    // Egy adott admin MINDEN feliratkozott eszközének elküldi ugyanazt az
    // üzenetet. A már érvénytelen (404/410 — a felhasználó a böngészőjében
    // visszavonta az engedélyt, vagy törölte az appot) feliratkozásokat
    // rögtön törli is — enélkül ezek némán, örökre próbálkozó, garantáltan
    // sikertelen küldési kísérletek maradnának.
    public function sendPushAdminnak($admin_id, $cim, $szoveg, $url = null) {
        global $apiConfig;
        if (empty($apiConfig['vapidPrivateKeyPem']) || empty($apiConfig['vapidPublicKey'])) {
            return;
        }

        $stmt = $this->db->prepare('SELECT endpoint, p256dh, auth_kulcs FROM push_feliratkozasok WHERE admin_id = :admin_id');
        $stmt->bindValue(':admin_id', $admin_id);
        $stmt->execute();
        $feliratkozasok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($feliratkozasok)) {
            return;
        }

        $sender = new WebPushSender($apiConfig['vapidPrivateKeyPem'], $apiConfig['vapidPublicKey'], $apiConfig['vapidSubject']);
        $payload = ['title' => $cim, 'body' => $szoveg, 'url' => $url ?: '/admin/dashboard'];

        foreach ($feliratkozasok as $f) {
            try {
                $status = $sender->send([
                    'endpoint' => $f['endpoint'],
                    'p256dh' => $f['p256dh'],
                    'auth' => $f['auth_kulcs'],
                ], $payload);

                if ($status === 404 || $status === 410) {
                    $this->deleteFeliratkozas($admin_id, $f['endpoint']);
                }
            } catch (Exception $e) {
                // Egy hibás/lejárt feliratkozás ne akadályozza a többi
                // eszköz értesítését — ugyanaz a védelmi minta, mint a
                // GPSmart flotta-riportoknál (egy jármű hibája nem dobja
                // el a többi jármű eredményét).
                error_log('Web push küldés sikertelen: ' . $e->getMessage());
            }
        }
    }
}

$pushInterface = new PushInterface();
