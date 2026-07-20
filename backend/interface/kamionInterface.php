<?php

class KamionInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // FONTOS: korábban ez a metódus egyáltalán nem szűrt cég szerint —
    // a `$user` paramétert kapta, de sosem használta, és a lekérdezés
    // MINDEN cég MINDEN kamionját visszaadta (a Bejelentések oldal
    // "Kamion kiválasztása" legördülője mindenki más flottáját is
    // mutatta). Most `ceg_id`-vel scope-olva, a projekt többi
    // kamion-lekérdezésével konzisztensen.
    public function getKamionValaszto($ceg_id) {
        try {
            $query = "SELECT id, rendszam FROM kamion WHERE admin = :ceg_id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            $kamionok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'kamionok' => $kamionok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$search`/`$page`/`$pageSize` NÉLKÜL hívva (a régi viselkedés) a teljes
    // listát adja vissza, lapozás nélkül — a lapozás szigorúan opt-in, hogy
    // más (nem a Kamionok lista-oldali) hívók ne törjenek el emiatt.
    public function getKamionok($id, $search = null, $page = null, $pageSize = null) {
        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM kamion WHERE admin = :id AND torolt <> 'I'";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['rendszam', 'tipus', 'meret', 'potkocsi', 'allapot'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $query .= " ORDER BY rendszam ASC";

            if ($page !== null) {
                [$kamionok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                $this->potkocsiRendszamFeloldas($kamionok, $id);
                return ['success' => true, 'kamionok' => $kamionok, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $kamionok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $this->potkocsiRendszamFeloldas($kamionok, $id);

            return ['success' => true, 'kamionok' => $kamionok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A `kamion.potkocsi` a `potkocsi` tábla ID-jét tárolja (nem a
    // rendszámot) — a lista-nézet ezt korábban nyers számként jelenítette
    // meg (ld. CardTableForKamionok.js "Pótkocsi" oszlop), itt oldjuk fel
    // a valódi rendszámra egy `potkocsi_rendszam` mezőben.
    private function potkocsiRendszamFeloldas(array &$kamionok, $ceg_id) {
        if (empty($kamionok)) {
            return;
        }
        $stmt = $this->db->prepare("SELECT id, rendszam FROM potkocsi WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $p) {
            $map[$p['id']] = $p['rendszam'];
        }
        foreach ($kamionok as &$k) {
            $k['potkocsi_rendszam'] = $k['potkocsi'] ? ($map[$k['potkocsi']] ?? null) : null;
        }
    }

    // `$ceg_id`-t a hívó (ApiHandler) mindig szerver-oldalon feloldva adja
    // át (resolveKerelmezo()['ceg_id']) — enélkül bármely cég módosíthatta
    // volna bármely másik cég kamionját puszta id-tallózással (IDOR,
    // ld. biztonsági audit). A `rowCount()===0` jelzi, ha az id nem
    // létezik VAGY nem a hívó cégéhez tartozik — a két esetet szándékosan
    // nem különböztetjük meg a válaszban, hogy ne áruljon el infót arról,
    // hogy egy adott id egyáltalán létezik-e más cégnél.
    public function saveKamionData($data, $ceg_id) {
        try {
            // SQL lekérdezés előkészítése az adatok frissítéséhez
            $query = "UPDATE kamion
                      SET rendszam = :rendszam,
                          potkocsi = :potkocsi,
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

            // Paraméterek kötése
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
            $stmt->bindValue(':potkocsi', empty($data['potkocsi']) ? null : $data['potkocsi']);
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
                return ['success' => false, 'message' => 'A kamion nem található, vagy nem a te céged flottájába tartozik.'];
            }

            return ['success' => true, 'message' => 'Kamion adatai sikeresen frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    // `$ceg_id`-t a hívó szerver-oldalon feloldva adja át — az `admin`
    // oszlopba MINDIG ez kerül, sosem a kliens által küldött `$data['admin']`
    // (enélkül bárki tetszőleges másik cég neve alatt hozhatott létre
    // kamiont, ld. biztonsági audit).
    public function newKamion($data, $ceg_id) {
        try {
            // SQL lekérdezés előkészítése az adatok beszúrásához.
            // (A korábbi VALUES-lista sorrendje nem egyezett az oszloplista
            // sorrendjével — pozicionálisan a `potkocsi`/`meret`/`tipus`
            // értékek egymás oszlopába kerültek volna beszúráskor. Most a
            // két lista sorrendje megegyezik.)
            $query = "INSERT INTO kamion
                      (admin, rendszam, potkocsi, meret, tipus, allapot, aktualis_km, muszaki_lejarat, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, porolto_lejarat, porolto_lejarat_2, kot_biztositas, kot_biz_nev, kot_biz_dij, kot_biz_utem, kaszko_biztositas, kaszko_nev, kaszko_dij, kaszko_fizetesi_utem)
                      VALUES (:admin, :rendszam, :potkocsi, :meret, :tipus, :allapot, :aktualis_km, :muszaki_lejarat, :adr_lejarat, :taograf_illesztes, :emelohatfal_vizsga, :porolto_lejarat, :porolto_lejarat_2, :kot_biztositas, :kot_biz_nev, :kot_biz_dij, :kot_biz_utem, :kaszko_biztositas, :kaszko_nev, :kaszko_dij, :kaszko_fizetesi_utem)";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindParam(':rendszam', $data['rendszam'], PDO::PARAM_STR);
            $stmt->bindValue(':potkocsi', empty($data['potkocsi']) ? null : $data['potkocsi']);
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

            $newKamionId = $this->db->lastInsertId();
            $newKamionData = $this->getKamion($newKamionId, $ceg_id);

            return ['success' => true, 'message' => 'Kamion adatai sikeresen beszúrva.', 'kamion' => $newKamionData];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id`-t a hívó szerver-oldalon feloldva adja át (ld. saveKamionData
    // komment) — a karbantartási előzmény törlése is scope-olva van, hogy
    // egy idegen cég kamion_id-jére hivatkozva ne lehessen mások
    // karbantartási naplóját is soft-törölni.
    public function deleteKamion($id, $ceg_id) {
        try {
            $query = "SELECT id FROM kamion WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A kamion nem található, vagy nem a te céged flottájába tartozik.'];
            }

            $query = "UPDATE kamion_karbantartars SET torolt='I' WHERE kamion_id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

            $query = "UPDATE kamion SET torolt='I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Kamion törölve'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getKamionRendszamok($id) {
        $query = "SELECT id, rendszam,tipus FROM kamion WHERE admin = :id AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return ['success' => true, 'kamionok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    public function getKamion($id, $ceg_id) {
        $query = "SELECT * FROM kamion WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
$kamionInterface = new KamionInterface();
