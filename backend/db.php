<?php

require_once __DIR__ . '/env.php';

class Database {
    private $host;
    private $db_name;          // Adatbázis neve
    private $username;         // Adatbázis felhasználónév
    private $password;         // Adatbázis jelszó
    private $db;

    // R45: env-változóból (DB_HOST/DB_NAME/DB_USER/DB_PASSWORD), ha van
    // `.env`/szerver-env — egyébként a korábbi, ismert értékre esik vissza,
    // hogy `.env` nélkül (pl. ez a fejlesztői gép) semmi ne törjön el. Ld.
    // env.php fejléc-komment: ez nem rotálja a régi, git-historyban élő
    // jelszót, csak a jövőbeli, env-alapú felülírást teszi lehetővé.
    public function __construct() {
        $this->host = envOrDefault('DB_HOST', 'localhost');
        $this->db_name = envOrDefault('DB_NAME', 'kamion');
        $this->username = envOrDefault('DB_USER', 'kamion');
        $this->password = envOrDefault('DB_PASSWORD', 'VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ');
    }

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



/*
    create database akm_erp_fejl;
    grant select,insert,update,delete,lock tables on kamion.* to kamion@localhost identified by 'VW4h2gzwm6vzA05xYGdWoNXFzHhSCdNQ';
*/
