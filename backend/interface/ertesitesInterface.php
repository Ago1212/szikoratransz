<?php

// A haranG-értesítések (NotificationDropdown.js) forrásai — függő
// jármű-váltási kérelmek, nyitott bejelentések — mindig a MOST élő
// állapotot tükrözik, nincs hozzájuk saját "értesítés" rekord. A "törlés"
// ezért nem magát a forrás-sort törli (az elbírálás/lezárás attól még nem
// történt meg), hanem egy külön, admin-onkénti "ezt már láttam, ne mutasd
// többé" listát vezet — a kliens (Sidebar.js) ez alapján szűri ki a
// `kulcs`-csal (pl. "bejelentes-42") azonosított tételeket a saját
// `allNotifications` tömbjéből, minden betöltéskor újra.
class ErtesitesInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function torolErtesites($admin_id, $kulcsok) {
        if (!is_array($kulcsok)) {
            $kulcsok = [$kulcsok];
        }
        $query = "INSERT IGNORE INTO ertesites_torles (admin_id, kulcs) VALUES (:admin_id, :kulcs)";
        $stmt = $this->db->prepare($query);
        foreach ($kulcsok as $kulcs) {
            if ($kulcs === '' || $kulcs === null) {
                continue;
            }
            $stmt->bindValue(':admin_id', $admin_id);
            $stmt->bindValue(':kulcs', $kulcs);
            $stmt->execute();
        }
        return ['success' => true];
    }

    public function getToroltErtesitesek($admin_id) {
        $query = "SELECT kulcs FROM ertesites_torles WHERE admin_id = :admin_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':admin_id', $admin_id);
        $stmt->execute();
        return ['success' => true, 'kulcsok' => $stmt->fetchAll(PDO::FETCH_COLUMN)];
    }

    // R12 (fejlesztési audit, 2026-07-19): a Sidebar minden betöltéskor/
    // frissítéskor meghívja ezt a MOST élő (törölt szűrés előtti) jelölt-
    // listával — `INSERT IGNORE` miatt egy már ismert `kulcs` újraküldése
    // olcsó no-op, tehát nem baj, hogy ugyanaz a kulcs sokszor újra
    // beérkezik, amíg a forrás-sor (kérelem/bejelentés) nyitva van.
    public function logErtesitesek($admin_id, $tetelek) {
        if (empty($tetelek) || !is_array($tetelek)) {
            return ['success' => true];
        }
        global $pushInterface;
        $stmt = $this->db->prepare(
            "INSERT IGNORE INTO ertesites_naplo (admin_id, kulcs, szoveg) VALUES (:admin_id, :kulcs, :szoveg)"
        );
        foreach ($tetelek as $tetel) {
            $kulcs = $tetel['kulcs'] ?? null;
            if (empty($kulcs)) {
                continue;
            }
            $szoveg = mb_substr((string) ($tetel['szoveg'] ?? ''), 0, 500);
            $stmt->bindValue(':admin_id', $admin_id);
            $stmt->bindValue(':kulcs', $kulcs);
            $stmt->bindValue(':szoveg', $szoveg);
            $stmt->execute();
            // `rowCount() === 1` csak akkor, ha ez a kulcs ÚJ volt (nem
            // `INSERT IGNORE`-olt duplikátum) — ez a push-küldés kapuja,
            // hogy egy már ismert, csak ismételten beküldött értesítés ne
            // dobjon ki push-t minden 60mp-es Sidebar-frissítésnél újra.
            if ($stmt->rowCount() === 1 && $pushInterface) {
                $pushInterface->sendPushAdminnak($admin_id, 'Új értesítés', $szoveg);
            }
        }
        return ['success' => true];
    }

    // Az admin saját, teljes értesítési előzménye — legújabb elöl. Ez a
    // lista SOSEM tűnik el a `torolErtesites()` hívástól (az csak a
    // haranG-ből rejti el, ld. a fájl tetején lévő komment), tehát egy
    // régen dismisselt riasztás is visszakereshető marad.
    public function getErtesitesNaplo($admin_id) {
        $query = "SELECT kulcs, szoveg, letrehozva FROM ertesites_naplo WHERE admin_id = :admin_id ORDER BY letrehozva DESC LIMIT 200";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':admin_id', $admin_id);
        $stmt->execute();
        return ['success' => true, 'naplo' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }
}

$ertesitesInterface = new ErtesitesInterface();
