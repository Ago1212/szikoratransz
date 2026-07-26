<?php

class FilesInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Oszloprendezés fehérlistája — ugyanaz a minta, mint
    // `koltsegInterface::getEgyebKoltsegek()`-ben (sosem a kliens nyers
    // string-jét fűzzük az ORDER BY-ba).
    const RENDEZHETO_OSZLOPOK = [
        'filename' => 'filename',
        'feltoltve' => 'feltoltve',
        'filesize' => 'filesize',
        'fajl_kategoria' => 'fajl_kategoria',
    ];

    // A `search`/`page`/`pageSize`/szűrők KIZÁRÓLAG a `tabla === "admin"`
    // ágra (az admin saját, önálló "Fájlok" listaoldala) vonatkoznak — a
    // másik ág (egy adott rekordhoz, pl. karbantartáshoz tartozó néhány
    // fájl) eleve kicsi, beágyazott lista, nem igényel lapozást/szűrést.
    // `$szurok` — opcionális: `kategoria`, `datumTol`, `datumIg`,
    // `feltoltoId`, `modul` (a `tabla` oszlopra szűkítő FILTER — külön
    // paraméternév kell, mert a `$tabla==="admin"` érték már foglalt
    // "listázz mindent" jelentéssel), `sortKey`/`sortDir`.
    // `$ceg_id`-t a hívó (ApiHandler) mindig szerver-oldalon feloldva adja
    // át. FONTOS, KORÁBBAN ÉLESEN HIBÁS ÁLLAPOT: ez a metódus régen csak 5
    // paramétert fogadott, miközben az `else` ág belsejében egy definiálatlan
    // `$ceg_id` változóra hivatkozott — az `ApiHandler` 6 argumentummal
    // hívta, amit PHP csendben eldobott, és a `WHERE ... admin = :ceg_id`
    // egy NULL-ra kötődött, ami sosem egyezett semmivel, tehát a
    // `tabla !== "admin"` ág (kamion/pótkocsi/furgon/sofőr/karbantartás/
    // bejelentés fájlok) MINDIG üres listát adott vissza — funkcionális
    // regresszió, nem csak biztonsági rés (ld. biztonsági audit).
    function getFiles($tabla, $id, $search = null, $page = null, $pageSize = null, $ceg_id = null, $szurok = []) {
        try {
            if ($tabla === "admin") {
                $params = [':id' => $ceg_id];
                $where = ["admin = :id"];

                if (!empty($search)) {
                    $where[] = PaginationHelper::likeClause(['filename', 'cimkek', 'feltolto_nev'], 'search');
                    $params[':search'] = '%' . $search . '%';
                }
                if (!empty($szurok['kategoria'])) {
                    $where[] = "fajl_kategoria = :kategoria";
                    $params[':kategoria'] = $szurok['kategoria'];
                }
                if (!empty($szurok['modul'])) {
                    $where[] = "tabla = :modul";
                    $params[':modul'] = $szurok['modul'];
                }
                if (!empty($szurok['feltoltoId'])) {
                    // Az admin- és sofőr-tábla auto-increment id-jai
                    // egymástól függetlenek, ütközhetnek — a szűrő ezért
                    // MINDIG a "tipus:id" összetett alakot várja, sosem
                    // csupasz id-t, különben egy admin=6 és egy sofor=6
                    // feltöltője összekeveredne.
                    [$feltoltoTipusSzuro, $feltoltoIdSzuro] = array_pad(explode(':', $szurok['feltoltoId'], 2), 2, null);
                    if ($feltoltoTipusSzuro && $feltoltoIdSzuro) {
                        $where[] = "feltolto_tipus = :feltoltoTipus AND feltolto_id = :feltoltoId";
                        $params[':feltoltoTipus'] = $feltoltoTipusSzuro;
                        $params[':feltoltoId'] = $feltoltoIdSzuro;
                    }
                }
                if (!empty($szurok['datumTol'])) {
                    $where[] = "feltoltve >= :datumTol";
                    $params[':datumTol'] = $szurok['datumTol'];
                }
                if (!empty($szurok['datumIg'])) {
                    $where[] = "feltoltve <= :datumIg";
                    $params[':datumIg'] = $szurok['datumIg'] . ' 23:59:59';
                }

                $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$szurok['sortKey'] ?? ''] ?? 'feltoltve';
                $rendezoIrany = (($szurok['sortDir'] ?? '') === 'asc') ? 'ASC' : 'DESC';

                $query = "SELECT * FROM fajlok WHERE " . implode(' AND ', $where) . " ORDER BY $rendezoOszlop $rendezoIrany";

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

    function fileToDatabase($admin, $tabla, $rowid, $hely, $name, $size, $kategoria, $feltoltoTipus, $feltoltoId, $feltoltoNev, $fajlKategoria, $cimkek) {
        $query = "INSERT INTO fajlok (admin,tabla,kategoria,rowid,hely,filename,filesize,feltoltve,feltolto_tipus,feltolto_id,feltolto_nev,fajl_kategoria,cimkek)
                   VALUES (:admin,:tabla,:kategoria,:id,:hely,:filename,:filesize,NOW(),:feltolto_tipus,:feltolto_id,:feltolto_nev,:fajl_kategoria,:cimkek)";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':admin', $admin);
        $stmt->bindParam(':tabla', $tabla);
        $stmt->bindParam(':kategoria', $kategoria);
        $stmt->bindParam(':id', $rowid);
        $stmt->bindParam(':hely', $hely);
        $stmt->bindParam(':filename', $name);
        $stmt->bindParam(':filesize', $size);
        $stmt->bindValue(':feltolto_tipus', $feltoltoTipus);
        $stmt->bindValue(':feltolto_id', $feltoltoId);
        $stmt->bindValue(':feltolto_nev', $feltoltoNev);
        $stmt->bindValue(':fajl_kategoria', $fajlKategoria);
        $stmt->bindValue(':cimkek', $cimkek);
        $result = $stmt->execute();
        if (!$result) {
            return ['success' => false, 'message' => 'Hiba a mentésnél'];
        }

        return $result;
    }

    // Csak ezek a kiterjesztések tölthetők fel — enélkül egy `.php`/`.phtml`
    // stb. fájl feltölthető és (mivel a `backend/files/` a production
    // webrootön belül van, ld. CLAUDE.md) közvetlenül lefuttatható lenne a
    // webszerveren (RCE). A lista a projektben ténylegesen használt
    // dokumentum-/kép-/táblázat-típusok mellett (2026-07-23, "központi
    // fájlkezelő" bővítés, felhasználói döntés alapján) a kért 9 kategória
    // teljes lefedéséhez szükséges prezentáció-/videó-/hang-/tömörített
    // típusokat is tartalmazza, plusz `ddd` a tachográf-import saját,
    // belső (nem szabad-formátumú admin-feltöltésből eredő) fájljaihoz.
    const MEGENGEDETT_KITERJESZTESEK = [
        'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
        'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt',
        'ppt', 'pptx', 'odp',
        'mp4', 'mov', 'avi', 'mkv', 'webm',
        'mp3', 'wav', 'ogg', 'm4a',
        'zip', 'rar', '7z',
        'ddd',
    ];

    // Kiterjesztés → a kért 9 kategória egyike. Csak a whitelisten szereplő
    // kiterjesztésekhez van bejegyzés — `fileUpload()` mindenképp elutasítja
    // a listán kívüli fájlokat, tehát ide sosem kerülhet ismeretlen érték.
    const KATEGORIA_TERKEP = [
        'jpg' => 'kep', 'jpeg' => 'kep', 'png' => 'kep', 'gif' => 'kep',
        'webp' => 'kep', 'heic' => 'kep', 'heif' => 'kep',
        'pdf' => 'pdf',
        'doc' => 'dokumentum', 'docx' => 'dokumentum', 'txt' => 'dokumentum',
        'xls' => 'tablazat', 'xlsx' => 'tablazat', 'csv' => 'tablazat',
        'ppt' => 'prezentacio', 'pptx' => 'prezentacio', 'odp' => 'prezentacio',
        'mp4' => 'video', 'mov' => 'video', 'avi' => 'video', 'mkv' => 'video', 'webm' => 'video',
        'mp3' => 'hang', 'wav' => 'hang', 'ogg' => 'hang', 'm4a' => 'hang',
        'zip' => 'tomoritett', 'rar' => 'tomoritett', '7z' => 'tomoritett',
    ];

    // A kliens-oldali 10MB-os ellenőrzés (ld. CardTableForFajlok.js)
    // trivially megkerülhető közvetlen API-hívással — ez a szerver-oldali,
    // a TÉNYLEGESEN dekódolt bájtokon mért kényszerítő korlát.
    const MAX_FAJLMERET_BYTE = 10 * 1024 * 1024;

    // `$feltoltoTipus`/`$feltoltoId`/`$feltoltoNev` — a HÍVÓ (ApiHandler)
    // mindig a munkamenetből szerver-oldalon feloldva adja át, sosem a
    // kliens által küldött mezőből (ugyanaz az elv, mint az `$admin`
    // paraméternél: a kliens `admin` mezőjét ez a kód már korábban is
    // figyelmen kívül hagyta, `resolveSajatCegId()`-t hívva helyette).
    function fileUpload($admin, $tabla, $rowid, $base64File, $name, $size, $kategoria = null, $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null, $cimkek = null) {
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
        $fajlKategoria = self::KATEGORIA_TERKEP[$kiterjesztes] ?? 'egyeb';

        if (file_put_contents($filePath, $fileData) !== false) {
            if ($this->fileToDatabase($admin, $tabla, $rowid, $filePath, $displayName, strlen($fileData), $kategoria, $feltoltoTipus, $feltoltoId, $feltoltoNev, $fajlKategoria, $cimkek)) {
                return ['success' => true, 'message' => 'A fájl mentve', 'id' => $this->db->lastInsertId()];
            }
            unlink($filePath);
            return ['success' => false, 'message' => 'Hiba a fájl mentésénél az adatbázisba'];
        }

        return ['success' => false, 'message' => 'Hiba a fájl mentésénél a mappába'];
    }

    // Tömeges/egyedi címkézés — a kijelölt fájl(ok) `cimkek` mezőjének
    // teljes felülírása (nem hozzáfűzés), ugyanaz a minta, mint a meglévő
    // tömeges törlésnél: a frontend soronként hívja.
    function updateFajlCimkek($id, $ceg_id, $cimkek) {
        $stmt = $this->db->prepare("UPDATE fajlok SET cimkek = :cimkek WHERE sorszam = :id AND admin = :ceg_id");
        $stmt->bindValue(':cimkek', $cimkek);
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        if ($stmt->rowCount() === 0) {
            return ['success' => false, 'message' => 'A fájl nem található, vagy nem a te céged fájlja'];
        }
        return ['success' => true];
    }

    // Átnevezés — csak a megjelenítési nevet (`filename`) írja át, a
    // lemezen lévő fájl (`hely`) és a fizikai fájlnév változatlan marad
    // (az mindig egy generált, ütközésmentes azonosító, ld. fileUpload()).
    function renameFile($id, $ceg_id, $newName) {
        $newName = trim((string) $newName);
        if ($newName === '') {
            return ['success' => false, 'message' => 'A fájlnév nem lehet üres.'];
        }
        $newName = preg_replace('/[^a-zA-Z0-9_\.\- ÁÉÍÓÖŐÚÜŰáéíóöőúüű]/u', '_', $newName);
        $stmt = $this->db->prepare("UPDATE fajlok SET filename = :filename WHERE sorszam = :id AND admin = :ceg_id");
        $stmt->bindValue(':filename', $newName);
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        if ($stmt->rowCount() === 0) {
            return ['success' => false, 'message' => 'A fájl nem található, vagy nem a te céged fájlja'];
        }
        return ['success' => true, 'filename' => $newName];
    }

    // Tömeges letöltés — a korábbi, N különálló böngésző-letöltést indító
    // megoldás helyett (amit Chrome/Safari 2-3 fájl után csendben letilt)
    // egyetlen ZIP-be csomagolja a kijelölt, ceg_id-vel ellenőrzött
    // fájlokat, és ugyanazt a base64-válasz mintát adja vissza, mint
    // downloadFile() — a frontend így egyetlen letöltést indít.
    function downloadFilesZip($ids, $ceg_id) {
        if (empty($ids) || !is_array($ids)) {
            return ['success' => false, 'message' => 'Nincs kiválasztva fájl.'];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT hely, filename FROM fajlok WHERE sorszam IN ($placeholders) AND admin = ?");
        $parameterek = array_merge(array_values($ids), [$ceg_id]);
        $stmt->execute($parameterek);
        $fajlok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($fajlok)) {
            return ['success' => false, 'message' => 'A kijelölt fájlok nem találhatók, vagy nem a te céged fájljai.'];
        }

        $zipPath = tempnam(sys_get_temp_dir(), 'fajlok_zip_') . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return ['success' => false, 'message' => 'Nem sikerült létrehozni a ZIP-fájlt.'];
        }
        // Névütközés-védelem a ZIP-en belül (két kijelölt fájl azonos
        // megjelenítési névvel) — sorszám-előtaggal egyértelműsítve.
        $hasznaltNevek = [];
        foreach ($fajlok as $i => $fajl) {
            if (!file_exists($fajl['hely'])) {
                continue;
            }
            $nev = $fajl['filename'];
            if (isset($hasznaltNevek[$nev])) {
                $nev = ($i + 1) . '_' . $nev;
            }
            $hasznaltNevek[$nev] = true;
            $zip->addFile($fajl['hely'], $nev);
        }
        $zip->close();

        $data = base64_encode(file_get_contents($zipPath));
        unlink($zipPath);

        return [
            'success' => true,
            'mime' => 'application/zip',
            'file' => $data,
            'filename' => 'fajlok_' . date('Y-m-d') . '.zip',
        ];
    }

    // Dashboard-statisztika a Fájlok oldal fejlécéhez — egyetlen aggregált
    // lekérdezés, ugyanaz a "feltételes SUM" minta, mint
    // koltsegInterface::getOsszesenGyors()-ban.
    function getStatisztika($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) osszes_fajl,
                    SUM(filesize) osszes_meret,
                    SUM(CASE WHEN feltoltve >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) uj_a_heten
             FROM fajlok WHERE admin = :ceg_id"
        );
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $osszesito = $stmt->fetch(PDO::FETCH_ASSOC);

        $kategoriaStmt = $this->db->prepare(
            "SELECT fajl_kategoria, COUNT(*) darab FROM fajlok
             WHERE admin = :ceg_id GROUP BY fajl_kategoria ORDER BY darab DESC"
        );
        $kategoriaStmt->bindValue(':ceg_id', $ceg_id);
        $kategoriaStmt->execute();
        $kategoriaSzerint = $kategoriaStmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'success' => true,
            'osszesFajl' => (int) ($osszesito['osszes_fajl'] ?? 0),
            'osszesMeret' => (int) ($osszesito['osszes_meret'] ?? 0),
            'ujAHeten' => (int) ($osszesito['uj_a_heten'] ?? 0),
            'leggyakoribbKategoria' => $kategoriaSzerint[0]['fajl_kategoria'] ?? null,
            'kategoriaSzerint' => $kategoriaSzerint,
        ];
    }

    // "Hasonló fájlok" a preview panelhez — ugyanaz a fájltípus-kategória
    // és ugyanaz a modul, a legutóbb feltöltöttek elöl, a jelenlegi fájl
    // kizárva. Tisztán SQL-egyezés, nincs mögötte AI/tartalom-elemzés.
    function getHasonloFajlok($id, $ceg_id) {
        $stmt = $this->db->prepare("SELECT fajl_kategoria, tabla FROM fajlok WHERE sorszam = :id AND admin = :ceg_id");
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $alap = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$alap) {
            return ['success' => false, 'message' => 'A fájl nem található.'];
        }

        $hasonloStmt = $this->db->prepare(
            "SELECT sorszam, filename, fajl_kategoria, filesize, feltoltve FROM fajlok
             WHERE admin = :ceg_id AND fajl_kategoria = :kategoria AND tabla = :tabla AND sorszam <> :id
             ORDER BY feltoltve DESC LIMIT 5"
        );
        $hasonloStmt->bindValue(':ceg_id', $ceg_id);
        $hasonloStmt->bindValue(':kategoria', $alap['fajl_kategoria']);
        $hasonloStmt->bindValue(':tabla', $alap['tabla']);
        $hasonloStmt->bindValue(':id', $id);
        $hasonloStmt->execute();

        return ['success' => true, 'fajlok' => $hasonloStmt->fetchAll(PDO::FETCH_ASSOC)];
    }
}

$filesInterface = new FilesInterface();
