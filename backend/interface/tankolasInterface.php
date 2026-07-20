<?php

class TankolasInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // `$ceg_id`/`$sofor_id`-t a hívó (ApiHandler) mindig szerver-oldalon
    // feloldva adja át (resolveSajatCegId()/resolveSajatSoforId()) — sosem
    // a kliens `admin`/`sofor_id` mezőjét, enélkül bármely sofőr tetszőleges
    // másik sofőr/cég nevében hozhatott létre hamis tankolási bejegyzést
    // (ld. biztonsági audit).
    public function newTankolas($data, $ceg_id, $sofor_id) {
        try {
            $liter = (float) ($data['liter'] ?? 0);
            $egysegar = isset($data['egysegar']) && $data['egysegar'] !== '' ? (float) $data['egysegar'] : null;
            $osszeg = $egysegar !== null ? round($liter * $egysegar, 2) : null;

            // A furgon önhajtó jármű, mint a kamion, ezért ugyanúgy tankolható
            // — `kamion_id`/`furgon_id` kölcsönösen kizáró (ld. sql/28.sql).
            $query = "INSERT INTO tankolasok (admin, sofor_id, kamion_id, furgon_id, datum, liter, egysegar, osszeg, km_oraallas, helyszin)
                      VALUES (:admin, :sofor_id, :kamion_id, :furgon_id, :datum, :liter, :egysegar, :osszeg, :km_oraallas, :helyszin)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindValue(':sofor_id', $sofor_id);
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':furgon_id', empty($data['furgon_id']) ? null : $data['furgon_id']);
            $stmt->bindValue(':datum', empty($data['datum']) ? date('Y-m-d H:i:s') : $data['datum']);
            $stmt->bindValue(':liter', $liter);
            $stmt->bindValue(':egysegar', $egysegar);
            $stmt->bindValue(':osszeg', $osszeg);
            $stmt->bindValue(':km_oraallas', empty($data['km_oraallas']) ? null : $data['km_oraallas']);
            $stmt->bindValue(':helyszin', $data['helyszin'] ?? null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Tankolás rögzítve.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getTankolasok($sofor_id) {
        try {
            $query = "SELECT * FROM tankolasok WHERE sofor_id = :sofor_id AND torolt <> 'I' ORDER BY datum DESC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':sofor_id', $sofor_id);
            $stmt->execute();
            $tankolasok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'tankolasok' => $tankolasok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Item 1: üzemanyag-fogyasztás anomália-detektálás. Két egymást követő
    // (km_oraallas szerint rendezett) tankolás km_oraallas-különbségéből és
    // a MÁSODIK tankolás literéből számoljuk a köztes szakasz fogyasztását
    // (L/100km) — ez a klasszikus "két tankolás közötti fogyasztás" módszer,
    // nem igényel GPS-adatot. Egy adott jármű saját, összes érvényes
    // szakaszának átlagához viszonyítva jelöljük "anomáliának" azokat a
    // szakaszokat, amik `ANOMALIA_KUSZOB_SZAZALEK`-nál jobban eltérnek —
    // ez tipikusan üzemanyag-lopás/kártyavisszaélés vagy hibás km-rögzítés
    // jele lehet, nem feltétlenül bizonyíték, ezért csak jelzésre, nem
    // automatikus döntésre szolgál.
    const ANOMALIA_KUSZOB_SZAZALEK = 20;

    // `$kamion_id`/`$furgon_id`: opcionális, egy adott jármű saját fogyasztás-
    // elemzésére szűkít (ld. Kamionok/Furgonok adatlap saját kártyája). Ha
    // mindkettő üres, a teljes flotta (kamionok ÉS furgonok) elemzése jön
    // vissza egy közös, `jarmu_tipus`-szal megkülönböztetett listában — a
    // furgon önhajtó jármű, mint a kamion, ezért ugyanaz a "két tankolás
    // közötti fogyasztás" módszer alkalmazható rá.
    public function getFogyasztasElemzes($ceg_id, $kamion_id = null, $furgon_id = null) {
        try {
            $sorok = [];
            if (empty($furgon_id)) {
                $query = "SELECT id, kamion_id AS jarmu_id, 'kamion' AS jarmu_tipus, datum, liter, km_oraallas
                          FROM tankolasok
                          WHERE admin = :ceg_id AND torolt <> 'I' AND kamion_id IS NOT NULL AND km_oraallas IS NOT NULL";
                $params = [':ceg_id' => $ceg_id];
                if (!empty($kamion_id)) {
                    $query .= " AND kamion_id = :kamion_id";
                    $params[':kamion_id'] = $kamion_id;
                }
                $query .= " ORDER BY kamion_id ASC, km_oraallas ASC";
                $stmt = $this->db->prepare($query);
                foreach ($params as $k => $v) {
                    $stmt->bindValue($k, $v);
                }
                $stmt->execute();
                $sorok = array_merge($sorok, $stmt->fetchAll(PDO::FETCH_ASSOC));
            }
            if (empty($kamion_id)) {
                $query = "SELECT id, furgon_id AS jarmu_id, 'furgon' AS jarmu_tipus, datum, liter, km_oraallas
                          FROM tankolasok
                          WHERE admin = :ceg_id AND torolt <> 'I' AND furgon_id IS NOT NULL AND km_oraallas IS NOT NULL";
                $params = [':ceg_id' => $ceg_id];
                if (!empty($furgon_id)) {
                    $query .= " AND furgon_id = :furgon_id";
                    $params[':furgon_id'] = $furgon_id;
                }
                $query .= " ORDER BY furgon_id ASC, km_oraallas ASC";
                $stmt = $this->db->prepare($query);
                foreach ($params as $k => $v) {
                    $stmt->bindValue($k, $v);
                }
                $stmt->execute();
                $sorok = array_merge($sorok, $stmt->fetchAll(PDO::FETCH_ASSOC));
            }

            $kamionRendszamok = $this->getKamionRendszamok($ceg_id);
            $furgonRendszamok = $this->getFurgonRendszamok($ceg_id);

            $csoportok = [];
            foreach ($sorok as $sor) {
                $csoportok[$sor['jarmu_tipus'] . ':' . $sor['jarmu_id']][] = $sor;
            }

            $eredmeny = [];
            foreach ($csoportok as $kulcs => $tetelek) {
                [$jarmuTipus, $jarmuId] = explode(':', $kulcs, 2);
                $rendszam = $jarmuTipus === 'furgon'
                    ? ($furgonRendszamok[$jarmuId] ?? null)
                    : ($kamionRendszamok[$jarmuId] ?? null);
                $szakaszok = [];
                for ($i = 1; $i < count($tetelek); $i++) {
                    $elozo = $tetelek[$i - 1];
                    $aktualis = $tetelek[$i];
                    $kmKulonbseg = (int) $aktualis['km_oraallas'] - (int) $elozo['km_oraallas'];
                    if ($kmKulonbseg <= 0) {
                        continue;
                    }
                    $fogyasztas = round(((float) $aktualis['liter'] / $kmKulonbseg) * 100, 2);
                    $szakaszok[] = [
                        'tankolas_id' => $aktualis['id'],
                        'datum' => $aktualis['datum'],
                        'km_tol' => (int) $elozo['km_oraallas'],
                        'km_ig' => (int) $aktualis['km_oraallas'],
                        'liter' => (float) $aktualis['liter'],
                        'fogyasztas_100km' => $fogyasztas,
                    ];
                }

                if (empty($szakaszok)) {
                    // Van tankolás-adat, de nincs két, egymást követő
                    // érvényes km-óraállás — nem tudunk fogyasztást számolni.
                    $eredmeny[] = [
                        'jarmu_tipus' => $jarmuTipus,
                        'kamion_id' => $jarmuTipus === 'kamion' ? $jarmuId : null,
                        'furgon_id' => $jarmuTipus === 'furgon' ? $jarmuId : null,
                        'rendszam' => $rendszam,
                        'atlagFogyasztas' => null,
                        'szakaszok' => [],
                    ];
                    continue;
                }

                // A MEDIÁN a viszonyítási alap, nem az átlag — egyetlen
                // valódi anomália (pont amit keresünk) a sima átlagot magával
                // rántaná, ami visszafelé az ÖSSZES normál szakaszt is
                // "anomáliának" mutatná a torzult átlaghoz képest. A medián
                // ezzel szemben ellenálló egy-két szélsőséges értékkel
                // szemben, tehát a normál szakaszok normálisnak, csak a
                // valódi kiugrás anomáliának látszik.
                $tipikusFogyasztas = $this->median(array_column($szakaszok, 'fogyasztas_100km'));
                foreach ($szakaszok as &$sz) {
                    $elteres = $tipikusFogyasztas > 0
                        ? round((($sz['fogyasztas_100km'] - $tipikusFogyasztas) / $tipikusFogyasztas) * 100, 1)
                        : 0;
                    $sz['elteres_szazalek'] = $elteres;
                    $sz['anomalia'] = abs($elteres) >= self::ANOMALIA_KUSZOB_SZAZALEK;
                }
                unset($sz);

                $eredmeny[] = [
                    'jarmu_tipus' => $jarmuTipus,
                    'kamion_id' => $jarmuTipus === 'kamion' ? $jarmuId : null,
                    'furgon_id' => $jarmuTipus === 'furgon' ? $jarmuId : null,
                    'rendszam' => $rendszam,
                    'atlagFogyasztas' => round($tipikusFogyasztas, 2),
                    'szakaszok' => array_reverse($szakaszok), // legújabb elöl
                ];
            }

            // A legtöbb/legsúlyosabb anomáliával rendelkező jármű elöl —
            // ez adja a leginkább releváns sorrendet egy admin számára.
            usort($eredmeny, function ($a, $b) {
                $aSzam = count(array_filter($a['szakaszok'], fn($s) => $s['anomalia']));
                $bSzam = count(array_filter($b['szakaszok'], fn($s) => $s['anomalia']));
                return $bSzam <=> $aSzam;
            });

            return ['success' => true, 'jarmuvek' => $eredmeny];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function median(array $ertekek) {
        sort($ertekek);
        $db = count($ertekek);
        if ($db === 0) {
            return 0;
        }
        $kozep = (int) floor($db / 2);
        if ($db % 2 === 0) {
            return ($ertekek[$kozep - 1] + $ertekek[$kozep]) / 2;
        }
        return $ertekek[$kozep];
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

    private function getFurgonRendszamok($ceg_id) {
        $stmt = $this->db->prepare("SELECT id, rendszam FROM furgon WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['rendszam'];
        }
        return $map;
    }
}

$tankolasInterface = new TankolasInterface();
