<?php

// Cégenként (admin = ceg_id) egyénileg bővíthető "segéd" listák — korábban
// kódba égetett ENUM-ok (kamion mérete, jármű állapota, biztosítás fizetési
// üteme, bejelentés típusa, szabadság típusa), amiket egy admin most már
// maga bővíthet/átnevezhet a Listak.js oldalon.
//
// A `TIPUS_TABLAK` térkép mondja meg, mely valós tábla/oszlop
// hivatkozhat egy adott típusú listaelemre — ez kell a törlés előtti
// "van-e még rá hivatkozó adat" ellenőrzéshez. A tábla/oszlopnevek innen
// SOSEM felhasználói bemenetből jönnek (csak ebből a kódba égetett
// térképből), ezért az SQL-be közvetlen behelyettesítésük biztonságos —
// ugyanaz a minta, mint a jarmuValtasInterface.php getRendszamok($tabla)
// segédfüggvényében.
class ListaInterface {
    protected $db;

    const TIPUSOK = ['kamion_meret', 'furgon_meret', 'potkocsi_meret', 'jarmu_allapot', 'biztositas_utem', 'bejelentes_tipus', 'szabadsag_tipus', 'deviza'];

    const TIPUS_TABLAK = [
        'kamion_meret' => [['kamion', 'meret']],
        // A furgon méretkategóriái eltérnek a kamionokétól (nem nyerges-
        // vontató méretosztályok), ezért külön, admin által feltölthető
        // lista, nem a meglévő `kamion_meret` újrafelhasználása.
        'furgon_meret' => [['furgon', 'meret']],
        // UX-audit (2026-07-23): a Pótkocsi modulból korábban hiányzott a
        // Kamion/Furgon mellett már meglévő "Méret" mező — ugyanaz az elv,
        // mint a furgon_meret-nél: saját lista, nem a kamion_meret
        // újrafelhasználása.
        'potkocsi_meret' => [['potkocsi', 'meret']],
        'jarmu_allapot' => [['kamion', 'allapot'], ['potkocsi', 'allapot'], ['furgon', 'allapot']],
        'biztositas_utem' => [
            ['kamion', 'kot_biz_utem'], ['kamion', 'kaszko_fizetesi_utem'],
            ['potkocsi', 'kot_biz_utem'], ['potkocsi', 'kaszko_fizetesi_utem'],
            ['furgon', 'kot_biz_utem'], ['furgon', 'kaszko_fizetesi_utem'],
        ],
        'bejelentes_tipus' => [['bejelentesek', 'tipus']],
        'szabadsag_tipus' => [['sofor_szabadsag', 'tipus']],
        'deviza' => [['egyeb_koltsegek', 'deviza']],
    ];

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getListaElemek($ceg_id, $tipus) {
        try {
            if (!in_array($tipus, self::TIPUSOK, true)) {
                return ['success' => false, 'message' => 'Ismeretlen lista-típus.'];
            }
            $query = "SELECT id, kulcs, nev, sorrend, vedett FROM listaelemek
                      WHERE admin = :ceg_id AND tipus = :tipus AND torolt <> 'I'
                      ORDER BY sorrend ASC, nev ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':tipus', $tipus);
            $stmt->execute();
            return ['success' => true, 'elemek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function newListaElem($ceg_id, $tipus, $kulcs, $nev) {
        try {
            if (!in_array($tipus, self::TIPUSOK, true)) {
                return ['success' => false, 'message' => 'Ismeretlen lista-típus.'];
            }
            $kulcs = trim($kulcs);
            $nev = trim($nev);
            if ($kulcs === '' || $nev === '') {
                return ['success' => false, 'message' => 'A név nem lehet üres.'];
            }

            $existing = $this->db->prepare("SELECT id FROM listaelemek WHERE admin = :ceg_id AND tipus = :tipus AND kulcs = :kulcs AND torolt <> 'I'");
            $existing->bindValue(':ceg_id', $ceg_id);
            $existing->bindValue(':tipus', $tipus);
            $existing->bindValue(':kulcs', $kulcs);
            $existing->execute();
            if ($existing->fetch()) {
                return ['success' => false, 'message' => 'Már létezik ilyen elem ebben a listában.'];
            }

            $maxSorrend = $this->db->prepare("SELECT COALESCE(MAX(sorrend), 0) AS m FROM listaelemek WHERE admin = :ceg_id AND tipus = :tipus");
            $maxSorrend->bindValue(':ceg_id', $ceg_id);
            $maxSorrend->bindValue(':tipus', $tipus);
            $maxSorrend->execute();
            $sorrend = (int) $maxSorrend->fetch(PDO::FETCH_ASSOC)['m'] + 1;

            $query = "INSERT INTO listaelemek (admin, tipus, kulcs, nev, sorrend) VALUES (:ceg_id, :tipus, :kulcs, :nev, :sorrend)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':tipus', $tipus);
            $stmt->bindValue(':kulcs', $kulcs);
            $stmt->bindValue(':nev', $nev);
            $stmt->bindValue(':sorrend', $sorrend);
            $stmt->execute();

            return ['success' => true, 'message' => 'Elem hozzáadva.', 'elem' => ['id' => $this->db->lastInsertId(), 'kulcs' => $kulcs, 'nev' => $nev, 'sorrend' => $sorrend, 'vedett' => 'N']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function updateListaElemNev($id, $ceg_id, $nev) {
        try {
            $nev = trim($nev);
            if ($nev === '') {
                return ['success' => false, 'message' => 'A név nem lehet üres.'];
            }
            $query = "UPDATE listaelemek SET nev = :nev WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':nev', $nev);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            return ['success' => true, 'message' => 'Mentve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Nem törölhető egy "védett" (rendszer-alapértelmezett) elem, sem egy
    // olyan elem, amire még van hivatkozó adat (kamion/pótkocsi/bejelentés/
    // szabadság rekord) — előbb át kell sorolni azokat egy másik értékre.
    // Az összesített találatszám a `TIPUS_TABLAK`-ban felsorolt összes
    // hivatkozó táblán/oszlopon át — mind a törlés előtti (`deleteListaElem`
    // hard block, már korábban is megvolt), mind az UX-audit szerint hiányzó
    // előzetes UI-előnézet (`getListaElemHasznalat`) ugyanezt a logikát
    // használja, hogy a két hely sose térhessen el egymástól.
    private function szamoljHasznalatot($tipus, $kulcs, $ceg_id) {
        $osszesen = 0;
        foreach (self::TIPUS_TABLAK[$tipus] ?? [] as [$tabla, $oszlop]) {
            $inUse = $this->db->prepare("SELECT COUNT(*) AS n FROM `$tabla` WHERE admin = :ceg_id AND `$oszlop` = :kulcs AND torolt <> 'I'");
            $inUse->bindValue(':ceg_id', $ceg_id);
            $inUse->bindValue(':kulcs', $kulcs);
            $inUse->execute();
            $osszesen += (int) $inUse->fetch(PDO::FETCH_ASSOC)['n'];
        }
        return $osszesen;
    }

    // UX-audit — törlés előtt eddig csak egy statikus figyelmeztető mondat
    // volt ("győződj meg róla, hogy már semmi nem használja"), a tényleges
    // ellenőrzés csak a törlés-kísérlet UTÁN, a `deleteListaElem` hard
    // blokkjában derült ki. Ez az akció lehetővé teszi, hogy a felület MÁR
    // a megerősítő kérdésben megmutassa a találatszámot.
    public function getListaElemHasznalat($id, $ceg_id) {
        try {
            $find = $this->db->prepare("SELECT tipus, kulcs FROM listaelemek WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $find->bindValue(':id', $id);
            $find->bindValue(':ceg_id', $ceg_id);
            $find->execute();
            $elem = $find->fetch(PDO::FETCH_ASSOC);
            if (!$elem) {
                return ['success' => false, 'message' => 'Az elem nem található.'];
            }
            return ['success' => true, 'darab' => $this->szamoljHasznalatot($elem['tipus'], $elem['kulcs'], $ceg_id)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteListaElem($id, $ceg_id) {
        try {
            $find = $this->db->prepare("SELECT tipus, kulcs, vedett FROM listaelemek WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $find->bindValue(':id', $id);
            $find->bindValue(':ceg_id', $ceg_id);
            $find->execute();
            $elem = $find->fetch(PDO::FETCH_ASSOC);
            if (!$elem) {
                return ['success' => false, 'message' => 'Az elem nem található.'];
            }
            if ($elem['vedett'] === 'I') {
                return ['success' => false, 'message' => 'Ez egy alapértelmezett elem, nem törölhető.'];
            }

            if ($this->szamoljHasznalatot($elem['tipus'], $elem['kulcs'], $ceg_id) > 0) {
                return ['success' => false, 'message' => 'Ezt az értéket még használja legalább egy rekord — előbb módosítsd azokat egy másik értékre.'];
            }

            $query = "UPDATE listaelemek SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Elem törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$listaInterface = new ListaInterface();
