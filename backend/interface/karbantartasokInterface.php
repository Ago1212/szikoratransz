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
    public function getKarbantartasok($id, $kamion_id, $potkocsi_id, $datumTol, $datumIg, $elvegezte, $search = null, $page = null, $pageSize = null, $furgon_id = null) {
        $filter = [
            'kamion_id' => $kamion_id,
            'potkocsi_id' => $potkocsi_id,
            'furgon_id' => $furgon_id,
            'datumTol' => $datumTol,
            'datumIg' => $datumIg,
            'elvegezte' => $elvegezte
        ];
        try {
            $params = [];
            $whereClauses = [];

            // Kamion karbantartások — a "más típusra szűrve" kizárás
            // (`AND 1 = 0`) mindhárom típust figyelembe veszi: ha akár
            // pótkocsira, akár furgonra szűr a hívó, a kamion-ág üres marad.
            $kamionQuery = "SELECT 'kamion' as tipus, id, kamion_id,null as potkocsi_id, null as furgon_id, kamion_id as jarmuId, datum, log,km_oraallas,elvegezte,koltseg, torolt FROM kamion_karbantartars WHERE torolt = 'N'";
            if (!empty($id)) {
                $kamionQuery .= " AND admin = :id";
                $params[':id'] = $id;
            }
            if (!empty($filter['kamion_id'])) {
                $kamionQuery .= " AND kamion_id = :kamion_id";
                $params[':kamion_id'] = $filter['kamion_id'];
            }
            if (!empty($filter['potkocsi_id']) || !empty($filter['furgon_id'])) {
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
            // A `rendszam` a lekérdezés eredményében nincs benne (a frontend
            // tölti fel egy külön kamion/pótkocsi/furgon-listából) — a
            // szabadszavas keresésnek ezért egy alkérdésre van szüksége a
            // rendszám szerinti találatokhoz, a `log`/`elvegezte` sima
            // LIKE-ja mellett.
            if (!empty($search)) {
                $kamionQuery .= " AND (" . PaginationHelper::likeClause(['log', 'elvegezte'], 'search') .
                    " OR kamion_id IN (SELECT id FROM kamion WHERE rendszam LIKE :search_rendszam))";
                $params[':search'] = '%' . $search . '%';
                $params[':search_rendszam'] = '%' . $search . '%';
            }

            // Potkocsi karbantartások
            $potkocsiQuery = "SELECT 'potkocsi' as tipus, id, null as kamion_id, potkocsi_id, null as furgon_id, potkocsi_id as jarmuId, datum, log,km_oraallas,elvegezte,koltseg, torolt FROM potkocsi_karbantartars WHERE torolt = 'N'";
            if (!empty($id)) {
                $potkocsiQuery .= " AND admin = :id";
            }
            if (!empty($filter['kamion_id']) || !empty($filter['furgon_id'])) {
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
            if (!empty($search)) {
                $potkocsiQuery .= " AND (" . PaginationHelper::likeClause(['log', 'elvegezte'], 'search') .
                    " OR potkocsi_id IN (SELECT id FROM potkocsi WHERE rendszam LIKE :search_rendszam))";
                $params[':search'] = '%' . $search . '%';
                $params[':search_rendszam'] = '%' . $search . '%';
            }

            // Furgon karbantartások
            $furgonQuery = "SELECT 'furgon' as tipus, id, null as kamion_id, null as potkocsi_id, furgon_id, furgon_id as jarmuId, datum, log,km_oraallas,elvegezte,koltseg, torolt FROM furgon_karbantartars WHERE torolt = 'N'";
            if (!empty($id)) {
                $furgonQuery .= " AND admin = :id";
            }
            if (!empty($filter['kamion_id']) || !empty($filter['potkocsi_id'])) {
                $furgonQuery .= " AND 1 = 0";
            }
            if (!empty($filter['furgon_id'])) {
                $furgonQuery .= " AND furgon_id = :furgon_id";
                $params[':furgon_id'] = $filter['furgon_id'];
            }
            if (!empty($filter['datumTol'])) {
                $furgonQuery .= " AND datum >= :furgon_datumTol";
                $params[':furgon_datumTol'] = $filter['datumTol'];
            }
            if (!empty($filter['datumIg'])) {
                $furgonQuery .= " AND datum <= :furgon_datumIg";
                $params[':furgon_datumIg'] = $filter['datumIg'];
            }
            if (!empty($filter['elvegezte'])) {
                $furgonQuery .= " AND elvegezte LIKE :elvegezte";
                $params[':elvegezte'] = "{$filter['elvegezte']}%";
            }
            if (!empty($search)) {
                $furgonQuery .= " AND (" . PaginationHelper::likeClause(['log', 'elvegezte'], 'search') .
                    " OR furgon_id IN (SELECT id FROM furgon WHERE rendszam LIKE :search_rendszam))";
                $params[':search'] = '%' . $search . '%';
                $params[':search_rendszam'] = '%' . $search . '%';
            }

            // UNION a három lekérdezés között
            $query = "$kamionQuery UNION ALL $potkocsiQuery UNION ALL $furgonQuery ORDER BY datum DESC";

            if ($page !== null) {
                [$result, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);

                // A "Szűrt összes költség" kártya a TELJES szűrt halmazra
                // vonatkozik, nem csak az épp látott oldalra — ezért egy
                // külön, LIMIT nélküli összesítő lekérdezés kell ugyanazokkal
                // a szűrőkkel, különben lapozáskor hamis (csak az oldalra
                // vonatkozó) összeg jelenne meg.
                $sumStmt = $this->db->prepare("SELECT SUM(koltseg) AS osszeg FROM ($query) AS agg");
                foreach ($params as $key => $value) {
                    $sumStmt->bindValue($key, $value);
                }
                $sumStmt->execute();
                $osszesKoltseg = (float) ($sumStmt->fetch(PDO::FETCH_ASSOC)['osszeg'] ?? 0);

                return ['success' => true, 'message' => 'Karbantartások lekérdezve.', 'karbantartasok' => $result, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize, 'osszesKoltseg' => $osszesKoltseg];
            }

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

    public function getFurgonKarbantartas($furgon_id) {
        try {
            $query = "SELECT * FROM furgon_karbantartars WHERE furgon_id = :furgon_id AND torolt = 'N'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':furgon_id', $furgon_id);
            $stmt->execute();

            $karbantartas_adatok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ['success' => true, 'message' => 'Karbantartások lekérdezve.', 'karbantartas' => $karbantartas_adatok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteFurgonKarbantartas($id) {
        try {
            // Frissítési lekérdezés
            $query = "UPDATE furgon_karbantartars SET torolt = :torolt WHERE id = :id";

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

    public function updateFurgonKarbantartas($id, $admin, $furgon_id, $datum, $log, $km_oraallas, $elvegezte, $kovetkezo_karbantartas, $koltseg = null) {
        try {
            if ($id === 0) {
                // Beszúrási lekérdezés
                $query = "INSERT INTO furgon_karbantartars (furgon_id,admin,datum, log, torolt, km_oraallas, elvegezte, koltseg) VALUES (:furgon_id,:admin,:datum, :log, 'N', :km_oraallas, :elvegezte, :koltseg)";

                // Lekérdezés előkészítése
                $stmt = $this->db->prepare($query);

                // Paraméterek kötése
                $stmt->bindParam(':admin', $admin);
                $stmt->bindParam(':furgon_id', $furgon_id);
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
                        $nextQuery = "INSERT INTO furgon_karbantartars (furgon_id, admin, datum, log, torolt, km_oraallas, elvegezte)
                                  VALUES (:furgon_id, :admin, :datum, :log, 'N', NULL, NULL)";
                        $nextStmt = $this->db->prepare($nextQuery);
                        $nextStmt->bindParam(':furgon_id', $furgon_id);
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
                $query = "UPDATE furgon_karbantartars SET datum = :datum, log = :log, km_oraallas = :km_oraallas, elvegezte = :elvegezte, koltseg = :koltseg WHERE id = :id AND torolt = 'N'";

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
                        $nextQuery = "INSERT INTO furgon_karbantartars (furgon_id, admin, datum, log, torolt, km_oraallas, elvegezte)
                                  VALUES (:furgon_id, :admin, :datum, :log, 'N', NULL, NULL)";
                        $nextStmt = $this->db->prepare($nextQuery);
                        $nextStmt->bindParam(':furgon_id', $furgon_id);
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
