<?php

// "Piaci árak" widget a Sidebarhoz — EUR/HUF, USD/HUF árfolyam és a
// hazai (NAV-hivatkozási) benzinár. Ez SZÁNDÉKOSAN nem cégenként kulcsolt
// adat (nincs `admin`/ceg_id oszlop a `piaci_arak` táblán) — az árfolyam és
// az üzemanyagár minden cégre azonos, közös, gyorsítótárazott érték, nem
// tenant-adat.
//
// Két külön külső forrás, két külön frissítési ütemmel:
//  - EUR/HUF, USD/HUF: az MNB (Magyar Nemzeti Bank) hivatalos, ingyenes,
//    kulcs nélküli SOAP webservice-e (arfolyamok.asmx). Az MNB munkanapokon
//    egyszer frissíti ezt (nincs valódi élő, percenkénti árfolyam ingyenes,
//    kulcs nélküli forrás) — ez a hivatalos, mindenki által referenciaként
//    használt "aznapi" árfolyam, ezért 1 órás gyorsítótárral hívjuk (ne
//    terheljük feleslegesen az MNB szerverét minden sidebar-betöltésnél).
//  - Benzinár: nincs ingyenes, kulcs nélküli, valóban élő (percenkénti)
//    magyar üzemanyagár-API — a NAV viszont havonta közzéteszi a hivatalos
//    referencia-üzemanyagárat (amit egyébként is minden magyar cég a saját
//    elszámolásában használ, ld. https://nav.gov.hu/.../uzemanyagarak),
//    ez a legmegbízhatóbb, hivatalos, ingyenes forrás — ezt scrape-eljük
//    (a projekt már meglévő GpsmartClient.php DOMDocument-mintáját követve,
//    mert itt sincs strukturált API), 12 órás gyorsítótárral, mivel havonta
//    egyszer változik.
class PiaciArakInterface {
    protected $db;

    const EUR_HUF_TTL_MP = 3600;        // 1 óra
    const USD_HUF_TTL_MP = 3600;        // 1 óra
    const BENZIN_TTL_MP = 43200;        // 12 óra

    const CIMKEK = [
        'EUR_HUF' => ['cimke' => 'EUR/HUF', 'egyseg' => 'Ft', 'tizedesek' => 2, 'csoport' => 'Árfolyamok'],
        'USD_HUF' => ['cimke' => 'USD/HUF', 'egyseg' => 'Ft', 'tizedesek' => 2, 'csoport' => 'Árfolyamok'],
        'BENZIN_95' => ['cimke' => 'Benzin (ESZ-95)', 'egyseg' => 'Ft/l', 'tizedesek' => 0, 'csoport' => 'Üzemanyag'],
    ];

    // UX-audit "market intelligence" pontja — a delta mellett meg kell
    // mondani, MIHEZ képest történt a változás, különben a szám nem
    // értelmezhető. Az MNB-árfolyam napi, a NAV-benzinár havi frissítésű,
    // ezért a két csoportnak más a természetes viszonyítási időszaka.
    const IDOSZAK_CIMKE = [
        'EUR_HUF' => 'előző munkanaphoz képest',
        'USD_HUF' => 'előző munkanaphoz képest',
        'BENZIN_95' => 'előző havi árhoz képest',
    ];

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function getPiaciArak() {
        $eredmeny = [];
        $eredmeny[] = $this->frissitVagyOlvas('EUR_HUF', self::EUR_HUF_TTL_MP, fn() => $this->lekerdezMnbArfolyam('EUR'));
        $eredmeny[] = $this->frissitVagyOlvas('USD_HUF', self::USD_HUF_TTL_MP, fn() => $this->lekerdezMnbArfolyam('USD'));
        $eredmeny[] = $this->frissitVagyOlvas('BENZIN_95', self::BENZIN_TTL_MP, fn() => $this->lekerdezNavBenzinar());

        return ['success' => true, 'tetelek' => $eredmeny];
    }

    // Tetszőleges MNB-deviza HUF-árfolyama, gyorsítótárazva — a Pénzforgalom
    // deviza-kezeléséhez (ld. koltsegInterface.php newEgyebKoltseg/
    // updateEgyebKoltseg, navSzamlaInterface.php). Ugyanazt a cache-
    // mechanizmust használja, mint a sidebar EUR/USD-je, csak nem korlátozódik
    // a `CIMKEK`-ben előre felsorolt két devizára — bármelyik cég devizalistán
    // (ld. listaInterface.php 'deviza' típus) felvett kódra működik, amíg azt
    // az MNB is ismeri. `null`-lal tér vissza, ha se friss cache, se élő
    // MNB-lekérdezés nem ad eredményt (pl. elgépelt/MNB által nem jegyzett kód).
    public function getArfolyam($devizanem) {
        if ($devizanem === 'HUF') {
            return 1.0;
        }
        // ISO 4217-formátum kikényszerítése beszúrás/lekérdezés ELŐTT — a
        // `$devizanem` végül egy XPath-kifejezés string-literáljába kerül
        // (ld. lekerdezMnbArfolyam() lentebb), ahol egy nem validált, `'`
        // karaktert tartalmazó érték kitörhetne a literálból és tetszőleges
        // XPath-predikátumot fűzhetne a lekérdezéshez (ld. biztonsági audit).
        if (!preg_match('/^[A-Z]{3}$/', $devizanem)) {
            return null;
        }
        $eredmeny = $this->frissitVagyOlvas($devizanem . '_HUF', self::EUR_HUF_TTL_MP, fn() => $this->lekerdezMnbArfolyam($devizanem));
        return $eredmeny['ertek'];
    }

    // Közös gyorsítótár-logika mindhárom kulcsra: ha a cache elég friss,
    // egyszerűen visszaadja; ha lejárt (vagy nincs még sor), megpróbál
    // frissíteni a `$lekerdezo` callback-kel. HA A KÜLSŐ LEKÉRDEZÉS
    // HIBÁZIK (a forrás átmenetileg elérhetetlen), a régi, gyorsítótárazott
    // értéket adja vissza (a `frissitve` időbélyeg NEM a próbálkozás, hanem
    // az utolsó SIKERES lekérdezés ideje — így a felhasználó mindig a
    // valós adat-frissesség őszinte képét látja, sosem hazug "most
    // frissült" időbélyeget egy valójában elavult szám mellett).
    private function frissitVagyOlvas($kulcs, $ttlMasodperc, callable $lekerdezo) {
        // A gyorsítótár frissességét SZÁNDÉKOSAN SQL-oldalon (TIMESTAMPDIFF)
        // hasonlítjuk össze, nem PHP `time() - strtotime(...)`-tal — élesben
        // kiderült, hogy ez a szerveren MySQL rendszer-időzóna (CEST) és a
        // PHP `date_default_timezone` (UTC) közti 2 órás eltérés miatt
        // szisztematikusan rossz eredményt adott (egy naiv DATETIME
        // string-et a `strtotime()` PHP saját időzónájában értelmez újra,
        // nem a MySQL-ében, amiben valójában tárolva lett). A `NOW()`
        // ugyanabban a (MySQL szerver) időzónában fut, mint amiben a
        // `frissitve` mentődött, tehát a különbség itt mindig helyes,
        // időzóna-függetlenül.
        $stmt = $this->db->prepare(
            'SELECT ertek, elozo_ertek, frissitve, TIMESTAMPDIFF(SECOND, frissitve, NOW()) AS kor_masodperc
             FROM piaci_arak WHERE kulcs = :kulcs'
        );
        $stmt->bindValue(':kulcs', $kulcs);
        $stmt->execute();
        $cache = $stmt->fetch(PDO::FETCH_ASSOC);

        $friss = $cache && (int) $cache['kor_masodperc'] < $ttlMasodperc;

        if (!$friss) {
            try {
                $ujErtek = $lekerdezo();
                if ($ujErtek !== null && $ujErtek > 0) {
                    $elozoErtek = $cache['ertek'] ?? null;
                    $stmt = $this->db->prepare(
                        'INSERT INTO piaci_arak (kulcs, ertek, elozo_ertek, frissitve) VALUES (:kulcs, :ertek, :elozo_ertek, NOW())
                         ON DUPLICATE KEY UPDATE ertek = :ertek2, elozo_ertek = :elozo_ertek2, frissitve = NOW()'
                    );
                    $stmt->bindValue(':kulcs', $kulcs);
                    $stmt->bindValue(':ertek', $ujErtek);
                    $stmt->bindValue(':elozo_ertek', $elozoErtek);
                    $stmt->bindValue(':ertek2', $ujErtek);
                    $stmt->bindValue(':elozo_ertek2', $elozoErtek);
                    $stmt->execute();

                    $cache = ['ertek' => $ujErtek, 'elozo_ertek' => $elozoErtek, 'frissitve' => date('Y-m-d H:i:s')];

                    // Napi előzmény-pont a sparkline-hoz — SZÁNDÉKOSAN a
                    // MySQL szerver dátuma (CURDATE()), ugyanazon
                    // időzóna-konzisztencia okból, mint a `frissitve`
                    // TIMESTAMPDIFF-je fentebb. Egy nap alatt többször is
                    // idekerülhetünk (pl. a cache lejár, majd megint
                    // frissítjük) — az ON DUPLICATE KEY UPDATE ilyenkor csak
                    // felülírja aznapi pontot, nem duplikálja.
                    $elozmenyStmt = $this->db->prepare(
                        'INSERT INTO piaci_arak_elozmeny (kulcs, datum, ertek) VALUES (:kulcs, CURDATE(), :ertek)
                         ON DUPLICATE KEY UPDATE ertek = :ertek2'
                    );
                    $elozmenyStmt->bindValue(':kulcs', $kulcs);
                    $elozmenyStmt->bindValue(':ertek', $ujErtek);
                    $elozmenyStmt->bindValue(':ertek2', $ujErtek);
                    $elozmenyStmt->execute();
                }
            } catch (Exception $e) {
                // Elnyeljük — a lenti fallback a régi cache-t adja vissza,
                // ha van; ha nincs (első futás, és a forrás pont most nem
                // elérhető), a lenti null-ellenőrzés kezeli.
            }
        }

        // `getArfolyam()` (deviza-kezelés, ld. koltsegInterface.php) a
        // `CIMKEK`-ben nem szereplő (tehát a sidebaron meg nem jelenő)
        // devizákra is meghívja ezt — azoknak nincs kész címkéjük, egy
        // semleges alapértelmezés jó helyettük (a hívó úgyis csak `ertek`-et
        // olvassa ki, a `cimke`/`egyseg` nem használt ezen az ágon).
        $meta = self::CIMKEK[$kulcs] ?? ['cimke' => $kulcs, 'egyseg' => 'Ft', 'tizedesek' => 4];
        if (!$cache) {
            return [
                'kulcs' => $kulcs,
                'cimke' => $meta['cimke'],
                'egyseg' => $meta['egyseg'],
                'ertek' => null,
                'elozoErtek' => null,
                'valtozas' => null,
                'frissitve' => null,
            ];
        }

        $ertek = round((float) $cache['ertek'], $meta['tizedesek']);
        $elozoErtek = $cache['elozo_ertek'] !== null ? round((float) $cache['elozo_ertek'], $meta['tizedesek']) : null;
        $valtozas = null;
        $valtozasSzazalek = null;
        if ($elozoErtek !== null) {
            $valtozas = $ertek > $elozoErtek ? 'fel' : ($ertek < $elozoErtek ? 'le' : 'valtozatlan');
            if ($elozoErtek != 0) {
                $valtozasSzazalek = round(($ertek - $elozoErtek) / $elozoErtek * 100, 1);
            }
        }

        return [
            'kulcs' => $kulcs,
            'cimke' => $meta['cimke'],
            'egyseg' => $meta['egyseg'],
            'csoport' => $meta['csoport'] ?? null,
            'ertek' => $ertek,
            'elozoErtek' => $elozoErtek,
            'valtozas' => $valtozas,
            'valtozasSzazalek' => $valtozasSzazalek,
            'idoszakCimke' => self::IDOSZAK_CIMKE[$kulcs] ?? null,
            'elozmeny' => $this->getElozmeny($kulcs),
            'frissitve' => $cache['frissitve'],
        ];
    }

    // Az utolsó N nap (alapból 7) napi pontja a sidebar mikro-sparkline-
    // jához, időrendben (legrégebbi elöl). Kevesebb pontot is visszaadhat,
    // mint N — a tábla csak azóta gyűlik, hogy ez a funkció bekerült, tehát
    // az első napokban szükségszerűen kevés (akár csak 1) pont lesz, sosem
    // pótoljuk ki kitalált adattal. A hívó (frontend) felelőssége eldönteni,
    // hogy 2 pontnál kevesebb esetén egyáltalán érdemes-e sparkline-t
    // rajzolni.
    private function getElozmeny($kulcs, $napok = 7) {
        $stmt = $this->db->prepare(
            'SELECT ertek FROM piaci_arak_elozmeny WHERE kulcs = :kulcs ORDER BY datum DESC LIMIT :napok'
        );
        $stmt->bindValue(':kulcs', $kulcs);
        $stmt->bindValue(':napok', $napok, PDO::PARAM_INT);
        $stmt->execute();
        return array_reverse(array_map('floatval', $stmt->fetchAll(PDO::FETCH_COLUMN)));
    }

    // MNB hivatalos, ingyenes, kulcs nélküli SOAP webservice — a napi
    // (munkanaponként frissülő) hivatalos középárfolyamot adja HUF-ban.
    // A visszaadott érték magyar tizedesvessző-formátumú ("359,21"), ezt
    // váltjuk pontra a float konverzió előtt.
    private function lekerdezMnbArfolyam($devizanem) {
        $client = new SoapClient('https://www.mnb.hu/arfolyamok.asmx?WSDL', ['exceptions' => true, 'connection_timeout' => 10]);
        $valasz = $client->GetCurrentExchangeRates();
        $xml = $valasz->GetCurrentExchangeRatesResult;

        $dom = new DOMDocument();
        $dom->loadXML($xml);
        $xpath = new DOMXPath($dom);
        $csomopontok = $xpath->query("//Rate[@curr='$devizanem']");
        if ($csomopontok->length === 0) {
            return null;
        }

        $csomopont = $csomopontok->item(0);
        $ertekSzoveg = str_replace(',', '.', trim($csomopont->textContent));
        $egyseg = (int) $csomopont->getAttribute('unit');
        $ertek = (float) $ertekSzoveg;

        // Néhány deviza (pl. JPY, IDR) 100 egységre van megadva — a
        // EUR/USD esetén ez mindig 1, de általánosan kezelve biztonságosabb.
        return $egyseg > 0 ? $ertek / $egyseg : null;
    }

    // A NAV hivatalos, havonta frissülő referencia-üzemanyagár oldala —
    // nincs strukturált API, HTML-táblát kell elemezni (ugyanaz a minta,
    // mint a GpsmartClient.php-ban, mert ott sincs API). A táblázat maga
    // entity-escape-elt szövegként (&lt;table&gt;...) van beágyazva az
    // oldal forrásába (feltehetően egy CMS JSON-blokkjában) — ezért előbb
    // html_entity_decode-oljuk a teljes választ, hogy a DOMDocument valódi
    // <table> elemként lássa. Az ESZ-95 "piaci árszabás" (nem a "védett ár")
    // oszlopot vesszük, mert az tükrözi a tényleges kúti árat.
    private function lekerdezNavBenzinar() {
        $ch = curl_init('https://nav.gov.hu/ugyfeliranytu/uzemanyag/2026-ban-alkalmazhato-uzemanyagarak');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $html = curl_exec($ch);
        $hiba = curl_error($ch);
        curl_close($ch);

        if ($html === false || $html === '') {
            throw new Exception('NAV oldal lekérdezési hiba: ' . $hiba);
        }

        $decoded = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8"?>' . $decoded);
        libxml_clear_errors();

        $tabla = null;
        foreach ($dom->getElementsByTagName('table') as $t) {
            if (strpos($t->getAttribute('class'), 'style9') !== false) {
                $tabla = $t;
                break;
            }
        }
        if (!$tabla) {
            return null;
        }

        $sorok = $tabla->getElementsByTagName('tr');
        if ($sorok->length < 2) {
            return null;
        }

        // A fejléc utáni ELSŐ adatsor a legfrissebb hónap (a tábla
        // csökkenő időrendben sorolja fel a hónapokat) — a 3. oszlop
        // (0-indexeléssel: hónap, ESZ-95 védett, ESZ-95 piaci) az, amit
        // keresünk.
        $elsoAdatSor = $sorok->item(1);
        $cellak = $elsoAdatSor->getElementsByTagName('td');
        if ($cellak->length < 3) {
            return null;
        }

        // A NAV oldal forrása a táblázat celláit láthatóan egy JSON-blokkból
        // építi fel (a szerkesztői tartalom eredetileg JSON string volt) —
        // ezért a cellák szövegében a sortörés nem valódi újsor-bájt, hanem
        // a szó szerinti két karakteres "\n" escape-szekvencia marad benne
        // még az entity-dekódolás után is. Ezt (és a nem-törhető szóközt)
        // is le kell még cserélni, mielőtt számmá értelmeznénk.
        $ertekSzoveg = trim(str_replace(['\n', "\xc2\xa0"], ['', ' '], $cellak->item(2)->textContent));
        return is_numeric($ertekSzoveg) ? (float) $ertekSzoveg : null;
    }
}

$piaciArakInterface = new PiaciArakInterface();
