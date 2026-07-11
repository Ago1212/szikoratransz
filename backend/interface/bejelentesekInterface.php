<?php

// Korábban ez az osztály minden hívásra ugyanazt az 5 hardcode-olt PHP
// tömböt adta vissza, a valós insert/update/delete metódusai pedig
// definiálatlan változókra (`$kamion`, `$felhasznalo`, `$bejelentes`)
// hivatkoztak `$data` helyett — sosem működtek volna. Emellett a
// `newBejelentes`/`saveBejelentesData`/`deleteBejelentes` akciók az
// `ApiHandler::getActions()`-ből is hiányoztak, így a `validation()`
// "Invalid action" hibával elutasította volna őket, még mielőtt
// idáig eljutottak volna. A teljes Bejelentések funkció mindkét oldalon
// (admin böngészés, sofőr bejelentés-küldés) ténylegesen törött volt.
class BejelentesekInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Admin oldali böngészés — a meglévő UX szerint kamiononként listáz.
    // A projekt konvenciója szerint (lásd ApiHandler::getEsemenyek) a
    // táblákat sosem kapcsoljuk össze egy lekérdezésen belül — a
    // kapcsolódó neveket külön lekérdezéssel töltjük be, és PHP oldalon
    // fűzzük össze.
    public function getBejelentesek($kamion) {
        try {
            $query = "SELECT * FROM bejelentesek WHERE kamion_id = :kamion AND torolt <> 'I' ORDER BY bejelentve DESC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':kamion', $kamion);
            $stmt->execute();
            $bejelentesek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $soforNevek = $this->getSoforNevek();
            foreach ($bejelentesek as &$b) {
                $b['sofor_nev'] = $soforNevek[$b['sofor_id']] ?? null;
            }

            return ['success' => true, 'bejelentesek' => $bejelentesek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Sofőr oldali nézet — saját bejelentései, státusszal.
    public function getBejelentesekSofor($sofor_id) {
        try {
            $query = "SELECT * FROM bejelentesek WHERE sofor_id = :sofor_id AND torolt <> 'I' ORDER BY bejelentve DESC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':sofor_id', $sofor_id);
            $stmt->execute();
            $bejelentesek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $kamionRendszamok = $this->getKamionRendszamok();
            foreach ($bejelentesek as &$b) {
                $b['kamion_rendszam'] = $kamionRendszamok[$b['kamion_id']] ?? null;
            }

            return ['success' => true, 'bejelentesek' => $bejelentesek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function getSoforNevek() {
        $stmt = $this->db->query("SELECT id, name FROM user WHERE torolt <> 'I'");
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['name'];
        }
        return $map;
    }

    private function getKamionRendszamok() {
        $stmt = $this->db->query("SELECT id, rendszam FROM kamion WHERE torolt <> 'I'");
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['rendszam'];
        }
        return $map;
    }

    // Az admin (tulajdonos cég) azonosítót szándékosan NEM a kliens által
    // küldött `admin` mezőből vesszük elsődlegesen, hanem szerveroldalon
    // vezetjük le a sofőr saját `user.admin` FK-jából. A sofőr saját
    // munkamenetében ugyanis a `user.admin` érték a bejelentkezéskor
    // futó `SELECT *, false as admin FROM user` lekérdezés miatt mindig
    // 0-ra (false) íródik felül — a `*` és a `false as admin` azonos nevű
    // oszlopot ad vissza, és PDO a duplikált kulcsnál az utolsót tartja
    // meg —, tehát a frontend sosem tudja megbízhatóan elküldeni a valós
    // tulajdonos-admin id-t sofőrként bejelentkezve. Adminként létrehozott
    // bejelentésnél ($data['admin'] explicit meg van adva) ez a kliens
    // által küldött érték marad az elsődleges forrás.
    private function resolveAdmin($data) {
        if (!empty($data['admin'])) {
            return $data['admin'];
        }
        if (!empty($data['sofor_id'])) {
            $stmt = $this->db->prepare("SELECT admin FROM user WHERE id = :id");
            $stmt->bindValue(':id', $data['sofor_id']);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return $row['admin'];
            }
        }
        return null;
    }

    public function newBejelentes($data) {
        try {
            $admin = $this->resolveAdmin($data);
            if (empty($admin)) {
                return ['success' => false, 'message' => 'A tulajdonos admin nem határozható meg (hiányzó admin/sofor_id).'];
            }

            $query = "INSERT INTO bejelentesek (admin, kamion_id, sofor_id, tipus, lat, lng, cim, leiras, prioritas)
                      VALUES (:admin, :kamion_id, :sofor_id, :tipus, :lat, :lng, :cim, :leiras, :prioritas)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $admin);
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':sofor_id', empty($data['sofor_id']) ? null : $data['sofor_id']);
            $stmt->bindValue(':tipus', empty($data['tipus']) ? 'egyeb' : $data['tipus']);
            $stmt->bindValue(':lat', $data['lat'] ?? null);
            $stmt->bindValue(':lng', $data['lng'] ?? null);
            $stmt->bindValue(':cim', $data['cim'] ?? '');
            $stmt->bindValue(':leiras', $data['leiras'] ?? '');
            $stmt->bindValue(':prioritas', empty($data['prioritas']) ? 'kozepes' : $data['prioritas']);
            $stmt->execute();

            return ['success' => true, 'message' => 'Bejelentés elküldve.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function saveBejelentesData($data) {
        try {
            $lezarva = $data['statusz'] === 'lezart' ? date('Y-m-d H:i:s') : null;
            $query = "UPDATE bejelentesek SET
                      cim = :cim, leiras = :leiras, prioritas = :prioritas, statusz = :statusz,
                      admin_valasz = :admin_valasz, lezarva = COALESCE(:lezarva, lezarva)
                      WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':cim', $data['cim'] ?? '');
            $stmt->bindValue(':leiras', $data['leiras'] ?? '');
            $stmt->bindValue(':prioritas', empty($data['prioritas']) ? 'kozepes' : $data['prioritas']);
            $stmt->bindValue(':statusz', empty($data['statusz']) ? 'uj' : $data['statusz']);
            $stmt->bindValue(':admin_valasz', $data['admin_valasz'] ?? null);
            $stmt->bindValue(':lezarva', $lezarva);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
            $stmt->execute();

            return ['success' => true, 'message' => 'Bejelentés frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Bejelentésből karbantartás generálása — a bejelentés kamionjához
    // létrehoz egy új karbantartási rekordot (a leírásból), és a
    // bejelentést a létrehozott karbantartáshoz köti (`karbantartas_id`),
    // hogy a szerkesztő felület ez alapján tudja, már intézkedés történt.
    // A km-óraállást a kamion utoljára rögzített `aktualis_km` értékéből
    // tölti ki — ez az egyetlen adat, ami a bejelentésből nem derül ki,
    // de a jármű törzsadatából már ismert. Pótkocsihoz kötött
    // karbantartást szándékosan nem generál — a bejelentesek tábla ma
    // csak kamion_id-t tárol, potkocsi_id-t nem.
    public function generateKarbantartasFromBejelentes($id) {
        try {
            $query = "SELECT * FROM bejelentesek WHERE id = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $bejelentes = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$bejelentes) {
                return ['success' => false, 'message' => 'A bejelentés nem található.'];
            }
            if (!empty($bejelentes['karbantartas_id'])) {
                return ['success' => false, 'message' => 'Ehhez a bejelentéshez már tartozik karbantartás.'];
            }
            if (empty($bejelentes['kamion_id'])) {
                return ['success' => false, 'message' => 'A bejelentéshez nincs kamion rendelve, így karbantartás sem generálható belőle.'];
            }

            $kamionStmt = $this->db->prepare("SELECT aktualis_km FROM kamion WHERE id = :id");
            $kamionStmt->bindValue(':id', $bejelentes['kamion_id']);
            $kamionStmt->execute();
            $kamion = $kamionStmt->fetch(PDO::FETCH_ASSOC);
            $kmOraallas = $kamion && !empty($kamion['aktualis_km']) ? $kamion['aktualis_km'] : null;

            $log = $bejelentes['cim'] . (!empty($bejelentes['leiras']) ? (' — ' . $bejelentes['leiras']) : '');
            $ma = date('Y-m-d');

            $insertQuery = "INSERT INTO kamion_karbantartars (kamion_id, admin, datum, log, km_oraallas, torolt)
                             VALUES (:kamion_id, :admin, :datum, :log, :km_oraallas, 'N')";
            $insertStmt = $this->db->prepare($insertQuery);
            $insertStmt->bindValue(':kamion_id', $bejelentes['kamion_id']);
            $insertStmt->bindValue(':admin', $bejelentes['admin']);
            $insertStmt->bindValue(':datum', $ma);
            $insertStmt->bindValue(':log', $log);
            $insertStmt->bindValue(':km_oraallas', $kmOraallas);
            $insertStmt->execute();
            $karbantartasId = $this->db->lastInsertId();

            $updateQuery = "UPDATE bejelentesek SET karbantartas_id = :karbantartas_id, statusz = IF(statusz = 'uj', 'folyamatban', statusz) WHERE id = :id";
            $updateStmt = $this->db->prepare($updateQuery);
            $updateStmt->bindValue(':karbantartas_id', $karbantartasId);
            $updateStmt->bindValue(':id', $id);
            $updateStmt->execute();

            return ['success' => true, 'message' => 'Karbantartás létrehozva a bejelentésből.', 'karbantartas_id' => $karbantartasId];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteBejelentes($id) {
        try {
            $query = "UPDATE bejelentesek SET torolt = 'I' WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Bejelentés törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$bejelentesekInterface = new BejelentesekInterface();
