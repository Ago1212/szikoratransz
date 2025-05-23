<?php

class KamionInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getKamionValaszto($user) {
        try {
            $query = "SELECT id, rendszam FROM kamion WHERE torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            $kamionok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'kamionok' => $kamionok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getKamionok($id) {

        try {
            $query = "SELECT * FROM kamion WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $kamionok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'kamionok' => $kamionok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function saveKamionData($data) {
        try {
            // SQL lekérdezés előkészítése az adatok frissítéséhez
            $query = "UPDATE kamion 
                      SET rendszam = :rendszam, 
                          potkocsi = :potkocsi, 
                          meret = :meret, 
                          tipus = :tipus, 
                          muszaki_lejarat = :muszaki_lejarat, 
                          adr_lejarat = :adr_lejarat, 
                          taograf_illesztes = :taograf_illesztes, 
                          emelohatfal_vizsga = :emelohatfal_vizsga, 
                          porolto_lejarat = :porolto_lejarat, 
                          porolto_lejarat_2 = :porolto_lejarat_2, 
                          kot_biztositas = :kot_biztositas, 
                          kot_biz_nev = :kot_biz_nev, 
                          kot_biz_dij = :kot_biz_dij, 
                          kot_biz_utem = :kot_biz_utem, 
                          kaszko_biztositas = :kaszko_biztositas, 
                          kaszko_nev = :kaszko_nev, 
                          kaszko_dij = :kaszko_dij, 
                          kaszko_fizetesi_utem = :kaszko_fizetesi_utem 
                      WHERE id = :id";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
            $stmt->bindParam(':potkocsi', $data['potkocsi'], PDO::PARAM_STR);
            $stmt->bindParam(':tipus', $data['tipus'], PDO::PARAM_STR);
            $stmt->bindParam(':meret', $data['meret'], PDO::PARAM_STR);
            $stmt->bindParam(':muszaki_lejarat', $data['muszaki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':taograf_illesztes', $data['taograf_illesztes'], PDO::PARAM_STR);
            $stmt->bindParam(':emelohatfal_vizsga', $data['emelohatfal_vizsga'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat', $data['porolto_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat_2', $data['porolto_lejarat_2'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biztositas', $data['kot_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_nev', $data['kot_biz_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_dij', $data['kot_biz_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_utem', $data['kot_biz_utem'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_biztositas', $data['kaszko_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_nev', $data['kaszko_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_dij', $data['kaszko_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_fizetesi_utem', $data['kaszko_fizetesi_utem'], PDO::PARAM_STR);
            $stmt->bindParam(':id', $data['id'], PDO::PARAM_INT);

            $stmt->execute();

            return ['success' => true, 'message' => 'Kamion adatai sikeresen frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    public function newKamion($data) {
        try {
            // SQL lekérdezés előkészítése az adatok beszúrásához
            $query = "INSERT INTO kamion 
                      (admin,rendszam, potkocsi,meret,tipus, muszaki_lejarat, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, porolto_lejarat, porolto_lejarat_2, kot_biztositas,kot_biz_nev, kot_biz_dij, kot_biz_utem, kaszko_biztositas,kaszko_nev, kaszko_dij, kaszko_fizetesi_utem) 
                      VALUES (:admin,:rendszam,:meret,:tipus, :potkocsi, :muszaki_lejarat, :adr_lejarat, :taograf_illesztes, :emelohatfal_vizsga, :porolto_lejarat, :porolto_lejarat_2, :kot_biztositas,:kot_biz_nev, :kot_biz_dij, :kot_biz_utem, :kaszko_biztositas, :kaszko_nev,:kaszko_dij, :kaszko_fizetesi_utem)";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindParam(':admin', $data['admin'], PDO::PARAM_STR);
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
            $stmt->bindParam(':potkocsi', $data['potkocsi'], PDO::PARAM_STR);
            $stmt->bindParam(':tipus', $data['tipus'], PDO::PARAM_STR);
            $stmt->bindParam(':meret', $data['meret'], PDO::PARAM_STR);
            $stmt->bindParam(':muszaki_lejarat', $data['muszaki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':taograf_illesztes', $data['taograf_illesztes'], PDO::PARAM_STR);
            $stmt->bindParam(':emelohatfal_vizsga', $data['emelohatfal_vizsga'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat', $data['porolto_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat_2', $data['porolto_lejarat_2'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biztositas', $data['kot_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_nev', $data['kot_biz_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_dij', $data['kot_biz_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_utem', $data['kot_biz_utem'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_biztositas', $data['kaszko_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_nev', $data['kaszko_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_dij', $data['kaszko_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_fizetesi_utem', $data['kaszko_fizetesi_utem'], PDO::PARAM_STR);

            $stmt->execute();

            $newKamionId = $this->db->lastInsertId();
            $newKamionData = $this->getKamion($newKamionId);

            return ['success' => true, 'message' => 'Kamion adatai sikeresen beszúrva.', 'kamion' => $newKamionData];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getKarbantartas($kamion_id, $elvegzett) {
        try {
            $query = "SELECT * FROM kamion_karbantartars WHERE kamionId = :kamionId AND kesz = :kesz AND torolt = 'N'";
            $stmt = $this->db->prepare($query);
            $kesz = $elvegzett ? "I" : "N";
            $stmt->bindParam(':kamionId', $kamion_id);
            $stmt->bindValue(':kesz', $kesz);
            $stmt->execute();

            $karbantartas_adatok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ['success' => true, 'message' => 'Karbantartások lekérdezve.', 'karbantartas' => $karbantartas_adatok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteKamion($id) {
        try {
            $query = "UPDATE kamion_karbantartars SET torolt='I' WHERE kamionId = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

            $query = "UPDATE kamion SET torolt='I' WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Kamion törölve'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteKarbantartas($id) {
        try {
            // Frissítési lekérdezés
            $query = "UPDATE kamion_karbantartars SET torolt = :torolt WHERE id = :id";

            // Lekérdezés előkészítése
            $stmt = $this->db->prepare($query);

            $torolt = "I";
            $stmt->bindParam(':torolt', $torolt);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);

            // Lekérdezés végrehajtása
            $stmt->execute();

            // Ellenőrzés, hogy történt-e frissítés
            if ($stmt->rowCount() > 0) {
                return ['success' => true, 'message' => 'A karbantartás tőrlése sikeres.'];
            } else {
                return ['success' => false, 'message' => 'A karbantartás nem található vagy az adatok nem változtak.'];
            }
        } catch (Exception $e) {
            // Hibakezelés
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    public function setKarbantartasKesz($id, $elvegzett) {
        try {
            // Frissítési lekérdezés
            $query = "UPDATE kamion_karbantartars SET kesz = :kesz WHERE id = :id AND torolt = 'N'";

            // Lekérdezés előkészítése
            $stmt = $this->db->prepare($query);

            $kesz = $elvegzett ? "I" : "N";
            $stmt->bindParam(':kesz', $kesz);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);

            // Lekérdezés végrehajtása
            $stmt->execute();

            // Ellenőrzés, hogy történt-e frissítés
            if ($stmt->rowCount() > 0) {
                return ['success' => true, 'message' => 'A karbantartás sikeresen elvégezve.'];
            } else {
                return ['success' => false, 'message' => 'A karbantartás nem található vagy az adatok nem változtak.'];
            }
        } catch (Exception $e) {
            // Hibakezelés
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function updateKarbantartas($id, $kamion_id, $datum, $log) {
        try {
            if ($id === 0) {
                // Beszúrási lekérdezés
                $query = "INSERT INTO kamion_karbantartars (kamionId,datum, log, torolt) VALUES (:kamion_id,:datum, :log, 'N')";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':kamion_id', $kamion_id);
                $stmt->bindParam(':datum', $datum);
                $stmt->bindParam(':log', $log);

                // Lekérdezés végrehajtása
                $stmt->execute();

                // Ellenőrzés, hogy történt-e beszúrás
                if ($stmt->rowCount() > 0) {
                    return ['success' => true, 'message' => 'A karbantartás sikeresen hozzáadva.'];
                } else {
                    return ['success' => false, 'message' => 'Hiba történt a karbantartás hozzáadása során.'];
                }
            } else {
                // Frissítési lekérdezés
                $query = "UPDATE kamion_karbantartars SET datum = :datum, log = :log WHERE id = :id AND torolt = 'N'";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':datum', $datum);
                $stmt->bindParam(':log', $log);
                $stmt->bindParam(':id', $id, PDO::PARAM_INT);

                // Lekérdezés végrehajtása
                $stmt->execute();

                // Ellenőrzés, hogy történt-e frissítés
                if ($stmt->rowCount() > 0) {
                    return ['success' => true, 'message' => 'A karbantartás sikeresen frissítve.'];
                } else {
                    return ['success' => false, 'message' => 'A karbantartás nem található vagy az adatok nem változtak.'];
                }
            }
        } catch (Exception $e) {
            // Hibakezelés
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getKamion($id) {
        $query = "SELECT * FROM kamion WHERE id = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
$kamionInterface = new KamionInterface();
