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
}

$ertesitesInterface = new ErtesitesInterface();
