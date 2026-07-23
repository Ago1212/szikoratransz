<?php

// Konfigurálható, szerepkör-alapú modul-jogosultságok — bármelyik, cégenként
// egyénileg létrehozott szerepkörre (ld. szerepkorInterface.php) állítható,
// az 'admin' kivételével (az mindig mindent lát/szerkeszt/törölhet, ez sosem
// állítható innen). A MODULOK lista és az egyes
// modulokon belül engedélyezett jogtípusok (`naplo`-nál pl. nincs
// szerkesztés/törlés, mert az audit napló olvasásra való) az ApiHandler
// `requirePermission()` hívásaival és a frontend Jogosultsagok.js oldallal
// vannak összhangban — ha itt új modul kerül be, mindkét helyen kövesse.
class JogosultsagInterface {
    protected $db;

    // A Helyszínek és a generikus Fájlok modul szándékosan NINCS itt — mindkettő
    // a sofőr (user tábla) oldaláról is aktívan használt/szerkeszthető
    // ugyanazokon az API-akciókon keresztül, amiket az admin oldal is hív,
    // ezért a jelenlegi, csak admin-táblás szerepkör-ellenőrzéssel nem
    // választható szét biztonságosan "admin szerkeszti" vs. "sofőr
    // szerkeszti" — ez egy jövőbeli, a hívó típusát is megkülönböztető
    // bővítés kérdése (ld. ApiHandler::MODULE_PERMISSION_MAP komment).
    const MODULOK = [
        'kamionok' => ['hozzaferes', 'szerkesztes', 'torles'],
        'potkocsik' => ['hozzaferes', 'szerkesztes', 'torles'],
        'furgonok' => ['hozzaferes', 'szerkesztes', 'torles'],
        'karbantartasok' => ['hozzaferes', 'szerkesztes', 'torles'],
        'soforok' => ['hozzaferes', 'szerkesztes', 'torles'],
        'bejelentesek' => ['hozzaferes', 'szerkesztes', 'torles'],
        'szabadsagok' => ['hozzaferes', 'szerkesztes', 'torles'],
        'ugyfelek' => ['hozzaferes', 'szerkesztes', 'torles'],
        'naplo' => ['hozzaferes'],
        'koltsegek' => ['hozzaferes', 'szerkesztes', 'torles'],
        'tachograf' => ['hozzaferes', 'szerkesztes'],
    ];

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Mindig a teljes modul-listát adja vissza, hiányzó adatbázis-sor
    // esetén is (alapértelmezett teljes hozzáféréssel kitöltve) — a
    // frontendnek így sosem kell magának tudnia az alapértelmezést.
    public function getJogosultsagok($ceg_id, $szerepkor = 'fuvarszervezo') {
        try {
            $query = "SELECT modul, hozzaferes, szerkesztes, torles FROM jogosultsagok WHERE admin = :ceg_id AND szerepkor = :szerepkor";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':szerepkor', $szerepkor);
            $stmt->execute();
            $mentett = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $mentett[$row['modul']] = $row;
            }

            $eredmeny = [];
            foreach (self::MODULOK as $modul => $tipusok) {
                $sor = $mentett[$modul] ?? null;
                $eredmeny[] = [
                    'modul' => $modul,
                    'hozzaferes' => $sor['hozzaferes'] ?? 'I',
                    'szerkesztes' => in_array('szerkesztes', $tipusok, true) ? ($sor['szerkesztes'] ?? 'I') : null,
                    'torles' => in_array('torles', $tipusok, true) ? ($sor['torles'] ?? 'I') : null,
                ];
            }
            return ['success' => true, 'jogosultsagok' => $eredmeny];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // `$jogosultsagok`: [{modul, hozzaferes, szerkesztes, torles}, ...] —
    // csak az ismert modulokat és jogtípusokat fogadja el, minden mást
    // csendben eldob (nem hibázik rajta, hogy a frontend esetleg extra
    // mezőt küldene).
    public function saveJogosultsagok($ceg_id, $szerepkor, $jogosultsagok) {
        try {
            if ($szerepkor === 'admin') {
                return ['success' => false, 'message' => 'Ez a szerepkör nem korlátozható — az adminisztrátor mindig teljes hozzáférésű.'];
            }

            $query = "INSERT INTO jogosultsagok (admin, szerepkor, modul, hozzaferes, szerkesztes, torles)
                      VALUES (:ceg_id, :szerepkor, :modul, :hozzaferes, :szerkesztes, :torles)
                      ON DUPLICATE KEY UPDATE hozzaferes = VALUES(hozzaferes), szerkesztes = VALUES(szerkesztes), torles = VALUES(torles)";
            $stmt = $this->db->prepare($query);

            foreach ($jogosultsagok as $sor) {
                $modul = $sor['modul'] ?? null;
                if (!array_key_exists($modul, self::MODULOK)) {
                    continue;
                }
                $tipusok = self::MODULOK[$modul];
                $hozzaferes = ($sor['hozzaferes'] ?? 'I') === 'N' ? 'N' : 'I';
                $szerkesztes = in_array('szerkesztes', $tipusok, true) && ($sor['szerkesztes'] ?? 'I') === 'N' ? 'N' : 'I';
                $torles = in_array('torles', $tipusok, true) && ($sor['torles'] ?? 'I') === 'N' ? 'N' : 'I';

                $stmt->bindValue(':ceg_id', $ceg_id);
                $stmt->bindValue(':szerepkor', $szerepkor);
                $stmt->bindValue(':modul', $modul);
                $stmt->bindValue(':hozzaferes', $hozzaferes);
                $stmt->bindValue(':szerkesztes', $szerkesztes);
                $stmt->bindValue(':torles', $torles);
                $stmt->execute();
            }

            return ['success' => true, 'message' => 'Jogosultságok mentve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$jogosultsagInterface = new JogosultsagInterface();
