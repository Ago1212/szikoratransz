<?php

// Korábban ez az osztály minden hívásra ugyanazt az 5 hardcode-olt PHP
// tömböt adta vissza, a valós insert/update/delete metódusai pedig
// definiálatlan változókra (`$kamion`, `$felhasznalo`, `$bejelentes`)
// hivatkoztak `$data` helyett — sosem működtek volna. Emellett a
// `newBejelentes`/`saveBejelentesData`/`deleteBejelentes` akciók az
// `ApiHandler::getActions()`-ből is hiányoztak, így a `validation()`
// "Invalid action" hibával elutasította volna őket, még mielőtt
// idáig eljutottak volna. A teljes Bejelentések funkció mindkét oldalon
// (admin böngészés, sofőr bejelentés-küldés) ténylegesen törött volt.
class BejelentesekInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Admin oldali böngészés — a cég ÖSSZES bejelentését adja vissza,
    // a `kamion` csak OPCIONÁLIS további szűrés (korábban kötelező volt,
    // az admin kényszerűen ki kellett válasszon egy kamiont, mielőtt
    // bármit is látott volna). A projekt konvenciója szerint (lásd
    // ApiHandler::getEsemenyek) a táblákat sosem kapcsoljuk össze egy
    // lekérdezésen belül — a kapcsolódó neveket külön lekérdezéssel
    // töltjük be, és PHP oldalon fűzzük össze.
    public function getBejelentesek($ceg_id, $kamion = null, $search = null, $page = null, $pageSize = null) {
        try {
            $params = [':ceg_id' => $ceg_id];
            $query = "SELECT * FROM bejelentesek WHERE admin = :ceg_id AND torolt <> 'I'";
            if (!empty($kamion)) {
                $query .= " AND kamion_id = :kamion";
                $params[':kamion'] = $kamion;
            }
            // A `sofor_nev`/`kamion_rendszam` a lekérdezés után, PHP oldalon
            // fűződik a sorokhoz (ld. lentebb) — ezért a rájuk szűrő kereséshez
            // egy-egy alkérdés kell (nem sima LIKE a `bejelentesek` oszlopain).
            if (!empty($search)) {
                $query .= " AND (" . PaginationHelper::likeClause(['cim', 'leiras', 'tipus'], 'search') .
                    " OR kamion_id IN (SELECT id FROM kamion WHERE rendszam LIKE :search_rendszam)" .
                    " OR sofor_id IN (SELECT id FROM user WHERE name LIKE :search_nev))";
                $params[':search'] = '%' . $search . '%';
                $params[':search_rendszam'] = '%' . $search . '%';
                $params[':search_nev'] = '%' . $search . '%';
            }
            $query .= " ORDER BY bejelentve DESC";

            if ($page !== null) {
                [$bejelentesek, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
            } else {
                $stmt = $this->db->prepare($query);
                foreach ($params as $key => $value) {
                    $stmt->bindValue($key, $value);
                }
                $stmt->execute();
                $bejelentesek = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            $soforNevek = $this->getSoforNevek($ceg_id);
            $kamionRendszamok = $this->getKamionRendszamok($ceg_id);
            // UX-audit — a lista korábban semmivel nem jelezte, melyik
            // bejelentésnek van új sofőr-üzenete, az admin csak úgy tudta
            // meg, ha egyenként megnyitotta és legörgetett mindegyiket.
            // `van_olvasatlan_uzenet`: igaz, ha a szál utolsó üzenetét sofőr
            // írta (az admin még nem válaszolt rá) — nincs valódi, admin-
            // szintű "olvasva" jelölés (a csapattagok közös `admin` táblát
            // használnak, ld. CLAUDE.md), ez egy egyszerű, de honest proxy.
            $uzenetInfok = $this->getUzenetInfok(array_column($bejelentesek, 'id'));
            foreach ($bejelentesek as &$b) {
                $b['sofor_nev'] = $soforNevek[$b['sofor_id']] ?? null;
                $b['kamion_rendszam'] = $kamionRendszamok[$b['kamion_id']] ?? null;
                $info = $uzenetInfok[$b['id']] ?? null;
                $b['uzenet_szam'] = $info['osszes'] ?? 0;
                $b['van_olvasatlan_uzenet'] = $info['utolsoSofortol'] ?? false;
            }

            $result = ['success' => true, 'bejelentesek' => $bejelentesek];
            if ($page !== null) {
                $result['total'] = $total;
                $result['page'] = $page;
                $result['pageSize'] = $pageSize;
            }
            return $result;
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Admin-oldali harang-értesítéshez — a `getBejelentesek($kamion)`-tól
    // eltérően itt NEM egy konkrét kamionra szűkítünk, hanem a cég ÖSSZES
    // kamionján átívelő, még nyitott (`statusz = 'uj'`) bejelentéseket adjuk
    // vissza, hogy a Sidebar haranG-ja jelezni tudja: van-e olyan bejelentés,
    // amit még senki nem nézett meg.
    public function getNyitottBejelentesek($ceg_id) {
        try {
            $query = "SELECT * FROM bejelentesek WHERE admin = :ceg_id AND statusz = 'uj' AND torolt <> 'I' ORDER BY bejelentve DESC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            $bejelentesek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $kamionRendszamok = $this->getKamionRendszamok($ceg_id);
            foreach ($bejelentesek as &$b) {
                $b['kamion_rendszam'] = $kamionRendszamok[$b['kamion_id']] ?? null;
            }

            return ['success' => true, 'bejelentesek' => $bejelentesek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Sofőr oldali nézet — saját bejelentései, státusszal. `$sofor_id`-t és
    // `$ceg_id`-t a hívó (ApiHandler) mindig szerver-oldalon feloldva adja
    // át (resolveSajatSoforId()/resolveSajatCegId()) — enélkül bármely
    // sofőr bármely másik sofőr bejelentéseit lekérhette volna puszta
    // id-tallózással.
    public function getBejelentesekSofor($sofor_id, $ceg_id) {
        try {
            $query = "SELECT * FROM bejelentesek WHERE sofor_id = :sofor_id AND torolt <> 'I' ORDER BY bejelentve DESC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':sofor_id', $sofor_id);
            $stmt->execute();
            $bejelentesek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $kamionRendszamok = $this->getKamionRendszamok($ceg_id);
            foreach ($bejelentesek as &$b) {
                $b['kamion_rendszam'] = $kamionRendszamok[$b['kamion_id']] ?? null;
            }

            return ['success' => true, 'bejelentesek' => $bejelentesek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id`-vel scope-olva — korábban minden cég összes sofőrjét/
    // kamionját betöltötte, ami önmagában nem szivárogtatott adatot (csak
    // a már ceg_id-vel szűrt bejelentés-sorok saját kulcsaival indexelnek
    // bele), de higiéniailag helytelen és fölösleges terhelés volt.
    private function getSoforNevek($ceg_id) {
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['name'];
        }
        return $map;
    }

    private function getKamionRendszamok($ceg_id) {
        $stmt = $this->db->prepare("SELECT id, rendszam FROM kamion WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['rendszam'];
        }
        return $map;
    }

    // `$ceg_id`-t a hívó (ApiHandler) mindig szerver-oldalon feloldva adja
    // át — admin-munkamenetből `resolveKerelmezo()['ceg_id']`, sofőr-
    // munkamenetből `resolveSajatCegId()` (a `sofor_id` mezőt is a
    // sofőr saját, szerver-oldalon feloldott id-jére kényszerítve). Korábban
    // ez a metódus a kliens által küldött `$data['admin']` mezőt fogadta el
    // elsődleges forrásként — ez lehetővé tette, hogy bárki tetszőleges
    // másik cég nevében hozzon létre bejelentést (ld. biztonsági audit).
    public function newBejelentes($data, $ceg_id) {
        try {
            $query = "INSERT INTO bejelentesek (admin, kamion_id, sofor_id, tipus, lat, lng, cim, leiras, prioritas)
                      VALUES (:admin, :kamion_id, :sofor_id, :tipus, :lat, :lng, :cim, :leiras, :prioritas)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':sofor_id', empty($data['sofor_id']) ? null : $data['sofor_id']);
            $stmt->bindValue(':tipus', empty($data['tipus']) ? 'egyeb' : $data['tipus']);
            $stmt->bindValue(':lat', $data['lat'] ?? null);
            $stmt->bindValue(':lng', $data['lng'] ?? null);
            $stmt->bindValue(':cim', $data['cim'] ?? '');
            $stmt->bindValue(':leiras', $data['leiras'] ?? '');
            $stmt->bindValue(':prioritas', empty($data['prioritas']) ? 'kozepes' : $data['prioritas']);
            $stmt->execute();

            return ['success' => true, 'message' => 'Bejelentés elküldve.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$ceg_id`-t a hívó szerver-oldalon feloldva adja át — enélkül bármely
    // cég módosíthatta volna bármely másik cég bejelentését puszta
    // id-tallózással (IDOR, ld. biztonsági audit).
    //
    // R02 (fejlesztési audit, 2026-07-19): `admin_valasz` korábban
    // feltétel nélkül `:admin_valasz`-ra íródott — mivel a CardBejelentesek.js
    // admin-felület form-állapota sosem tartalmazta ezt a mezőt (nem volt
    // hozzá beviteli mező), minden mentés (akár csak egy státuszváltás is)
    // csendben NULL-ra írta felül a korábban már rögzített admin-választ —
    // élő adatvesztés, élő DB-n megerősítve (2 sornak volt tényleges
    // admin_valasz értéke, amit egy újramentés némán törölt volna). A
    // `lezarva`-nál már bevált COALESCE-mintát követve: ha a hívó ténylegesen
    // NEM küld admin_valasz-t (NULL), a meglévő érték megmarad; ha explicit
    // üres string érkezik (a mostantól létező admin-felületi mező törlésre
    // szánt beküldése), az ténylegesen törli — ez a különbség számít.
    public function saveBejelentesData($data, $ceg_id) {
        try {
            $lezarva = $data['statusz'] === 'lezart' ? date('Y-m-d H:i:s') : null;
            $query = "UPDATE bejelentesek SET
                      cim = :cim, leiras = :leiras, prioritas = :prioritas, statusz = :statusz,
                      admin_valasz = COALESCE(:admin_valasz, admin_valasz), lezarva = COALESCE(:lezarva, lezarva)
                      WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':cim', $data['cim'] ?? '');
            $stmt->bindValue(':leiras', $data['leiras'] ?? '');
            $stmt->bindValue(':prioritas', empty($data['prioritas']) ? 'kozepes' : $data['prioritas']);
            $stmt->bindValue(':statusz', empty($data['statusz']) ? 'uj' : $data['statusz']);
            $stmt->bindValue(':admin_valasz', array_key_exists('admin_valasz', $data) ? $data['admin_valasz'] : null);
            $stmt->bindValue(':lezarva', $lezarva);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A bejelentés nem található, vagy nem a te céged tulajdona.'];
            }

            return ['success' => true, 'message' => 'Bejelentés frissítve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Bejelentésből karbantartás generálása — a bejelentés kamionjához
    // létrehoz egy új karbantartási rekordot (a leírásból), és a
    // bejelentést a létrehozott karbantartáshoz köti (`karbantartas_id`),
    // hogy a szerkesztő felület ez alapján tudja, már intézkedés történt.
    // A km-óraállást a kamion utoljára rögzített `aktualis_km` értékéből
    // tölti ki — ez az egyetlen adat, ami a bejelentésből nem derül ki,
    // de a jármű törzsadatából már ismert. Pótkocsihoz kötött
    // karbantartást szándékosan nem generál — a bejelentesek tábla ma
    // csak kamion_id-t tárol, potkocsi_id-t nem.
    public function generateKarbantartasFromBejelentes($id, $ceg_id) {
        try {
            $query = "SELECT * FROM bejelentesek WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            $bejelentes = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$bejelentes) {
                return ['success' => false, 'message' => 'A bejelentés nem található.'];
            }
            if (!empty($bejelentes['karbantartas_id'])) {
                return ['success' => false, 'message' => 'Ehhez a bejelentéshez már tartozik karbantartás.'];
            }
            if (empty($bejelentes['kamion_id'])) {
                return ['success' => false, 'message' => 'A bejelentéshez nincs kamion rendelve, így karbantartás sem generálható belőle.'];
            }

            $kamionStmt = $this->db->prepare("SELECT aktualis_km FROM kamion WHERE id = :id");
            $kamionStmt->bindValue(':id', $bejelentes['kamion_id']);
            $kamionStmt->execute();
            $kamion = $kamionStmt->fetch(PDO::FETCH_ASSOC);
            $kmOraallas = $kamion && !empty($kamion['aktualis_km']) ? $kamion['aktualis_km'] : null;

            $log = $bejelentes['cim'] . (!empty($bejelentes['leiras']) ? (' — ' . $bejelentes['leiras']) : '');
            $ma = date('Y-m-d');

            $insertQuery = "INSERT INTO kamion_karbantartars (kamion_id, admin, datum, log, km_oraallas, torolt)
                             VALUES (:kamion_id, :admin, :datum, :log, :km_oraallas, 'N')";
            $insertStmt = $this->db->prepare($insertQuery);
            $insertStmt->bindValue(':kamion_id', $bejelentes['kamion_id']);
            $insertStmt->bindValue(':admin', $bejelentes['admin']);
            $insertStmt->bindValue(':datum', $ma);
            $insertStmt->bindValue(':log', $log);
            $insertStmt->bindValue(':km_oraallas', $kmOraallas);
            $insertStmt->execute();
            $karbantartasId = $this->db->lastInsertId();

            $updateQuery = "UPDATE bejelentesek SET karbantartas_id = :karbantartas_id, statusz = IF(statusz = 'uj', 'folyamatban', statusz) WHERE id = :id";
            $updateStmt = $this->db->prepare($updateQuery);
            $updateStmt->bindValue(':karbantartas_id', $karbantartasId);
            $updateStmt->bindValue(':id', $id);
            $updateStmt->execute();

            return ['success' => true, 'message' => 'Karbantartás létrehozva a bejelentésből.', 'karbantartas_id' => $karbantartasId];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A korábban csak frontend-mockolt üzenetfolyam (ld. a fájl tetején lévő
    // komment) valódi backendje — ugyanaz a minta, mint
    // `HelyszinInterface::getHelyszinMegjegyzesek()`/`newHelyszinMegjegyzes()`.
    // `$sofor_id` NULL admin-hívásnál (a cég BÁRMELY bejelentéséhez fér
    // hozzá), és a hívó saját, szerver-oldalon feloldott sofőr-id-je
    // sofőr-hívásnál (csak a SAJÁT bejelentéséhez fér hozzá) — enélkül egy
    // sofőr egy másik sofőr bejelentésének üzenetfolyamát is olvashatná/
    // írhatná puszta bejelentes_id-tallózással.
    private function bejelentesElerheto($bejelentes_id, $ceg_id, $sofor_id = null) {
        $query = "SELECT id FROM bejelentesek WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'";
        if ($sofor_id !== null) {
            $query .= " AND sofor_id = :sofor_id";
        }
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':id', $bejelentes_id);
        $stmt->bindValue(':ceg_id', $ceg_id);
        if ($sofor_id !== null) {
            $stmt->bindValue(':sofor_id', $sofor_id);
        }
        $stmt->execute();
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // `bejelentes_id => ['osszes' => N, 'utolsoSofortol' => bool]` — egyetlen
    // lekérdezéssel az ÖSSZES kért bejelentés üzenet-metaadata, nem N+1
    // (a projekt konvenciója szerint a táblákat sosem kapcsoljuk össze egy
    // lekérdezésen belül).
    private function getUzenetInfok($bejelentesIds) {
        $bejelentesIds = array_values(array_filter($bejelentesIds, fn($id) => $id !== null));
        if (empty($bejelentesIds)) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($bejelentesIds), '?'));
        $query = "SELECT bejelentes_id, szerzo_tipus FROM bejelentes_uzenetek
                  WHERE bejelentes_id IN ($placeholders) AND torolt <> 'I'
                  ORDER BY letrehozva ASC, id ASC";
        $stmt = $this->db->prepare($query);
        $stmt->execute($bejelentesIds);
        $infok = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $id = $row['bejelentes_id'];
            if (!isset($infok[$id])) {
                $infok[$id] = ['osszes' => 0, 'utolsoSofortol' => false];
            }
            $infok[$id]['osszes']++;
            $infok[$id]['utolsoSofortol'] = ($row['szerzo_tipus'] === 'sofor');
        }
        return $infok;
    }

    public function getMessages($bejelentes_id, $ceg_id, $sofor_id = null) {
        try {
            if (!$this->bejelentesElerheto($bejelentes_id, $ceg_id, $sofor_id)) {
                return ['success' => false, 'message' => 'A bejelentés nem található, vagy nincs jogosultságod hozzá.'];
            }

            $query = "SELECT * FROM bejelentes_uzenetek WHERE bejelentes_id = :id AND torolt <> 'I' ORDER BY letrehozva ASC, id ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $bejelentes_id);
            $stmt->execute();
            return ['success' => true, 'uzenetek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function sendMessage($bejelentes_id, $szoveg, $ceg_id, $szerzo_tipus, $szerzo_id, $szerzo_nev, $sofor_id = null) {
        try {
            if (!$this->bejelentesElerheto($bejelentes_id, $ceg_id, $sofor_id)) {
                return ['success' => false, 'message' => 'A bejelentés nem található, vagy nincs jogosultságod hozzá.'];
            }
            if (trim((string) $szoveg) === '') {
                return ['success' => false, 'message' => 'Az üzenet nem lehet üres.'];
            }

            $query = "INSERT INTO bejelentes_uzenetek (bejelentes_id, szerzo_tipus, szerzo_id, szerzo_nev, szoveg)
                      VALUES (:bejelentes_id, :szerzo_tipus, :szerzo_id, :szerzo_nev, :szoveg)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':bejelentes_id', $bejelentes_id);
            $stmt->bindValue(':szerzo_tipus', $szerzo_tipus);
            $stmt->bindValue(':szerzo_id', $szerzo_id);
            $stmt->bindValue(':szerzo_nev', $szerzo_nev);
            $stmt->bindValue(':szoveg', $szoveg);
            $stmt->execute();

            return ['success' => true, 'id' => $this->db->lastInsertId(), 'message' => 'Üzenet elküldve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteBejelentes($id, $ceg_id) {
        try {
            $query = "UPDATE bejelentesek SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A bejelentés nem található, vagy nem a te céged tulajdona.'];
            }

            return ['success' => true, 'message' => 'Bejelentés törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$bejelentesekInterface = new BejelentesekInterface();
