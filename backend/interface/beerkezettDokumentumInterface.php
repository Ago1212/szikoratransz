<?php

require_once __DIR__ . '/../GeminiOcrClient.php';

// "Beérkezett dokumentumok" inbox — a fuvarlevél/szállítólevél OCR-alapú
// beérkeztetése, ld. docs/superpowers/specs/2026-07-25-fuvar-dokumentum-
// ocr-design.md 5. pont. Ugyanaz a "digest, admin dönt" kétlépéses minta,
// mint a MolTankolasInterface/BankImportInterface/TachografInterface-nél,
// EGY tudatos eltéréssel: a feltöltés MINDIG perzisztálódik, még akkor is,
// ha az OCR sikertelen (kvóta-limit/hálózati hiba) — a dokumentum sose
// veszhet el, admin kézzel pótolja a hiányzó mezőket. A többi importnál
// (MOL/Bank/Tachográf) egy sikertelen elemzés semmit nem ment el; itt ez
// a viselkedés szándékosan más.
class BeerkezettDokumentumInterface {
    protected $db;

    const RENDEZHETO_OSZLOPOK = [
        'letrehozva' => 'bd.letrehozva',
        'tipus' => 'bd.tipus',
    ];

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // A feltöltés MINDIG gyors — az OCR (Gemini-hívás) a háttérben, egy
    // külön processzben fut le (ld. dolgozzFel() lentebb és
    // backend/cli/ocr_feldolgozas.php), hogy a sofőr/admin ne várjon
    // 3-13+ másodpercet a válaszra. Ez a metódus csak a fájlt tölti fel és
    // létrehozza a sort 'feldolgozatlan' állapotban — semmilyen OCR-hívás
    // nincs benne.
    public function letrehozFeldolgozatlan($base64, $fajlnev, $ceg_id, $feltoltoTipus, $feltoltoId, $feltoltoNev) {
        global $filesInterface;

        $raw = base64_decode((string) $base64, true);
        if ($raw === false || $raw === '') {
            return ['success' => false, 'message' => 'A feltöltött fájl nem érvényes.'];
        }

        $nev = $fajlnev ?: 'beerkezett_dokumentum';
        $feltoltEredmeny = $filesInterface->fileUpload($ceg_id, 'beerkezett_dokumentum', $ceg_id, $base64, $nev, strlen($raw), null, $feltoltoTipus, $feltoltoId, $feltoltoNev);
        if (empty($feltoltEredmeny['success'])) {
            return ['success' => false, 'message' => $feltoltEredmeny['message'] ?? 'A fájl mentése sikertelen.'];
        }
        $fajlId = $feltoltEredmeny['id'];

        $stmt = $this->db->prepare(
            "INSERT INTO beerkezett_dokumentumok (admin, fajl_id, tipus, ocr_allapot, ocr_adatok, feltolto_tipus, feltolto_id, feltolto_nev, hozzarendelt_sofor_id)
             VALUES (:admin, :fajl_id, 'ismeretlen', 'feldolgozatlan', NULL, :feltolto_tipus, :feltolto_id, :feltolto_nev, NULL)"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':fajl_id', $fajlId, PDO::PARAM_INT);
        $stmt->bindValue(':feltolto_tipus', $feltoltoTipus);
        $stmt->bindValue(':feltolto_id', $feltoltoId);
        $stmt->bindValue(':feltolto_nev', $feltoltoNev);
        $stmt->execute();

        $dokumentumId = $this->db->lastInsertId();
        return ['success' => true, 'dokumentum' => [
            'id' => (int) $dokumentumId,
            'fajl_id' => (int) $fajlId,
            'tipus' => 'ismeretlen',
            'ocr_allapot' => 'feldolgozatlan',
            'ocr_adatok' => null,
            'hozzarendelt_sofor_id' => null,
        ]];
    }

    // Ezt a metódust a HTTP-kéréstől függetlenül, egy külön, elszakított
    // PHP-processz hívja (backend/cli/ocr_feldolgozas.php) — SOSEM a
    // letrehozFeldolgozatlan()-t kiszolgáló kérésen belül. A fizikai fájlt
    // közvetlenül a `fajlok.hely` oszlopból olvassuk (a projekt saját
    // SQL-lintere miatt JOIN nélkül, két külön lekérdezéssel, ugyanaz a
    // minta, mint fajlnevekFeloldasa()-nál), nem a base64-kódoló
    // filesInterface::downloadFile()-on át, ami felesleges kódolási kör
    // lenne. Az egész törzs try/catch-ben: bármilyen kivétel (hálózati
    // hiba, hiányzó Gemini-kulcs, pdftoppm hiba) 'hiba' állapotra állítja a
    // sort — SOSEM maradhat 'feldolgozatlan'-on egy elszállt hívás után.
    public function dolgozzFel($dokumentumId) {
        global $apiConfig;

        $stmt = $this->db->prepare(
            "SELECT id, admin, fajl_id FROM beerkezett_dokumentumok WHERE id = :id AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $dokumentumId, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($sor === false) {
            return;
        }

        $fajlStmt = $this->db->prepare("SELECT hely, filename FROM fajlok WHERE sorszam = :sorszam");
        $fajlStmt->bindValue(':sorszam', $sor['fajl_id'], PDO::PARAM_INT);
        $fajlStmt->execute();
        $fajl = $fajlStmt->fetch(PDO::FETCH_ASSOC);
        if ($fajl === false || !file_exists($fajl['hely'])) {
            $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
            return;
        }

        $tmpKepPath = null;
        try {
            $kiterjesztes = strtolower(pathinfo((string) $fajl['filename'], PATHINFO_EXTENSION));

            if ($kiterjesztes === 'pdf') {
                $tmpKepPath = $this->pdfElsoOldalKepe($fajl['hely']);
                if ($tmpKepPath === null) {
                    $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
                    return;
                }
                $kepBytes = file_get_contents($tmpKepPath);
                $kepMime = 'image/png';
            } else {
                $kepBytes = file_get_contents($fajl['hely']);
                $kepMime = $this->kepMimeTipusa($kepBytes, $kiterjesztes);
            }

            $sajatCegnev = $this->sajatCegnev($sor['admin']);
            $geminiKulcsok = $apiConfig['geminiApiKeys'] ?? [];

            $adatok = null;
            if (!empty($geminiKulcsok)) {
                $client = new GeminiOcrClient($geminiKulcsok);
                $adatok = $client->extractFuvarAdatok($kepBytes, $kepMime, $sajatCegnev);
            }

            if ($adatok === null) {
                $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
                return;
            }

            $tipus = $adatok['tipus'] ?? 'ismeretlen';
            if (!in_array($tipus, ['fuvarlevel', 'szallitolevel', 'ismeretlen'], true)) {
                $tipus = 'ismeretlen';
            }

            $hozzarendeltSoforId = null;
            if (!empty($adatok['sofor_neve'])) {
                $hozzarendeltSoforId = $this->keresSoforNevAlapjan($sor['admin'], $adatok['sofor_neve']);
            }

            $this->frissitAllapot($dokumentumId, 'kesz', $tipus, $adatok, $hozzarendeltSoforId);
        } catch (\Throwable $e) {
            error_log('BeerkezettDokumentumInterface::dolgozzFel hiba (id=' . $dokumentumId . '): ' . $e->getMessage());
            $this->frissitAllapot($dokumentumId, 'hiba', 'ismeretlen', null, null);
        } finally {
            if ($tmpKepPath !== null && file_exists($tmpKepPath)) {
                unlink($tmpKepPath);
            }
        }
    }

    // Csak akkor írjuk felül a `tipus`-t, ha még nincs admin/OCR által
    // eldöntve ('ismeretlen') — és a sofőr-hozzárendelést csak akkor, ha
    // még nincs kézzel beállítva (COALESCE) — hogy egy admin által a
    // review-panelen KÉZZEL módosított típus/sofőr ne vesszen el egy
    // közben lefutó (retry vagy csak lassú) háttér-OCR alatt. A
    // `WHERE ocr_allapot = 'feldolgozatlan'` biztosítja, hogy egy már
    // befejezett (`kesz`/`hiba`) sort ne írjon felül egy késve érkező/
    // duplikált háttérfolyamat.
    private function frissitAllapot($id, $ocrAllapot, $tipus, $adatok, $hozzarendeltSoforId) {
        $stmt = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok
             SET tipus = CASE WHEN tipus = 'ismeretlen' THEN :tipus ELSE tipus END,
                 ocr_allapot = :ocr_allapot,
                 ocr_adatok = :ocr_adatok,
                 hozzarendelt_sofor_id = COALESCE(hozzarendelt_sofor_id, :hozzarendelt_sofor_id)
             WHERE id = :id AND ocr_allapot = 'feldolgozatlan'"
        );
        $stmt->bindValue(':tipus', $tipus);
        $stmt->bindValue(':ocr_allapot', $ocrAllapot);
        $stmt->bindValue(':ocr_adatok', $adatok !== null ? json_encode($adatok, JSON_UNESCAPED_UNICODE) : null);
        $stmt->bindValue(':hozzarendelt_sofor_id', $hozzarendeltSoforId, $hozzarendeltSoforId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
    }

    // Admin-akció (review-panel "Újrapróbálás" gomb) — visszaállítja a sort
    // 'feldolgozatlan'-ra, az ApiHandler ez után egy új háttérfolyamatot
    // indít (dolgozzFel() ugyanígy fut le, mint az első feltöltésnél).
    public function ujraprobal($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id FROM beerkezett_dokumentumok WHERE id = :id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        if ($stmt->fetch(PDO::FETCH_ASSOC) === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }

        $update = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok SET ocr_allapot = 'feldolgozatlan', ocr_adatok = NULL WHERE id = :id AND admin = :admin"
        );
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $update->execute();

        return ['success' => true, 'message' => 'Újrafeldolgozás elindítva.'];
    }

    // Whole-branch review Minor finding: a kép MIME-típusát korábban
    // kizárólag a feltöltött fájlnév kiterjesztéséből találtuk ki (pl. egy
    // ".jpg"-re átnevezett PNG "image/jpeg"-ként ment volna a Gemini
    // OCR-hívásba). A `finfo` (core PHP kiterjesztés, nincs composer-
    // függőség, ld. `php8.2 -m | grep fileinfo`) a nyers bájtok tartalma
    // alapján ismeri fel a valódi MIME-típust — csak akkor esünk vissza a
    // kiterjesztés-alapú találgatásra, ha a `finfo`-detekció sikertelen
    // vagy nem `image/`-del kezdődő típust ad (pl. a fájl ténylegesen nem
    // kép — ez esetben legalább a korábbi viselkedést kapjuk, nem egy
    // üres/hibás MIME-et).
    private function kepMimeTipusa($kepBytes, $kiterjesztes) {
        $tartalekMime = 'image/' . ($kiterjesztes === 'jpg' ? 'jpeg' : $kiterjesztes);

        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $detektalt = finfo_buffer($finfo, $kepBytes);
                finfo_close($finfo);
                if (is_string($detektalt) && strpos($detektalt, 'image/') === 0) {
                    return $detektalt;
                }
            }
        }

        return $tartalekMime;
    }

    // Csak az első oldalt konvertáljuk (a fuvarlevél/szállítólevél
    // egyoldalas dokumentum) — ugyanaz a poppler-utils rendszer-bináris
    // függőség, mint a `pdftotext`-nél a MOL-importnál, itt `pdftoppm`.
    private function pdfElsoOldalKepe($pdfPath) {
        $kimenetPrefix = tempnam(sys_get_temp_dir(), 'bdok_kep_');
        unlink($kimenetPrefix); // pdftoppm maga hozza létre a <prefix>-1.png fájlt
        $escapedPdf = escapeshellarg($pdfPath);
        $escapedPrefix = escapeshellarg($kimenetPrefix);
        exec("pdftoppm -png -r 150 -f 1 -l 1 $escapedPdf $escapedPrefix 2>/dev/null", $kimenet, $returnVar);
        $vartFajl = $kimenetPrefix . '-1.png';
        if ($returnVar !== 0 || !file_exists($vartFajl)) {
            return null;
        }
        return $vartFajl;
    }

    private function sajatCegnev($ceg_id) {
        $stmt = $this->db->prepare("SELECT cegnev FROM admin WHERE id = :id");
        $stmt->bindValue(':id', $ceg_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC)['cegnev'] ?? null;
    }

    // Csak javaslat — a dekódolt sofőr-név és a `user.name` közti laza
    // (nagybetűs, ékezet-érzéketlen tartalmazás) egyezés alapján, ugyanaz a
    // minta, mint `TachografInterface::keresSoforNevAlapjan()`-nál. Csak
    // EGYÉRTELMŰ (pontosan egy találatos) egyezésnél térünk vissza egy
    // id-vel — ha több sofőr neve is illeszkedne, inkább nem találgatunk,
    // az admin a review-panelen kézzel választ.
    private function keresSoforNevAlapjan($ceg_id, $nev) {
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $keresett = $this->normalizalNev($nev);
        if ($keresett === '') {
            return null;
        }
        $talalatok = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $jelolt = $this->normalizalNev($row['name']);
            if ($jelolt !== '' && (strpos($keresett, $jelolt) !== false || strpos($jelolt, $keresett) !== false)) {
                $talalatok[] = (int) $row['id'];
            }
        }
        return count($talalatok) === 1 ? $talalatok[0] : null;
    }

    private function normalizalNev($nev) {
        $nev = mb_strtoupper(trim((string) $nev));
        $atirasok = ['Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ö'=>'O','Ő'=>'O','Ú'=>'U','Ü'=>'U','Ű'=>'U'];
        return strtr($nev, $atirasok);
    }

    // `$csakFeldolgozatlan` — true esetén csak azok a sorok, amikből MÉG
    // nem lett fuvar (`fuvar_id IS NULL`) — ez az admin inbox alapértelmezett
    // nézete; false esetén minden, torolt<>'I' sor (archívum-nézet).
    //
    // A `filename`-t a projekt saját SQL-lintere miatt (összekapcsolt lekérdezés
    // nem engedélyezett, ld. `helyszinInterface::hozzafuzMegjegyzesekSzama()`/
    // `bejelentesekInterface::getUzenetInfok()` ugyanezen mintája) egy külön,
    // `fajl_id IN (...)` lekérdezéssel fűzzük hozzá PHP-oldalon.
    public function getDokumentumok(
        $ceg_id,
        $ocrAllapot = null,
        $csakFeldolgozatlan = true,
        $tipus = null,
        $search = null,
        $datumTol = null,
        $datumIg = null,
        $sortKey = null,
        $sortDir = 'asc',
        $page = null,
        $pageSize = null
    ) {
        $query = "SELECT bd.id, bd.fajl_id, bd.tipus, bd.ocr_allapot, bd.ocr_adatok,
                         bd.feltolto_tipus, bd.feltolto_id, bd.feltolto_nev, bd.hozzarendelt_sofor_id,
                         bd.fuvar_id, bd.letrehozva
                  FROM beerkezett_dokumentumok bd
                  WHERE bd.admin = :admin AND bd.torolt <> 'I'";
        $params = [':admin' => $ceg_id];

        if ($csakFeldolgozatlan) {
            $query .= " AND bd.fuvar_id IS NULL";
        }
        if (!empty($ocrAllapot)) {
            $query .= " AND bd.ocr_allapot = :ocr_allapot";
            $params[':ocr_allapot'] = $ocrAllapot;
        }
        if (!empty($tipus)) {
            $query .= " AND bd.tipus = :tipus";
            $params[':tipus'] = $tipus;
        }
        if (!empty($datumTol)) {
            $query .= " AND bd.letrehozva >= :datum_tol";
            $params[':datum_tol'] = $datumTol . ' 00:00:00';
        }
        if (!empty($datumIg)) {
            $query .= " AND bd.letrehozva <= :datum_ig";
            $params[':datum_ig'] = $datumIg . ' 23:59:59';
        }
        if (!empty($search)) {
            $fajlIdk = $this->keresFajlIdkNevAlapjan($ceg_id, $search);
            $feltetel = "bd.ocr_adatok LIKE :search";
            if (!empty($fajlIdk)) {
                $feltetel .= " OR bd.fajl_id IN (" . implode(',', $fajlIdk) . ")";
            }
            $query .= " AND ($feltetel)";
            $params[':search'] = '%' . $search . '%';
        }

        $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'bd.letrehozva';
        $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
        $query .= " ORDER BY $rendezoOszlop $irany";

        $total = null;
        if ($page !== null) {
            [$sorok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
        } else {
            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $fajlnevek = $this->fajlnevekFeloldasa(array_column($sorok, 'fajl_id'));
        $soforNevek = $this->soforNevekFeloldasa(array_column($sorok, 'hozzarendelt_sofor_id'), $ceg_id);
        foreach ($sorok as &$sor) {
            $sor['filename'] = $fajlnevek[$sor['fajl_id']] ?? null;
            $sor['hozzarendelt_sofor_nev'] = $sor['hozzarendelt_sofor_id'] ? ($soforNevek[$sor['hozzarendelt_sofor_id']] ?? null) : null;
            $sor['ocr_adatok'] = $sor['ocr_adatok'] !== null ? json_decode($sor['ocr_adatok'], true) : null;
        }
        unset($sor);

        $valasz = ['success' => true, 'dokumentumok' => $sorok];
        if ($page !== null) {
            $valasz['total'] = $total;
            $valasz['page'] = $page;
            $valasz['pageSize'] = $pageSize;
        }
        return $valasz;
    }

    // Fájlnév alapján keres id-ket a `fajlok` táblában (ugyanaz a JOIN-
    // mentes, PHP-oldali összefésülő minta, mint `FuvarInterface::
    // keresIdkNevAlapjan()`), hogy a getDokumentumok() keresése a fájlnévre
    // is kiterjedjen, ne csak az ocr_adatok nyers JSON-szövegére.
    private function keresFajlIdkNevAlapjan($ceg_id, $search) {
        $stmt = $this->db->prepare(
            "SELECT sorszam FROM fajlok WHERE admin = :ceg_id AND tabla = 'beerkezett_dokumentum' AND filename LIKE :search"
        );
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':search', '%' . $search . '%');
        $stmt->execute();
        return array_map('intval', array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'sorszam'));
    }

    // Batch-elt sofőr-név feloldás a manuálisan hozzárendelt sofőrhöz —
    // ugyanaz a minta, mint fajlnevekFeloldasa(), a $ceg_id-vel szűkítve
    // (nehogy egy más céghez tartozó user.id nevét adja vissza).
    private function soforNevekFeloldasa($soforIdk, $ceg_id) {
        $soforIdk = array_values(array_unique(array_filter(array_map('intval', $soforIdk))));
        if (empty($soforIdk)) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($soforIdk), '?'));
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE id IN ($placeholders) AND admin = ?");
        $stmt->execute([...$soforIdk, $ceg_id]);
        $nevek = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $nevek[$row['id']] = $row['name'];
        }
        return $nevek;
    }

    // Kézi sofőr-hozzárendelés — $soforId lehet null (visszavonás). A
    // fuvarInterface.php ervenyesEntitasE()-hez hasonló IDOR-védelem: a
    // megadott sofőrnek TÉNYLEG a hívó cégéhez kell tartoznia, különben egy
    // másik cég sofőr-id-ját is be lehetne írni ide.
    public function updateSofor($id, $ceg_id, $soforId) {
        if (!empty($soforId)) {
            $ellenorzo = $this->db->prepare("SELECT id FROM user WHERE id = :id AND admin = :admin AND torolt <> 'I'");
            $ellenorzo->bindValue(':id', $soforId, PDO::PARAM_INT);
            $ellenorzo->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
            $ellenorzo->execute();
            if ($ellenorzo->fetch() === false) {
                return ['success' => false, 'message' => 'Érvénytelen sofőr azonosító.'];
            }
        }
        $stmt = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok SET hozzarendelt_sofor_id = :sofor_id WHERE id = :id AND admin = :admin"
        );
        $stmt->bindValue(':sofor_id', empty($soforId) ? null : (int) $soforId, empty($soforId) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'message' => 'Sofőr hozzárendelve.'];
    }

    private function fajlnevekFeloldasa($fajlIdk) {
        $fajlIdk = array_values(array_unique(array_filter($fajlIdk)));
        if (empty($fajlIdk)) {
            return [];
        }
        // A `fajlok` tábla elsődleges kulcsa `sorszam`, NEM `id` — `fajl_id`
        // ide mutat (ld. `FilesInterface::fileUpload()`, ami `sorszam`-ot ad
        // vissza egy `'id'` kulcs alatt a válaszban, de a tábla oszlopa maga
        // `sorszam`). Élőben, `DESCRIBE fajlok`-kal megerősítve.
        $placeholders = implode(',', array_fill(0, count($fajlIdk), '?'));
        $stmt = $this->db->prepare("SELECT sorszam, filename FROM fajlok WHERE sorszam IN ($placeholders)");
        $stmt->execute($fajlIdk);
        $nevek = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $nevek[$row['sorszam']] = $row['filename'];
        }
        return $nevek;
    }

    // Könnyűsúlyú darabszám a sidebar-jelvényhez/Fuvarok fejléc-pillhez —
    // szándékosan NEM getDokumentumok()-ot hívja (ami minden ocr_adatok
    // JSON-t áthúzna a hálózaton egy puszta számért).
    public function getSzama($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) AS db FROM beerkezett_dokumentumok WHERE admin = :admin AND torolt <> 'I' AND fuvar_id IS NULL"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'szam' => (int) $stmt->fetch(PDO::FETCH_ASSOC)['db']];
    }

    // Csak "fuvar_id IS NULL" dokumentum vethető el — egy már fuvarrá
    // alakított dokumentumot deleteFuvar() (ami visszaallitForrasDokumentumot()-
    // tal reparentálja) tesz újra elérhetővé, ez a metódus szándékosan nem
    // nyúl egy már összekapcsolt sorhoz.
    public function torol($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT fuvar_id FROM beerkezett_dokumentumok WHERE id = :id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($sor === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }
        if (!empty($sor['fuvar_id'])) {
            return ['success' => false, 'message' => 'Ehhez a dokumentumhoz már tartozik fuvar, nem vethető el.'];
        }

        $update = $this->db->prepare("UPDATE beerkezett_dokumentumok SET torolt = 'I' WHERE id = :id AND admin = :admin");
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $update->execute();
        return ['success' => true, 'message' => 'Dokumentum elvetve.'];
    }

    public function updateTipus($id, $ceg_id, $tipus) {
        if (!in_array($tipus, ['fuvarlevel', 'szallitolevel', 'ismeretlen'], true)) {
            return ['success' => false, 'message' => 'Érvénytelen dokumentumtípus.'];
        }
        $stmt = $this->db->prepare("UPDATE beerkezett_dokumentumok SET tipus = :tipus WHERE id = :id AND admin = :admin");
        $stmt->bindValue(':tipus', $tipus);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'message' => 'Dokumentumtípus frissítve.'];
    }

    // Ugyanaz a minta, mint `fajlnevekFeloldasa()`, de a fájlnév mellett a
    // `fajl_kategoria`-t is visszaadja — a sofőr-oldali lista ez alapján dönti
    // el, mutasson-e kép-előnézetet vagy egy egyszerű dokumentum-ikont.
    private function fajlMetaFeloldasa($fajlIdk) {
        $fajlIdk = array_values(array_unique(array_filter($fajlIdk)));
        if (empty($fajlIdk)) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($fajlIdk), '?'));
        $stmt = $this->db->prepare("SELECT sorszam, filename, fajl_kategoria FROM fajlok WHERE sorszam IN ($placeholders)");
        $stmt->execute($fajlIdk);
        $meta = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $meta[$row['sorszam']] = ['filename' => $row['filename'], 'fajl_kategoria' => $row['fajl_kategoria']];
        }
        return $meta;
    }

    // Sofőr-oldali, SZŰKÍTETT mezőkészletű lekérdezés — a sofőr csak saját
    // feltöltéseit látja (feltolto_tipus='sofor' AND feltolto_id=:sofor_id),
    // és SOSEM kapja meg az `ocr_adatok`/`fuvar_id`/`hozzarendelt_sofor_id`
    // mezőket — csak egy szerver-oldalon számolt `torolheto` boolean-t
    // (fuvar_id IS NULL), hogy a frontend eldönthesse, mutasson-e törlés
    // gombot, anélkül hogy magát a fuvar-összekapcsolást ismerné.
    public function getSajatDokumentumok($soforId, $cegId, $limit = null) {
        $query = "SELECT bd.id, bd.fajl_id, bd.tipus, bd.ocr_allapot, bd.letrehozva,
                         (bd.fuvar_id IS NULL) AS torolheto
                  FROM beerkezett_dokumentumok bd
                  WHERE bd.admin = :admin AND bd.feltolto_tipus = 'sofor' AND bd.feltolto_id = :sofor_id
                        AND bd.torolt <> 'I'
                  ORDER BY bd.letrehozva DESC";
        if ($limit !== null) {
            $query .= " LIMIT " . (int) $limit;
        }
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':admin', $cegId, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $soforId, PDO::PARAM_INT);
        $stmt->execute();
        $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $fajlMeta = $this->fajlMetaFeloldasa(array_column($sorok, 'fajl_id'));
        foreach ($sorok as &$sor) {
            $sor['torolheto'] = (bool) $sor['torolheto'];
            $meta = $fajlMeta[$sor['fajl_id']] ?? null;
            $sor['filename'] = $meta['filename'] ?? null;
            $sor['fajl_kategoria'] = $meta['fajl_kategoria'] ?? null;
        }
        unset($sor);

        return ['success' => true, 'dokumentumok' => $sorok];
    }

    // Sofőr-oldali törlés — a `torol()`-tól (admin-oldali) elkülönítve: itt a
    // tulajdonjogot (feltolto_tipus='sofor' AND feltolto_id=$soforId) IS
    // ellenőrizzük, nem csak a `fuvar_id IS NULL` állapotot — egy sofőr csak
    // a SAJÁT feltöltését törölheti, nem a cég bármelyik dokumentumát.
    public function torolSajat($id, $soforId, $cegId) {
        $stmt = $this->db->prepare(
            "SELECT fuvar_id FROM beerkezett_dokumentumok
             WHERE id = :id AND admin = :admin AND feltolto_tipus = 'sofor' AND feltolto_id = :sofor_id AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $cegId, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $soforId, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($sor === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }
        if (!empty($sor['fuvar_id'])) {
            return ['success' => false, 'message' => 'Ez a dokumentum már fuvarrá lett alakítva, nem törölhető.'];
        }

        $update = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok SET torolt = 'I' WHERE id = :id AND admin = :admin"
        );
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':admin', $cegId, PDO::PARAM_INT);
        $update->execute();
        return ['success' => true, 'message' => 'Dokumentum törölve.'];
    }
}

$beerkezettDokumentumInterface = new BeerkezettDokumentumInterface();
