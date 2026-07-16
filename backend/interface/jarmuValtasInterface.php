<?php

class JarmuValtasInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Új váltás-kérés — a sofőr nem cserélhet szabadon kamiont/pótkocsit,
    // csak kérheti; a tényleges user.kamion/aktiv_potkocsi mező csak
    // admin jóváhagyás után módosul (ld. elbiralJarmuValtas). Egy
    // sofőrnek egyszerre csak egy függőben lévő kérése lehet
    // típusonként — az esetleges korábbi függő kérést visszavontnak
    // jelöljük, hogy ne torlódjanak fel duplikátumok.
    // `$sofor_id` a szerver-oldalon (session alapján) feloldott saját
    // azonosító, nem a kliens kérése — ld. ApiHandler::resolveSajatSoforId().
    // A `jarmu_id`-t itt ellenőrizzük le, hogy tényleg a sofőr saját
    // (a `user.admin` szerinti) cégéhez tartozik-e — enélkül egy sofőr
    // egy másik cég kamionját/pótkocsiját is kérhetné, amit egy (mit sem
    // sejtő) admin jóvá is hagyhatna a saját flottájába.
    public function requestJarmuValtas($sofor_id, $tipus, $jarmu_id, $indoklas = null) {
        try {
            $soforStmt = $this->db->prepare("SELECT admin FROM user WHERE id = :id AND torolt <> 'I'");
            $soforStmt->bindValue(':id', $sofor_id);
            $soforStmt->execute();
            $sofor = $soforStmt->fetch(PDO::FETCH_ASSOC);
            if (!$sofor) {
                return ['success' => false, 'message' => 'A sofőr fiók nem található.'];
            }
            $ceg_id = $sofor['admin'];

            $tabla = $tipus === 'kamion' ? 'kamion' : 'potkocsi';
            $jarmuStmt = $this->db->prepare("SELECT id FROM `$tabla` WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $jarmuStmt->bindValue(':id', $jarmu_id);
            $jarmuStmt->bindValue(':ceg_id', $ceg_id);
            $jarmuStmt->execute();
            if (!$jarmuStmt->fetch()) {
                return ['success' => false, 'message' => 'A kiválasztott jármű nem található a céged flottájában.'];
            }

            $this->db->prepare(
                "UPDATE jarmu_valtas_kerelmek SET allapot = 'visszavonva'
                 WHERE sofor_id = :sofor_id AND tipus = :tipus AND allapot = 'fuggoben'"
            )->execute([':sofor_id' => $sofor_id, ':tipus' => $tipus]);

            $query = "INSERT INTO jarmu_valtas_kerelmek (admin, sofor_id, tipus, jarmu_id, indoklas)
                      VALUES (:admin, :sofor_id, :tipus, :jarmu_id, :indoklas)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindValue(':sofor_id', $sofor_id);
            $stmt->bindValue(':tipus', $tipus);
            $stmt->bindValue(':jarmu_id', $jarmu_id);
            $stmt->bindValue(':indoklas', $indoklas);
            $stmt->execute();

            return ['success' => true, 'message' => 'Kérés elküldve, várj az admin jóváhagyására.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A sofőr csak a SAJÁT, még el nem bírált kérését vonhatja vissza —
    // a `sofor_id` itt is a session alapján feloldott, szerver-oldali érték.
    public function visszavonJarmuValtas($id, $sofor_id) {
        try {
            $query = "UPDATE jarmu_valtas_kerelmek SET allapot = 'visszavonva' WHERE id = :id AND sofor_id = :sofor_id AND allapot = 'fuggoben'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':sofor_id', $sofor_id);
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A kérés nem található, vagy már el lett bírálva.'];
            }
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Sofőr saját nézete — az aktuális függő kérése(i), típusonként.
    public function getSajatJarmuValtasKerelmek($sofor_id) {
        try {
            $query = "SELECT * FROM jarmu_valtas_kerelmek
                      WHERE sofor_id = :sofor_id AND allapot = 'fuggoben' AND torolt <> 'I'
                      ORDER BY kerelmezve DESC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':sofor_id', $sofor_id);
            $stmt->execute();
            $kerelmek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $kamionRendszamok = $this->getRendszamok('kamion');
            $potkocsiRendszamok = $this->getRendszamok('potkocsi');
            foreach ($kerelmek as &$k) {
                $k['jarmu_rendszam'] = $k['tipus'] === 'kamion'
                    ? ($kamionRendszamok[$k['jarmu_id']] ?? null)
                    : ($potkocsiRendszamok[$k['jarmu_id']] ?? null);
            }

            return ['success' => true, 'kerelmek' => $kerelmek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Sofőr-oldali értesítéshez — a nemrég ELBÍRÁLT (jóváhagyott/elutasított)
    // saját kérései, hogy a sofőr lássa, ha időközben döntés született.
    // Szándékosan NEM ugyanaz, mint getSajatJarmuValtasKerelmek() fent —
    // az kizárólag a még függőben lévőket adja vissza (más hívók, pl.
    // JarmuValaszto.js, pont ezért használják: hogy tudják, van-e még
    // aktív kérés), a 'visszavonva' állapotot pedig szándékosan kihagyjuk,
    // mert azt a sofőr saját maga váltotta ki, nem admin-döntés.
    public function getElbiraltJarmuValtasok($sofor_id) {
        try {
            $query = "SELECT * FROM jarmu_valtas_kerelmek
                      WHERE sofor_id = :sofor_id AND allapot IN ('jovahagyva', 'elutasitva') AND torolt <> 'I'
                      ORDER BY elbiralva DESC LIMIT 5";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':sofor_id', $sofor_id);
            $stmt->execute();
            $kerelmek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $kamionRendszamok = $this->getRendszamok('kamion');
            $potkocsiRendszamok = $this->getRendszamok('potkocsi');
            foreach ($kerelmek as &$k) {
                $k['jarmu_rendszam'] = $k['tipus'] === 'kamion'
                    ? ($kamionRendszamok[$k['jarmu_id']] ?? null)
                    : ($potkocsiRendszamok[$k['jarmu_id']] ?? null);
            }

            return ['success' => true, 'kerelmek' => $kerelmek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Admin oldali nézet — az összes függőben lévő kérés a cég flottájára.
    public function getFuggoJarmuValtasok($admin) {
        try {
            $query = "SELECT * FROM jarmu_valtas_kerelmek
                      WHERE admin = :admin AND allapot = 'fuggoben' AND torolt <> 'I'
                      ORDER BY kerelmezve ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $admin);
            $stmt->execute();
            $kerelmek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $soforNevek = $this->getSoforNevek();
            $kamionRendszamok = $this->getRendszamok('kamion');
            $potkocsiRendszamok = $this->getRendszamok('potkocsi');
            foreach ($kerelmek as &$k) {
                $k['sofor_nev'] = $soforNevek[$k['sofor_id']] ?? null;
                $k['jarmu_rendszam'] = $k['tipus'] === 'kamion'
                    ? ($kamionRendszamok[$k['jarmu_id']] ?? null)
                    : ($potkocsiRendszamok[$k['jarmu_id']] ?? null);
            }

            return ['success' => true, 'kerelmek' => $kerelmek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Jóváhagyás/elutasítás — csak jóváhagyáskor módosul ténylegesen a
    // sofőr aktuális kamion/pótkocsi hozzárendelése. `$ceg_id` a
    // szerver-oldalon (admin-munkamenetből) feloldott saját cég —
    // enélkül egy másik cég kérését is el lehetne bírálni. A záró UPDATE
    // is a `WHERE ... AND allapot = 'fuggoben'` feltétellel fut (nem csak
    // a megelőző SELECT ellenőrzi ezt), hogy két egyidejű kérés ne tudja
    // ugyanazt a kérést kétszer feldolgozni (versenyhelyzet elkerülése).
    public function elbiralJarmuValtas($id, $allapot, $ceg_id) {
        try {
            if (!in_array($allapot, ['jovahagyva', 'elutasitva'], true)) {
                throw new Exception('Érvénytelen döntés.');
            }

            $stmt = $this->db->prepare("SELECT * FROM jarmu_valtas_kerelmek WHERE id = :id AND admin = :ceg_id AND allapot = 'fuggoben'");
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            $kerelem = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$kerelem) {
                throw new Exception('A kérés már el lett bírálva, nem létezik, vagy nem a te céged kérése.');
            }

            $stmt = $this->db->prepare(
                "UPDATE jarmu_valtas_kerelmek SET allapot = :allapot, elbiralva = NOW() WHERE id = :id AND allapot = 'fuggoben'"
            );
            $stmt->bindValue(':allapot', $allapot);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                throw new Exception('A kérést időközben már elbírálták.');
            }

            if ($allapot === 'jovahagyva') {
                $column = $kerelem['tipus'] === 'kamion' ? 'kamion' : 'aktiv_potkocsi';
                $update = $this->db->prepare("UPDATE user SET $column = :jarmu_id WHERE id = :sofor_id");
                $update->bindValue(':jarmu_id', $kerelem['jarmu_id']);
                $update->bindValue(':sofor_id', $kerelem['sofor_id']);
                $update->execute();
            }

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function getSoforNevek() {
        $stmt = $this->db->query("SELECT id, name FROM user WHERE torolt <> 'I'");
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['name'];
        }
        return $map;
    }

    private function getRendszamok($tabla) {
        $stmt = $this->db->query("SELECT id, rendszam FROM $tabla WHERE torolt <> 'I'");
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['rendszam'];
        }
        return $map;
    }
}

$jarmuValtasInterface = new JarmuValtasInterface();
