<?php

// A `kamionInterface.php` pontos mása, a `potkocsi` FK-oszlop és a hozzá
// tartozó `potkocsiRendszamFeloldas()` helper nélkül — a furgon önhajtó
// jármű, mint a kamion, de nem vontat nyerges-pótkocsit.
class FurgonInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getFurgonValaszto($ceg_id) {
        try {
            $query = "SELECT id, rendszam FROM furgon WHERE admin = :ceg_id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            $furgonok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'furgonok' => $furgonok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$search`/`$page`/`$pageSize` NÉLKÜL hívva a teljes listát adja vissza,
    // lapozás nélkül — ugyanaz a mintát, mint a kamionInterface::getKamionok().
    public function getFurgonok($id, $search = null, $page = null, $pageSize = null) {
        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM furgon WHERE admin = :id AND torolt <> 'I'";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['rendszam', 'tipus', 'meret', 'allapot'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $query .= " ORDER BY rendszam ASC";

            if ($page !== null) {
                [$furgonok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                return ['success' => true, 'furgonok' => $furgonok, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $furgonok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'furgonok' => $furgonok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id`-t a hívó (ApiHandler) mindig szerver-oldalon feloldva adja
    // át — enélkül bármely cég módosíthatta volna bármely másik cég
    // furgonját puszta id-tallózással (IDOR, ld. biztonsági audit).
    public function saveFurgonData($data, $ceg_id) {
        try {
            $query = "UPDATE furgon
                      SET rendszam = :rendszam,
                          meret = :meret,
                          tipus = :tipus,
                          allapot = :allapot,
                          aktualis_km = :aktualis_km,
                          muszaki_lejarat = :muszaki_lejarat,
                          adr_lejarat = :adr_lejarat,
                          taograf_illesztes = :taograf_illesztes,
                          emelohatfal_vizsga = :emelohatfal_vizsga,
                          porolto_lejarat = :porolto_lejarat,
                          porolto_lejarat_2 = :porolto_lejarat_2,
                          kot_biztositas = :kot_biztositas,
                          kot_biz_nev = :kot_biz_nev,
                          kot_biz_dij = :kot_biz_dij,
                          kot_biz_utem = :kot_biz_utem,
                          kaszko_biztositas = :kaszko_biztositas,
                          kaszko_nev = :kaszko_nev,
                          kaszko_dij = :kaszko_dij,
                          kaszko_fizetesi_utem = :kaszko_fizetesi_utem
                      WHERE id = :id AND admin = :ceg_id";

            $stmt = $this->db->prepare($query);

            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
            $stmt->bindParam(':tipus', $data['tipus'], PDO::PARAM_STR);
            $stmt->bindParam(':meret', $data['meret'], PDO::PARAM_STR);
            $stmt->bindValue(':allapot', empty($data['allapot']) ? 'szabad' : $data['allapot']);
            $stmt->bindValue(':aktualis_km', empty($data['aktualis_km']) ? null : $data['aktualis_km']);
            $stmt->bindParam(':muszaki_lejarat', $data['muszaki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':taograf_illesztes', $data['taograf_illesztes'], PDO::PARAM_STR);
            $stmt->bindParam(':emelohatfal_vizsga', $data['emelohatfal_vizsga'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat', $data['porolto_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat_2', $data['porolto_lejarat_2'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biztositas', $data['kot_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_nev', $data['kot_biz_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_dij', $data['kot_biz_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_utem', $data['kot_biz_utem'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_biztositas', $data['kaszko_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_nev', $data['kaszko_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_dij', $data['kaszko_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_fizetesi_utem', $data['kaszko_fizetesi_utem'], PDO::PARAM_STR);
            $stmt->bindParam(':id', $data['id'], PDO::PARAM_INT);

            $stmt->execute();

            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A furgon nem található, vagy nem a te céged flottájába tartozik.'];
            }

            return ['success' => true, 'message' => 'Furgon adatai sikeresen frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id`-t a hívó szerver-oldalon feloldva adja át — sosem a kliens
    // `$data['admin']` mezőjét.
    public function newFurgon($data, $ceg_id) {
        try {
            $query = "INSERT INTO furgon
                      (admin, rendszam, meret, tipus, allapot, aktualis_km, muszaki_lejarat, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, porolto_lejarat, porolto_lejarat_2, kot_biztositas, kot_biz_nev, kot_biz_dij, kot_biz_utem, kaszko_biztositas, kaszko_nev, kaszko_dij, kaszko_fizetesi_utem)
                      VALUES (:admin, :rendszam, :meret, :tipus, :allapot, :aktualis_km, :muszaki_lejarat, :adr_lejarat, :taograf_illesztes, :emelohatfal_vizsga, :porolto_lejarat, :porolto_lejarat_2, :kot_biztositas, :kot_biz_nev, :kot_biz_dij, :kot_biz_utem, :kaszko_biztositas, :kaszko_nev, :kaszko_dij, :kaszko_fizetesi_utem)";

            $stmt = $this->db->prepare($query);

            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
            $stmt->bindParam(':tipus', $data['tipus'], PDO::PARAM_STR);
            $stmt->bindParam(':meret', $data['meret'], PDO::PARAM_STR);
            $stmt->bindValue(':allapot', empty($data['allapot']) ? 'szabad' : $data['allapot']);
            $stmt->bindValue(':aktualis_km', empty($data['aktualis_km']) ? null : $data['aktualis_km']);
            $stmt->bindParam(':muszaki_lejarat', $data['muszaki_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $data['adr_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':taograf_illesztes', $data['taograf_illesztes'], PDO::PARAM_STR);
            $stmt->bindParam(':emelohatfal_vizsga', $data['emelohatfal_vizsga'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat', $data['porolto_lejarat'], PDO::PARAM_STR);
            $stmt->bindParam(':porolto_lejarat_2', $data['porolto_lejarat_2'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biztositas', $data['kot_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_nev', $data['kot_biz_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_dij', $data['kot_biz_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kot_biz_utem', $data['kot_biz_utem'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_biztositas', $data['kaszko_biztositas'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_nev', $data['kaszko_nev'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_dij', $data['kaszko_dij'], PDO::PARAM_STR);
            $stmt->bindParam(':kaszko_fizetesi_utem', $data['kaszko_fizetesi_utem'], PDO::PARAM_STR);

            $stmt->execute();

            $newFurgonId = $this->db->lastInsertId();
            $newFurgonData = $this->getFurgon($newFurgonId, $ceg_id);

            return ['success' => true, 'message' => 'Furgon adatai sikeresen beszúrva.', 'furgon' => $newFurgonData];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteFurgon($id, $ceg_id) {
        try {
            $query = "SELECT id FROM furgon WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A furgon nem található, vagy nem a te céged flottájába tartozik.'];
            }

            $query = "UPDATE furgon_karbantartars SET torolt='I' WHERE furgon_id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

            $query = "UPDATE furgon SET torolt='I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Furgon törölve'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getFurgonRendszamok($id) {
        $query = "SELECT id, rendszam, tipus FROM furgon WHERE admin = :id AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return ['success' => true, 'furgonok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    public function getFurgon($id, $ceg_id) {
        $query = "SELECT * FROM furgon WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
$furgonInterface = new FurgonInterface();
