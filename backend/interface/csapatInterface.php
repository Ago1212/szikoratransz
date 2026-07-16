<?php

// Több admin-fiók egy céghez — ld. backend/sql/6.sql. A `szerepkor` mező
// értéke ma már NEM egy fix, kódba égetett lista ('admin'/'fuvarszervezo')
// — cégenként egyéni szerepkörök is létrehozhatók (ld. szerepkorInterface.php
// + backend/sql/11.sql), ezért az érvényes szerepkör-készletet mindig az
// adott cég `szerepkorok` táblájából (+ a mindig létező 'admin'-ból)
// olvassuk ki, nem egy statikus konstansból.
class CsapatInterface {
    protected $db;

    private function ervenyesSzerepkorok($ceg_id) {
        $stmt = $this->db->prepare("SELECT kulcs FROM szerepkorok WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $kulcsok = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $kulcsok[] = 'admin';
        return $kulcsok;
    }

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Minden fiók, ami egy céghez tartozik — a gyökér (tulajdonos) admin
    // saját maga is szerepel a listában, hogy lássa a teljes csapatot.
    // `$isAdmin`: a `ber` (havi bérezés) csak admin szerepkörnek jár —
    // ezt a mezőt csak akkor kérjük le/adjuk vissza egyáltalán, ha a
    // hívó igazoltan admin (ld. ApiHandler::kerelmezoAdmin()).
    public function getCsapattagok($ceg_id, $isAdmin = false) {
        try {
            $mezok = $isAdmin
                ? "id, name, email, phone, szerepkor, tulajdonos_admin_id, createdAt, ber"
                : "id, name, email, phone, szerepkor, tulajdonos_admin_id, createdAt";
            $query = "SELECT $mezok
                      FROM admin
                      WHERE (id = :ceg_id OR tulajdonos_admin_id = :ceg_id2) AND torolt <> 'I'
                      ORDER BY id ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':ceg_id2', $ceg_id);
            $stmt->execute();
            return ['success' => true, 'csapattagok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Csak admin szerepkör hívhatja (ld. ApiHandler::ADMIN_ONLY_ACTIONS) —
    // a szerepkör-váltáshoz hasonló, önálló, kis akció, nem egy általános
    // "csapattag adatai" szerkesztő form része (olyan ma nincs is, a
    // csapattag saját magát a saját Profil oldalán szerkeszti).
    public function updateCsapattagBer($id, $ceg_id, $ber) {
        try {
            $query = "UPDATE admin SET ber = :ber
                      WHERE id = :id AND (id = :ceg_id OR tulajdonos_admin_id = :ceg_id2)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ber', $ber !== '' && $ber !== null ? $ber : null);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':ceg_id2', $ceg_id);
            $stmt->execute();
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function newCsapattag($data) {
        try {
            $existing = $this->db->prepare("SELECT id FROM admin WHERE email = :email AND torolt <> 'I'");
            $existing->bindValue(':email', $data['email']);
            $existing->execute();
            if ($existing->fetch()) {
                return ['success' => false, 'message' => 'Már létezik fiók ezzel az email címmel.'];
            }

            $szerepkor = in_array($data['szerepkor'] ?? null, $this->ervenyesSzerepkorok($data['ceg_id']), true) ? $data['szerepkor'] : 'admin';
            $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
            $query = "INSERT INTO admin (tulajdonos_admin_id, name, email, phone, password, szerepkor)
                      VALUES (:ceg_id, :name, :email, :phone, :password, :szerepkor)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $data['ceg_id']);
            $stmt->bindValue(':name', $data['name']);
            $stmt->bindValue(':email', $data['email']);
            $stmt->bindValue(':phone', $data['phone'] ?? null);
            $stmt->bindValue(':password', $hashed);
            $stmt->bindValue(':szerepkor', $szerepkor);
            $stmt->execute();

            return ['success' => true, 'message' => 'Csapattag meghívva.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Szerepkör módosítása — egyszerű dropdown-váltás a listán, nem
    // külön form (ld. Slack/GitHub minta). A gyökér fiók szerepköre is
    // módosítható innen, de a gyökér-mivolta (tulajdonos_admin_id) nem.
    public function updateCsapattagSzerepkor($id, $ceg_id, $szerepkor) {
        try {
            if (!in_array($szerepkor, $this->ervenyesSzerepkorok($ceg_id), true)) {
                return ['success' => false, 'message' => 'Érvénytelen szerepkör.'];
            }
            $query = "UPDATE admin SET szerepkor = :szerepkor
                      WHERE id = :id AND (id = :ceg_id OR tulajdonos_admin_id = :ceg_id2)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':szerepkor', $szerepkor);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':ceg_id2', $ceg_id);
            $stmt->execute();
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Csak a saját cégéhez tartozó, nem-gyökér fiókot lehet törölni innen
    // — a `tulajdonos_admin_id = ceg_id` feltétel miatt a gyökér admin
    // fiókja (aminek tulajdonos_admin_id-ja NULL) sosem törölhető ezen
    // a végponton.
    public function deleteCsapattag($id, $ceg_id) {
        try {
            $query = "UPDATE admin SET torolt = 'I' WHERE id = :id AND tulajdonos_admin_id = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A fiók nem törölhető (nem található, vagy ez a cég gyökér-fiókja).'];
            }
            return ['success' => true, 'message' => 'Csapattag törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$csapatInterface = new CsapatInterface();
