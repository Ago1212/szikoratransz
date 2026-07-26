<?php

// A modul szándékosan nincs a `MODULE_PERMISSION_MAP`-ban (admin ÉS sofőr
// munkamenetből is elérhető), de emiatt korábban SEMMILYEN cég-szintű
// hozzáférés-ellenőrzés nem volt rajta — bármely érvényes munkamenet
// (sofőr is) tetszőleges másik cég helyszín-listáját olvashatta/
// módosíthatta/törölhette, és a jegyzet szerzőjét (`szerzo_id`/`szerzo_nev`)
// is a kliens kérése határozta meg, tehát bárki hamisíthatta (ld.
// biztonsági audit). Minden metódus mostantól `$ceg_id`-t kap — ezt az
// ApiHandler mindig szerver-oldalon oldja fel (resolveSajatCegId(), ami
// admin- és sofőr-munkamenetre egyaránt működik).
class HelyszinInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    private const RENDEZHETO_OSZLOPOK = ['nev' => 'nev'];

    public function getHelyszinek($ceg_id, $search = null, $page = null, $pageSize = null, $sortKey = null, $sortDir = 'asc') {
        try {
            $params = [':id' => $ceg_id];
            $query = "SELECT * FROM helyszinek WHERE admin = :id AND torolt <> 'I'";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['nev'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'nev';
            $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
            $query .= " ORDER BY $rendezoOszlop $irany";

            if ($page !== null) {
                [$helyszinek, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                $helyszinek = $this->hozzafuzMegjegyzesekSzama($helyszinek);
                return ['success' => true, 'helyszinek' => $helyszinek, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $helyszinek = $this->hozzafuzMegjegyzesekSzama($stmt->fetchAll(PDO::FETCH_ASSOC));
            return ['success' => true, 'helyszinek' => $helyszinek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // UX-audit — a lista korábban ténylegesen egyetlen adatoszlopot (Név)
    // mutatott, a `helyszinek` tábla más érdemi mezőt nem is tárol. Ez a
    // metódus a jegyzetek darabszámát fűzi hozzá az oldalanként lekérdezett
    // sorokhoz — PHP-oldali, két különálló SELECT-tel (a projekt saját
    // SQL-lintere sem az összekapcsolt, sem a beágyazott lekérdezést nem
    // engedi), ugyanaz a minta, mint a `bejelentesekInterface::getUzenetInfok()`-nál.
    private function hozzafuzMegjegyzesekSzama($helyszinek) {
        if (empty($helyszinek)) {
            return $helyszinek;
        }
        $ids = array_column($helyszinek, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare(
            "SELECT helyszin_id, COUNT(*) AS db FROM helyszin_megjegyzesek
             WHERE torolt <> 'I' AND helyszin_id IN ($placeholders) GROUP BY helyszin_id"
        );
        $stmt->execute($ids);
        $szamok = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $szamok[$row['helyszin_id']] = (int) $row['db'];
        }
        foreach ($helyszinek as &$h) {
            $h['megjegyzesek_szama'] = $szamok[$h['id']] ?? 0;
        }
        return $helyszinek;
    }

    public function getHelyszin($id, $ceg_id) {
        try {
            $query = "SELECT * FROM helyszinek WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
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

    public function newHelyszin($data, $ceg_id) {
        try {
            $query = "INSERT INTO helyszinek (admin, nev) VALUES (:admin, :nev)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->execute();

            $newId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Helyszín rögzítve.', 'helyszin' => ['id' => $newId, 'nev' => $data['nev']]];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function saveHelyszinData($data, $ceg_id) {
        try {
            $query = "UPDATE helyszinek SET nev = :nev WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id']);
            $stmt->bindValue(':nev', $data['nev']);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A helyszín nem található, vagy nem a te céged tulajdona.'];
            }

            return ['success' => true, 'message' => 'Mentés sikeres.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteHelyszin($id, $ceg_id) {
        try {
            $query = "UPDATE helyszinek SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A helyszín nem található, vagy nem a te céged tulajdona.'];
            }
            return ['success' => true, 'message' => 'Helyszín törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `helyszin_megjegyzesek`-nek nincs saját `admin` oszlopa — a tulajdonos
    // céget a `helyszin_id`-n keresztül, a `helyszinek` táblából kell
    // levezetni. A projekt konvenciója szerint (ld. ApiHandler::getEsemenyek)
    // nincs SQL JOIN/subselect a kódbázisban — ezért két külön lekérdezés:
    // előbb ellenőrizzük, hogy a helyszín tényleg a hívó cégéhez tartozik-e,
    // utána (és csak akkor) kérjük le a hozzá tartozó jegyzeteket.
    public function getHelyszinMegjegyzesek($helyszin_id, $ceg_id) {
        try {
            if (!$this->helyszinSajat($helyszin_id, $ceg_id)) {
                return ['success' => false, 'message' => 'A helyszín nem található, vagy nem a te céged tulajdona.'];
            }

            $query = "SELECT * FROM helyszin_megjegyzesek WHERE helyszin_id = :helyszin_id AND torolt <> 'I' ORDER BY letrehozva ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':helyszin_id', $helyszin_id);
            $stmt->execute();
            return ['success' => true, 'megjegyzesek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function helyszinSajat($helyszin_id, $ceg_id) {
        $stmt = $this->db->prepare("SELECT id FROM helyszinek WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':id', $helyszin_id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // `$szerzo_tipus`/`$szerzo_id`/`$szerzo_nev` mostantól a hívó (ApiHandler)
    // által szerver-oldalon feloldott session-adatból jön, nem a kliens
    // `$data` mezőiből — enélkül bárki tetszőleges nevet/id-t hamisíthatott
    // a jegyzet szerzőjeként (ld. biztonsági audit).
    public function newHelyszinMegjegyzes($data, $ceg_id, $szerzo_tipus, $szerzo_id, $szerzo_nev) {
        try {
            $helyszinStmt = $this->db->prepare("SELECT id FROM helyszinek WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $helyszinStmt->bindValue(':id', $data['helyszin_id']);
            $helyszinStmt->bindValue(':ceg_id', $ceg_id);
            $helyszinStmt->execute();
            if (!$helyszinStmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A helyszín nem található, vagy nem a te céged tulajdona.'];
            }

            $query = "INSERT INTO helyszin_megjegyzesek (helyszin_id, szerzo_tipus, szerzo_id, szerzo_nev, szoveg)
                      VALUES (:helyszin_id, :szerzo_tipus, :szerzo_id, :szerzo_nev, :szoveg)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':helyszin_id', $data['helyszin_id']);
            $stmt->bindValue(':szerzo_tipus', $szerzo_tipus);
            $stmt->bindValue(':szerzo_id', $szerzo_id);
            $stmt->bindValue(':szerzo_nev', $szerzo_nev);
            $stmt->bindValue(':szoveg', $data['szoveg']);
            $stmt->execute();

            $newId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Megjegyzés hozzáadva.', 'id' => $newId];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteHelyszinMegjegyzes($id, $ceg_id) {
        try {
            $megjStmt = $this->db->prepare("SELECT helyszin_id FROM helyszin_megjegyzesek WHERE id = :id AND torolt <> 'I'");
            $megjStmt->bindValue(':id', $id);
            $megjStmt->execute();
            $megjegyzes = $megjStmt->fetch(PDO::FETCH_ASSOC);
            if (!$megjegyzes || !$this->helyszinSajat($megjegyzes['helyszin_id'], $ceg_id)) {
                return ['success' => false, 'message' => 'A megjegyzés nem található, vagy nem a te céged tulajdona.'];
            }

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
