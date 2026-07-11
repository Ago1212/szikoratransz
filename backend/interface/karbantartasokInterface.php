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
    // datumTol: "",
    // datumIg: "",
    public function getKarbantartasok($id, $kamion_id, $potkocsi_id, $datumTol, $datumIg, $elvegezte) {
        $filter = [
            'kamion_id' => $kamion_id,
            'potkocsi_id' => $potkocsi_id,
            'datumTol' => $datumTol,
            'datumIg' => $datumIg,
            'elvegezte' => $elvegezte
        ];
        try {
            $params = [];
            $whereClauses = [];

            // Kamion karbantartások
            $kamionQuery = "SELECT 'kamion' as tipus, id, kamion_id,null as potkocsi_id,kamion_id as jarmuId, datum, log,km_oraallas,elvegezte,koltseg, torolt FROM kamion_karbantartars WHERE torolt = 'N'";
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
            if (!empty($filter['datumTol'])) {
                $kamionQuery .= " AND datum >= :kamion_datumTol";
                $params[':kamion_datumTol'] = $filter['datumTol'];
            }
            if (!empty($filter['datumIg'])) {
                $kamionQuery .= " AND datum <= :kamion_datumIg";
                $params[':kamion_datumIg'] = $filter['datumIg'];
            }
            if (!empty($filter['elvegezte'])) {
                $kamionQuery .= " AND elvegezte LIKE :elvegezte";
                $params[':elvegezte'] = "{$filter['elvegezte']}%";
            }

            // Potkocsi karbantartások
            $potkocsiQuery = "SELECT 'potkocsi' as tipus, id, null as kamion_id, potkocsi_id, potkocsi_id as jarmuId, datum, log,km_oraallas,elvegezte,koltseg, torolt FROM potkocsi_karbantartars WHERE torolt = 'N'";
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
            if (!empty($filter['datumTol'])) {
                $potkocsiQuery .= " AND datum >= :potkocsi_datumTol";
                $params[':potkocsi_datumTol'] = $filter['datumTol'];
            }
            if (!empty($filter['datumIg'])) {
                $potkocsiQuery .= " AND datum <= :potkocsi_datumIg";
                $params[':potkocsi_datumIg'] = $filter['datumIg'];
            }
            if (!empty($filter['elvegezte'])) {
                $potkocsiQuery .= " AND elvegezte LIKE :elvegezte";
                $params[':elvegezte'] = "{$filter['elvegezte']}%";
            }

            // UNION a két lekérdezés között
            $query = "$kamionQuery UNION ALL $potkocsiQuery ORDER BY datum DESC";

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
    public function getKamionKarbantartas($kamion_id) {
        try {
            $query = "SELECT * FROM kamion_karbantartars WHERE kamion_id = :kamion_id AND torolt = 'N'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':kamion_id', $kamion_id);
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
    public function updateKamionKarbantartas($id, $admin, $kamion_id, $datum, $log, $km_oraallas, $elvegezte, $kovetkezo_karbantartas, $koltseg = null) {
        try {
            if ($id === 0) {
                // Beszúrási lekérdezés
                $query = "INSERT INTO kamion_karbantartars (kamion_id,admin,datum, log, torolt, km_oraallas, elvegezte, koltseg) VALUES (:kamion_id,:admin,:datum, :log, 'N', :km_oraallas, :elvegezte, :koltseg)";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':admin', $admin);
                $stmt->bindParam(':kamion_id', $kamion_id);
                $stmt->bindParam(':datum', $datum);
                $stmt->bindParam(':log', $log);
                $stmt->bindParam(':km_oraallas', $km_oraallas);
                $stmt->bindParam(':elvegezte', $elvegezte);
                $stmt->bindValue(':koltseg', $koltseg === '' || $koltseg === null ? null : $koltseg);

                // Lekérdezés végrehajtása
                $stmt->execute();

                // Ellenőrzés, hogy történt-e beszúrás
                if ($stmt->rowCount() > 0) {
                    if (!empty($kovetkezo_karbantartas) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $kovetkezo_karbantartas)) {
                        $nextQuery = "INSERT INTO kamion_karbantartars (kamion_id, admin, datum, log, torolt, km_oraallas, elvegezte) 
                                  VALUES (:kamion_id, :admin, :datum, :log, 'N', NULL, NULL)";
                        $nextStmt = $this->db->prepare($nextQuery);
                        $nextStmt->bindParam(':kamion_id', $kamion_id);
                        $nextStmt->bindParam(':admin', $admin);
                        $nextStmt->bindParam(':datum', $kovetkezo_karbantartas);
                        $nextStmt->bindParam(':log', $log);
                        $nextStmt->execute();
                    }
                    return ['success' => true, 'message' => 'A karbantartás sikeresen hozzáadva.'];
                } else {
                    return ['success' => false, 'message' => 'Hiba történt a karbantartás hozzáadása során.'];
                }
            } else {
                // Frissítési lekérdezés
                $query = "UPDATE kamion_karbantartars SET datum = :datum, log = :log, km_oraallas = :km_oraallas, elvegezte = :elvegezte, koltseg = :koltseg WHERE id = :id AND torolt = 'N'";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':datum', $datum);
                $stmt->bindParam(':log', $log);
                $stmt->bindParam(':km_oraallas', $km_oraallas);
                $stmt->bindParam(':elvegezte', $elvegezte);
                $stmt->bindValue(':koltseg', $koltseg === '' || $koltseg === null ? null : $koltseg);
                $stmt->bindParam(':id', $id, PDO::PARAM_INT);

                // Lekérdezés végrehajtása


                // Ellenőrzés, hogy történt-e frissítés
                if ($stmt->execute()) {
                    if (!empty($kovetkezo_karbantartas) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $kovetkezo_karbantartas)) {
                        $nextQuery = "INSERT INTO kamion_karbantartars (kamion_id, admin, datum, log, torolt, km_oraallas, elvegezte)
                                  VALUES (:kamion_id, :admin, :datum, :log, 'N', NULL, NULL)";
                        $nextStmt = $this->db->prepare($nextQuery);
                        $nextStmt->bindParam(':kamion_id', $kamion_id);
                        $nextStmt->bindParam(':admin', $admin);
                        $nextStmt->bindParam(':datum', $kovetkezo_karbantartas);
                        $nextStmt->bindParam(':log', $log);
                        $nextStmt->execute();
                    }

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


    public function getPotkocsiKarbantartas($potkocsi_id) {
        try {
            $query = "SELECT * FROM potkocsi_karbantartars WHERE potkocsi_id = :potkocsi_id AND torolt = 'N'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':potkocsi_id', $potkocsi_id);
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

    public function updatePotkocsiKarbantartas($id, $admin, $potkocsi_id, $datum, $log, $km_oraallas, $elvegezte, $kovetkezo_karbantartas, $koltseg = null) {
        try {
            if ($id === 0) {
                // Beszúrási lekérdezés
                $query = "INSERT INTO potkocsi_karbantartars (potkocsi_id,admin,datum, log, torolt, km_oraallas, elvegezte, koltseg) VALUES (:potkocsi_id,:admin,:datum, :log, 'N', :km_oraallas, :elvegezte, :koltseg)";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':admin', $admin);
                $stmt->bindParam(':potkocsi_id', $potkocsi_id);
                $stmt->bindParam(':datum', $datum);
                $stmt->bindParam(':log', $log);
                $stmt->bindParam(':km_oraallas', $km_oraallas);
                $stmt->bindParam(':elvegezte', $elvegezte);
                $stmt->bindValue(':koltseg', $koltseg === '' || $koltseg === null ? null : $koltseg);

                // Lekérdezés végrehajtása
                $stmt->execute();

                // Ellenőrzés, hogy történt-e beszúrás
                if ($stmt->rowCount() > 0) {
                    if (!empty($kovetkezo_karbantartas) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $kovetkezo_karbantartas)) {
                        $nextQuery = "INSERT INTO potkocsi_karbantartars (potkocsi_id, admin, datum, log, torolt, km_oraallas, elvegezte) 
                                  VALUES (:potkocsi_id, :admin, :datum, :log, 'N', NULL, NULL)";
                        $nextStmt = $this->db->prepare($nextQuery);
                        $nextStmt->bindParam(':potkocsi_id', $potkocsi_id);
                        $nextStmt->bindParam(':admin', $admin);
                        $nextStmt->bindParam(':datum', $kovetkezo_karbantartas);
                        $nextStmt->bindParam(':log', $log);
                        $nextStmt->execute();
                    }

                    return ['success' => true, 'message' => 'A karbantartás sikeresen hozzáadva.'];
                } else {
                    return ['success' => false, 'message' => 'Hiba történt a karbantartás hozzáadása során.'];
                }
            } else {
                // Frissítési lekérdezés
                $query = "UPDATE potkocsi_karbantartars SET datum = :datum, log = :log, km_oraallas = :km_oraallas, elvegezte = :elvegezte, koltseg = :koltseg WHERE id = :id AND torolt = 'N'";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':datum', $datum);
                $stmt->bindParam(':log', $log);
                $stmt->bindParam(':km_oraallas', $km_oraallas);
                $stmt->bindParam(':elvegezte', $elvegezte);
                $stmt->bindValue(':koltseg', $koltseg === '' || $koltseg === null ? null : $koltseg);
                $stmt->bindParam(':id', $id, PDO::PARAM_INT);

                // Lekérdezés végrehajtása

                // Ellenőrzés, hogy történt-e frissítés
                if ($stmt->execute()) {
                    if (!empty($kovetkezo_karbantartas) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $kovetkezo_karbantartas)) {
                        $nextQuery = "INSERT INTO potkocsi_karbantartars (potkocsi_id, admin, datum, log, torolt, km_oraallas, elvegezte)
                                  VALUES (:potkocsi_id, :admin, :datum, :log, 'N', NULL, NULL)";
                        $nextStmt = $this->db->prepare($nextQuery);
                        $nextStmt->bindParam(':potkocsi_id', $potkocsi_id);
                        $nextStmt->bindParam(':admin', $admin);
                        $nextStmt->bindParam(':datum', $kovetkezo_karbantartas);
                        $nextStmt->bindParam(':log', $log);
                        $nextStmt->execute();
                    }

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
