<?php

class BejelentesekInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }
    public function getBejelentesek($kamion) {

        $bejelentesek = [
            ["bejelento" => "Ágó", "bejelentve" => "2023-10-01", "tipus" => "A kamion nem indul el."],
            ["bejelento" => "Béla", "bejelentve" => "2023-10-02", "tipus" => "A kamion nem indul el."],
            ["bejelento" => "Cecil", "bejelentve" => "2023-10-03", "tipus" => "A kamion nem indul el."],
            ["bejelento" => "Dávid", "bejelentve" => "2023-10-04", "tipus" => "A kamion nem indul el."],
            ["bejelento" => "Erika", "bejelentve" => "2023-10-05", "tipus" => "A kamion nem indul el."]
        ];
        return ['success' => true, 'bejelentesek' => $bejelentesek];


        $query = "SELECT * FROM bejelentesek";
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function newBejelentes($data) {
        $query = "INSERT INTO bejelentesek (kamion, felhasznalo, bejelentes) VALUES (:kamion, :felhasznalo, :bejelentes)";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':kamion', $kamion);
        $stmt->bindParam(':felhasznalo', $felhasznalo);
        $stmt->bindParam(':bejelentes', $bejelentes);
        return $stmt->execute();
    }
    public function saveBejelentesData($data) {
        $query = "UPDATE bejelentesek SET kamion = :kamion, felhasznalo = :felhasznalo, bejelentes = :bejelentes WHERE id = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':kamion', $kamion);
        $stmt->bindParam(':felhasznalo', $felhasznalo);
        $stmt->bindParam(':bejelentes', $bejelentes);
        return $stmt->execute();
    }
    public function deleteBejelentes($id) {
        $query = "DELETE FROM bejelentesek WHERE id = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        return $stmt->execute();
    }
}

$bejelentesekInterface = new BejelentesekInterface();
