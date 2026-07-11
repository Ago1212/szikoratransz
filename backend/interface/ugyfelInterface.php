<?php

class UgyfelInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getUgyfelek($id) {
        try {
            $query = "SELECT * FROM ugyfelek WHERE admin = :id AND torolt <> 'I' ORDER BY nev ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            return ['success' => true, 'ugyfelek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Könnyű választó — pl. egy fuvar/megrendelés ügyfél-mezőjéhez, csak
    // id+név, nem a teljes rekord.
    public function getUgyfelValaszto($id) {
        try {
            $query = "SELECT id, nev FROM ugyfelek WHERE admin = :id AND torolt <> 'I' ORDER BY nev ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
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

    public function saveUgyfelData($data) {
        try {
            $query = "UPDATE ugyfelek SET
                      nev = :nev, adoszam = :adoszam, cim = :cim, irsz = :irsz, varos = :varos,
                      kapcsolattarto_nev = :kapcsolattarto_nev, kapcsolattarto_email = :kapcsolattarto_email,
                      kapcsolattarto_telefon = :kapcsolattarto_telefon, megjegyzes = :megjegyzes
                      WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id']);
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

    public function deleteUgyfel($id) {
        try {
            $query = "UPDATE ugyfelek SET torolt = 'I' WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Ügyfél törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$ugyfelInterface = new UgyfelInterface();
