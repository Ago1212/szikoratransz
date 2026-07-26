<?php

// Fejlesztési javaslat (2026-07-20): bankszámla-kivonat CSV import és
// automatikus párosítás a Pénzforgalom `egyeb_koltsegek` tételeihez.
// Ugyanazt a "digest, admin dönt" mintát követi, mint a NAV Online Számla
// import (navSzamlaInterface.php) — `elemezCsv()` semmit nem ír az
// adatbázisba, csak egy javaslat-listát ad vissza; a tényleges
// összepárosítás/új tétel létrehozás csak `alkalmaz()`-on, admin explicit
// döntése alapján történik.
//
// Nincs egyetlen "a" magyar banki CSV-formátum — a bankok (OTP, K&H, Erste,
// Raiffeisen stb.) eltérő oszlop-elrendezéssel exportálnak. Ahelyett, hogy
// egy adott bank formátumát próbálná kitalálni/hardcode-olni (ami a többi
// banknál csendben rossz eredményt adna), a admin explicit megmondja, melyik
// CSV-oszlop melyik mező (dátum/összeg/közlemény) — ld. `$oszlopok` paraméter.
class BankImportInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // `$oszlopok` = ['datum' => 0, 'osszeg' => 2, 'kozlemeny' => 4] — a CSV
    // fejléc utáni sorok megfelelő index-oszlopai (frontend a fejléc
    // előnézete alapján állítja össze). `$fajlnev`/`$feltolto*` — a nyers
    // CSV a "Fájlok" központi fájlkezelőbe is bekerül (ld.
    // FilesInterface::fileUpload(), `tabla='bank_import'`), FÜGGETLENÜL
    // attól, hogy az admin később ténylegesen alkalmazza-e az importot —
    // egy elemzett, de el nem fogadott feltöltés is valódi feltöltés volt.
    public function elemezCsv($csvSzoveg, $oszlopok, $ceg_id, $fajlnev = null, $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null) {
        try {
            if (empty($oszlopok['datum']) && $oszlopok['datum'] !== 0) {
                return ['success' => false, 'message' => 'Nincs kiválasztva dátum-oszlop.'];
            }
            if (empty($oszlopok['osszeg']) && $oszlopok['osszeg'] !== 0) {
                return ['success' => false, 'message' => 'Nincs kiválasztva összeg-oszlop.'];
            }

            $sorok = $this->parseCsv($csvSzoveg);
            if (count($sorok) < 2) {
                return ['success' => false, 'message' => 'A CSV üres, vagy csak a fejlécet tartalmazza.'];
            }
            array_shift($sorok); // fejléc sor kihagyása

            $digest = [];
            $kihagyottSorSzam = 0;
            $mar_feldolgozott = 0;
            foreach ($sorok as $sor) {
                if (empty(array_filter($sor, fn($cella) => trim((string) $cella) !== ''))) {
                    continue; // teljesen üres sor
                }

                $datum = $this->normalizalDatum($sor[$oszlopok['datum']] ?? '');
                $osszeg = $this->normalizalOsszeg($sor[$oszlopok['osszeg']] ?? '');
                $kozlemeny = isset($oszlopok['kozlemeny']) && $oszlopok['kozlemeny'] !== ''
                    ? trim((string) ($sor[$oszlopok['kozlemeny']] ?? ''))
                    : '';

                if ($datum === null || $osszeg === null) {
                    $kihagyottSorSzam++;
                    continue;
                }

                $hash = hash('sha256', $datum . '|' . $osszeg . '|' . $kozlemeny);
                if ($this->marFeldolgozva($ceg_id, $hash)) {
                    $mar_feldolgozott++;
                    continue;
                }

                $digest[] = [
                    'datum' => $datum,
                    'osszeg' => $osszeg,
                    'kozlemeny' => $kozlemeny,
                    'hash' => $hash,
                    'javasoltTetel' => $this->keresJavasoltPart($ceg_id, $datum, $osszeg),
                    // Fuvar-számla párosítás (2026-07-26): nincs Számlázz.hu/NAV
                    // API-integráció, a fuvarok.szamlaszam-ot az admin kézzel
                    // rögzíti (ld. hozzarendelFuvarSzamlaszamot) — az egyetlen
                    // megbízható jel egy beérkező utalás párosításához az, ha a
                    // bank "közlemény" mezője tartalmazza ezt a számlaszámot
                    // (magyar banki gyakorlat szerint ez szokásos). Összeg/dátum
                    // alapú egyeztetés N:1 (egy számlaszám több fuvaron) esetén
                    // nem megbízható, ezért csak informatív, nem szűrőfeltétel.
                    'javasoltFuvarSzamlaszam' => $this->keresFuvarSzamlaszamAlapjan($ceg_id, $kozlemeny),
                ];
            }

            $this->mentsNyersFajlt($ceg_id, $csvSzoveg, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev);

            return [
                'success' => true,
                'sorok' => $digest,
                'kihagyottSorSzam' => $kihagyottSorSzam,
                'marFeldolgozottSorSzam' => $mar_feldolgozott,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A sikeresen elemzett nyers CSV elmentése a központi Fájlok
    // fájlkezelőbe — csendben elnyeli a hibát (pl. ismeretlen kiterjesztés,
    // ha az admin fájlneve nem `.csv`-re végződik), mert egy fájl-mentési
    // gond sosem akaszthatja meg a már sikeresen lefutott CSV-elemzést.
    private function mentsNyersFajlt($ceg_id, $csvSzoveg, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev) {
        global $filesInterface;
        $nev = $fajlnev ?: 'bank_import.csv';
        $base64 = base64_encode($csvSzoveg);
        $filesInterface->fileUpload($ceg_id, 'bank_import', $ceg_id, $base64, $nev, strlen($csvSzoveg), null, $feltoltoTipus, $feltoltoId, $feltoltoNev);
    }

    // +/- 5 nap dátum-ablak, +/- 1 Ft kerekítési tolerancia az összegen (a
    // devizás tételeknél a tárolt `osszeg` már HUF-ra átváltva, kerekítve
    // van, ld. koltsegInterface "Deviza" komment) — a legközelebbi dátumú,
    // majd legközelebbi összegű még nem bank-igazolt tételt javasolja, sosem
    // automatikusan alkalmazza.
    private function keresJavasoltPart($ceg_id, $datum, $osszeg) {
        $stmt = $this->db->prepare(
            "SELECT id, megnevezes, datum, osszeg, irany FROM egyeb_koltsegek
             WHERE admin = :admin AND torolt <> 'I' AND bank_parositva <> 'I'
               AND ABS(osszeg - :osszeg) <= 1
               AND ABS(DATEDIFF(datum, :datum)) <= 5
             ORDER BY ABS(DATEDIFF(datum, :datum2)) ASC, ABS(osszeg - :osszeg2) ASC
             LIMIT 1"
        );
        $stmt->bindValue(':admin', $ceg_id);
        $stmt->bindValue(':osszeg', abs($osszeg));
        $stmt->bindValue(':osszeg2', abs($osszeg));
        $stmt->bindValue(':datum', $datum);
        $stmt->bindValue(':datum2', $datum);
        $stmt->execute();
        $talalat = $stmt->fetch(PDO::FETCH_ASSOC);
        return $talalat ?: null;
    }

    // Az admin cégéhez tartozó, még nem teljesített ('szamlazva' vagy
    // 'fizetesre_var' állapotú) fuvarok számlaszámai közül visszaadja azt,
    // amelyik szó szerint szerepel a bank "közlemény" szövegében — vagy
    // `null`-t, ha egyik sem egyezik. Csak akkor fut le értelmesen, ha a
    // közlemény nem üres.
    private function keresFuvarSzamlaszamAlapjan($ceg_id, $kozlemeny) {
        $kozlemeny = trim((string) $kozlemeny);
        if ($kozlemeny === '') {
            return null;
        }
        $stmt = $this->db->prepare(
            "SELECT DISTINCT szamlaszam FROM fuvarok
             WHERE admin = :admin AND torolt <> 'I' AND szamlaszam IS NOT NULL
               AND allapot IN ('szamlazva', 'fizetesre_var')"
        );
        $stmt->bindValue(':admin', $ceg_id);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $szamlaszam) {
            if ($szamlaszam !== '' && mb_stripos($kozlemeny, $szamlaszam) !== false) {
                return $szamlaszam;
            }
        }
        return null;
    }

    private function marFeldolgozva($ceg_id, $hash) {
        $stmt = $this->db->prepare("SELECT id FROM bank_import_tetelek WHERE admin = :admin AND tetel_hash = :hash");
        $stmt->bindValue(':admin', $ceg_id);
        $stmt->bindValue(':hash', $hash);
        $stmt->execute();
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // `$sorok` — a frontend review-listán admin által jóváhagyott döntések:
    // [{datum, osszeg, kozlemeny, hash, akcio: 'parosit'|'uj'|'skip', tetelId?}, ...]
    // MINDEN sorra (a kihagyottra is) rögzítünk egy `bank_import_tetelek`
    // sort, hogy egy jövőbeli, átfedő időszakú újra-feltöltés ne ajánlja fel
    // újra ugyanazt a bank-sort (ld. marFeldolgozva()).
    public function alkalmaz($sorok, $ceg_id) {
        $eredmeny = ['parositva' => 0, 'ujTetel' => 0, 'kihagyva' => 0, 'fuvarTeljesitve' => 0, 'hiba' => 0];
        foreach ($sorok as $sor) {
            try {
                $akcio = $sor['akcio'] ?? 'skip';
                $egyebKoltsegId = null;

                if ($akcio === 'parositFuvar') {
                    $szamlaszam = trim((string) ($sor['javasoltFuvarSzamlaszam'] ?? ''));
                    if ($szamlaszam === '') {
                        $eredmeny['hiba']++;
                        continue;
                    }
                    // Minden, ugyanezt a számlaszámot viselő fuvar egyszerre vált
                    // Teljesítve-re — N:1 kapcsolat (ld. hozzarendelFuvarSzamlaszamot).
                    $upd = $this->db->prepare(
                        "UPDATE fuvarok SET allapot = 'teljesitve' WHERE admin = :admin AND torolt <> 'I' AND szamlaszam = :szamlaszam"
                    );
                    $upd->bindValue(':admin', $ceg_id);
                    $upd->bindValue(':szamlaszam', $szamlaszam);
                    $upd->execute();
                    if ($upd->rowCount() === 0) {
                        $eredmeny['hiba']++;
                        continue;
                    }
                    $eredmeny['fuvarTeljesitve']++;
                    $naploAkcio = 'fuvar_teljesitve';
                } elseif ($akcio === 'parosit') {
                    if (empty($sor['tetelId'])) {
                        $eredmeny['hiba']++;
                        continue;
                    }
                    $upd = $this->db->prepare("UPDATE egyeb_koltsegek SET bank_parositva = 'I' WHERE id = :id AND admin = :admin");
                    $upd->bindValue(':id', $sor['tetelId']);
                    $upd->bindValue(':admin', $ceg_id);
                    $upd->execute();
                    if ($upd->rowCount() === 0) {
                        $eredmeny['hiba']++;
                        continue;
                    }
                    $egyebKoltsegId = $sor['tetelId'];
                    $eredmeny['parositva']++;
                    $naploAkcio = 'parositva';
                } elseif ($akcio === 'uj') {
                    $irany = ($sor['osszeg'] ?? 0) >= 0 ? 'bevetel' : 'kiado';
                    $ins = $this->db->prepare(
                        "INSERT INTO egyeb_koltsegek (admin, irany, datum, megnevezes, osszeg, bank_parositva)
                         VALUES (:admin, :irany, :datum, :megnevezes, :osszeg, 'I')"
                    );
                    $ins->bindValue(':admin', $ceg_id);
                    $ins->bindValue(':irany', $irany);
                    $ins->bindValue(':datum', $sor['datum']);
                    $ins->bindValue(':megnevezes', ($sor['kozlemeny'] ?? '') !== '' ? mb_substr($sor['kozlemeny'], 0, 200) : 'Bank tétel');
                    $ins->bindValue(':osszeg', abs($sor['osszeg']));
                    $ins->execute();
                    $egyebKoltsegId = $this->db->lastInsertId();
                    $eredmeny['ujTetel']++;
                    $naploAkcio = 'uj_tetel';
                } else {
                    $eredmeny['kihagyva']++;
                    $naploAkcio = 'kihagyva';
                }

                $log = $this->db->prepare(
                    "INSERT INTO bank_import_tetelek (admin, datum, osszeg, kozlemeny, tetel_hash, akcio, egyeb_koltseg_id)
                     VALUES (:admin, :datum, :osszeg, :kozlemeny, :hash, :akcio, :egyeb_koltseg_id)
                     ON DUPLICATE KEY UPDATE akcio = :akcio2, egyeb_koltseg_id = :egyeb_koltseg_id2"
                );
                $log->bindValue(':admin', $ceg_id);
                $log->bindValue(':datum', $sor['datum']);
                $log->bindValue(':osszeg', $sor['osszeg']);
                $log->bindValue(':kozlemeny', $sor['kozlemeny'] ?? null);
                $log->bindValue(':hash', $sor['hash']);
                $log->bindValue(':akcio', $naploAkcio);
                $log->bindValue(':egyeb_koltseg_id', $egyebKoltsegId);
                $log->bindValue(':akcio2', $naploAkcio);
                $log->bindValue(':egyeb_koltseg_id2', $egyebKoltsegId);
                $log->execute();
            } catch (Exception $e) {
                $eredmeny['hiba']++;
            }
        }
        return ['success' => true, 'eredmeny' => $eredmeny];
    }

    // Magyar banki export gyakori dátumformátumai: 2026.07.20, 2026-07-20,
    // 2026/07/20 (év-hónap-nap sorrend, csak az elválasztó tér el).
    private function normalizalDatum($nyers) {
        $nyers = trim((string) $nyers);
        if ($nyers === '') {
            return null;
        }
        $nyers = str_replace(['.', '/'], '-', $nyers);
        $nyers = rtrim($nyers, '-');
        $ts = strtotime($nyers);
        if ($ts === false) {
            return null;
        }
        return date('Y-m-d', $ts);
    }

    // Magyar számformátum: "12 500,00" / "12.500,00" -> 12500.00. Ha mindkét
    // elválasztó (pont és vessző) szerepel, a pontot ezres-elválasztónak,
    // a vesszőt tizedesvesszőnek vesszük — ha csak vessző van, azt tizedesre
    // cseréljük.
    private function normalizalOsszeg($nyers) {
        $nyers = trim((string) $nyers);
        if ($nyers === '') {
            return null;
        }
        $nyers = str_replace([' ', "\xc2\xa0"], '', $nyers);
        if (strpos($nyers, ',') !== false && strpos($nyers, '.') !== false) {
            $nyers = str_replace('.', '', $nyers);
            $nyers = str_replace(',', '.', $nyers);
        } elseif (strpos($nyers, ',') !== false) {
            $nyers = str_replace(',', '.', $nyers);
        }
        if (!is_numeric($nyers)) {
            return null;
        }
        return (float) $nyers;
    }

    // A tizedesvessző Excel-hu exportnál gyakran ütközik a CSV alap `,`
    // elválasztójával — a bankok emiatt jellemzően `;`-t használnak. Nem
    // feltételezzük egyiket sem: a szövegben gyakoribb karaktert vesszük
    // elválasztónak.
    private function parseCsv($csvSzoveg) {
        $csvSzoveg = preg_replace('/^\xEF\xBB\xBF/', '', $csvSzoveg);
        $elvalaszto = substr_count($csvSzoveg, ';') > substr_count($csvSzoveg, ',') ? ';' : ',';
        $sorok = [];
        foreach (preg_split('/\r\n|\r|\n/', trim($csvSzoveg)) as $sor) {
            if ($sor === '') {
                continue;
            }
            $sorok[] = str_getcsv($sor, $elvalaszto);
        }
        return $sorok;
    }
}

$bankImportInterface = new BankImportInterface();
