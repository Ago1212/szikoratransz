<?php

class Database {
    private $host = 'localhost';        
    private $db_name = 'kamion';          // Adatbázis neve
    private $username = 'kamion';         // Adatbázis felhasználónév
    private $password = 'VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ';             // Adatbázis jelszó
    private $db;

    // Csatlakozás létrehozása
    public function connect() {
        $this->db = null;

        try {
            $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name;
            $this->db = new PDO($dsn, $this->username, $this->password);
            $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $e) {
            echo "Kapcsolódási hiba: " . $e->getMessage();
        }

        return $this->db;
    }
}
