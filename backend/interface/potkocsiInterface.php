<?php

class PotkocsiInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    private const RENDEZHETO_OSZLOPOK = ['rendszam' => 'rendszam', 'tipus' => 'tipus', 'meret' => 'meret', 'allapot' => 'allapot'];

    public function getPotkocsik($id, $search = null, $page = null, $pageSize = null, $sortKey = null, $sortDir = 'asc') {

        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM potkocsi WHERE admin = :id  AND torolt <> 'I'";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['rendszam', 'tipus', 'meret', 'allapot'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'rendszam';
            $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
            $query .= " ORDER BY $rendezoOszlop $irany";

            if ($page !== null) {
                [$potkocsik, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                return ['success' => true, 'potkocsik' => $potkocsik, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $potkocsik = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'potkocsik' => $potkocsik];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id`-t a hívó (ApiHandler) mindig szerver-oldalon feloldva adja
    // át — enélkül bármely cég módosíthatta volna bármely másik cég
    // pótkocsiját puszta id-tallózással (IDOR, ld. biztonsági audit).
    public function savePotkocsiData($data, $ceg_id) {
        try {
            // SQL lekérdezés előkészítése az adatok frissítéséhez
            $query = "UPDATE potkocsi
                      SET rendszam = :rendszam,
                          muszaki_lejarat = :muszaki_lejarat,
                          tipus = :tipus,
                          meret = :meret,
                          allapot = :allapot,
                          aktualis_km = :aktualis_km,
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

            // Paraméterek kötése
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
            $stmt->bindParam(':tipus', $data['tipus'], PDO::PARAM_STR);
            $stmt->bindValue(':meret', empty($data['meret']) ? null : $data['meret']);
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
                return ['success' => false, 'message' => 'A pótkocsi nem található, vagy nem a te céged flottájába tartozik.'];
            }

            return ['success' => true, 'message' => 'Pótkocsi adatai sikeresen frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    // `$ceg_id`-t a hívó szerver-oldalon feloldva adja át — sosem a kliens
    // `$data['admin']` mezőjét (ld. saveKamionData komment ugyanerről).
    public function newPotkocsi($data, $ceg_id) {
        try {
            // SQL lekérdezés előkészítése az adatok beszúrásához
            $query = "INSERT INTO potkocsi
                      (admin, rendszam, tipus, meret, allapot, aktualis_km, muszaki_lejarat, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, porolto_lejarat, porolto_lejarat_2, kot_biztositas, kot_biz_nev, kot_biz_dij, kot_biz_utem, kaszko_biztositas, kaszko_nev, kaszko_dij, kaszko_fizetesi_utem)
                      VALUES (:admin, :rendszam, :tipus, :meret, :allapot, :aktualis_km, :muszaki_lejarat, :adr_lejarat, :taograf_illesztes, :emelohatfal_vizsga, :porolto_lejarat, :porolto_lejarat_2, :kot_biztositas, :kot_biz_nev, :kot_biz_dij, :kot_biz_utem, :kaszko_biztositas, :kaszko_nev, :kaszko_dij, :kaszko_fizetesi_utem)";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindParam(':tipus', $data['tipus'], PDO::PARAM_STR);
            $stmt->bindValue(':meret', empty($data['meret']) ? null : $data['meret']);
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
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

            $newPotkocsiId = $this->db->lastInsertId();
            $newPotkocsiData = $this->getPotkocsi($newPotkocsiId, $ceg_id);

            return ['success' => true, 'message' => 'Pótkocsi adatai sikeresen beszúrva.', 'potkocsi' => $newPotkocsiData];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deletePotkocsi($id, $ceg_id) {
        try {
            $query = "SELECT id FROM potkocsi WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A pótkocsi nem található, vagy nem a te céged flottájába tartozik.'];
            }

            $query = "UPDATE potkocsi_karbantartars SET torolt='I' WHERE potkocsi_id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

            $query = "UPDATE potkocsi SET torolt='I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Pótkocsi törölve'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getPotkocsiRendszamok($id) {
        $query = "SELECT id,rendszam,tipus FROM potkocsi WHERE admin = :id AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return ['success' => true, 'potkocsik' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    public function getPotkocsi($id, $ceg_id) {
        $query = "SELECT * FROM potkocsi WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
$potkocsiInterface = new PotkocsiInterface();
