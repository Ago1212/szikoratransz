<?php

// Pénzforgalom (cashflow) riport — meglévő adatra épül, nincs sok új
// domain-entitás: a karbantartások (`kamion_karbantartars`/
// `potkocsi_karbantartars.koltseg`), a tankolások (`tankolasok.osszeg`), a
// biztosítási díjak (`kamion`/`potkocsi.kot_biz_dij`/`kaszko_dij`, a
// fizetési ütem alapján ON-THE-FLY generált eltelt esedékességekkel, ld.
// getBiztositasKiadasok()) összegzése havi bontásban (grafikon) és jármű
// szerinti bontásban (táblázat), kiegészítve a kézzel rögzített, kétirányú
// (`irany` = 'bevetel'/'kiado') `egyeb_koltsegek` tételekkel — ez utóbbi
// az EGYETLEN bevétel-forrás (a Fuvarok modul eltávolítása előtt a lezárt
// fuvarok díja is ide folyt be automatikusan). A projekt JOIN-mentes
// konvenciója szerint (ld. bejelentesekInterface.php komment) minden
// tábla saját lekérdezést kap, PHP oldalon fűzzük össze.
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
    // használt kívülről), 'egyeb' = csak a kategória NÉLKÜLI sorok (a
    // "Kiadás" — korábban "Egyéb" — kártya alapja), 'uzemanyag'/
    // 'karbantartas'/'biztositas'/'ber' = az így megjelölt sorok (ezek a
    // saját táblájukból/on-the-fly számolt forrás MELLÉ, ugyanabba az
    // összesítőbe folynak be, ld. getKoltsegOsszesito) — ezt a 4 kézzel is
    // választható kategóriát ugyanaz a KATEGORIAK lista sorolja fel, amit
    // a normalizKategoria() is használ.
    const KATEGORIAK = ['uzemanyag', 'karbantartas', 'biztositas', 'ber'];

    private function kategoriaWhere($kategoriaSzuro, &$params) {
        if ($kategoriaSzuro === 'egyeb') {
            return " AND kategoria IS NULL";
        }
        if (in_array($kategoriaSzuro, self::KATEGORIAK, true)) {
            $params[':kategoria'] = $kategoriaSzuro;
            return " AND kategoria = :kategoria";
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

    // Ft/km fajlagos mutató forrása — TISZTÁN a `gpsmart_napi_km` cache-t
    // olvassa (SUM+COUNT), sosem hív élő GPSmart-lekérdezést. A cache-t a
    // `gpsmart_km_cache_frissites.php` cron tölti fel a háttérben (ld. ott
    // a komment) — ha egy jármű még egyáltalán nincs cache-elve, vagy a
    // kért tartomány nagy része hiányzik, ez egyszerűen `km = 0`-t és
    // alacsony/0 `lefedettNapok`-ot ad vissza, a hívó (getKoltsegOsszesito)
    // pedig emiatt `null`-t tesz a fajlagos mezőkbe explicit szám helyett —
    // sosem mutatunk hiányos adatból számolt, hamis pontosságú Ft/km-et.
    // A mai nap szándékosan kimarad az `osszesNap` nevezőből is (ld.
    // GpsmartInterface::frissitNapiKm komment — a mai nap sosem cache-elt).
    private function kmOsszesito($kamion_id, $datumTol, $datumIg) {
        $tegnap = date('Y-m-d', strtotime('-1 day'));
        $zartVegDatum = $datumIg && $datumIg < $tegnap ? $datumIg : $tegnap;
        if (!$datumTol || !$zartVegDatum || $zartVegDatum < $datumTol) {
            return ['km' => 0.0, 'lefedettNapok' => 0, 'osszesNap' => 0];
        }
        $stmt = $this->db->prepare(
            'SELECT COALESCE(SUM(km), 0) AS km, COUNT(*) AS lefedettNapok
             FROM gpsmart_napi_km WHERE kamion_id = :kamion_id AND datum BETWEEN :tol AND :ig'
        );
        $stmt->bindValue(':kamion_id', $kamion_id, PDO::PARAM_INT);
        $stmt->bindValue(':tol', $datumTol);
        $stmt->bindValue(':ig', $zartVegDatum);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        $osszesNap = (int) ((strtotime($zartVegDatum) - strtotime($datumTol)) / 86400) + 1;
        return [
            'km' => (float) $sor['km'],
            'lefedettNapok' => (int) $sor['lefedettNapok'],
            'osszesNap' => $osszesNap,
        ];
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

    // Havi bérek — nincs saját "bérfizetés" tábla, a sofőr (`user.ber`) és
    // a csapattagok (`admin.ber`) mezőjéből generálódik on-the-fly, egy
    // tétel/hónap/ember, ugyanúgy, mint a biztosítási díjak. Csak a MÁR
    // eltelt hónapokra (a jövőbeli hónap még nem valós kiadás — ugyanaz az
    // elv, mint elapsedPeriodDatums()-nál). Dátumszűrés nélkül (üres
    // datumTol/datumIg) szándékosan üres listát ad — enélkül egy
    // "mindenkori" lekérdezés a fiók fennállása óta minden hónapra
    // generálna bér-tételt, ami félrevezető lenne.
    private function getBerKiadasok($ceg_id, $datumTol, $datumIg) {
        if (empty($datumTol) || empty($datumIg)) {
            return [];
        }

        $berek = [];
        $soforStmt = $this->db->prepare("SELECT ber FROM user WHERE admin = :ceg_id AND torolt <> 'I' AND ber IS NOT NULL AND ber > 0");
        $soforStmt->bindValue(':ceg_id', $ceg_id);
        $soforStmt->execute();
        foreach ($soforStmt->fetchAll(PDO::FETCH_COLUMN) as $ber) {
            $berek[] = (float) $ber;
        }
        $csapatStmt = $this->db->prepare("SELECT ber FROM admin WHERE (id = :ceg_id OR tulajdonos_admin_id = :ceg_id2) AND torolt <> 'I' AND ber IS NOT NULL AND ber > 0");
        $csapatStmt->bindValue(':ceg_id', $ceg_id);
        $csapatStmt->bindValue(':ceg_id2', $ceg_id);
        $csapatStmt->execute();
        foreach ($csapatStmt->fetchAll(PDO::FETCH_COLUMN) as $ber) {
            $berek[] = (float) $ber;
        }
        if (empty($berek)) {
            return [];
        }

        $folyoHonap = new DateTime('first day of this month');
        $honap = new DateTime(date('Y-m-01', strtotime($datumTol)));
        $veg = new DateTime(date('Y-m-01', strtotime($datumIg)));
        if ($veg > $folyoHonap) {
            $veg = $folyoHonap;
        }

        $tetelek = [];
        while ($honap <= $veg) {
            $honapKulcs = $honap->format('Y-m');
            foreach ($berek as $ber) {
                $tetelek[] = ['honap' => $honapKulcs, 'osszeg' => $ber];
            }
            $honap->modify('+1 month');
        }
        return $tetelek;
    }

    // `$isAdmin`: a bér-kategória konkrét összege csak admin szerepkörnek
    // jár (ld. sql/24.sql) — nem-admin kérelmezőnél a `ber` mezőket
    // NULLÁZZUK a válaszban (a chart/chipek egyszerűen nem mutatnak
    // "Fizetés" oszlopot/összeget neki), DE a `kiadasOsszesen`/`netto`
    // TOVÁBBRA IS a valós (bért is tartalmazó) összeggel számol — a teljes
    // cégszintű pénzügyi képet (mennyi jött be, mennyi ment el összesen)
    // nem akarjuk hamisítani egy csapattagnak, csak a bér-specifikus
    // RÉSZLETEZÉST rejtjük el előle.
    public function getKoltsegOsszesito($ceg_id, $datumTol = null, $datumIg = null, $isAdmin = false) {
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

            // A 4 kézzel is választható kategória (Üzemanyag/Karbantartás/
            // Biztosítás/Fizetés) — az így megjelölt kézi/NAV-importált
            // egyeb_koltsegek tételek a saját táblájukból számolt/on-the-fly
            // összeg MELLÉ, ugyanabba az összesítőbe folynak be, nem a
            // kategória nélküli "Kiadás"-ba.
            foreach ($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'uzemanyag') as $honap => $osszeg) {
                $uzemanyagHavonta[$honap] = ($uzemanyagHavonta[$honap] ?? 0) + $osszeg;
            }
            foreach ($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'karbantartas') as $honap => $osszeg) {
                $karbHavonta[$honap] = ($karbHavonta[$honap] ?? 0) + $osszeg;
            }

            $biztositasTetelek = $this->getBiztositasKiadasok($ceg_id, $datumTol, $datumIg);
            $biztositasHavonta = [];
            foreach ($biztositasTetelek as $t) {
                $biztositasHavonta[$t['honap']] = ($biztositasHavonta[$t['honap']] ?? 0) + $t['osszeg'];
            }
            foreach ($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'biztositas') as $honap => $osszeg) {
                $biztositasHavonta[$honap] = ($biztositasHavonta[$honap] ?? 0) + $osszeg;
            }

            // Bérek — automatikusan, a sofőrök/csapattagok havi bér mezőjéből
            // (ld. getBerKiadasok), a kézzel "Fizetés" kategóriával jelölt
            // tételekkel (pl. egyszeri bónusz) kiegészítve.
            $berTetelek = $this->getBerKiadasok($ceg_id, $datumTol, $datumIg);
            $berHavonta = [];
            foreach ($berTetelek as $t) {
                $berHavonta[$t['honap']] = ($berHavonta[$t['honap']] ?? 0) + $t['osszeg'];
            }
            foreach ($this->egyebHavonta('kiado', $datumTol, $datumIg, $ceg_id, 'ber') as $honap => $osszeg) {
                $berHavonta[$honap] = ($berHavonta[$honap] ?? 0) + $osszeg;
            }

            $bevetelHavonta = $egyebBevetelHavonta;

            $honapok = array_unique(array_merge(
                array_keys($karbHavonta),
                array_keys($uzemanyagHavonta),
                array_keys($biztositasHavonta),
                array_keys($berHavonta),
                array_keys($egyebKiadasHavonta),
                array_keys($bevetelHavonta)
            ));
            sort($honapok);
            $havi = [];
            foreach ($honapok as $honap) {
                $karbantartas = $karbHavonta[$honap] ?? 0;
                $uzemanyag = $uzemanyagHavonta[$honap] ?? 0;
                $biztositas = $biztositasHavonta[$honap] ?? 0;
                $ber = $berHavonta[$honap] ?? 0;
                $egyeb = $egyebKiadasHavonta[$honap] ?? 0;
                $bevetel = $bevetelHavonta[$honap] ?? 0;
                $kiadasOsszesen = $karbantartas + $uzemanyag + $biztositas + $ber + $egyeb;
                $havi[] = [
                    'honap' => $honap,
                    'bevetel' => $bevetel,
                    'karbantartas' => $karbantartas,
                    'uzemanyag' => $uzemanyag,
                    'biztositas' => $biztositas,
                    'ber' => $ber,
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

            // Az 'uzemanyag'/'karbantartas'/'biztositas' kategóriájú, jármühöz
            // kötött kiadás-tételek a saját forrásuk jármű szerinti bontása
            // mellé folynak be — enélkül a jármű-táblázat sorainak összege
            // nem egyezne a havi grafikon összegével egy ilyen kézi tételnél.
            foreach ($this->egyebJarmuvenkent('kiado', 'kamion_id', $datumTol, $datumIg, $ceg_id, 'uzemanyag') as $id => $osszeg) {
                $uzemanyagKamiononkent[$id] = ($uzemanyagKamiononkent[$id] ?? 0) + $osszeg;
            }
            $uzemanyagPotkocsinkent = $this->egyebJarmuvenkent('kiado', 'potkocsi_id', $datumTol, $datumIg, $ceg_id, 'uzemanyag');

            foreach ($this->egyebJarmuvenkent('kiado', 'kamion_id', $datumTol, $datumIg, $ceg_id, 'karbantartas') as $id => $osszeg) {
                $karbKamiononkent[$id] = ($karbKamiononkent[$id] ?? 0) + $osszeg;
            }
            foreach ($this->egyebJarmuvenkent('kiado', 'potkocsi_id', $datumTol, $datumIg, $ceg_id, 'karbantartas') as $id => $osszeg) {
                $karbPotkocsinkent[$id] = ($karbPotkocsinkent[$id] ?? 0) + $osszeg;
            }

            $biztositasKamiononkent = [];
            $biztositasPotkocsinkent = [];
            foreach ($biztositasTetelek as $t) {
                if ($t['jarmu_tipus'] === 'kamion') {
                    $biztositasKamiononkent[$t['jarmu_id']] = ($biztositasKamiononkent[$t['jarmu_id']] ?? 0) + $t['osszeg'];
                } else {
                    $biztositasPotkocsinkent[$t['jarmu_id']] = ($biztositasPotkocsinkent[$t['jarmu_id']] ?? 0) + $t['osszeg'];
                }
            }
            foreach ($this->egyebJarmuvenkent('kiado', 'kamion_id', $datumTol, $datumIg, $ceg_id, 'biztositas') as $id => $osszeg) {
                $biztositasKamiononkent[$id] = ($biztositasKamiononkent[$id] ?? 0) + $osszeg;
            }
            foreach ($this->egyebJarmuvenkent('kiado', 'potkocsi_id', $datumTol, $datumIg, $ceg_id, 'biztositas') as $id => $osszeg) {
                $biztositasPotkocsinkent[$id] = ($biztositasPotkocsinkent[$id] ?? 0) + $osszeg;
            }

            $bevetelKamiononkent = $egyebBevetelKamiononkent;

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
                $km = $this->kmOsszesito($id, $datumTol, $datumIg);
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
                    // Ft/km — csak akkor számoljuk, ha van legalább 1 lezárt,
                    // gyorsítótárazott nap km-adata (ld. kmOsszesito()); a
                    // `kmLefedettseg` jelzi, ha a cache még hiányos a kért
                    // tartományhoz képest, hogy a frontend ne mutasson
                    // hamis pontosságú, valójában hiányos adatból számolt
                    // fajlagos mutatót magyarázat nélkül.
                    'bevetelPerKm' => $km['km'] > 0 ? round($bevetel / $km['km'], 1) : null,
                    'kiadasPerKm' => $km['km'] > 0 ? round($kiadasOsszesen / $km['km'], 1) : null,
                    'kmLefedettseg' => $km['osszesNap'] > 0 ? round($km['lefedettNapok'] / $km['osszesNap'] * 100) : null,
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
            $osszesenBer = array_sum($berHavonta);
            $osszesenEgyeb = array_sum($egyebKiadasHavonta);
            $osszesenKiadas = $osszesenKarbantartas + $osszesenUzemanyag + $osszesenBiztositas + $osszesenBer + $osszesenEgyeb;

            // Nem-admin kérelmezőnek a bér-RÉSZLETEZÉST rejtjük (ld. fenti
            // komment) — a havi soronkénti `ber` mezőt is nullázzuk, hogy a
            // grafikon se rajzoljon ki egy "Fizetés" oszlopot neki.
            if (!$isAdmin) {
                foreach ($havi as &$honapSor) {
                    $honapSor['ber'] = 0;
                }
                unset($honapSor);
                $osszesenBer = 0;
            }

            return [
                'success' => true,
                'havi' => $havi,
                'jarmuvenkent' => $jarmuvenkent,
                'egyebNemKotott' => ['bevetel' => $egyebNemKotottBevetel, 'kiado' => $egyebNemKotottKiado],
                'osszesen' => [
                    'bevetel' => $osszesenBevetel,
                    'karbantartas' => $osszesenKarbantartas,
                    'uzemanyag' => $osszesenUzemanyag,
                    'biztositas' => $osszesenBiztositas,
                    'ber' => $osszesenBer,
                    'egyeb' => $osszesenEgyeb,
                    'kiadas' => $osszesenKiadas,
                    'netto' => $osszesenBevetel - $osszesenKiadas,
                ],
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A havi bérezés (user.ber + admin.ber) ÉLŐ, aktuális összege — nem az
    // `egyeb_koltsegek`/`getBerKiadasok()` havi-bontású, múltra vonatkozó
    // generált tételeiből, hanem közvetlenül a jelenlegi bér-mezőkből. A
    // "várható eredmény" (Item 3) ezt használja fixköltségként, mert a
    // bérezés valódi FIX (nem átlagolandó) havi kiadás — a múltbeli
    // átlagolás itt épp azt torzítaná el, ha valakinek nemrég változott a
    // bére, vagy új munkatársat vettek fel.
    private function getAktivBerOsszeg($ceg_id) {
        $soforStmt = $this->db->prepare("SELECT COALESCE(SUM(ber), 0) AS osszeg FROM user WHERE admin = :ceg_id AND torolt <> 'I' AND ber IS NOT NULL");
        $soforStmt->bindValue(':ceg_id', $ceg_id);
        $soforStmt->execute();
        $soforBer = (float) $soforStmt->fetch(PDO::FETCH_ASSOC)['osszeg'];

        $csapatStmt = $this->db->prepare("SELECT COALESCE(SUM(ber), 0) AS osszeg FROM admin WHERE (id = :ceg_id OR tulajdonos_admin_id = :ceg_id2) AND torolt <> 'I' AND ber IS NOT NULL");
        $csapatStmt->bindValue(':ceg_id', $ceg_id);
        $csapatStmt->bindValue(':ceg_id2', $ceg_id);
        $csapatStmt->execute();
        $csapatBer = (float) $csapatStmt->fetch(PDO::FETCH_ASSOC)['osszeg'];

        return $soforBer + $csapatBer;
    }

    // Item 9: a jövő hónapra ütemezett, még el nem végzett karbantartások
    // (a `kamion_karbantartars`/`potkocsi_karbantartars` azon sorai, amiket
    // egy korábbi karbantartás rögzítésekor a "következő karbantartás"
    // dátummezője automatikusan generált — ld. karbantartasokInterface.php
    // `updateKamionKarbantartas()` — ezeknek a `datum`-juk a jövőben van,
    // `koltseg`-jük pedig NULL, mert még nem történtek meg) várható
    // költségének becslése. Mivel egy még el nem végzett karbantartásnak
    // definíció szerint nincs rögzített ára, a becslés az adott JÁRMŰ saját
    // korábbi (elvégzett, koltseg IS NOT NULL) karbantartásainak átlagából
    // indul ki; ha a járműnek nincs még egyetlen árazott karbantartása sem,
    // a teljes flotta átlagára esünk vissza — jobb egy durva becslés, mint
    // szó szerint 0 Ft (ami hamis biztonságérzetet adna az előrejelzésben).
    private function getTervezettKarbantartasBecsult($ceg_id, $datumTol, $datumIg) {
        $tetelek = [];
        foreach ([['kamion_karbantartars', 'kamion_id', 'kamion'], ['potkocsi_karbantartars', 'potkocsi_id', 'potkocsi']] as [$tabla, $oszlop, $tipus]) {
            $stmt = $this->db->prepare(
                "SELECT $oszlop AS jarmu_id, log, datum FROM `$tabla`
                 WHERE admin = :ceg_id AND torolt <> 'I' AND koltseg IS NULL AND datum BETWEEN :datumTol AND :datumIg"
            );
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->bindValue(':datumTol', $datumTol);
            $stmt->bindValue(':datumIg', $datumIg);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $row['tipus'] = $tipus;
                $row['tabla'] = $tabla;
                $tetelek[] = $row;
            }
        }

        if (empty($tetelek)) {
            return ['osszeg' => 0, 'tetelSzam' => 0];
        }

        $jarmuAtlag = [];
        foreach (['kamion_karbantartars' => 'kamion_id', 'potkocsi_karbantartars' => 'potkocsi_id'] as $tabla => $oszlop) {
            $stmt = $this->db->prepare(
                "SELECT $oszlop AS jarmu_id, AVG(koltseg) AS atlag FROM `$tabla`
                 WHERE admin = :ceg_id AND torolt <> 'I' AND koltseg IS NOT NULL GROUP BY $oszlop"
            );
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $jarmuAtlag[$tabla . ':' . $row['jarmu_id']] = (float) $row['atlag'];
            }
        }

        // A teljes flotta átlaga — a projekt JOIN/UNION-mentes konvenciója
        // szerint két önálló SELECT, PHP-ban összegezve (nem SQL UNION-nal).
        $flottaOsszeg = 0;
        $flottaDb = 0;
        foreach (['kamion_karbantartars', 'potkocsi_karbantartars'] as $tabla) {
            $stmt = $this->db->prepare(
                "SELECT koltseg FROM `$tabla` WHERE admin = :ceg_id AND torolt <> 'I' AND koltseg IS NOT NULL"
            );
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $koltseg) {
                $flottaOsszeg += (float) $koltseg;
                $flottaDb++;
            }
        }
        $flottaAtlag = $flottaDb > 0 ? $flottaOsszeg / $flottaDb : 0;

        $osszeg = 0;
        foreach ($tetelek as $t) {
            $kulcs = $t['tabla'] . ':' . $t['jarmu_id'];
            $osszeg += $jarmuAtlag[$kulcs] ?? $flottaAtlag;
        }

        return ['osszeg' => round($osszeg, 2), 'tetelSzam' => count($tetelek)];
    }

    // Item 3: "várható eredmény" a következő hónapra — a bevételt az elmúlt
    // 6 LEZÁRT (nem a folyó, részleges) hónap átlagából becsüljük, mert a
    // bevétel hónapról hónapra ingadozik (nincs jobb előrejelzési forrás,
    // mint a közelmúlt átlaga). A fix költségeket (biztosítás + bérek)
    // viszont NEM átlagoljuk ugyanígy — a bérek élő, aktuális összegét
    // használjuk (ld. getAktivBerOsszeg fenti komment), a biztosítást pedig
    // az átlagra hagyjuk, mert az egyes járművek befizetései esedékesség
    // szerint egyenetlenül oszlanak el hónapok között (ld.
    // calculateNextPaymentDate), a 6 havi átlag ezt simítja ki leginkább
    // torzításmentesen anélkül, hogy jármű-szintű esedékesség-számítást
    // kellene újraírni ide.
    //
    // `$isAdmin`: a bérek (mint fixköltség-elem) csak adminnak látszanak és
    // számítanak bele a kiírt "várható eredménybe" — nem-admin kérelmezőnek
    // a bér-sort és -összeget teljesen kihagyjuk a válaszból (nem csak
    // nullázzuk, ld. getKoltsegOsszesito komment), mert egy kombinált
    // "fix költségek" szám a látható biztosítás-chippel együtt könnyen
    // visszafejthető lenne bér-összeggé — ezt itt, a forrásnál kerüljük el.
    public function getVarhatoEredmeny($ceg_id, $isAdmin = false) {
        try {
            $honapEleje = new DateTime('first day of this month');
            $datumIg = (clone $honapEleje)->modify('-1 day');
            $datumTol = (clone $honapEleje)->modify('-6 months');

            $osszesito = $this->getKoltsegOsszesito($ceg_id, $datumTol->format('Y-m-d'), $datumIg->format('Y-m-d'), true);
            if (!$osszesito['success']) {
                return $osszesito;
            }

            $honapokSzama = max(count($osszesito['havi']), 1);
            $atlagBevetel = round($osszesito['osszesen']['bevetel'] / $honapokSzama, 2);
            $atlagBiztositas = round($osszesito['osszesen']['biztositas'] / $honapokSzama, 2);

            // Item 9: a következő naptári hónapra ütemezett, még el nem
            // végzett karbantartások becsült költsége — nem privát adat
            // (ellentétben a bérrel), tehát nem-admin kérelmezőnek is
            // megmutatjuk.
            $kovHonapEleje = (clone $honapEleje)->modify('+1 month');
            $kovHonapVege = (clone $kovHonapEleje)->modify('+1 month')->modify('-1 day');
            $karbantartasBecsult = $this->getTervezettKarbantartasBecsult($ceg_id, $kovHonapEleje->format('Y-m-d'), $kovHonapVege->format('Y-m-d'));

            $result = [
                'success' => true,
                'honapokSzama' => $honapokSzama,
                'datumTol' => $datumTol->format('Y-m-d'),
                'datumIg' => $datumIg->format('Y-m-d'),
                'atlagBevetel' => $atlagBevetel,
                'atlagBiztositas' => $atlagBiztositas,
                'tervezettKarbantartas' => $karbantartasBecsult['osszeg'],
                'tervezettKarbantartasTetelSzam' => $karbantartasBecsult['tetelSzam'],
            ];

            if ($isAdmin) {
                $aktivBer = $this->getAktivBerOsszeg($ceg_id);
                $result['aktivBer'] = $aktivBer;
                $result['fixKoltsegek'] = round($atlagBiztositas + $aktivBer + $karbantartasBecsult['osszeg'], 2);
                $result['varhatoEredmeny'] = round($atlagBevetel - $atlagBiztositas - $aktivBer - $karbantartasBecsult['osszeg'], 2);
            } else {
                $result['fixKoltsegek'] = round($atlagBiztositas + $karbantartasBecsult['osszeg'], 2);
                $result['varhatoEredmeny'] = round($atlagBevetel - $atlagBiztositas - $karbantartasBecsult['osszeg'], 2);
            }

            return $result;
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // --- Egyéb tételek (bevétel/kiadás) — manuális CRUD ---
    // Az opcionális `szamlaszam` mező előkészület egy jövőbeli NAV Online
    // Számla-integrációhoz (a NAV-tól lekérdezett számlák természetes
    // párosítási kulcsa a számlaszám lenne) — ma még nincs tényleges
    // NAV-lekérdezés, csak a mező létezik, kézzel is kitölthető.

    // A négy felismert kategória-érték: 'uzemanyag'/'karbantartas'/
    // 'biztositas'/'ber' — ezzel jelölt kiadás-tételek a Pénzforgalom
    // megfelelő összesítőjébe folynak be (ld. getKoltsegOsszesito), nem a
    // "Kiadás" (kategória nélküli) kártyába. Bármi más értéket a felület
    // küldene, csendben null-ra esik vissza. A 'ber' kategóriát csak admin
    // szerepkör állíthatja be egy tételen (ld. sql/24.sql) — nem-admin
    // kérelmezőnél ez is null-ra esik, ugyanúgy, mint egy ismeretlen érték.
    private function normalizKategoria($kategoria, $isAdmin = false) {
        if ($kategoria === 'ber' && !$isAdmin) {
            return null;
        }
        return in_array($kategoria, self::KATEGORIAK, true) ? $kategoria : null;
    }

    // Deviza-feloldás új/szerkesztett tételhez — HUF esetén (alapértelmezett,
    // ha a `deviza` mező hiányzik) semmi nem változik a korábbi
    // viselkedéshez képest, az `osszeg` mezőt közvetlenül a hívó adja meg.
    // Nem-HUF esetén a `eredeti_osszeg`-et a rögzítés PILLANATÁBAN érvényes
    // MNB-árfolyamon (Piaci árak cache, tetszőleges devizára — ld.
    // piaciArakInterface.php getArfolyam()) váltjuk HUF-ra, és ezt fagyasztjuk
    // be az `osszeg` mezőbe — a Pénzforgalom minden riportja továbbra is
    // egyszerűen ezt az egy HUF-mezőt összegzi, semmilyen aggregáló logikát
    // nem kellett emiatt módosítani.
    private function resolveDevizaOsszeg($data) {
        $deviza = strtoupper(trim($data['deviza'] ?? 'HUF')) ?: 'HUF';
        if ($deviza === 'HUF') {
            return ['osszeg' => $data['osszeg'], 'deviza' => 'HUF', 'eredeti_osszeg' => null, 'arfolyam' => null];
        }

        $eredetiOsszeg = (float) ($data['eredeti_osszeg'] ?? 0);
        if ($eredetiOsszeg <= 0) {
            throw new Exception('Devizás tételnél az eredeti összeg megadása kötelező.');
        }

        global $piaciArakInterface;
        $arfolyam = $piaciArakInterface->getArfolyam($deviza);
        if ($arfolyam === null) {
            throw new Exception("Nem sikerült árfolyamot lekérni ehhez a devizához: $deviza.");
        }

        return [
            'osszeg' => round($eredetiOsszeg * $arfolyam, 2),
            'deviza' => $deviza,
            'eredeti_osszeg' => $eredetiOsszeg,
            'arfolyam' => $arfolyam,
        ];
    }

    public function newEgyebKoltseg($data, $isAdmin = false) {
        try {
            $irany = in_array($data['irany'] ?? null, ['bevetel', 'kiado'], true) ? $data['irany'] : 'kiado';
            $deviza = $this->resolveDevizaOsszeg($data);
            $query = "INSERT INTO egyeb_koltsegek (admin, irany, kategoria, kamion_id, potkocsi_id, datum, megnevezes, szamlaszam, osszeg, deviza, eredeti_osszeg, arfolyam, megjegyzes)
                      VALUES (:admin, :irany, :kategoria, :kamion_id, :potkocsi_id, :datum, :megnevezes, :szamlaszam, :osszeg, :deviza, :eredeti_osszeg, :arfolyam, :megjegyzes)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['ceg_id']);
            $stmt->bindValue(':irany', $irany);
            $stmt->bindValue(':kategoria', $this->normalizKategoria($data['kategoria'] ?? null, $isAdmin));
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':potkocsi_id', empty($data['potkocsi_id']) ? null : $data['potkocsi_id']);
            $stmt->bindValue(':datum', $data['datum']);
            $stmt->bindValue(':megnevezes', $data['megnevezes']);
            $stmt->bindValue(':szamlaszam', $data['szamlaszam'] ?: null);
            $stmt->bindValue(':osszeg', $deviza['osszeg']);
            $stmt->bindValue(':deviza', $deviza['deviza']);
            $stmt->bindValue(':eredeti_osszeg', $deviza['eredeti_osszeg']);
            $stmt->bindValue(':arfolyam', $deviza['arfolyam']);
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
    public function updateEgyebKoltseg($data, $isAdmin = false) {
        try {
            $irany = in_array($data['irany'] ?? null, ['bevetel', 'kiado'], true) ? $data['irany'] : 'kiado';
            $deviza = $this->resolveDevizaOsszeg($data);
            $query = "UPDATE egyeb_koltsegek SET
                        irany = :irany, kategoria = :kategoria, kamion_id = :kamion_id, potkocsi_id = :potkocsi_id,
                        datum = :datum, megnevezes = :megnevezes, szamlaszam = :szamlaszam,
                        osszeg = :osszeg, deviza = :deviza, eredeti_osszeg = :eredeti_osszeg, arfolyam = :arfolyam, megjegyzes = :megjegyzes
                      WHERE id = :id AND admin = :admin";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id']);
            $stmt->bindValue(':admin', $data['ceg_id']);
            $stmt->bindValue(':irany', $irany);
            $stmt->bindValue(':kategoria', $this->normalizKategoria($data['kategoria'] ?? null, $isAdmin));
            $stmt->bindValue(':kamion_id', empty($data['kamion_id']) ? null : $data['kamion_id']);
            $stmt->bindValue(':potkocsi_id', empty($data['potkocsi_id']) ? null : $data['potkocsi_id']);
            $stmt->bindValue(':datum', $data['datum']);
            $stmt->bindValue(':megnevezes', $data['megnevezes']);
            $stmt->bindValue(':szamlaszam', $data['szamlaszam'] ?: null);
            $stmt->bindValue(':osszeg', $deviza['osszeg']);
            $stmt->bindValue(':deviza', $deviza['deviza']);
            $stmt->bindValue(':eredeti_osszeg', $deviza['eredeti_osszeg']);
            $stmt->bindValue(':arfolyam', $deviza['arfolyam']);
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

    // `$kategoria`: a Pénzforgalom oldal kategória-chipjeinek szűrője. Az
    // 'uzemanyag'/'egyeb' a ténylegesen tárolt `kategoria` oszlop-értékek,
    // ezekre valódi szűrés fut. A 'karbantartas'/'biztositas' chipekre
    // szándékosan NEM létezik `egyeb_koltsegek` sor (azok külön táblákból,
    // on-the-fly számolódnak, ld. getKoltsegOsszesito) — ezekre a query
    // egyszerűen üres találati listát ad (nincs ilyen `kategoria` érték a
    // táblában), a frontend ezt ismeri fel és mutat helyette egy rövid
    // eligazító szöveget ("ezek a tételek a Karbantartások/Kamionok oldalon
    // részletesek"), nem hibaüzenetet.
    public function getEgyebKoltsegek($ceg_id, $datumTol = null, $datumIg = null, $irany = null, $search = null, $page = null, $pageSize = null, $kategoria = null, $isAdmin = false) {
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
            if (!empty($kategoria)) {
                if ($kategoria === 'egyeb') {
                    $query .= " AND kategoria IS NULL";
                } else {
                    $query .= " AND kategoria = :kategoria";
                    $params[':kategoria'] = $kategoria;
                }
            }
            // A bérezés-tételek (kategoria = 'ber') listás nézetben is csak
            // adminnak látszanak — ugyanaz a szabály, mint az összesítőben
            // (ld. getKoltsegOsszesito), csak itt a lekérdezés szintjén.
            if (!$isAdmin) {
                $query .= " AND (kategoria IS NULL OR kategoria <> 'ber')";
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
