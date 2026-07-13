<?php

class SzabadsagInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // A sofőr nevét PHP oldalon csatoljuk (a projekt konvenciója szerint
    // nincs SQL JOIN sehol a kódbázisban, lásd ApiHandler::getEsemenyek).
    public function getSzabadsagok($id, $search = null, $page = null, $pageSize = null) {
        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM sofor_szabadsag WHERE admin = :id AND torolt <> 'I'";
            // A `sofor_nev` a lekérdezés után, PHP oldalon fűződik a sorokhoz
            // (ld. lentebb) — a rá szűrő kereséshez ezért alkérdés kell.
            if (!empty($search)) {
                $query .= " AND (" . PaginationHelper::likeClause(['tipus', 'megjegyzes'], 'search') .
                    " OR sofor_id IN (SELECT id FROM user WHERE name LIKE :search_nev))";
                $params[':search'] = '%' . $search . '%';
                $params[':search_nev'] = '%' . $search . '%';
            }
            $query .= " ORDER BY datum_tol DESC";

            if ($page !== null) {
                [$szabadsagok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
            } else {
                $stmt = $this->db->prepare($query);
                foreach ($params as $key => $value) {
                    $stmt->bindValue($key, $value);
                }
                $stmt->execute();
                $szabadsagok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            $stmt2 = $this->db->query("SELECT id, name FROM user WHERE torolt <> 'I'");
            $soforNevek = [];
            foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $soforNevek[$row['id']] = $row['name'];
            }
            foreach ($szabadsagok as &$sz) {
                $sz['sofor_nev'] = $soforNevek[$sz['sofor_id']] ?? 'Ismeretlen';
            }

            $result = ['success' => true, 'szabadsagok' => $szabadsagok];
            if ($page !== null) {
                $result['total'] = $total;
                $result['page'] = $page;
                $result['pageSize'] = $pageSize;
            }
            return $result;
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function newSzabadsag($data) {
        try {
            $query = "INSERT INTO sofor_szabadsag (admin, sofor_id, datum_tol, datum_ig, tipus, megjegyzes)
                      VALUES (:admin, :sofor_id, :datum_tol, :datum_ig, :tipus, :megjegyzes)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['admin']);
            $stmt->bindValue(':sofor_id', $data['sofor_id']);
            $stmt->bindValue(':datum_tol', $data['datum_tol']);
            $stmt->bindValue(':datum_ig', $data['datum_ig']);
            $stmt->bindValue(':tipus', empty($data['tipus']) ? 'szabadsag' : $data['tipus']);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Szabadság rögzítve.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteSzabadsag($id) {
        try {
            $query = "UPDATE sofor_szabadsag SET torolt = 'I' WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Szabadság törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$szabadsagInterface = new SzabadsagInterface();
