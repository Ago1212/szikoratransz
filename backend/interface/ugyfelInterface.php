<?php

class UgyfelInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    private const RENDEZHETO_OSZLOPOK = ['nev' => 'nev', 'varos' => 'varos'];

    public function getUgyfelek($id, $search = null, $page = null, $pageSize = null, $sortKey = null, $sortDir = 'asc') {
        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM ugyfelek WHERE admin = :id AND torolt <> 'I'";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['nev', 'varos', 'kapcsolattarto_nev', 'kapcsolattarto_telefon', 'kapcsolattarto_email'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'nev';
            $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
            $query .= " ORDER BY $rendezoOszlop $irany";

            if ($page !== null) {
                [$ugyfelek, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                return ['success' => true, 'ugyfelek' => $ugyfelek, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            return ['success' => true, 'ugyfelek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function newUgyfel($data) {
        try {
            $query = "INSERT INTO ugyfelek (admin, nev, adoszam, cim, irsz, varos, kapcsolattarto_nev, kapcsolattarto_email, kapcsolattarto_telefon, megjegyzes)
                      VALUES (:admin, :nev, :adoszam, :cim, :irsz, :varos, :kapcsolattarto_nev, :kapcsolattarto_email, :kapcsolattarto_telefon, :megjegyzes)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['admin']);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->bindValue(':adoszam', $data['adoszam'] ?? null);
            $stmt->bindValue(':cim', $data['cim'] ?? null);
            $stmt->bindValue(':irsz', $data['irsz'] ?? null);
            $stmt->bindValue(':varos', $data['varos'] ?? null);
            $stmt->bindValue(':kapcsolattarto_nev', $data['kapcsolattarto_nev'] ?? null);
            $stmt->bindValue(':kapcsolattarto_email', $data['kapcsolattarto_email'] ?? null);
            $stmt->bindValue(':kapcsolattarto_telefon', $data['kapcsolattarto_telefon'] ?? null);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
            $stmt->execute();

            $newId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Ügyfél rögzítve.', 'ugyfel' => ['id' => $newId] + $data];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id` nélkül egy másik cég ügyfél-rekordja is módosítható/
    // törölhető lenne az `id` eltalálásával (a hívó oldalon eddig csak az
    // audit-naplózáshoz oldottuk fel a tulajdonos céget, magát a
    // műveletet nem korlátozta) — most már a WHERE feltétel is kikényszeríti.
    public function saveUgyfelData($data) {
        try {
            $query = "UPDATE ugyfelek SET
                      nev = :nev, adoszam = :adoszam,
                      cim = :cim, irsz = :irsz, varos = :varos,
                      kapcsolattarto_nev = :kapcsolattarto_nev, kapcsolattarto_email = :kapcsolattarto_email,
                      kapcsolattarto_telefon = :kapcsolattarto_telefon, megjegyzes = :megjegyzes
                      WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id']);
            $stmt->bindValue(':ceg_id', $data['ceg_id']);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->bindValue(':adoszam', $data['adoszam'] ?? null);
            $stmt->bindValue(':cim', $data['cim'] ?? null);
            $stmt->bindValue(':irsz', $data['irsz'] ?? null);
            $stmt->bindValue(':varos', $data['varos'] ?? null);
            $stmt->bindValue(':kapcsolattarto_nev', $data['kapcsolattarto_nev'] ?? null);
            $stmt->bindValue(':kapcsolattarto_email', $data['kapcsolattarto_email'] ?? null);
            $stmt->bindValue(':kapcsolattarto_telefon', $data['kapcsolattarto_telefon'] ?? null);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Mentés sikeres.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteUgyfel($id, $ceg_id) {
        try {
            $query = "UPDATE ugyfelek SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Ügyfél törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$ugyfelInterface = new UgyfelInterface();
