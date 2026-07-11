<?php

class SoforokInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getSoforok($id) {

        try {
            $query = "SELECT * FROM user WHERE admin = :id AND admin <> id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $soforok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'soforok' => $soforok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    public function saveSoforData($data) {
        try {
            $query = "UPDATE user
                      SET name = :name,
                          email = :email,
                          phone = :phone,
                          szul_datum = :szul_datum,
                          szemelyi = :szemelyi,
                          varos = :varos,
                          irsz = :irsz,
                          cim = :cim,
                          lakcim = COALESCE(:lakcim, lakcim),
                          szemelyi_lejarat = :szemelyi_lejarat,
                          jogsi_lejarat = :jogsi_lejarat,
                          gki_lejarat = :gki_lejarat,
                          adr_lejarat = :adr_lejarat,
                          kamion = :kamion,
                          aktiv_potkocsi = :aktiv_potkocsi
                      WHERE id = :id";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindParam(':id', $data['id'], PDO::PARAM_INT);
            $stmt->bindParam(':name', $data['name'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':phone', $data['phone'], PDO::PARAM_STR);
            $stmt->bindParam(':szul_datum', $data['szul_datum'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi', $data['szemelyi'], PDO::PARAM_STR);
            $stmt->bindParam(':varos', $data['varos'], PDO::PARAM_STR);
            $stmt->bindParam(':irsz', $data['irsz'], PDO::PARAM_STR);
            $stmt->bindParam(':cim', $data['cim'], PDO::PARAM_STR);
            $stmt->bindParam(':lakcim', $data['lakcim'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi_lejarat', $data['szemelyi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':jogsi_lejarat', $data['jogsi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':gki_lejarat', $data['gki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);
            // Elsődleges jármű-hozzárendelés — közvetlenül az admin
            // állítja be itt, jóváhagyás nélkül (a sofőr saját maga
            // csak kérést küldhet, ld. jarmuValtasInterface).
            $kamion = !empty($data['kamion']) ? $data['kamion'] : null;
            $aktivPotkocsi = !empty($data['aktiv_potkocsi']) ? $data['aktiv_potkocsi'] : null;
            $stmt->bindValue(':kamion', $kamion);
            $stmt->bindValue(':aktiv_potkocsi', $aktivPotkocsi);

            // Lekérdezés végrehajtása
            $stmt->execute();

            return ['success' => true, 'message' => 'Sofőr adatai sikeresen frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    public function newSofor($data) {
        try {
            $query = "INSERT INTO user 
                      (admin,name, email, phone, szul_datum, szemelyi, varos, irsz, cim, szemelyi_lejarat, jogsi_lejarat, gki_lejarat, adr_lejarat) 
                      VALUES 
                      (:admin,:name, :email, :phone, :szul_datum, :szemelyi, :varos, :irsz, :cim, :szemelyi_lejarat, :jogsi_lejarat, :gki_lejarat, :adr_lejarat)";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindParam(':admin', $data['admin'], PDO::PARAM_STR);
            $stmt->bindParam(':name', $data['name'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':phone', $data['phone'], PDO::PARAM_STR);
            $stmt->bindParam(':szul_datum', $data['szul_datum'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi', $data['szemelyi'], PDO::PARAM_STR);
            $stmt->bindParam(':varos', $data['varos'], PDO::PARAM_STR);
            $stmt->bindParam(':irsz', $data['irsz'], PDO::PARAM_STR);
            $stmt->bindParam(':cim', $data['cim'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi_lejarat', $data['szemelyi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':jogsi_lejarat', $data['jogsi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':gki_lejarat', $data['gki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);

            // Lekérdezés végrehajtása
            $stmt->execute();

            $newSoforId = $this->db->lastInsertId();
            $newSoforData = $this->getSofor($newSoforId);

            return ['success' => true, 'message' => 'Sofőr adatai sikeresen beszúrva.', 'sofor' => $newSoforData];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteSofor($id) {
        try {
            $query = "UPDATE user SET torolt='I' WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Sofőr törölve'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }


    private function getSofor($id) {
        $query = "SELECT * FROM user WHERE id = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Sofőr saját, friss adatai — a munkamenetben tárolt `user` a
    // bejelentkezéskori állapot, ez nem frissül automatikusan, ha pl.
    // az admin időközben jóváhagyta a jármű-váltási kérését. A sofőr
    // oldali Kezdőlap ezzel frissíti a sessionStorage-ban tárolt
    // kamion/aktiv_potkocsi mezőket minden betöltéskor.
    public function getSajatSofor($id) {
        $sofor = $this->getSofor($id);
        if (!$sofor) {
            return ['success' => false, 'message' => 'Sofőr nem található.'];
        }
        unset($sofor['password']);
        return ['success' => true, 'user' => $sofor];
    }
}

$soforokInterface = new SoforokInterface();
