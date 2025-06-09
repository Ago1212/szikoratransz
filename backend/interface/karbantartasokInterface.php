<?php

class KarbantartasInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    //visszaadjuk az összes kamion és potkocsi karbantartast ahol az id = $id, és a filter szerint szűrünk amik a következőek:
    // kamion_id: "",
    // potkocsi_id: "",
    // elvegzett: "",
    // datumTol: "",
    // datumIg: "",
    public function getKarbantartasok($id, $kamion_id, $potkocsi_id, $elvegzett, $datumTol, $datumIg) {
        $filter = [
            'kamion_id' => $kamion_id,
            'potkocsi_id' => $potkocsi_id,
            'elvegzett' => $elvegzett,
            'datumTol' => $datumTol,
            'datumIg' => $datumIg
        ];
        try {
            $params = [];
            $whereClauses = [];

            // Kamion karbantartások
            $kamionQuery = "SELECT 'kamion' as tipus, id, kamion_id,null as potkocsi_id,kamion_id as jarmuId, datum, log, kesz, torolt FROM kamion_karbantartars WHERE torolt = 'N'";
            if (!empty($id)) {
                $kamionQuery .= " AND admin = :id";
                $params[':id'] = $id;
            }
            if (!empty($filter['kamion_id'])) {
                $kamionQuery .= " AND kamion_id = :kamion_id";
                $params[':kamion_id'] = $filter['kamion_id'];
            }
            if (!empty($filter['potkocsi_id'])) {
                $kamionQuery .= " AND 1 = 0";
            }
            if (isset($filter['kesz']) && $filter['kesz'] !== "") {
                $kamionQuery .= " AND kesz = :kamion_kesz";
                $params[':kamion_kesz'] = $filter['kesz'] ? "I" : "N";
            }
            if (!empty($filter['datumTol'])) {
                $kamionQuery .= " AND datum >= :kamion_datumTol";
                $params[':kamion_datumTol'] = $filter['datumTol'];
            }
            if (!empty($filter['datumIg'])) {
                $kamionQuery .= " AND datum <= :kamion_datumIg";
                $params[':kamion_datumIg'] = $filter['datumIg'];
            }

            // Potkocsi karbantartások
            $potkocsiQuery = "SELECT 'potkocsi' as tipus, id, null as kamion_id, potkocsi_id, potkocsi_id as jarmuId, datum, log, kesz, torolt 
                         FROM potkocsi_karbantartars WHERE torolt = 'N'";
            if (!empty($id)) {
                $potkocsiQuery .= " AND admin = :id";
            }
            if (!empty($filter['kamion_id'])) {
                $potkocsiQuery .= " AND 1 = 0";
            }
            if (!empty($filter['potkocsi_id'])) {
                $potkocsiQuery .= " AND potkocsi_id = :potkocsi_id";
                $params[':potkocsi_id'] = $filter['potkocsi_id'];
            }
            if (isset($filter['kesz']) && $filter['kesz'] !== "") {
                $potkocsiQuery .= " AND kesz = :potkocsi_kesz";
                $params[':potkocsi_kesz'] = $filter['kesz'] ? "I" : "N";
            }
            if (!empty($filter['datumTol'])) {
                $potkocsiQuery .= " AND datum >= :potkocsi_datumTol";
                $params[':potkocsi_datumTol'] = $filter['datumTol'];
            }
            if (!empty($filter['datumIg'])) {
                $potkocsiQuery .= " AND datum <= :potkocsi_datumIg";
                $params[':potkocsi_datumIg'] = $filter['datumIg'];
            }

            // UNION a két lekérdezés között
            $query = "$kamionQuery UNION ALL $potkocsiQuery ORDER BY kesz DESC,datum ASC";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }

            $stmt->execute();
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'message' => 'Karbantartások lekérdezve.', 'karbantartasok' => $result];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    public function getKamionKarbantartas($kamion_id, $elvegzett) {
        try {
            $query = "SELECT * FROM kamion_karbantartars WHERE kamion_id = :kamion_id AND kesz = :kesz AND torolt = 'N'";
            $stmt = $this->db->prepare($query);
            $kesz = $elvegzett ? "I" : "N";
            $stmt->bindParam(':kamion_id', $kamion_id);
            $stmt->bindValue(':kesz', $kesz);
            $stmt->execute();

            $karbantartas_adatok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ['success' => true, 'message' => 'Karbantartások lekérdezve.', 'karbantartas' => $karbantartas_adatok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    public function deleteKamionKarbantartas($id) {
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
    public function setKamionKarbantartasKesz($id, $elvegzett) {
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

    public function updateKamionKarbantartas($id, $admin, $kamion_id, $datum, $log) {
        try {
            if ($id === 0) {
                // Beszúrási lekérdezés
                $query = "INSERT INTO kamion_karbantartars (kamion_id,admin,datum, log, torolt) VALUES (:kamion_id,:admin,:datum, :log, 'N')";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':admin', $admin);
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


    public function getPotkocsiKarbantartas($potkocsi_id, $elvegzett) {
        try {
            $query = "SELECT * FROM potkocsi_karbantartars WHERE potkocsi_id = :potkocsi_id AND kesz = :kesz AND torolt = 'N'";
            $stmt = $this->db->prepare($query);
            $kesz = $elvegzett ? "I" : "N";
            $stmt->bindParam(':potkocsi_id', $potkocsi_id);
            $stmt->bindValue(':kesz', $kesz);
            $stmt->execute();

            $karbantartas_adatok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ['success' => true, 'message' => 'Karbantartások lekérdezve.', 'karbantartas' => $karbantartas_adatok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deletePotkocsiKarbantartas($id) {
        try {
            // Frissítési lekérdezés
            $query = "UPDATE potkocsi_karbantartars SET torolt = :torolt WHERE id = :id";

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
    public function setPotkocsiKarbantartasKesz($id, $elvegzett) {
        try {
            // Frissítési lekérdezés
            $query = "UPDATE potkocsi_karbantartars SET kesz = :kesz WHERE id = :id AND torolt = 'N'";

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

    public function updatePotkocsiKarbantartas($id, $admin, $potkocsi_id, $datum, $log) {
        try {
            if ($id === 0) {
                // Beszúrási lekérdezés
                $query = "INSERT INTO potkocsi_karbantartars (potkocsi_id,admin,datum, log, torolt) VALUES (:potkocsi_id,:admin,:datum, :log, 'N')";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':admin', $admin);
                $stmt->bindParam(':potkocsi_id', $potkocsi_id);
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
                $query = "UPDATE potkocsi_karbantartars SET datum = :datum, log = :log WHERE id = :id AND torolt = 'N'";

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
}
$karbantartasInterface = new KarbantartasInterface();
