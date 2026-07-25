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

    public function elemez($base64, $fajlnev, $ceg_id, $feltoltoTipus, $feltoltoId, $feltoltoNev) {
        global $filesInterface, $apiConfig;

        $raw = base64_decode((string) $base64, true);
        if ($raw === false || $raw === '') {
            return ['success' => false, 'message' => 'A feltöltött fájl nem érvényes.'];
        }

        $kiterjesztes = strtolower(pathinfo((string) $fajlnev, PATHINFO_EXTENSION));
        $tmpEredetiPath = null;
        $tmpKepPath = null;

        try {
            if ($kiterjesztes === 'pdf') {
                // `tempnam()` maga is létrehozza a fájlt a visszaadott, kiterjesztés
                // nélküli néven — ha közvetlenül ehhez fűznénk a '.pdf'-et, az eredeti,
                // tempnam() által ténylegesen létrehozott fájl sosem törlődne (a lenti
                // `finally` csak a `.pdf`-es nevet unlinkeli), minden PDF-feltöltés egy
                // 0 bájtos, örökre ott maradó fájlt hagyna a rendszer temp mappájában —
                // élőben, ismételt PDF-teszttel megerősítve. Ugyanaz a minta, mint lent
                // a `pdfElsoOldalKepe()`-ben: azonnal unlinkeljük a tempnam() által
                // létrehozott fájlt, mielőtt a kiterjesztéssel bővített nevet használnánk.
                $tmpEredetiPath = tempnam(sys_get_temp_dir(), 'bdok_');
                unlink($tmpEredetiPath);
                $tmpEredetiPath .= '.pdf';
                file_put_contents($tmpEredetiPath, $raw);
                $tmpKepPath = $this->pdfElsoOldalKepe($tmpEredetiPath);
                if ($tmpKepPath === null) {
                    return $this->mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, 'hiba', null);
                }
                $kepBytes = file_get_contents($tmpKepPath);
                $kepMime = 'image/png';
            } else {
                $kepBytes = $raw;
                $kepMime = $this->kepMimeTipusa($kepBytes, $kiterjesztes);
            }

            $sajatCegnev = $this->sajatCegnev($ceg_id);
            // `geminiApiKeys` (tömb, ld. config.php) — nem a régi, egyetlen
            // `geminiApiKey`-t olvassuk, hogy a GeminiOcrClient kvóta-túllépés
            // esetén tényleg tudjon másik (külön projektben generált) kulcsra
            // váltani, ne csak egyetlen kulcsot lásson.
            $geminiKulcsok = $apiConfig['geminiApiKeys'] ?? [];

            $adatok = null;
            if (!empty($geminiKulcsok)) {
                $client = new GeminiOcrClient($geminiKulcsok);
                $adatok = $client->extractFuvarAdatok($kepBytes, $kepMime, $sajatCegnev);
            }

            if ($adatok === null) {
                return $this->mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, 'hiba', null);
            }

            return $this->mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, 'kesz', $adatok);
        } finally {
            if ($tmpEredetiPath !== null && file_exists($tmpEredetiPath)) {
                unlink($tmpEredetiPath);
            }
            if ($tmpKepPath !== null && file_exists($tmpKepPath)) {
                unlink($tmpKepPath);
            }
        }
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

    private function mentesEredmennyel($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev, $ocrAllapot, $adatok) {
        global $filesInterface;

        $raw = base64_decode((string) $base64, true);
        $nev = $fajlnev ?: 'beerkezett_dokumentum';
        $feltoltEredmeny = $filesInterface->fileUpload($ceg_id, 'beerkezett_dokumentum', $ceg_id, $base64, $nev, strlen((string) $raw), null, $feltoltoTipus, $feltoltoId, $feltoltoNev);
        if (empty($feltoltEredmeny['success'])) {
            return ['success' => false, 'message' => $feltoltEredmeny['message'] ?? 'A fájl mentése sikertelen.'];
        }
        $fajlId = $feltoltEredmeny['id'];

        $tipus = $adatok['tipus'] ?? 'ismeretlen';
        if (!in_array($tipus, ['fuvarlevel', 'szallitolevel', 'ismeretlen'], true)) {
            $tipus = 'ismeretlen';
        }

        $stmt = $this->db->prepare(
            "INSERT INTO beerkezett_dokumentumok (admin, fajl_id, tipus, ocr_allapot, ocr_adatok, feltolto_tipus, feltolto_id, feltolto_nev)
             VALUES (:admin, :fajl_id, :tipus, :ocr_allapot, :ocr_adatok, :feltolto_tipus, :feltolto_id, :feltolto_nev)"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':fajl_id', $fajlId, PDO::PARAM_INT);
        $stmt->bindValue(':tipus', $tipus);
        $stmt->bindValue(':ocr_allapot', $ocrAllapot);
        $stmt->bindValue(':ocr_adatok', $adatok !== null ? json_encode($adatok, JSON_UNESCAPED_UNICODE) : null);
        $stmt->bindValue(':feltolto_tipus', $feltoltoTipus);
        $stmt->bindValue(':feltolto_id', $feltoltoId);
        $stmt->bindValue(':feltolto_nev', $feltoltoNev);
        $stmt->execute();

        $dokumentumId = $this->db->lastInsertId();
        return ['success' => true, 'dokumentum' => [
            'id' => (int) $dokumentumId,
            'fajl_id' => (int) $fajlId,
            'tipus' => $tipus,
            'ocr_allapot' => $ocrAllapot,
            'ocr_adatok' => $adatok,
        ]];
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
                         bd.feltolto_tipus, bd.feltolto_id, bd.feltolto_nev, bd.fuvar_id, bd.letrehozva
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
        foreach ($sorok as &$sor) {
            $sor['filename'] = $fajlnevek[$sor['fajl_id']] ?? null;
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
}

$beerkezettDokumentumInterface = new BeerkezettDokumentumInterface();
