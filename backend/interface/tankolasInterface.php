<?php

class TankolasInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function newTankolas($data) {
        try {
            $liter = (float) ($data['liter'] ?? 0);
            $egysegar = isset($data['egysegar']) && $data['egysegar'] !== '' ? (float) $data['egysegar'] : null;
            $osszeg = $egysegar !== null ? round($liter * $egysegar, 2) : null;

            $query = "INSERT INTO tankolasok (admin, sofor_id, kamion_id, datum, liter, egysegar, osszeg, km_oraallas, helyszin)
                      VALUES (:admin, :sofor_id, :kamion_id, :datum, :liter, :egysegar, :osszeg, :km_oraallas, :helyszin)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['admin']);
            $stmt->bindValue(':sofor_id', $data['sofor_id']);
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':datum', empty($data['datum']) ? date('Y-m-d H:i:s') : $data['datum']);
            $stmt->bindValue(':liter', $liter);
            $stmt->bindValue(':egysegar', $egysegar);
            $stmt->bindValue(':osszeg', $osszeg);
            $stmt->bindValue(':km_oraallas', empty($data['km_oraallas']) ? null : $data['km_oraallas']);
            $stmt->bindValue(':helyszin', $data['helyszin'] ?? null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Tankolás rögzítve.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getTankolasok($sofor_id) {
        try {
            $query = "SELECT * FROM tankolasok WHERE sofor_id = :sofor_id AND torolt <> 'I' ORDER BY datum DESC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':sofor_id', $sofor_id);
            $stmt->execute();
            $tankolasok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'tankolasok' => $tankolasok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$tankolasInterface = new TankolasInterface();
