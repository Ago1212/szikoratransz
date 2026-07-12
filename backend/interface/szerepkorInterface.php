<?php

// Cégenként (admin = ceg_id) egyéni szerepkör-katalógus. Az 'admin'
// szerepkör szándékosan NINCS a `szerepkorok` táblában — az mindig fix,
// minden cégnél elérhető, teljes hozzáférésű, nem szerkeszthető/törölhető
// "rendszer" szerepkör, ezért `getSzerepkorok()` szintetikusan fűzi az elejére.
class SzerepkorInterface {
    protected $db;

    const FOGLALT_KULCSOK = ['admin'];

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getSzerepkorok($ceg_id) {
        try {
            $query = "SELECT id, kulcs, nev FROM szerepkorok WHERE admin = :ceg_id AND torolt <> 'I' ORDER BY nev ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            $egyediek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $szerepkorok = [
                ['id' => null, 'kulcs' => 'admin', 'nev' => 'Adminisztrátor', 'rendszer' => true],
            ];
            foreach ($egyediek as $sor) {
                $szerepkorok[] = [
                    'id' => (int) $sor['id'],
                    'kulcs' => $sor['kulcs'],
                    'nev' => $sor['nev'],
                    'rendszer' => false,
                ];
            }

            return ['success' => true, 'szerepkorok' => $szerepkorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function newSzerepkor($ceg_id, $kulcs, $nev) {
        try {
            $kulcs = strtolower(trim($kulcs));
            if ($kulcs === '' || !preg_match('/^[a-z0-9_]+$/', $kulcs)) {
                return ['success' => false, 'message' => 'Érvénytelen szerepkör-azonosító.'];
            }
            if (in_array($kulcs, self::FOGLALT_KULCSOK, true)) {
                return ['success' => false, 'message' => 'Ez a szerepkör-azonosító foglalt.'];
            }

            $existing = $this->db->prepare("SELECT id FROM szerepkorok WHERE admin = :ceg_id AND kulcs = :kulcs AND torolt <> 'I'");
            $existing->bindValue(':ceg_id', $ceg_id);
            $existing->bindValue(':kulcs', $kulcs);
            $existing->execute();
            if ($existing->fetch()) {
                return ['success' => false, 'message' => 'Már létezik ilyen szerepkör.'];
            }

            $query = "INSERT INTO szerepkorok (admin, kulcs, nev) VALUES (:ceg_id, :kulcs, :nev)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':kulcs', $kulcs);
            $stmt->bindValue(':nev', trim($nev));
            $stmt->execute();

            return ['success' => true, 'message' => 'Szerepkör létrehozva.', 'szerepkor' => ['id' => $this->db->lastInsertId(), 'kulcs' => $kulcs, 'nev' => trim($nev)]];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Nem törölhető egy szerepkör, amíg van hozzá rendelt csapattag — előbb
    // át kell sorolni őket egy másik szerepkörbe, hogy senki ne maradjon
    // "árva" (nem létező) szerepkörrel.
    public function deleteSzerepkor($id, $ceg_id) {
        try {
            $find = $this->db->prepare("SELECT kulcs FROM szerepkorok WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $find->bindValue(':id', $id);
            $find->bindValue(':ceg_id', $ceg_id);
            $find->execute();
            $szerepkor = $find->fetch(PDO::FETCH_ASSOC);
            if (!$szerepkor) {
                return ['success' => false, 'message' => 'A szerepkör nem található.'];
            }

            $inUse = $this->db->prepare("SELECT COUNT(*) AS n FROM admin WHERE tulajdonos_admin_id = :ceg_id AND szerepkor = :kulcs AND torolt <> 'I'");
            $inUse->bindValue(':ceg_id', $ceg_id);
            $inUse->bindValue(':kulcs', $szerepkor['kulcs']);
            $inUse->execute();
            if ((int) $inUse->fetch(PDO::FETCH_ASSOC)['n'] > 0) {
                return ['success' => false, 'message' => 'Ehhez a szerepkörhöz még vannak hozzárendelt csapattagok — előbb helyezd át őket másik szerepkörbe.'];
            }

            $query = "UPDATE szerepkorok SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            // A hozzá tartozó, mentett jogosultság-beállítások is feleslegessé
            // válnak — ne maradjon árva `jogosultsagok` sor egy törölt
            // szerepkörhöz.
            $cleanup = $this->db->prepare("DELETE FROM jogosultsagok WHERE admin = :ceg_id AND szerepkor = :kulcs");
            $cleanup->bindValue(':ceg_id', $ceg_id);
            $cleanup->bindValue(':kulcs', $szerepkor['kulcs']);
            $cleanup->execute();

            return ['success' => true, 'message' => 'Szerepkör törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$szerepkorInterface = new SzerepkorInterface();
