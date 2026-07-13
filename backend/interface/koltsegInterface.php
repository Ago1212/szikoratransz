<?php

// Pénzforgalom (cashflow) riport — meglévő adatra épül, nincs sok új
// domain-entitás: a karbantartások (`kamion_karbantartars`/
// `potkocsi_karbantartars.koltseg`), a tankolások (`tankolasok.osszeg`), a
// biztosítási díjak (`kamion`/`potkocsi.kot_biz_dij`/`kaszko_dij`, a
// fizetési ütem alapján ON-THE-FLY generált eltelt esedékességekkel, ld.
// getBiztositasKiadasok()) és a lezárt fuvarok díja (`fuvarok.dij`, mint
// bevétel) összegzése havi bontásban (grafikon) és jármű szerinti
// bontásban (táblázat), kiegészítve a kézzel rögzített, immár kétirányú
// (`irany` = 'bevetel'/'kiado') `egyeb_koltsegek` tételekkel. A projekt
// JOIN-mentes konvenciója szerint (ld. bejelentesekInterface.php komment)
// minden tábla saját lekérdezést kap, PHP oldalon fűzzük össze.
class KoltsegInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    private function datumSzures($oszlop, $datumTol, $datumIg) {
        $felt = [];
        $params = [];
        if (!empty($datumTol)) {
            $felt[] = "$oszlop >= :datumTol";
            $params[':datumTol'] = $datumTol;
        }
        if (!empty($datumIg)) {
            $felt[] = "$oszlop <= :datumIg";
            $params[':datumIg'] = $datumIg;
        }
        return [$felt ? ' AND ' . implode(' AND ', $felt) : '', $params];
    }

    private function havonta($tabla, $oszlop, $datumTol, $datumIg, $ceg_id) {
        [$szuresSql, $szuresParams] = $this->datumSzures($oszlop, $datumTol, $datumIg);
        $query = "SELECT DATE_FORMAT($oszlop, '%Y-%m') AS honap, SUM(koltseg) AS osszeg
                  FROM $tabla WHERE admin = :ceg_id AND torolt <> 'I' AND koltseg IS NOT NULL$szuresSql
                  GROUP BY honap";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':ceg_id', $ceg_id);
        foreach ($szuresParams as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['honap']] = (float) $row['osszeg'];
        }
        return $map;
    }

    private function jarmuvenkent($tabla, $jarmuOszlop, $datumTol, $datumIg, $ceg_id) {
        [$szuresSql, $szuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
        $query = "SELECT $jarmuOszlop AS jarmu_id, SUM(koltseg) AS osszeg
                  FROM $tabla WHERE admin = :ceg_id AND torolt <> 'I' AND koltseg IS NOT NULL$szuresSql
                  GROUP BY $jarmuOszlop";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':ceg_id', $ceg_id);
        foreach ($szuresParams as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($row['jarmu_id'] !== null) {
                $map[$row['jarmu_id']] = (float) $row['osszeg'];
            }
        }
        return $map;
    }

    // Havi bontás az `egyeb_koltsegek` táblára, iránnyal szűrve — a
    // `koltseg`-es táblák `havonta()` segédjéhez hasonló, de az oszlopnév
    // ott mindig `koltseg`, itt `osszeg`, és itt kell `irany`-t is
    // szűrni, ezért külön kis lekérdezés, nem a meglévő helper.
    // `$kategoriaSzuro`: null = minden (kategóriától függetlenül, ma nem
    // használt kívülről), 'egyeb' = csak a kategória NÉLKÜLI sorok (ez a
    // hagyományos "Egyéb" kiadás/bevétel-kártya alapja), 'uzemanyag' =
    // csak az így megjelölt sorok (ezek a tankolasok.osszeg mellé, az
    // Üzemanyag-összesítőbe folynak be, ld. getKoltsegOsszesito).
    private function kategoriaWhere($kategoriaSzuro, &$params) {
        if ($kategoriaSzuro === 'uzemanyag') {
            $params[':kategoria'] = 'uzemanyag';
            return " AND kategoria = :kategoria";
        }
        if ($kategoriaSzuro === 'egyeb') {
            return " AND kategoria IS NULL";
        }
        return "";
    }

    private function egyebHavonta($irany, $datumTol, $datumIg, $ceg_id, $kategoriaSzuro = null) {
        [$szuresSql, $szuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
        $params = [':ceg_id' => $ceg_id, ':irany' => $irany];
        foreach ($szuresParams as $k => $v) {
            $params[$k] = $v;
        }
        $kategoriaSql = $this->kategoriaWhere($kategoriaSzuro, $params);
        $query = "SELECT DATE_FORMAT(datum, '%Y-%m') AS honap, SUM(osszeg) AS osszeg
                  FROM egyeb_koltsegek WHERE admin = :ceg_id AND torolt <> 'I' AND irany = :irany$szuresSql$kategoriaSql
                  GROUP BY honap";
        $stmt = $this->db->prepare($query);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['honap']] = (float) $row['osszeg'];
        }
        return $map;
    }

    private function egyebJarmuvenkent($irany, $jarmuOszlop, $datumTol, $datumIg, $ceg_id, $kategoriaSzuro = null) {
        [$szuresSql, $szuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
        $params = [':ceg_id' => $ceg_id, ':irany' => $irany];
        foreach ($szuresParams as $k => $v) {
            $params[$k] = $v;
        }
        $kategoriaSql = $this->kategoriaWhere($kategoriaSzuro, $params);
        $query = "SELECT $jarmuOszlop AS jarmu_id, SUM(osszeg) AS osszeg
                  FROM egyeb_koltsegek WHERE admin = :ceg_id AND torolt <> 'I' AND irany = :irany AND $jarmuOszlop IS NOT NULL$szuresSql$kategoriaSql
                  GROUP BY $jarmuOszlop";
        $stmt = $this->db->prepare($query);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['jarmu_id']] = (float) $row['osszeg'];
        }
        return $map;
    }

    private function egyebNemKotott($irany, $datumTol, $datumIg, $ceg_id, $kategoriaSzuro = null) {
        [$szuresSql, $szuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
        $params = [':ceg_id' => $ceg_id, ':irany' => $irany];
        foreach ($szuresParams as $k => $v) {
            $params[$k] = $v;
        }
        $kategoriaSql = $this->kategoriaWhere($kategoriaSzuro, $params);
        $stmt = $this->db->prepare(
            "SELECT SUM(osszeg) AS osszeg FROM egyeb_koltsegek
             WHERE admin = :ceg_id AND torolt <> 'I' AND irany = :irany AND kamion_id IS NULL AND potkocsi_id IS NULL$szuresSql$kategoriaSql"
        );
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        return (float) ($stmt->fetch(PDO::FETCH_ASSOC)['osszeg'] ?? 0);
    }

    // Lezárt fuvarok díja, mint bevétel — a bevétel dátuma a lerakás
    // dátuma (ha van), különben a felrakás dátuma, különben a rögzítés
    // dátuma. SZÁNDÉKOSAN csak a HUF-ban (vagy deviza nélkül) rögzített
    // fuvarok kerülnek összegzésre — nincs árfolyam-forrás az appban,
    // hamis pontosság helyett az EUR-fuvarok kimaradnak az Ft-alapú
    // riportból (a frontend erről külön jelez, ha van ilyen fuvar).
    private function fuvarBevetelHavonta($datumTol, $datumIg, $ceg_id) {
        $datumKif = "COALESCE(lerakas_datum, felrakas_datum, DATE(letrehozva))";
        [$szuresSql, $szuresParams] = $this->datumSzures($datumKif, $datumTol, $datumIg);
        $query = "SELECT DATE_FORMAT($datumKif, '%Y-%m') AS honap, SUM(dij) AS osszeg
                  FROM fuvarok WHERE admin = :ceg_id AND torolt <> 'I' AND statusz = 'lezart' AND dij IS NOT NULL
                  AND (devizanem = 'HUF' OR devizanem IS NULL)$szuresSql
                  GROUP BY honap";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':ceg_id', $ceg_id);
        foreach ($szuresParams as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['honap']] = (float) $row['osszeg'];
        }
        return $map;
    }

    private function fuvarBevetelJarmuvenkent($datumTol, $datumIg, $ceg_id) {
        $datumKif = "COALESCE(lerakas_datum, felrakas_datum, DATE(letrehozva))";
        [$szuresSql, $szuresParams] = $this->datumSzures($datumKif, $datumTol, $datumIg);
        $query = "SELECT kamion_id AS jarmu_id, SUM(dij) AS osszeg
                  FROM fuvarok WHERE admin = :ceg_id AND torolt <> 'I' AND statusz = 'lezart' AND dij IS NOT NULL
                  AND (devizanem = 'HUF' OR devizanem IS NULL) AND kamion_id IS NOT NULL$szuresSql
                  GROUP BY kamion_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':ceg_id', $ceg_id);
        foreach ($szuresParams as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['jarmu_id']] = (float) $row['osszeg'];
        }
        return $map;
    }

    private function vanDevizasLezartFuvar($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) AS db FROM fuvarok
             WHERE admin = :ceg_id AND torolt <> 'I' AND statusz = 'lezart' AND dij IS NOT NULL
             AND devizanem IS NOT NULL AND devizanem <> 'HUF'"
        );
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        return (int) ($stmt->fetch(PDO::FETCH_ASSOC)['db'] ?? 0) > 0;
    }

    // A `kot_biz_dij`/`kaszko_dij` mezők varchar-ok, a valós adat gyakran
    // üres string, néha "Nincs", néha tiszta szám — ez a nem-numerikus
    // szemetet levágja, `null`-t ad vissza, ha nincs érdemi összeg.
    private function parsePenz($ertek) {
        if ($ertek === null || $ertek === '') {
            return null;
        }
        $tisztitott = str_replace(',', '.', preg_replace('/[^0-9,.]/', '', (string) $ertek));
        if ($tisztitott === '' || !is_numeric($tisztitott)) {
            return null;
        }
        $szam = (float) $tisztitott;
        return $szam > 0 ? $szam : null;
    }

    private function periodInterval($utem) {
        switch ($utem) {
            case 'Negyed év':
                return new DateInterval('P3M');
            case 'Fél év':
                return new DateInterval('P6M');
            case 'Éves':
                return new DateInterval('P1Y');
            default:
                return null;
        }
    }

    // Az ApiHandler::calculateNextPaymentDate()/getPeriodEndDate() mintája,
    // de NEM a következő egyetlen esedékességet adja vissza, hanem MINDEN
    // már ELTELT (≤ mai nap, illetve ≤ $datumIg) esedékességi napot a
    // `[$datumTol, $datumIg]` tartományban — így a biztosítási díjak a
    // teljes riport-időszakra ismétlődő kiadás-tételekké válnak, nem csak
    // egy jövőbeli emlékeztetővé.
    private function elapsedPeriodDatums($kezdoDatum, $utem, $datumTol, $datumIg) {
        $interval = $this->periodInterval($utem);
        if (empty($kezdoDatum) || !$interval) {
            return [];
        }

        $ma = new DateTime();
        $felsoHatar = !empty($datumIg) ? new DateTime($datumIg) : clone $ma;
        if ($felsoHatar > $ma) {
            $felsoHatar = $ma; // jövőbeli esedékesség még nem valós pénzmozgás
        }
        $alsoHatar = !empty($datumTol) ? new DateTime($datumTol) : null;

        $periodStart = new DateTime($kezdoDatum);
        $datumok = [];
        $periodEnd = (clone $periodStart)->add($interval)->sub(new DateInterval('P1D'));

        while ($periodEnd <= $felsoHatar) {
            if (!$alsoHatar || $periodEnd >= $alsoHatar) {
                $datumok[] = $periodEnd->format('Y-m-d');
            }
            $periodStart->add($interval);
            $periodEnd = (clone $periodStart)->add($interval)->sub(new DateInterval('P1D'));
        }

        return $datumok;
    }

    // Biztosítási kiadások (kötelező + kaszkó) — nincs saját tábla, a
    // kamion/potkocsi mezőkből generálódik on-the-fly, ugyanúgy, mint az
    // ApiHandler::getEsemenyek() naptár-emlékeztetői.
    private function getBiztositasKiadasok($ceg_id, $datumTol, $datumIg) {
        $tetelek = [];
        foreach (['kamion', 'potkocsi'] as $tabla) {
            $stmt = $this->db->prepare(
                "SELECT id, kot_biztositas, kot_biz_utem, kot_biz_dij, kaszko_biztositas, kaszko_fizetesi_utem, kaszko_dij
                 FROM `$tabla` WHERE admin = :ceg_id AND torolt <> 'I'"
            );
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $jarmu) {
                $kotOsszeg = $this->parsePenz($jarmu['kot_biz_dij']);
                if ($kotOsszeg !== null) {
                    foreach ($this->elapsedPeriodDatums($jarmu['kot_biztositas'], $jarmu['kot_biz_utem'], $datumTol, $datumIg) as $datum) {
                        $tetelek[] = ['honap' => substr($datum, 0, 7), 'jarmu_tipus' => $tabla, 'jarmu_id' => $jarmu['id'], 'osszeg' => $kotOsszeg];
                    }
                }
                $kaszkoOsszeg = $this->parsePenz($jarmu['kaszko_dij']);
                if ($kaszkoOsszeg !== null) {
                    foreach ($this->elapsedPeriodDatums($jarmu['kaszko_biztositas'], $jarmu['kaszko_fizetesi_utem'], $datumTol, $datumIg) as $datum) {
                        $tetelek[] = ['honap' => substr($datum, 0, 7), 'jarmu_tipus' => $tabla, 'jarmu_id' => $jarmu['id'], 'osszeg' => $kaszkoOsszeg];
                    }
                }
            }
        }
        return $tetelek;
    }

    public function getKoltsegOsszesito($ceg_id, $datumTol = null, $datumIg = null) {
        try {
            // --- Havi bontás (grafikonhoz) ---
            $karbHavonta = $this->havonta('kamion_karbantartars', 'datum', $datumTol, $datumIg, $ceg_id);
            foreach ($this->havonta('potkocsi_karbantartars', 'datum', $datumTol, $datumIg, $ceg_id) as $honap => $osszeg) {
                $karbHavonta[$honap] = ($karbHavonta[$honap] ?? 0) + $osszeg;
            }

            [$tankSzuresSql, $tankSzuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
            $tankStmt = $this->db->prepare(
                "SELECT DATE_FORMAT(datum, '%Y-%m') AS honap, SUM(osszeg) AS osszeg
                 FROM tankolasok WHERE admin = :ceg_id AND torolt <> 'I' AND osszeg IS NOT NULL$tankSzuresSql
                 GROUP BY honap"
            );
            $tankStmt->bindValue(':ceg_id', $ceg_id);
            foreach ($tankSzuresParams as $k => $v) {
                $tankStmt->bindValue($k, $v);
            }
            $tankStmt->execute();
            $uzemanyagHavonta = [];
            foreach ($tankStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $uzemanyagHavonta[$row['honap']] = (float) $row['osszeg'];
            }

            $egyebKiadasHavonta = $this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'egyeb');
            $egyebBevetelHavonta = $this->egyebHavonta('bevetel', $datumTol, $datumIg, $ceg_id);
            $fuvarBevetelHavonta = $this->fuvarBevetelHavonta($datumTol, $datumIg, $ceg_id);

            // Az 'uzemanyag' kategóriával megjelölt kiadás-tételek (pl. NAV-ból
            // importált MOL-számla) a tankolasok.osszeg mellé, ugyanabba az
            // Üzemanyag-összesítőbe folynak be — nem az Egyébbe.
            foreach ($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'uzemanyag') as $honap => $osszeg) {
                $uzemanyagHavonta[$honap] = ($uzemanyagHavonta[$honap] ?? 0) + $osszeg;
            }

            $biztositasTetelek = $this->getBiztositasKiadasok($ceg_id, $datumTol, $datumIg);
            $biztositasHavonta = [];
            foreach ($biztositasTetelek as $t) {
                $biztositasHavonta[$t['honap']] = ($biztositasHavonta[$t['honap']] ?? 0) + $t['osszeg'];
            }

            $bevetelHavonta = $fuvarBevetelHavonta;
            foreach ($egyebBevetelHavonta as $honap => $osszeg) {
                $bevetelHavonta[$honap] = ($bevetelHavonta[$honap] ?? 0) + $osszeg;
            }

            $honapok = array_unique(array_merge(
                array_keys($karbHavonta),
                array_keys($uzemanyagHavonta),
                array_keys($biztositasHavonta),
                array_keys($egyebKiadasHavonta),
                array_keys($bevetelHavonta)
            ));
            sort($honapok);
            $havi = [];
            foreach ($honapok as $honap) {
                $karbantartas = $karbHavonta[$honap] ?? 0;
                $uzemanyag = $uzemanyagHavonta[$honap] ?? 0;
                $biztositas = $biztositasHavonta[$honap] ?? 0;
                $egyeb = $egyebKiadasHavonta[$honap] ?? 0;
                $bevetel = $bevetelHavonta[$honap] ?? 0;
                $kiadasOsszesen = $karbantartas + $uzemanyag + $biztositas + $egyeb;
                $havi[] = [
                    'honap' => $honap,
                    'bevetel' => $bevetel,
                    'karbantartas' => $karbantartas,
                    'uzemanyag' => $uzemanyag,
                    'biztositas' => $biztositas,
                    'egyeb' => $egyeb,
                    'kiadasOsszesen' => $kiadasOsszesen,
                    'netto' => $bevetel - $kiadasOsszesen,
                ];
            }

            // --- Jármű szerinti bontás (táblázathoz) ---
            $karbKamiononkent = $this->jarmuvenkent('kamion_karbantartars', 'kamion_id', $datumTol, $datumIg, $ceg_id);
            $karbPotkocsinkent = $this->jarmuvenkent('potkocsi_karbantartars', 'potkocsi_id', $datumTol, $datumIg, $ceg_id);
            [$tankJarmuSzuresSql, $tankJarmuSzuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
            $tankKamiononkentStmt = $this->db->prepare(
                "SELECT kamion_id AS jarmu_id, SUM(osszeg) AS osszeg
                 FROM tankolasok WHERE admin = :ceg_id AND torolt <> 'I' AND osszeg IS NOT NULL AND kamion_id IS NOT NULL$tankJarmuSzuresSql
                 GROUP BY kamion_id"
            );
            $tankKamiononkentStmt->bindValue(':ceg_id', $ceg_id);
            foreach ($tankJarmuSzuresParams as $k => $v) {
                $tankKamiononkentStmt->bindValue($k, $v);
            }
            $tankKamiononkentStmt->execute();
            $uzemanyagKamiononkent = [];
            foreach ($tankKamiononkentStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $uzemanyagKamiononkent[$row['jarmu_id']] = (float) $row['osszeg'];
            }

            $egyebKiadasKamiononkent = $this->egyebJarmuvenkent('kiado', 'kamion_id', $datumTol, $datumIg, $ceg_id, 'egyeb');
            $egyebKiadasPotkocsinkent = $this->egyebJarmuvenkent('kiado', 'potkocsi_id', $datumTol, $datumIg, $ceg_id, 'egyeb');
            $egyebBevetelKamiononkent = $this->egyebJarmuvenkent('bevetel', 'kamion_id', $datumTol, $datumIg, $ceg_id);
            $egyebBevetelPotkocsinkent = $this->egyebJarmuvenkent('bevetel', 'potkocsi_id', $datumTol, $datumIg, $ceg_id);
            $fuvarBevetelKamiononkent = $this->fuvarBevetelJarmuvenkent($datumTol, $datumIg, $ceg_id);

            // Az 'uzemanyag' kategóriájú, jármühöz kötött kiadás-tételek a
            // tankolasok jármű szerinti bontása mellé folynak be — a
            // pótkocsi-oldali térkép új (a tankolasok táblának nincs
            // potkocsi_id oszlopa, eddig mindig 0 volt itt).
            foreach ($this->egyebJarmuvenkent('kiado', 'kamion_id', $datumTol, $datumIg, $ceg_id, 'uzemanyag') as $id => $osszeg) {
                $uzemanyagKamiononkent[$id] = ($uzemanyagKamiononkent[$id] ?? 0) + $osszeg;
            }
            $uzemanyagPotkocsinkent = $this->egyebJarmuvenkent('kiado', 'potkocsi_id', $datumTol, $datumIg, $ceg_id, 'uzemanyag');

            $biztositasKamiononkent = [];
            $biztositasPotkocsinkent = [];
            foreach ($biztositasTetelek as $t) {
                if ($t['jarmu_tipus'] === 'kamion') {
                    $biztositasKamiononkent[$t['jarmu_id']] = ($biztositasKamiononkent[$t['jarmu_id']] ?? 0) + $t['osszeg'];
                } else {
                    $biztositasPotkocsinkent[$t['jarmu_id']] = ($biztositasPotkocsinkent[$t['jarmu_id']] ?? 0) + $t['osszeg'];
                }
            }

            $bevetelKamiononkent = $fuvarBevetelKamiononkent;
            foreach ($egyebBevetelKamiononkent as $id => $osszeg) {
                $bevetelKamiononkent[$id] = ($bevetelKamiononkent[$id] ?? 0) + $osszeg;
            }

            $kamionRendszamok = $this->getRendszamok('kamion', $ceg_id);
            $potkocsiRendszamok = $this->getRendszamok('potkocsi', $ceg_id);

            $jarmuvenkent = [];
            $kamionIdk = array_unique(array_merge(
                array_keys($karbKamiononkent),
                array_keys($uzemanyagKamiononkent),
                array_keys($biztositasKamiononkent),
                array_keys($egyebKiadasKamiononkent),
                array_keys($bevetelKamiononkent)
            ));
            foreach ($kamionIdk as $id) {
                if (!isset($kamionRendszamok[$id])) {
                    continue; // más céghez tartozó vagy törölt kamion — a kulcsok csak a saját cég rendszámaival egyeznek
                }
                $karbantartas = $karbKamiononkent[$id] ?? 0;
                $uzemanyag = $uzemanyagKamiononkent[$id] ?? 0;
                $biztositas = $biztositasKamiononkent[$id] ?? 0;
                $egyeb = $egyebKiadasKamiononkent[$id] ?? 0;
                $bevetel = $bevetelKamiononkent[$id] ?? 0;
                $kiadasOsszesen = $karbantartas + $uzemanyag + $biztositas + $egyeb;
                $jarmuvenkent[] = [
                    'tipus' => 'kamion',
                    'id' => $id,
                    'rendszam' => $kamionRendszamok[$id],
                    'bevetel' => $bevetel,
                    'karbantartas' => $karbantartas,
                    'uzemanyag' => $uzemanyag,
                    'biztositas' => $biztositas,
                    'egyeb' => $egyeb,
                    'kiadasOsszesen' => $kiadasOsszesen,
                    'netto' => $bevetel - $kiadasOsszesen,
                ];
            }
            $potkocsiIdk = array_unique(array_merge(
                array_keys($karbPotkocsinkent),
                array_keys($uzemanyagPotkocsinkent),
                array_keys($biztositasPotkocsinkent),
                array_keys($egyebKiadasPotkocsinkent),
                array_keys($egyebBevetelPotkocsinkent)
            ));
            foreach ($potkocsiIdk as $id) {
                if (!isset($potkocsiRendszamok[$id])) {
                    continue;
                }
                $karbantartas = $karbPotkocsinkent[$id] ?? 0;
                $uzemanyag = $uzemanyagPotkocsinkent[$id] ?? 0;
                $biztositas = $biztositasPotkocsinkent[$id] ?? 0;
                $egyeb = $egyebKiadasPotkocsinkent[$id] ?? 0;
                $bevetel = $egyebBevetelPotkocsinkent[$id] ?? 0;
                $kiadasOsszesen = $karbantartas + $uzemanyag + $biztositas + $egyeb;
                $jarmuvenkent[] = [
                    'tipus' => 'potkocsi',
                    'id' => $id,
                    'rendszam' => $potkocsiRendszamok[$id],
                    'bevetel' => $bevetel,
                    'karbantartas' => $karbantartas,
                    'uzemanyag' => $uzemanyag,
                    'biztositas' => $biztositas,
                    'egyeb' => $egyeb,
                    'kiadasOsszesen' => $kiadasOsszesen,
                    'netto' => $bevetel - $kiadasOsszesen,
                ];
            }
            usort($jarmuvenkent, fn($a, $b) => $b['netto'] <=> $a['netto']);

            // Jármühöz nem köthető egyéb tétel — cég-szintű, nem kerülhet
            // a jármüvenkénti táblázatba, de az összesenbe igen.
            $egyebNemKotottKiado = $this->egyebNemKotott('kiado', $datumTol, $datumIg, $ceg_id, 'egyeb');
            $egyebNemKotottBevetel = $this->egyebNemKotott('bevetel', $datumTol, $datumIg, $ceg_id);

            $osszesenBevetel = array_sum($bevetelHavonta);
            $osszesenKarbantartas = array_sum($karbHavonta);
            $osszesenUzemanyag = array_sum($uzemanyagHavonta);
            $osszesenBiztositas = array_sum($biztositasHavonta);
            $osszesenEgyeb = array_sum($egyebKiadasHavonta);
            $osszesenKiadas = $osszesenKarbantartas + $osszesenUzemanyag + $osszesenBiztositas + $osszesenEgyeb;

            return [
                'success' => true,
                'havi' => $havi,
                'jarmuvenkent' => $jarmuvenkent,
                'egyebNemKotott' => ['bevetel' => $egyebNemKotottBevetel, 'kiado' => $egyebNemKotottKiado],
                'vanDevizasFuvar' => $this->vanDevizasLezartFuvar($ceg_id),
                'osszesen' => [
                    'bevetel' => $osszesenBevetel,
                    'karbantartas' => $osszesenKarbantartas,
                    'uzemanyag' => $osszesenUzemanyag,
                    'biztositas' => $osszesenBiztositas,
                    'egyeb' => $osszesenEgyeb,
                    'kiadas' => $osszesenKiadas,
                    'netto' => $osszesenBevetel - $osszesenKiadas,
                ],
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // --- Egyéb tételek (bevétel/kiadás) — manuális CRUD ---
    // Az opcionális `szamlaszam` mező előkészület egy jövőbeli NAV Online
    // Számla-integrációhoz (a NAV-tól lekérdezett számlák természetes
    // párosítási kulcsa a számlaszám lenne) — ma még nincs tényleges
    // NAV-lekérdezés, csak a mező létezik, kézzel is kitölthető.

    // Az egyetlen ma felismert kategória-érték az 'uzemanyag' — ezzel
    // jelölt kiadás-tételek a Pénzforgalom Üzemanyag-összesítőjébe folynak
    // be (ld. getKoltsegOsszesito), nem az Egyébbe. Bármi más értéket a
    // felület küldene, csendben null-ra esik vissza (= "Egyéb").
    private function normalizKategoria($kategoria) {
        return $kategoria === 'uzemanyag' ? 'uzemanyag' : null;
    }

    public function newEgyebKoltseg($data) {
        try {
            $irany = in_array($data['irany'] ?? null, ['bevetel', 'kiado'], true) ? $data['irany'] : 'kiado';
            $query = "INSERT INTO egyeb_koltsegek (admin, irany, kategoria, kamion_id, potkocsi_id, datum, megnevezes, szamlaszam, osszeg, megjegyzes)
                      VALUES (:admin, :irany, :kategoria, :kamion_id, :potkocsi_id, :datum, :megnevezes, :szamlaszam, :osszeg, :megjegyzes)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['ceg_id']);
            $stmt->bindValue(':irany', $irany);
            $stmt->bindValue(':kategoria', $this->normalizKategoria($data['kategoria'] ?? null));
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':potkocsi_id', empty($data['potkocsi_id']) ? null : $data['potkocsi_id']);
            $stmt->bindValue(':datum', $data['datum']);
            $stmt->bindValue(':megnevezes', $data['megnevezes']);
            $stmt->bindValue(':szamlaszam', $data['szamlaszam'] ?: null);
            $stmt->bindValue(':osszeg', $data['osszeg']);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
            $stmt->execute();

            return [
                'success' => true,
                'message' => $irany === 'bevetel' ? 'Bevétel rögzítve.' : 'Kiadás rögzítve.',
                'id' => $this->db->lastInsertId(),
                'irany' => $irany,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Meglévő tétel szerkesztése — elsősorban azért kellett, hogy egy NAV
    // Online Számlából importált tételhez (aminek importáláskor nincs
    // kamion_id/potkocsi_id-je, ld. NavSzamlaInterface::importalSzamlak)
    // utólag hozzá lehessen rendelni egy járművet, de a többi mező is
    // szerkeszthető vele, ugyanazokkal a mezőkkel, mint az új tétel
    // felvételénél. A `WHERE ... AND admin = :ceg_id` szándékosan van ott —
    // enélkül egy másik cég is módosíthatná a sorodat, ha kitalálná az id-t.
    public function updateEgyebKoltseg($data) {
        try {
            $irany = in_array($data['irany'] ?? null, ['bevetel', 'kiado'], true) ? $data['irany'] : 'kiado';
            $query = "UPDATE egyeb_koltsegek SET
                        irany = :irany, kategoria = :kategoria, kamion_id = :kamion_id, potkocsi_id = :potkocsi_id,
                        datum = :datum, megnevezes = :megnevezes, szamlaszam = :szamlaszam,
                        osszeg = :osszeg, megjegyzes = :megjegyzes
                      WHERE id = :id AND admin = :admin";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id']);
            $stmt->bindValue(':admin', $data['ceg_id']);
            $stmt->bindValue(':irany', $irany);
            $stmt->bindValue(':kategoria', $this->normalizKategoria($data['kategoria'] ?? null));
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':potkocsi_id', empty($data['potkocsi_id']) ? null : $data['potkocsi_id']);
            $stmt->bindValue(':datum', $data['datum']);
            $stmt->bindValue(':megnevezes', $data['megnevezes']);
            $stmt->bindValue(':szamlaszam', $data['szamlaszam'] ?: null);
            $stmt->bindValue(':osszeg', $data['osszeg']);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
            $stmt->execute();

            return [
                'success' => true,
                'message' => $irany === 'bevetel' ? 'Bevétel frissítve.' : 'Kiadás frissítve.',
                'irany' => $irany,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getEgyebKoltsegek($ceg_id, $datumTol = null, $datumIg = null, $irany = null, $search = null, $page = null, $pageSize = null) {
        try {
            [$szuresSql, $szuresParams] = $this->datumSzures('datum', $datumTol, $datumIg);
            $params = [':ceg_id' => $ceg_id];
            foreach ($szuresParams as $k => $v) {
                $params[$k] = $v;
            }
            $query = "SELECT * FROM egyeb_koltsegek WHERE admin = :ceg_id AND torolt <> 'I'$szuresSql";
            if (!empty($irany)) {
                $query .= " AND irany = :irany";
                $params[':irany'] = $irany;
            }
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['megnevezes', 'szamlaszam', 'megjegyzes'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $query .= " ORDER BY datum DESC, id DESC";

            if ($page !== null) {
                [$tetelek, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
            } else {
                $stmt = $this->db->prepare($query);
                foreach ($params as $k => $v) {
                    $stmt->bindValue($k, $v);
                }
                $stmt->execute();
                $tetelek = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            $kamionRendszamok = $this->getRendszamok('kamion', $ceg_id);
            $potkocsiRendszamok = $this->getRendszamok('potkocsi', $ceg_id);
            foreach ($tetelek as &$t) {
                if ($t['kamion_id']) {
                    $t['rendszam'] = $kamionRendszamok[$t['kamion_id']] ?? null;
                } elseif ($t['potkocsi_id']) {
                    $t['rendszam'] = $potkocsiRendszamok[$t['potkocsi_id']] ?? null;
                } else {
                    $t['rendszam'] = null;
                }
            }

            $result = ['success' => true, 'tetelek' => $tetelek];
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

    public function deleteEgyebKoltseg($id, $ceg_id) {
        try {
            $query = "UPDATE egyeb_koltsegek SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Tétel törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function getRendszamok($tabla, $ceg_id) {
        $stmt = $this->db->prepare("SELECT id, rendszam FROM `$tabla` WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['rendszam'];
        }
        return $map;
    }
}

$koltsegInterface = new KoltsegInterface();
