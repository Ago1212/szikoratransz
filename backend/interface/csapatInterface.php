<?php

// Több admin-fiók egy céghez — ld. backend/sql/6.sql. A `szerepkor` mező
// (admin/fuvarszervezo, ld. backend/sql/7.sql) ma még csak megjelenítési
// célú címke — mindenki, aki egy céghez tartozik, ugyanazt
// látja/szerkeszti, amíg nincs bevezetve a jogosultsági mátrix. Ez a
// mező előkészíti a talajt ahhoz anélkül, hogy most bármit korlátozna.
class CsapatInterface {
    protected $db;

    const SZEREPKOROK = ['admin', 'fuvarszervezo'];

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Minden fiók, ami egy céghez tartozik — a gyökér (tulajdonos) admin
    // saját maga is szerepel a listában, hogy lássa a teljes csapatot.
    public function getCsapattagok($ceg_id) {
        try {
            $query = "SELECT id, name, email, phone, szerepkor, tulajdonos_admin_id, createdAt
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

    public function newCsapattag($data) {
        try {
            $existing = $this->db->prepare("SELECT id FROM admin WHERE email = :email AND torolt <> 'I'");
            $existing->bindValue(':email', $data['email']);
            $existing->execute();
            if ($existing->fetch()) {
                return ['success' => false, 'message' => 'Már létezik fiók ezzel az email címmel.'];
            }

            $szerepkor = in_array($data['szerepkor'] ?? null, self::SZEREPKOROK, true) ? $data['szerepkor'] : 'admin';
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
            if (!in_array($szerepkor, self::SZEREPKOROK, true)) {
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
