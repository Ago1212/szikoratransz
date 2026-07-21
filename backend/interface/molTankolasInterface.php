<?php

// MOL üzemanyagkártya "Számla melléklet" PDF import — az admin feltölti a
// MOL-tól kapott, tranzakció-szintű részletező PDF-et (NEM magát a
// számlát), ez kártyaszám/rendszám-blokkonként listázza a tankolásokat
// (dátum, km-óraállás, liter, bruttó összeg). A feldolgozás két lépéses,
// ugyanaz a minta, mint a BankImportInterface::elemezCsv()/alkalmaz()-nál:
// előbb egy előnézeti/egyeztető lista (elemezPdf), amit az admin átnéz és
// jóváhagy, csak utána íródik ténylegesen a `tankolasok` táblába
// (alkalmaz) — sosem automatikus, néma import.
//
// A tényleges HUF-összeg egyelőre KIZÁRÓLAG ide, a `tankolasok` táblába
// kerül be (liter/km-szintű, a meglévő fogyasztás-anomália elemzés ezt
// olvassa) — a Pénzforgalom `egyeb_koltsegek` táblájába NEM ír ez az
// osztály. Ennek oka: `koltsegInterface::getKoltsegOsszesito()` az
// "Üzemanyag" összesítőt a `tankolasok.osszeg` ÉS az `egyeb_koltsegek`
// (kategoria='uzemanyag') összegéből FELTÉTEL NÉLKÜL összeadja — ha
// ugyanennek a MOL-számlának a forint-értéke mindkét táblába bekerülne,
// az duplán számolná be a kiadást. A `szamlaszam` mező (ld. sql/21.sql)
// ettől függetlenül minden importált sorra kitöltve marad, hogy egy
// jövőbeli NAV Online Számla-lekérdezés a saját `egyeb_koltsegek.szamlaszam`
// alapú de-duplikációjával felismerhesse: ez a számla már be van fedve a
// tankolás-oldalról, és NE hozzon létre rá még egy `egyeb_koltsegek` sort.
class MolTankolasInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // Csak azok a termék-kategóriák számítanak tényleges tankolásnak,
    // amiknek mértékegysége liter (DIESEL/AdBlue) — az "OTHER" (pl. éves
    // kártyadíj) darabszámra (DB) menő tétel, nem üzemanyag-mennyiség,
    // ezért kimarad a `tankolasok` importból.
    const TERMEK_KEYWORDS = ['AD BLUE pump', 'DIESEL', 'OTHER'];

    public function elemezPdf($pdfBase64, $ceg_id) {
        $tmpPath = null;
        try {
            $raw = base64_decode((string) $pdfBase64, true);
            if ($raw === false || $raw === '') {
                return ['success' => false, 'message' => 'A feltöltött fájl nem érvényes PDF (base64 dekódolás sikertelen).'];
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'mol_') . '.pdf';
            file_put_contents($tmpPath, $raw);

            $szoveg = $this->pdfSzovegKinyerese($tmpPath);
            if ($szoveg === null) {
                return [
                    'success' => false,
                    'message' => 'A PDF-ből nem sikerült szöveget kinyerni — a szerveren valószínűleg hiányzik a "pdftotext" (poppler-utils) parancs, vagy a fájl nem érvényes/nem szöveges PDF.',
                ];
            }

            return $this->szovegFeldolgozasa($szoveg, $ceg_id);
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        } finally {
            if ($tmpPath !== null && file_exists($tmpPath)) {
                unlink($tmpPath);
            }
        }
    }

    // `pdftotext -layout` a MOL "Számla melléklet" táblázatos elrendezését
    // (kártyaszám-blokkok, egy tranzakció = 2 sor) a lehető legjobban
    // szöveges oszlopokká rendezve adja vissza — enélkül (sima `pdftotext`)
    // a sorok sorrendje/tördelése megbízhatatlan lenne. Nem composer-
    // csomag, hanem a szerveren telepített bináris (ld. `which pdftotext`)
    // — ha hiányzik, ez a metódus NULL-t ad vissza, sosem dob fatal hibát.
    private function pdfSzovegKinyerese($pdfPath) {
        $escaped = escapeshellarg($pdfPath);
        $kimenet = [];
        $returnVar = 0;
        exec("pdftotext -layout $escaped - 2>/dev/null", $kimenet, $returnVar);
        if ($returnVar !== 0 || empty($kimenet)) {
            return null;
        }
        return implode("\n", $kimenet);
    }

    private function szovegFeldolgozasa($szoveg, $ceg_id) {
        $sorok = explode("\n", $szoveg);

        $szamlaszam = null;
        if (preg_match('/^(\d{7,})\s*$/m', $szoveg, $m)) {
            $szamlaszam = $m[1];
        }
        if ($szamlaszam === null) {
            return ['success' => false, 'message' => 'Nem található számlaszám a PDF-ben — ez valószínűleg nem MOL "Számla melléklet" formátumú fájl.'];
        }

        $jarmuTerkep = $this->rendszamJarmuTerkep($ceg_id);
        $marImportalt = $this->marImportaltSlipIdk($ceg_id);

        $rendszam = null;
        $eredmenySorok = [];
        $kihagyottSorSzam = 0;
        $termekNevekById = [];

        for ($i = 0; $i < count($sorok); $i++) {
            $sor = $sorok[$i];

            if (preg_match('/^Kártyaszám:\s*(\S+)\s+Rendszám:\s*(\S*)/u', $sor, $m)) {
                $rendszam = trim($m[2]) !== '' ? trim($m[2]) : null;
                continue;
            }

            if (!preg_match('/^(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})\s+(.*)$/u', $sor, $m)) {
                continue;
            }
            $datum = $m[1];
            $ido = $m[2];
            $rest = $m[3];

            $horgonyPoz = null;
            $horgonyKw = null;
            foreach (self::TERMEK_KEYWORDS as $kw) {
                $pos = strpos($rest, $kw);
                if ($pos !== false && ($horgonyPoz === null || $pos < $horgonyPoz)) {
                    $horgonyPoz = $pos;
                    $horgonyKw = $kw;
                }
            }
            if ($horgonyPoz === null) {
                $kihagyottSorSzam++;
                continue;
            }

            $elotte = trim(substr($rest, 0, $horgonyPoz));
            $utana = trim(substr($rest, $horgonyPoz + strlen($horgonyKw)));

            $elotteTokenek = preg_split('/\s+/', $elotte, -1, PREG_SPLIT_NO_EMPTY);
            $kmNyers = null;
            $slipId = null;
            if (count($elotteTokenek) === 1) {
                $slipId = $elotteTokenek[0];
            } elseif (count($elotteTokenek) >= 2) {
                $kmNyers = $elotteTokenek[0];
                $slipId = $elotteTokenek[1];
            }

            $utanaTokenek = preg_split('/\s+/', $utana, -1, PREG_SPLIT_NO_EMPTY);
            if (count($utanaTokenek) < 6 || $slipId === null) {
                $kihagyottSorSzam++;
                continue;
            }
            $termekId = $utanaTokenek[0];
            $me = $utanaTokenek[1];
            $mennyisegNyers = $utanaTokenek[2];
            $n = count($utanaTokenek);
            $szlaBruttoNyers = $utanaTokenek[$n - 1];

            // Csak a liter-alapú (tényleges üzemanyag/AdBlue) tételeket
            // importáljuk a tankolasok táblába — ld. TERMEK_KEYWORDS komment.
            if (strtoupper($me) !== 'L') {
                $kihagyottSorSzam++;
                continue;
            }

            $helyszin = null;
            $termekNev = null;
            if (isset($sorok[$i + 1])) {
                $kovetkezo = trim($sorok[$i + 1]);
                $reszek = preg_split('/\s{2,}/u', $kovetkezo);
                $helyszin = $reszek[0] ?? null;
                if (count($reszek) >= 2) {
                    $termekNev = $reszek[1];
                } elseif ($helyszin !== null && isset($termekNevekById[$termekId])) {
                    $ismertNev = $termekNevekById[$termekId];
                    if (str_ends_with($helyszin, $ismertNev)) {
                        $helyszin = trim(substr($helyszin, 0, -strlen($ismertNev)));
                        $termekNev = $ismertNev;
                    }
                }
                if ($termekNev !== null) {
                    $termekNevekById[$termekId] = $termekNev;
                }
            }

            // A "," és a néhány (1-3) jegyű "km" érték is megbízhatatlan
            // MOL-oldali placeholder ("nincs olvasat"), nem valódi
            // óraállás — élő mintaadaton (KOA657 2026.07.06-i tranzakció)
            // megerősítve: a "km" oszlopban szereplő "1" a következő,
            // 379161-es olvasással összevetve nyilvánvalóan nem valós.
            $km = ($kmNyers !== null && ctype_digit($kmNyers) && (int) $kmNyers >= 1000) ? (int) $kmNyers : null;

            $normalizaltRendszam = $this->normalizaltRendszam($rendszam);
            $jarmu = $normalizaltRendszam !== null ? ($jarmuTerkep[$normalizaltRendszam] ?? null) : null;

            $eredmenySorok[] = [
                'datum' => "$datum $ido:00",
                'rendszamNyers' => $rendszam,
                'jarmuTipus' => $jarmu['tipus'] ?? null,
                'jarmuId' => $jarmu['id'] ?? null,
                'kmOraallas' => $km,
                'molSlipId' => $slipId,
                'termek' => $termekNev ?? $horgonyKw,
                'liter' => (float) str_replace(',', '', $mennyisegNyers),
                'osszeg' => (float) str_replace(',', '', $szlaBruttoNyers),
                'helyszin' => $helyszin,
                'szamlaszam' => $szamlaszam,
                'marImportalva' => isset($marImportalt[$slipId]),
            ];
        }

        return [
            'success' => true,
            'szamlaszam' => $szamlaszam,
            'sorok' => $eredmenySorok,
            'kihagyottSorSzam' => $kihagyottSorSzam,
        ];
    }

    // Kártyaszám->rendszám a PDF-ben mindig szerepel, de a kötőjel/szóköz
    // írásmódja eltérhet a rendszertörzstől (pl. PDF "RLP018", DB
    // "RLP-018") — ezért mindkét oldalt csak alfanumerikus, nagybetűs
    // formára hozva hasonlítjuk össze.
    private function normalizaltRendszam($rendszam) {
        if ($rendszam === null || trim($rendszam) === '') {
            return null;
        }
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $rendszam));
    }

    private function rendszamJarmuTerkep($ceg_id) {
        $terkep = [];

        $stmt = $this->db->prepare("SELECT id, rendszam FROM kamion WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $key = $this->normalizaltRendszam($row['rendszam']);
            if ($key !== null) {
                $terkep[$key] = ['tipus' => 'kamion', 'id' => (int) $row['id']];
            }
        }

        $stmt = $this->db->prepare("SELECT id, rendszam FROM furgon WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $key = $this->normalizaltRendszam($row['rendszam']);
            if ($key !== null) {
                $terkep[$key] = ['tipus' => 'furgon', 'id' => (int) $row['id']];
            }
        }

        return $terkep;
    }

    private function marImportaltSlipIdk($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT mol_slip_id FROM tankolasok WHERE admin = :ceg_id AND torolt <> 'I' AND mol_slip_id IS NOT NULL"
        );
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        return array_flip(array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'mol_slip_id'));
    }

    // `$sorok` — a frontend előnézeti listáján az admin által jóváhagyott,
    // importálásra jelölt tételek: [{datum, jarmuTipus, jarmuId, kmOraallas,
    // molSlipId, liter, osszeg, helyszin, szamlaszam}, ...] — a `jarmuTipus`/
    // `jarmuId`-t a frontend engedi kézzel felülírni azoknál a soroknál,
    // ahol az automatikus rendszám-egyeztetés nem talált jármüvet.
    public function alkalmaz($sorok, $ceg_id) {
        $eredmeny = ['sikeres' => 0, 'kihagyva' => 0, 'marVolt' => 0, 'hiba' => 0];

        $insert = $this->db->prepare(
            "INSERT INTO tankolasok (admin, sofor_id, kamion_id, furgon_id, datum, liter, egysegar, osszeg, km_oraallas, helyszin, szamlaszam, mol_slip_id)
             VALUES (:admin, NULL, :kamion_id, :furgon_id, :datum, :liter, :egysegar, :osszeg, :km_oraallas, :helyszin, :szamlaszam, :mol_slip_id)"
        );

        foreach ($sorok as $sor) {
            try {
                if (empty($sor['betoltendo'])) {
                    $eredmeny['kihagyva']++;
                    continue;
                }
                if (empty($sor['molSlipId']) || empty($sor['liter']) || empty($sor['datum'])) {
                    $eredmeny['hiba']++;
                    continue;
                }
                if (empty($sor['jarmuId']) || !in_array($sor['jarmuTipus'] ?? null, ['kamion', 'furgon'], true)) {
                    $eredmeny['hiba']++;
                    continue;
                }

                $liter = (float) $sor['liter'];
                $osszeg = isset($sor['osszeg']) ? (float) $sor['osszeg'] : null;
                $egysegar = ($osszeg !== null && $liter > 0) ? round($osszeg / $liter, 3) : null;

                $insert->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
                $insert->bindValue(':kamion_id', $sor['jarmuTipus'] === 'kamion' ? (int) $sor['jarmuId'] : null, $sor['jarmuTipus'] === 'kamion' ? PDO::PARAM_INT : PDO::PARAM_NULL);
                $insert->bindValue(':furgon_id', $sor['jarmuTipus'] === 'furgon' ? (int) $sor['jarmuId'] : null, $sor['jarmuTipus'] === 'furgon' ? PDO::PARAM_INT : PDO::PARAM_NULL);
                $insert->bindValue(':datum', $sor['datum']);
                $insert->bindValue(':liter', $liter);
                $insert->bindValue(':egysegar', $egysegar);
                $insert->bindValue(':osszeg', $osszeg);
                $insert->bindValue(':km_oraallas', empty($sor['kmOraallas']) ? null : (int) $sor['kmOraallas'], empty($sor['kmOraallas']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $insert->bindValue(':helyszin', $sor['helyszin'] ?? null);
                $insert->bindValue(':szamlaszam', $sor['szamlaszam'] ?? null);
                $insert->bindValue(':mol_slip_id', $sor['molSlipId']);
                $insert->execute();

                $eredmeny['sikeres']++;
            } catch (PDOException $e) {
                // UNIQUE KEY (admin, mol_slip_id) ütközés — ugyanezt a
                // tranzakciót korábban már importáltuk (pl. a PDF véletlen
                // kétszeri feltöltése). Nem hiba, csak nem-ismételt import.
                if ((int) $e->getCode() === 23000) {
                    $eredmeny['marVolt']++;
                } else {
                    $eredmeny['hiba']++;
                }
            } catch (Exception $e) {
                $eredmeny['hiba']++;
            }
        }

        return ['success' => true, 'eredmeny' => $eredmeny];
    }
}

$molTankolasInterface = new MolTankolasInterface();
