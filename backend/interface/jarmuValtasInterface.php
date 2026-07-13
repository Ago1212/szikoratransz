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
    public function requestJarmuValtas($data) {
        try {
            $this->db->prepare(
                "UPDATE jarmu_valtas_kerelmek SET allapot = 'visszavonva'
                 WHERE sofor_id = :sofor_id AND tipus = :tipus AND allapot = 'fuggoben'"
            )->execute([':sofor_id' => $data['sofor_id'], ':tipus' => $data['tipus']]);

            $query = "INSERT INTO jarmu_valtas_kerelmek (admin, sofor_id, tipus, jarmu_id, indoklas)
                      VALUES (:admin, :sofor_id, :tipus, :jarmu_id, :indoklas)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['admin']);
            $stmt->bindValue(':sofor_id', $data['sofor_id']);
            $stmt->bindValue(':tipus', $data['tipus']);
            $stmt->bindValue(':jarmu_id', $data['jarmu_id']);
            $stmt->bindValue(':indoklas', $data['indoklas'] ?? null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Kérés elküldve, várj az admin jóváhagyására.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A sofőr visszavonhatja a saját, még el nem bírált kérését.
    public function visszavonJarmuValtas($id) {
        try {
            $query = "UPDATE jarmu_valtas_kerelmek SET allapot = 'visszavonva' WHERE id = :id AND allapot = 'fuggoben'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
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
    // sofőr aktuális kamion/pótkocsi hozzárendelése.
    public function elbiralJarmuValtas($id, $allapot) {
        try {
            if (!in_array($allapot, ['jovahagyva', 'elutasitva'], true)) {
                throw new Exception('Érvénytelen döntés.');
            }

            $stmt = $this->db->prepare("SELECT * FROM jarmu_valtas_kerelmek WHERE id = :id AND allapot = 'fuggoben'");
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $kerelem = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$kerelem) {
                throw new Exception('A kérés már el lett bírálva, vagy nem létezik.');
            }

            if ($allapot === 'jovahagyva') {
                $column = $kerelem['tipus'] === 'kamion' ? 'kamion' : 'aktiv_potkocsi';
                $update = $this->db->prepare("UPDATE user SET $column = :jarmu_id WHERE id = :sofor_id");
                $update->bindValue(':jarmu_id', $kerelem['jarmu_id']);
                $update->bindValue(':sofor_id', $kerelem['sofor_id']);
                $update->execute();
            }

            $stmt = $this->db->prepare(
                "UPDATE jarmu_valtas_kerelmek SET allapot = :allapot, elbiralva = NOW() WHERE id = :id"
            );
            $stmt->bindValue(':allapot', $allapot);
            $stmt->bindValue(':id', $id);
            $stmt->execute();

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
