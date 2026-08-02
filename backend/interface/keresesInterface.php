<?php

// Globális keresés — egyetlen keresőmezőből az összes fő modulban keres
// (kamionok, pótkocsik, sofőrök, ügyfelek, helyszínek), cégenként (ceg_id)
// szűrve. A projekt meglévő konvenciója szerint (ld. bejelentesekInterface.php
// komment) nincs JOIN — minden tábla saját lekérdezést kap, az eredmények
// PHP oldalon egy közös, egységes alakra hozva.
//
// Az `url` a LISTA oldalra mutat (fallbackként) — a GlobalSearch.js viszont
// egy találat kiválasztásakor mostantól a szerkesztő FORM route-ra navigál,
// `?id=`-vel (ld. GlobalSearch.js `TIPUS_FORM_URL`), amit a Form komponensek
// `useDeepLinkRecord.js`-en keresztül egy dedikált, modulonkénti "adott id
// lekérése" akcióval (getKamion/getPotkocsi/getFurgon/getSofor/getUgyfel/
// getHelyszin/getFuvar) oldanak fel teljes rekorddá — ez a lenti keresés
// ugyanis csak részleges mezőket ad vissza, formba töltésre nem elég.
class KeresesInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function globalSearch($ceg_id, $q) {
        try {
            $q = trim($q);
            if ($q === '' || mb_strlen($q) < 2) {
                return ['success' => true, 'talalatok' => []];
            }
            $like = '%' . $q . '%';
            $talalatok = [];

            $stmt = $this->db->prepare("SELECT id, rendszam, tipus FROM kamion WHERE admin = :ceg_id AND torolt <> 'I' AND rendszam LIKE :q LIMIT 8");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $talalatok[] = [
                    'tipus' => 'kamion',
                    'id' => $row['id'],
                    'cim' => $row['rendszam'],
                    'alcim' => $row['tipus'] ?: 'Kamion',
                    'url' => '/admin/kamionok',
                ];
            }

            $stmt = $this->db->prepare("SELECT id, rendszam, tipus FROM potkocsi WHERE admin = :ceg_id AND torolt <> 'I' AND rendszam LIKE :q LIMIT 8");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $talalatok[] = [
                    'tipus' => 'potkocsi',
                    'id' => $row['id'],
                    'cim' => $row['rendszam'],
                    'alcim' => $row['tipus'] ?: 'Pótkocsi',
                    'url' => '/admin/potkocsi',
                ];
            }

            $stmt = $this->db->prepare("SELECT id, rendszam, tipus FROM furgon WHERE admin = :ceg_id AND torolt <> 'I' AND rendszam LIKE :q LIMIT 8");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $talalatok[] = [
                    'tipus' => 'furgon',
                    'id' => $row['id'],
                    'cim' => $row['rendszam'],
                    'alcim' => $row['tipus'] ?: 'Furgon',
                    'url' => '/admin/furgonok',
                ];
            }

            $stmt = $this->db->prepare("SELECT id, name, email FROM user WHERE admin = :ceg_id AND admin <> id AND torolt <> 'I' AND name LIKE :q LIMIT 8");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $talalatok[] = [
                    'tipus' => 'sofor',
                    'id' => $row['id'],
                    'cim' => $row['name'],
                    'alcim' => $row['email'] ?: 'Sofőr',
                    'url' => '/admin/soforok',
                ];
            }

            $stmt = $this->db->prepare("SELECT id, nev, varos FROM ugyfelek WHERE admin = :ceg_id AND torolt <> 'I' AND nev LIKE :q LIMIT 8");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $talalatok[] = [
                    'tipus' => 'ugyfel',
                    'id' => $row['id'],
                    'cim' => $row['nev'],
                    'alcim' => $row['varos'] ?: 'Ügyfél',
                    'url' => '/admin/ugyfelek',
                ];
            }

            $stmt = $this->db->prepare("SELECT id, nev FROM helyszinek WHERE admin = :ceg_id AND torolt <> 'I' AND nev LIKE :q LIMIT 8");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $talalatok[] = [
                    'tipus' => 'helyszin',
                    'id' => $row['id'],
                    'cim' => $row['nev'],
                    'alcim' => 'Helyszín',
                    'url' => '/admin/helyszinek',
                ];
            }

            $stmt = $this->db->prepare(
                "SELECT id, felrako_ceg, lerako_ceg, aru_megnevezese, raklapszam, szamlaszam FROM fuvarok
                 WHERE admin = :ceg_id AND torolt <> 'I'
                   AND (felrako_ceg LIKE :q OR lerako_ceg LIKE :q OR aru_megnevezese LIKE :q OR raklapszam LIKE :q OR szamlaszam LIKE :q)
                 LIMIT 8"
            );
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':q', $like);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $utvonal = trim(($row['felrako_ceg'] ?: '') . ($row['felrako_ceg'] && $row['lerako_ceg'] ? ' → ' : '') . ($row['lerako_ceg'] ?: ''));
                $talalatok[] = [
                    'tipus' => 'fuvar',
                    'id' => $row['id'],
                    'cim' => $utvonal !== '' ? $utvonal : ($row['aru_megnevezese'] ?: 'Fuvar'),
                    'alcim' => $row['raklapszam'] ? "Raklapszám: {$row['raklapszam']}" : ($row['szamlaszam'] ?: 'Fuvar'),
                    'url' => '/admin/fuvarok',
                ];
            }

            return ['success' => true, 'talalatok' => $talalatok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$keresesInterface = new KeresesInterface();
