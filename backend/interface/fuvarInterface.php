<?php

// Fuvarmegbízás-kezelő — a `fuvarok` tábla korábban már létezett (ld.
// backend/sql/2.sql és 4.sql kommentjei: a funkciót annak idején
// visszavonták, mert "a diszpécserek szóban egyeztetik a fuvarokat, és
// utólagos rögzítésre nincs idejük"), a tábla viszont sosem lett eldobva.
// Ez az interfész most szándékosan a GYORS, alacsony-súrlódású rögzítésre
// épül — a `newFuvar()`-ban KIZÁRÓLAG a fel-/lerakási cím kötelező, minden
// más (jármű, sofőr, ügyfél, dátumok, díj) utólag is kiegészíthető, hogy a
// korábbi visszavonás indoka (nincs idő részletes rögzítésre) ne álljon
// fenn újra. A projekt JOIN-mentes konvenciója szerint (ld.
// bejelentesekInterface.php komment) a kapcsolódó neveket külön
// lekérdezésekkel töltjük be, PHP oldalon fűzzük össze.
class FuvarInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function newFuvar($data) {
        try {
            if (empty($data['felrakas_cim']) || empty($data['lerakas_cim'])) {
                return ['success' => false, 'message' => 'A felrakási és lerakási cím megadása kötelező.'];
            }
            // Mindkét dátum opcionális (ld. fenti komment: "gyors rögzítés",
            // utólag is kiegészíthető), de ha mindkettő meg van adva, a
            // lerakás nem előzheti meg a felrakást.
            if (!empty($data['felrakas_datum']) && !empty($data['lerakas_datum']) && $data['lerakas_datum'] < $data['felrakas_datum']) {
                return ['success' => false, 'message' => 'A lerakási dátum nem lehet korábbi a felrakási dátumnál.'];
            }
            if (isset($data['dij']) && $data['dij'] !== '' && $data['dij'] !== null && (float) $data['dij'] < 0) {
                return ['success' => false, 'message' => 'A díj nem lehet negatív.'];
            }

            $query = "INSERT INTO fuvarok
                      (admin, ugyfel_id, kamion_id, potkocsi_id, sofor_id, felrakas_cim, felrakas_datum,
                       lerakas_cim, lerakas_datum, rakomany_leiras, suly_kg, dij, devizanem, megjegyzes)
                      VALUES
                      (:admin, :ugyfel_id, :kamion_id, :potkocsi_id, :sofor_id, :felrakas_cim, :felrakas_datum,
                       :lerakas_cim, :lerakas_datum, :rakomany_leiras, :suly_kg, :dij, :devizanem, :megjegyzes)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['ceg_id']);
            $stmt->bindValue(':ugyfel_id', empty($data['ugyfel_id']) ? null : $data['ugyfel_id']);
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':potkocsi_id', empty($data['potkocsi_id']) ? null : $data['potkocsi_id']);
            $stmt->bindValue(':sofor_id', empty($data['sofor_id']) ? null : $data['sofor_id']);
            $stmt->bindValue(':felrakas_cim', $data['felrakas_cim']);
            $stmt->bindValue(':felrakas_datum', $data['felrakas_datum'] ?: null);
            $stmt->bindValue(':lerakas_cim', $data['lerakas_cim']);
            $stmt->bindValue(':lerakas_datum', $data['lerakas_datum'] ?: null);
            $stmt->bindValue(':rakomany_leiras', $data['rakomany_leiras'] ?: null);
            $stmt->bindValue(':suly_kg', $data['suly_kg'] ?: null);
            $stmt->bindValue(':dij', $data['dij'] ?: null);
            $stmt->bindValue(':devizanem', $data['devizanem'] ?: 'HUF');
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?: null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Fuvar rögzítve.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function saveFuvarData($data) {
        try {
            if (empty($data['felrakas_cim']) || empty($data['lerakas_cim'])) {
                return ['success' => false, 'message' => 'A felrakási és lerakási cím megadása kötelező.'];
            }
            // Mindkét dátum opcionális (ld. fenti komment: "gyors rögzítés",
            // utólag is kiegészíthető), de ha mindkettő meg van adva, a
            // lerakás nem előzheti meg a felrakást.
            if (!empty($data['felrakas_datum']) && !empty($data['lerakas_datum']) && $data['lerakas_datum'] < $data['felrakas_datum']) {
                return ['success' => false, 'message' => 'A lerakási dátum nem lehet korábbi a felrakási dátumnál.'];
            }
            if (isset($data['dij']) && $data['dij'] !== '' && $data['dij'] !== null && (float) $data['dij'] < 0) {
                return ['success' => false, 'message' => 'A díj nem lehet negatív.'];
            }

            $query = "UPDATE fuvarok SET
                      ugyfel_id = :ugyfel_id, kamion_id = :kamion_id, potkocsi_id = :potkocsi_id, sofor_id = :sofor_id,
                      felrakas_cim = :felrakas_cim, felrakas_datum = :felrakas_datum,
                      lerakas_cim = :lerakas_cim, lerakas_datum = :lerakas_datum,
                      rakomany_leiras = :rakomany_leiras, suly_kg = :suly_kg, dij = :dij,
                      devizanem = :devizanem, megjegyzes = :megjegyzes
                      WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
            $stmt->bindValue(':ceg_id', $data['ceg_id']);
            $stmt->bindValue(':ugyfel_id', empty($data['ugyfel_id']) ? null : $data['ugyfel_id']);
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':potkocsi_id', empty($data['potkocsi_id']) ? null : $data['potkocsi_id']);
            $stmt->bindValue(':sofor_id', empty($data['sofor_id']) ? null : $data['sofor_id']);
            $stmt->bindValue(':felrakas_cim', $data['felrakas_cim']);
            $stmt->bindValue(':felrakas_datum', $data['felrakas_datum'] ?: null);
            $stmt->bindValue(':lerakas_cim', $data['lerakas_cim']);
            $stmt->bindValue(':lerakas_datum', $data['lerakas_datum'] ?: null);
            $stmt->bindValue(':rakomany_leiras', $data['rakomany_leiras'] ?: null);
            $stmt->bindValue(':suly_kg', $data['suly_kg'] ?: null);
            $stmt->bindValue(':dij', $data['dij'] ?: null);
            $stmt->bindValue(':devizanem', $data['devizanem'] ?: 'HUF');
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?: null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Fuvar frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Könnyű, önálló akció a lista gyors állapotváltó gombjaihoz — nem
    // kell megnyitni a teljes szerkesztő modált egy Indítás/Lezárás/Storno
    // művelethez.
    public function updateFuvarStatusz($id, $ceg_id, $statusz) {
        try {
            if (!in_array($statusz, ['tervezett', 'folyamatban', 'lezart', 'storno'], true)) {
                return ['success' => false, 'message' => 'Ismeretlen állapot.'];
            }
            $query = "UPDATE fuvarok SET statusz = :statusz WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':statusz', $statusz);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Állapot frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Könnyű, csak ütemezést módosító akció a Fuvartervező naptár
    // húzás-műveleteihez (áthúzás másik napra/kamionra, beosztatlan fuvar
    // behúzása) — nem a teljes szerkesztő-mezőkészletet frissíti, mint
    // saveFuvarData(). `kamion_id` NULL is lehet: ez a "vissza a
    // beosztatlanok közé" húzást fedi le.
    public function updateFuvarBeosztas($id, $ceg_id, $kamion_id, $felrakas_datum, $lerakas_datum) {
        try {
            $query = "UPDATE fuvarok SET kamion_id = :kamion_id, felrakas_datum = :felrakas_datum, lerakas_datum = :lerakas_datum
                      WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':kamion_id', empty($kamion_id) ? null : $kamion_id);
            $stmt->bindValue(':felrakas_datum', $felrakas_datum ?: null);
            $stmt->bindValue(':lerakas_datum', $lerakas_datum ?: null);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Ütemezés frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteFuvar($id, $ceg_id) {
        try {
            $query = "UPDATE fuvarok SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Fuvar törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getFuvarok($ceg_id, $statusz = null, $datumTol = null, $datumIg = null, $search = null, $page = null, $pageSize = null) {
        try {
            $query = "SELECT * FROM fuvarok WHERE admin = :ceg_id AND torolt <> 'I'";
            $params = [':ceg_id' => $ceg_id];
            if (!empty($statusz)) {
                $query .= " AND statusz = :statusz";
                $params[':statusz'] = $statusz;
            }
            if (!empty($datumTol)) {
                $query .= " AND (felrakas_datum >= :datumTol OR felrakas_datum IS NULL)";
                $params[':datumTol'] = $datumTol;
            }
            if (!empty($datumIg)) {
                $query .= " AND (felrakas_datum <= :datumIg OR felrakas_datum IS NULL)";
                $params[':datumIg'] = $datumIg;
            }
            // A `kamion_rendszam`/`potkocsi_rendszam`/`ugyfel_nev`/`sofor_nev`
            // a lekérdezés után, PHP oldalon fűződik a sorokhoz (ld. lentebb) —
            // ezért a rájuk szűrő kereséshez alkérdés kell, nem sima LIKE a
            // `fuvarok` saját oszlopain.
            if (!empty($search)) {
                // A subquery-k is `admin = :ceg_id AND torolt <> 'I'` szerint
                // szűrnek, konzisztensen a fájl többi lekérdezésével (ld.
                // getNevLookup/getSoforNevek lentebb) — enélkül egy másik
                // cégbeli vagy törölt kamion/pótkocsi/ügyfél/sofőr rendszáma/
                // neve is illeszkedhetne, ha egy `*_id` FK véletlenül arra
                // mutatna.
                $query .= " AND (" . PaginationHelper::likeClause(['felrakas_cim', 'lerakas_cim', 'rakomany_leiras', 'megjegyzes'], 'search') .
                    " OR kamion_id IN (SELECT id FROM kamion WHERE rendszam LIKE :search_kamion AND admin = :ceg_id_kamion AND torolt <> 'I')" .
                    " OR potkocsi_id IN (SELECT id FROM potkocsi WHERE rendszam LIKE :search_potkocsi AND admin = :ceg_id_potkocsi AND torolt <> 'I')" .
                    " OR ugyfel_id IN (SELECT id FROM ugyfelek WHERE nev LIKE :search_ugyfel AND admin = :ceg_id_ugyfel AND torolt <> 'I')" .
                    " OR sofor_id IN (SELECT id FROM user WHERE name LIKE :search_sofor AND admin = :ceg_id_sofor AND torolt <> 'I'))";
                $params[':search'] = '%' . $search . '%';
                $params[':search_kamion'] = '%' . $search . '%';
                $params[':ceg_id_kamion'] = $ceg_id;
                $params[':search_potkocsi'] = '%' . $search . '%';
                $params[':ceg_id_potkocsi'] = $ceg_id;
                $params[':search_ugyfel'] = '%' . $search . '%';
                $params[':ceg_id_ugyfel'] = $ceg_id;
                $params[':search_sofor'] = '%' . $search . '%';
                $params[':ceg_id_sofor'] = $ceg_id;
            }
            $query .= " ORDER BY COALESCE(felrakas_datum, letrehozva) DESC, id DESC";

            if ($page !== null) {
                [$fuvarok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
            } else {
                $stmt = $this->db->prepare($query);
                foreach ($params as $k => $v) {
                    $stmt->bindValue($k, $v);
                }
                $stmt->execute();
                $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            $ugyfelNevek = $this->getNevLookup('ugyfelek', 'nev', $ceg_id);
            $kamionRendszamok = $this->getNevLookup('kamion', 'rendszam', $ceg_id);
            $potkocsiRendszamok = $this->getNevLookup('potkocsi', 'rendszam', $ceg_id);
            $soforNevek = $this->getSoforNevek($ceg_id);

            foreach ($fuvarok as &$f) {
                $f['ugyfel_nev'] = $ugyfelNevek[$f['ugyfel_id']] ?? null;
                $f['kamion_rendszam'] = $kamionRendszamok[$f['kamion_id']] ?? null;
                $f['potkocsi_rendszam'] = $potkocsiRendszamok[$f['potkocsi_id']] ?? null;
                $f['sofor_nev'] = $soforNevek[$f['sofor_id']] ?? null;
            }

            $result = ['success' => true, 'fuvarok' => $fuvarok];
            if ($page !== null) {
                $result['total'] = $total;
                $result['page'] = $page;
                $result['pageSize'] = $pageSize;
            }
            return $result;
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A jövőben getEsemenyek() is hívja (Dashboard-naptár előnézet) — csak
    // a tervezett/folyamatban fuvarokat adja vissza, dátum-tartomány
    // nélkül szűrve, mert a naptár maga dönti el, mit jelenít meg.
    public function getAktivFuvarok($ceg_id) {
        try {
            $query = "SELECT * FROM fuvarok
                      WHERE admin = :ceg_id AND torolt <> 'I' AND statusz IN ('tervezett', 'folyamatban')
                      AND felrakas_datum IS NOT NULL";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $kamionRendszamok = $this->getNevLookup('kamion', 'rendszam', $ceg_id);
            foreach ($fuvarok as &$f) {
                $f['kamion_rendszam'] = $kamionRendszamok[$f['kamion_id']] ?? null;
            }

            return $fuvarok;
        } catch (Exception $e) {
            return [];
        }
    }

    private function getNevLookup($tabla, $oszlop, $ceg_id) {
        $stmt = $this->db->prepare("SELECT id, `$oszlop` AS nev FROM `$tabla` WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['nev'];
        }
        return $map;
    }

    private function getSoforNevek($ceg_id) {
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id AND admin <> id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['name'];
        }
        return $map;
    }
}

$fuvarInterface = new FuvarInterface();
