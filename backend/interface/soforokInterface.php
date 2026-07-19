<?php

class SoforokInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // `$isAdmin`: a sofőr havi bére (`ber` oszlop) kizárólag admin
    // szerepkörnek jár — más (pl. fuvarszervező) szerepkör lekérdezéskor a
    // mezőt itt, szerver oldalon vágjuk ki a válaszból, nem a frontendre
    // bízzuk, hogy egyszerűen nem jeleníti meg (a nyers API-válasz
    // böngésző dev toolsból amúgy is látszódna).
    public function getSoforok($id, $search = null, $page = null, $pageSize = null, $isAdmin = false) {

        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM user WHERE admin = :id AND admin <> id AND torolt <> 'I'";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['name', 'email', 'phone', 'lakcim'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $query .= " ORDER BY name ASC";

            $szur = function ($sorok) use ($isAdmin) {
                if ($isAdmin) {
                    return $sorok;
                }
                foreach ($sorok as &$sor) {
                    unset($sor['ber']);
                }
                return $sorok;
            };

            if ($page !== null) {
                [$soforok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                return ['success' => true, 'soforok' => $szur($soforok), 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $soforok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'soforok' => $szur($soforok)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    // `$ceg_id`-t a hívó (ApiHandler) mindig szerver-oldalon feloldva adja
    // át — enélkül bármely sofőr felülírhatta volna bármely másik sofőr
    // (akár másik cég!) adatait puszta id-tallózással (IDOR, ld. biztonsági
    // audit). `$isAdmin`: a `ber` mezőt csak admin szerepkör küldheti/
    // módosíthatja — nem-admin kérelmezőnél a mezőt EGYSZERŰEN figyelmen
    // kívül hagyjuk (a meglévő adatbázis-érték megmarad). `$canSetJarmu`:
    // a `kamion`/`aktiv_potkocsi` mezőt KIZÁRÓLAG admin-oldali hívás
    // állíthatja be — sofőr-munkamenetből (a saját "Profil" oldal is ezt
    // az akciót hívja) ez mindig `false`, hogy egy sofőr ne tudja
    // megkerülni a jármű-váltási jóváhagyási folyamatot (ld.
    // jarmuValtasInterface) egy közvetlen `saveSoforData` hívással.
    public function saveSoforData($data, $ceg_id, $isAdmin = false, $canSetJarmu = false) {
        try {
            $query = "UPDATE user
                      SET name = :name,
                          email = :email,
                          phone = :phone,
                          szul_datum = :szul_datum,
                          szemelyi = :szemelyi,
                          varos = :varos,
                          irsz = :irsz,
                          cim = :cim,
                          lakcim = COALESCE(:lakcim, lakcim),
                          szemelyi_lejarat = :szemelyi_lejarat,
                          jogsi_lejarat = :jogsi_lejarat,
                          gki_lejarat = :gki_lejarat,
                          adr_lejarat = :adr_lejarat"
                      . ($canSetJarmu ? ", kamion = :kamion, aktiv_potkocsi = :aktiv_potkocsi" : "") . "
                      "
                      . ($isAdmin ? ", ber = :ber" : "") . "
                      WHERE id = :id AND admin = :ceg_id";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindParam(':id', $data['id'], PDO::PARAM_INT);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindParam(':name', $data['name'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':phone', $data['phone'], PDO::PARAM_STR);
            $stmt->bindParam(':szul_datum', $data['szul_datum'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi', $data['szemelyi'], PDO::PARAM_STR);
            $stmt->bindParam(':varos', $data['varos'], PDO::PARAM_STR);
            $stmt->bindParam(':irsz', $data['irsz'], PDO::PARAM_STR);
            $stmt->bindParam(':cim', $data['cim'], PDO::PARAM_STR);
            $stmt->bindParam(':lakcim', $data['lakcim'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi_lejarat', $data['szemelyi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':jogsi_lejarat', $data['jogsi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':gki_lejarat', $data['gki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);
            if ($canSetJarmu) {
                // Elsődleges jármű-hozzárendelés — közvetlenül az admin
                // állítja be itt, jóváhagyás nélkül (a sofőr saját maga
                // csak kérést küldhet, ld. jarmuValtasInterface).
                $kamion = !empty($data['kamion']) ? $data['kamion'] : null;
                $aktivPotkocsi = !empty($data['aktiv_potkocsi']) ? $data['aktiv_potkocsi'] : null;
                $stmt->bindValue(':kamion', $kamion);
                $stmt->bindValue(':aktiv_potkocsi', $aktivPotkocsi);
            }
            if ($isAdmin) {
                $stmt->bindValue(':ber', $data['ber'] !== '' && $data['ber'] !== null ? $data['ber'] : null);
            }

            // Lekérdezés végrehajtása
            $stmt->execute();

            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A sofőr nem található, vagy nem a te céged sofőrje.'];
            }

            return ['success' => true, 'message' => 'Sofőr adatai sikeresen frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    // `$ceg_id`-t a hívó szerver-oldalon feloldva adja át — sosem a kliens
    // `$data['admin']` mezőjét (enélkül bárki tetszőleges másik cég neve
    // alatt hozhatott volna létre sofőr-rekordot, ld. biztonsági audit).
    public function newSofor($data, $ceg_id) {
        try {
            $query = "INSERT INTO user
                      (admin,name, email, phone, szul_datum, szemelyi, varos, irsz, cim, szemelyi_lejarat, jogsi_lejarat, gki_lejarat, adr_lejarat)
                      VALUES
                      (:admin,:name, :email, :phone, :szul_datum, :szemelyi, :varos, :irsz, :cim, :szemelyi_lejarat, :jogsi_lejarat, :gki_lejarat, :adr_lejarat)";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindParam(':name', $data['name'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':phone', $data['phone'], PDO::PARAM_STR);
            $stmt->bindParam(':szul_datum', $data['szul_datum'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi', $data['szemelyi'], PDO::PARAM_STR);
            $stmt->bindParam(':varos', $data['varos'], PDO::PARAM_STR);
            $stmt->bindParam(':irsz', $data['irsz'], PDO::PARAM_STR);
            $stmt->bindParam(':cim', $data['cim'], PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi_lejarat', $data['szemelyi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':jogsi_lejarat', $data['jogsi_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':gki_lejarat', $data['gki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);

            // Lekérdezés végrehajtása
            $stmt->execute();

            $newSoforId = $this->db->lastInsertId();
            $newSoforData = $this->getSofor($newSoforId, $ceg_id);

            return ['success' => true, 'message' => 'Sofőr adatai sikeresen beszúrva.', 'sofor' => $newSoforData];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id`-t a hívó szerver-oldalon feloldva adja át — enélkül bármely
    // cég törölhette volna bármely másik cég sofőrjét puszta id-tallózással.
    public function deleteSofor($id, $ceg_id) {
        try {
            $query = "UPDATE user SET torolt='I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A sofőr nem található, vagy nem a te céged sofőrje.'];
            }
            return ['success' => true, 'message' => 'Sofőr törölve'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }


    // `$ceg_id`-vel és `torolt` szűréssel scope-olva — enélkül egy soft-
    // törölt, vagy más céghez tartozó sofőr rekordja is visszakapható volt
    // (ld. `getSajatSofor()` alábbi, korábban ellenőrzés nélküli hívása).
    private function getSofor($id, $ceg_id) {
        $query = "SELECT * FROM user WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Sofőr saját, friss adatai — a munkamenetben tárolt `user` a
    // bejelentkezéskori állapot, ez nem frissül automatikusan, ha pl.
    // az admin időközben jóváhagyta a jármű-váltási kérését. A sofőr
    // oldali Kezdőlap ezzel frissíti a sessionStorage-ban tárolt
    // kamion/aktiv_potkocsi mezőket minden betöltéskor.
    //
    // `$id`/`$ceg_id` mindkettő a hívó (ApiHandler) által szerver-oldalon
    // feloldott érték (resolveSajatSoforId()/resolveSajatCegId()) — sosem
    // a kliens kérésből — enélkül bármely sofőr bármely másik sofőr (akár
    // másik cég!) teljes profilját lekérhette volna puszta id-tallózással
    // (IDOR, ld. biztonsági audit).
    public function getSajatSofor($id, $ceg_id) {
        $sofor = $this->getSofor($id, $ceg_id);
        if (!$sofor) {
            return ['success' => false, 'message' => 'Sofőr nem található.'];
        }
        unset($sofor['password']);
        // A sofőr SOSEM láthatja a saját bérét ezen a felületen (ld.
        // sql/24.sql komment) — ez a saját-magát-lekérdező végpont,
        // eltérően a getSoforok()-tól, nem kap `$isAdmin` paramétert, mert
        // sofőr-munkamenetből sosem admin.
        unset($sofor['ber']);
        return ['success' => true, 'user' => $sofor];
    }
}

$soforokInterface = new SoforokInterface();
