<?php

class HelyszinInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getHelyszinek($id) {
        try {
            $query = "SELECT * FROM helyszinek WHERE admin = :id AND torolt <> 'I' ORDER BY nev ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            return ['success' => true, 'helyszinek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getHelyszin($id) {
        try {
            $query = "SELECT * FROM helyszinek WHERE id = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $helyszin = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$helyszin) {
                return ['success' => false, 'message' => 'A helyszín nem található.'];
            }
            return ['success' => true, 'helyszin' => $helyszin];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function newHelyszin($data) {
        try {
            $query = "INSERT INTO helyszinek (admin, nev) VALUES (:admin, :nev)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['admin']);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->execute();

            $newId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Helyszín rögzítve.', 'helyszin' => ['id' => $newId, 'nev' => $data['nev']]];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function saveHelyszinData($data) {
        try {
            $query = "UPDATE helyszinek SET nev = :nev WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id']);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->execute();

            return ['success' => true, 'message' => 'Mentés sikeres.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteHelyszin($id) {
        try {
            $query = "UPDATE helyszinek SET torolt = 'I' WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Helyszín törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getHelyszinMegjegyzesek($helyszin_id) {
        try {
            $query = "SELECT * FROM helyszin_megjegyzesek WHERE helyszin_id = :helyszin_id AND torolt <> 'I' ORDER BY letrehozva ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':helyszin_id', $helyszin_id);
            $stmt->execute();
            return ['success' => true, 'megjegyzesek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function newHelyszinMegjegyzes($data) {
        try {
            $query = "INSERT INTO helyszin_megjegyzesek (helyszin_id, szerzo_tipus, szerzo_id, szerzo_nev, szoveg)
                      VALUES (:helyszin_id, :szerzo_tipus, :szerzo_id, :szerzo_nev, :szoveg)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':helyszin_id', $data['helyszin_id']);
            $stmt->bindValue(':szerzo_tipus', $data['szerzo_tipus']);
            $stmt->bindValue(':szerzo_id', $data['szerzo_id']);
            $stmt->bindValue(':szerzo_nev', $data['szerzo_nev']);
            $stmt->bindValue(':szoveg', $data['szoveg']);
            $stmt->execute();

            $newId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Megjegyzés hozzáadva.', 'id' => $newId];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteHelyszinMegjegyzes($id) {
        try {
            $query = "UPDATE helyszin_megjegyzesek SET torolt = 'I' WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Megjegyzés törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$helyszinInterface = new HelyszinInterface();
