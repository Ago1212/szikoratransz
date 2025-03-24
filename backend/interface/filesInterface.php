<?php

class FilesInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    function getFiles($tabla,$id){
        try {    
            if($tabla==="admin"){
                $query = "SELECT * FROM fajlok WHERE admin = :id";
                $stmt = $this->db->prepare($query);
                $stmt->bindParam(':id', $id);
            }else{
                $query = "SELECT * FROM fajlok WHERE rowid = :id AND tabla = :tabla";
                $stmt = $this->db->prepare($query);
                $stmt->bindParam(':id', $id);
                $stmt->bindParam(':tabla', $tabla);
            }
            $stmt->execute();
            $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return ['success' => true, 'files'=>$files];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    function deleteFile($id){
        // Először lekérjük a fájl elérési útját az adatbázisból
        $query = "SELECT hely FROM fajlok WHERE sorszam = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
    
        if (!$file) {
            return ['success' => false, 'message' => 'A fájl nem található az adatbázisban'];
        }
    
        // Töröljük a fájlt a mappából
        if (file_exists($file['hely']) && !unlink($file['hely'])) {
            return ['success' => false, 'message' => 'Hiba történt a fájl törlésekor'];
        }
    
        // Töröljük a rekordot az adatbázisból
        $query = "DELETE FROM fajlok WHERE sorszam = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
    
        return ['success' => true, 'message' => 'A fájl sikeresen törölve'];
    }
    

    function downloadFile ($id) {
        $query = "SELECT * FROM fajlok WHERE sorszam = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
    
        if (!$file) {
            return ['success' => false, 'message' => 'Nincs ilyen fájl'];
        }
    
        if (!file_exists($file['hely'])) {
            return ['success' => false, 'message' => 'A fájl nem található'];
        }
    
    
        $mime = mime_content_type($file['hely']);
        $data = base64_encode(file_get_contents($file['hely']));
    
        return([
            "success" => true,
            "mime" => $mime,
            "file" => $data
        ]);
    }

    function fileToDatabase($admin,$tabla,$rowid, $hely, $name, $size) {
        $query = "INSERT INTO fajlok (admin,tabla,rowid, hely, filename, filesize,feltoltve) VALUES (:admin,:tabla,:id, :hely, :filename, :filesize,NOW())";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':admin', $admin);
        $stmt->bindParam(':tabla', $tabla);
        $stmt->bindParam(':id', $rowid);
        $stmt->bindParam(':hely', $hely);
        $stmt->bindParam(':filename', $name);
        $stmt->bindParam(':filesize', $size);
        $result = $stmt->execute();
        if (!$result) {
            return ['success' => false, 'message' => 'Hiba a mentésnél'];
        }
    
        return $result;
    }
    
    function fileUpload($admin,$tabla,$rowid, $base64File, $name, $size) {
        $baseDirectory =  __DIR__ . '/../files';
        if (!is_dir($baseDirectory)) {
            if (!mkdir($baseDirectory, 0755, true)) {
                return ['success' => false, 'message' => 'Hiba a mappa létrehozásánál'];
            }
        }
        $safeName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $name);
        $filePath = rtrim($baseDirectory, '/') . '/' . $safeName;
    
        $fileData = base64_decode($base64File, true);
        if ($fileData === false) {
            return ['success' => false, 'message' => 'Hiba a fájl visszakódolásánál'];
            return false;
        }
    
        if (file_put_contents($filePath, $fileData) !== false) {
            if ($this->fileToDatabase($admin,$tabla,$rowid, $filePath, $safeName, $size)) {
                return ['success' => true, 'message' => 'A fájl mentve'];
            } else {
                return ['success' => false, 'message' => 'Hiba a fájl mentésénél az adatbázisba'];
                unlink($filePath);
            }
        } else {
            return ['success' => false, 'message' => 'Hiba a fájl mentésénél a mappába'];
        }
    
        return false;
    }

}

$filesInterface = new FilesInterface();
