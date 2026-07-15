<?php

class FilesInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // A `search`/`page`/`pageSize` KIZÁRÓLAG a `tabla === "admin"` ágra
    // (az admin saját, önálló "Fájlok" listaoldala) vonatkozik — a másik
    // ág (egy adott rekordhoz, pl. karbantartáshoz tartozó néhány fájl)
    // eleve kicsi, beágyazott lista, nem igényel lapozást.
    function getFiles($tabla, $id, $search = null, $page = null, $pageSize = null) {
        try {
            if ($tabla === "admin") {
                $params = [':id' => $id];
                $query = "SELECT * FROM fajlok WHERE admin = :id";
                if (!empty($search)) {
                    $query .= " AND " . PaginationHelper::likeClause(['filename'], 'search');
                    $params[':search'] = '%' . $search . '%';
                }
                $query .= " ORDER BY feltoltve DESC";

                if ($page !== null) {
                    [$files, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                    return ['success' => true, 'files' => $files, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
                }

                $stmt = $this->db->prepare($query);
                foreach ($params as $key => $value) {
                    $stmt->bindValue($key, $value);
                }
            } else {
                // A `fajlok.admin` oszlop minden sornál kitöltött (nem csak
                // a `tabla === "admin"` ágnál) — enélkül a szűrés nélkül
                // bármely cég bármely másik cég `rowid`-jét eltalálva
                // (pl. egy karbantartás/sofőr azonosítót végigpróbálva)
                // hozzáférhetne annak fájllistájához.
                $query = "SELECT * FROM fajlok WHERE rowid = :id AND tabla = :tabla AND admin = :ceg_id";
                $stmt = $this->db->prepare($query);
                $stmt->bindParam(':id', $id);
                $stmt->bindParam(':tabla', $tabla);
                $stmt->bindValue(':ceg_id', $ceg_id);
            }
            $stmt->execute();
            $files = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'files' => $files];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id` nélkül bármely bejelentkezett felhasználó törölhetne
    // bármely másik cég fájlját a `sorszam` (auto-increment, tehát könnyen
    // végigpróbálható) eltalálásával — a WHERE feltétel ezt zárja ki.
    function deleteFile($id, $ceg_id) {
        $query = "SELECT hely FROM fajlok WHERE sorszam = :id AND admin = :ceg_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            return ['success' => false, 'message' => 'A fájl nem található, vagy nem a te céged fájlja'];
        }

        // Töröljük a fájlt a mappából
        if (file_exists($file['hely']) && !unlink($file['hely'])) {
            return ['success' => false, 'message' => 'Hiba történt a fájl törlésekor'];
        }

        // Töröljük a rekordot az adatbázisból
        $query = "DELETE FROM fajlok WHERE sorszam = :id AND admin = :ceg_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();

        return ['success' => true, 'message' => 'A fájl sikeresen törölve'];
    }


    // `$ceg_id` — ld. deleteFile() fenti komment, ugyanaz a kockázat
    // letöltésnél is (bármely cég bármely fájlját letölthetné anélkül).
    function downloadFile($id, $ceg_id) {
        $query = "SELECT * FROM fajlok WHERE sorszam = :id AND admin = :ceg_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            return ['success' => false, 'message' => 'Nincs ilyen fájl, vagy nem a te céged fájlja'];
        }

        if (!file_exists($file['hely'])) {
            return ['success' => false, 'message' => 'A fájl nem található'];
        }


        $mime = mime_content_type($file['hely']);
        $data = base64_encode(file_get_contents($file['hely']));

        return ([
            "success" => true,
            "mime" => $mime,
            "file" => $data
        ]);
    }

    function fileToDatabase($admin, $tabla, $rowid, $hely, $name, $size, $kategoria = null) {
        $query = "INSERT INTO fajlok (admin,tabla,kategoria,rowid, hely, filename, filesize,feltoltve) VALUES (:admin,:tabla,:kategoria,:id, :hely, :filename, :filesize,NOW())";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':admin', $admin);
        $stmt->bindParam(':tabla', $tabla);
        $stmt->bindParam(':kategoria', $kategoria);
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

    // Csak ezek a kiterjesztések tölthetők fel — enélkül egy `.php`/`.phtml`
    // stb. fájl feltölthető és (mivel a `backend/files/` a production
    // webrootön belül van, ld. CLAUDE.md) közvetlenül lefuttatható lenne a
    // webszerveren (RCE). A whitelist a projektben ténylegesen használt
    // dokumentum-/kép-/táblázat-típusokra szorítkozik.
    const MEGENGEDETT_KITERJESZTESEK = [
        'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
        'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt',
    ];

    // A kliens-oldali 10MB-os ellenőrzés (ld. CardTableForFajlok.js)
    // trivially megkerülhető közvetlen API-hívással — ez a szerver-oldali,
    // a TÉNYLEGESEN dekódolt bájtokon mért kényszerítő korlát.
    const MAX_FAJLMERET_BYTE = 10 * 1024 * 1024;

    function fileUpload($admin, $tabla, $rowid, $base64File, $name, $size, $kategoria = null) {
        $kiterjesztes = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($kiterjesztes, self::MEGENGEDETT_KITERJESZTESEK, true)) {
            return ['success' => false, 'message' => 'Ez a fájltípus nem engedélyezett.'];
        }

        $fileData = base64_decode($base64File, true);
        if ($fileData === false) {
            return ['success' => false, 'message' => 'Hiba a fájl visszakódolásánál'];
        }
        if (strlen($fileData) > self::MAX_FAJLMERET_BYTE) {
            return ['success' => false, 'message' => 'A fájl mérete túl nagy (maximum 10MB).'];
        }

        $baseDirectory =  __DIR__ . '/../files';
        if (!is_dir($baseDirectory)) {
            if (!mkdir($baseDirectory, 0755, true)) {
                return ['success' => false, 'message' => 'Hiba a mappa létrehozásánál'];
            }
        }

        // Az eredeti fájlnevet csak megjelenítésre (DB `filename` oszlop)
        // tároljuk — a lemezen a fájl neve egy generált, ütközésmentes
        // azonosító, hogy két cég azonos nevű feltöltése (pl. "szamla.pdf")
        // sose írja felül egymást.
        $egyediNev = bin2hex(random_bytes(16)) . '.' . $kiterjesztes;
        $filePath = rtrim($baseDirectory, '/') . '/' . $egyediNev;
        $displayName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $name);

        if (file_put_contents($filePath, $fileData) !== false) {
            if ($this->fileToDatabase($admin, $tabla, $rowid, $filePath, $displayName, strlen($fileData), $kategoria)) {
                return ['success' => true, 'message' => 'A fájl mentve', 'id' => $this->db->lastInsertId()];
            }
            unlink($filePath);
            return ['success' => false, 'message' => 'Hiba a fájl mentésénél az adatbázisba'];
        }

        return ['success' => false, 'message' => 'Hiba a fájl mentésénél a mappába'];
    }
}

$filesInterface = new FilesInterface();
