<?php

// NAV Online Számla (e-invoice) API v3.0 kliens — kizárólag a
// `queryInvoiceDigest` művelethez (számla-kivonatok lekérdezése), a
// Pénzforgalom modul bevétel/kiadás-import funkciójához.
//
// Forrás/ellenőrzés: a kérés/válasz szerkezetet a NAV hivatalos, publikus
// GitHub-repóiból származó minta-XML-ek alapján építettük fel
// (github.com/nav-gov-hu/Online-Invoice — sample/API sample/tokenExchange.xml
// és queryInvoiceDigest_outbound_query_params.xml), az aláírás-számítás
// pontos algoritmusát pedig a NAV-specifikációt implementáló, nyilvános
// `pzs/nav-online-invoice` PHP könyvtár forrásával (BaseRequestXml.php,
// Util.php) kereszt-ellenőrizve — NEM feltételezésből, hanem ezekből az
// elsődleges forrásokból.
//
// Szándékosan NINCS `tokenExchange` hívás: a NAV mintakódja és a fenti
// referencia-könyvtár is megerősíti, hogy a `queryInvoiceDigest` önmagában,
// teljesen önállóan hitelesített kérés (saját requestSignature-rel) —
// a tokenExchange egy KÜLÖN, más célú (elsősorban a technikai felhasználó/
// kapcsolat tesztelésére szolgáló) művelet, nem előfeltétele a lekérdezésnek.
//
// A cserekulcs (exchangeKey) ezért ebben az osztályban nincs használva —
// csak a beállítások-táblában/felületen szerepel, mert a NAV portál a két
// kulcsot (aláíró + csere) mindig együtt, egy technikai felhasználóhoz
// generálja, és egy jövőbeli bővítés (pl. manageInvoice) használhatja majd.
class NavSzamlaClient {
    const API_NS = 'http://schemas.nav.gov.hu/OSA/3.0/api';
    const COMMON_NS = 'http://schemas.nav.gov.hu/NTCA/1.0/common';

    const BASE_URL_ELES = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';
    const BASE_URL_TESZT = 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3';

    // A NAV oldali fejlesztői regisztrációkor kapott, a rendszer saját magát
    // azonosító adatok — nem a technikai felhasználóé, hanem magáé a
    // Szikora Transz alkalmazásé, minden ügyfélnél ugyanaz (ahogy a NAV
    // specifikáció is előírja: ez a "software" blokk a lekérdező programot
    // azonosítja, nem a lekérdező céget).
    // A `softwareId` a NAV séma szerint pontosan 18 karakter kell legyen,
    // csak [0-9A-Z-] karakterekből (ellenőrizve: élő NAV teszt-végpont
    // SCHEMA_VIOLATION hibája egy hosszabb, próba-értékre).
    const SOFTWARE = [
        'softwareId' => 'SZIKORATR-FLOTTA01',
        'softwareName' => 'Szikora Transz Flottakezelo',
        'softwareOperation' => 'LOCAL_SOFTWARE',
        'softwareMainVersion' => '1.0',
        'softwareDevName' => 'Szikora Transz',
        'softwareDevContact' => 'info@szikora-transz.hu',
        'softwareDevCountryCode' => 'HU',
        'softwareDevTaxNumber' => '00000000',
    ];

    private $adoszam;
    private $login;
    private $jelszo;
    private $alairoKulcs;
    private $baseUrl;

    public function __construct($adoszam, $login, $jelszo, $alairoKulcs, $kornyezet = 'eles') {
        $this->adoszam = $adoszam;
        $this->login = $login;
        $this->jelszo = $jelszo;
        $this->alairoKulcs = $alairoKulcs;
        $this->baseUrl = $kornyezet === 'teszt' ? self::BASE_URL_TESZT : self::BASE_URL_ELES;
    }

    // `$irany`: 'OUTBOUND' (a cég saját kiállított számlái — bevétel-jelölt)
    // vagy 'INBOUND' (a cégre mint vevőre jelentett, befogadott számlák —
    // kiadás-jelölt).
    //
    // A NAV `queryInvoiceDigest` a `invoiceIssueDate` intervallumot
    // MAXIMUM 35 napban engedélyezi kérésenként (élő NAV teszt-végponttal
    // ellenőrizve: egy évnyi tartományra `BAD_QUERY_PARAM_RANGE_EXCEEDED`
    // hibát ad) — ezért egy hosszabb, felhasználó által választott
    // időszakot itt csendben, legfeljebb 35 napos darabokra bontunk, és a
    // darabok eredményét fűzzük össze. A hívó (navSzamlaInterface) oldalán
    // ebből semmi nem látszik — bármilyen dátumtartomány megadható.
    public function queryInvoiceDigest($datumTol, $datumIg, $irany) {
        $eredmeny = [];
        foreach ($this->intervallumDarabolas($datumTol, $datumIg) as [$reszTol, $reszIg]) {
            $eredmeny = array_merge($eredmeny, $this->queryInvoiceDigestEgyIntervallum($reszTol, $reszIg, $irany));
        }
        return $eredmeny;
    }

    // [[datumTol, datumIg], ...] legfeljebb 35 napos, egymást követő
    // darabokra bontva a teljes [$datumTol, $datumIg] intervallumot.
    private function intervallumDarabolas($datumTol, $datumIg) {
        $darabok = [];
        $aktualisTol = new DateTime($datumTol);
        $vegsoIg = new DateTime($datumIg);

        while ($aktualisTol <= $vegsoIg) {
            $aktualisIg = (clone $aktualisTol)->modify('+34 days');
            if ($aktualisIg > $vegsoIg) {
                $aktualisIg = clone $vegsoIg;
            }
            $darabok[] = [$aktualisTol->format('Y-m-d'), $aktualisIg->format('Y-m-d')];
            $aktualisTol = (clone $aktualisIg)->modify('+1 day');
        }

        return $darabok;
    }

    // Egyetlen (már max. 35 napos) intervallum lekérdezése — a NAV saját
    // lapozásán (oldalanként max. 100 tétel) végigmegy, összefűzve adja
    // vissza.
    private function queryInvoiceDigestEgyIntervallum($datumTol, $datumIg, $irany) {
        $eredmeny = [];
        $page = 1;
        $maxOldal = 50; // védőháló végtelen ciklus ellen, ~5000 számla felett

        do {
            $responseXml = $this->kuldQueryInvoiceDigest($datumTol, $datumIg, $irany, $page);
            $this->ellenorizFuncCode($responseXml);

            $digestResult = $responseXml->invoiceDigestResult ?? null;
            if ($digestResult === null) {
                break;
            }

            foreach ($digestResult->invoiceDigest ?? [] as $tetel) {
                $eredmeny[] = $this->digestSorFeldolgozas($tetel, $irany);
            }

            $availablePage = (int) ($digestResult->availablePage ?? 1);
            $page++;
        } while ($page <= $availablePage && $page <= $maxOldal);

        return $eredmeny;
    }

    private function digestSorFeldolgozas($tetel, $irany) {
        // A nettó+ÁFA forint-egyenértéke (`invoiceNetAmountHUF`/
        // `invoiceVatAmountHUF`) MINDEN számlán szerepel, a pénznemétől
        // függetlenül — ez az ÁFA-törvény szerint kötelező adat, a NAV
        // saját maga adja meg a kiállításkori árfolyamon átszámítva.
        // Ezért (eltérően a lezárt fuvarok EUR-kizárásától, ahol nincs
        // ilyen megbízható forrás) itt NEM kell kizárnunk a devizás
        // számlákat — a NAV-tól kapott forint-összeget használjuk.
        $nettoHuf = isset($tetel->invoiceNetAmountHUF) ? (float) $tetel->invoiceNetAmountHUF : null;
        $afaHuf = isset($tetel->invoiceVatAmountHUF) ? (float) $tetel->invoiceVatAmountHUF : null;
        $bruttoHuf = ($nettoHuf !== null && $afaHuf !== null) ? round($nettoHuf + $afaHuf, 2) : null;

        // A számla EREDETI (nem HUF-ra váltott) nettó+ÁFA összege is szerepel
        // a digestben (`invoiceNetAmount`/`invoiceVatAmount`, élő NAV-teszttel
        // megerősítve) — ez kell a deviza-kezeléshez (ld. koltsegInterface.php
        // resolveDevizaOsszeg), hogy egy importált devizás tételnél ne csak a
        // HUF-egyenértéket lássa a felhasználó, hanem az eredeti "500 EUR"
        // összeget is, és a kettőből visszaszámolt tényleges NAV-árfolyamot.
        $nettoEredeti = isset($tetel->invoiceNetAmount) ? (float) $tetel->invoiceNetAmount : null;
        $afaEredeti = isset($tetel->invoiceVatAmount) ? (float) $tetel->invoiceVatAmount : null;
        $bruttoEredeti = ($nettoEredeti !== null && $afaEredeti !== null) ? round($nettoEredeti + $afaEredeti, 2) : null;

        $penznem = isset($tetel->currency) ? (string) $tetel->currency : 'HUF';
        $partnerNev = $irany === 'OUTBOUND'
            ? (string) ($tetel->customerName ?? '')
            : (string) ($tetel->supplierName ?? '');

        return [
            'szamlaszam' => (string) $tetel->invoiceNumber,
            'datum' => (string) $tetel->invoiceIssueDate,
            'partner_nev' => $partnerNev !== '' ? $partnerNev : null,
            'osszeg_huf' => $bruttoHuf,
            'osszeg_eredeti' => $bruttoEredeti,
            'penznem' => $penznem,
            'irany' => $irany === 'OUTBOUND' ? 'bevetel' : 'kiado',
        ];
    }

    private function kuldQueryInvoiceDigest($datumTol, $datumIg, $irany, $page) {
        $requestId = $this->generalRequestId();
        $timestamp = $this->timestampGeneralas();

        $xml = new SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?><QueryInvoiceDigestRequest xmlns:common="'
            . self::COMMON_NS . '" xmlns="' . self::API_NS . '"></QueryInvoiceDigestRequest>'
        );

        $this->fejlecHozzaadas($xml, $requestId, $timestamp);
        $this->felhasznaloHozzaadas($xml, $requestId, $timestamp);
        $this->szoftverHozzaadas($xml);

        $xml->addChild('page', (string) $page);
        $xml->addChild('invoiceDirection', $irany);

        $queryParams = $xml->addChild('invoiceQueryParams');
        $mandatory = $queryParams->addChild('mandatoryQueryParams');
        $issueDate = $mandatory->addChild('invoiceIssueDate');
        $issueDate->addChild('dateFrom', $datumTol);
        $issueDate->addChild('dateTo', $datumIg);

        return $this->kuldes('/queryInvoiceDigest', $xml);
    }

    private function fejlecHozzaadas($xml, $requestId, $timestamp) {
        $header = $xml->addChild('header', null, self::COMMON_NS);
        $header->addChild('requestId', $requestId);
        $header->addChild('timestamp', $timestamp);
        $header->addChild('requestVersion', '3.0');
        $header->addChild('headerVersion', '1.0');
    }

    private function felhasznaloHozzaadas($xml, $requestId, $timestamp) {
        $user = $xml->addChild('user', null, self::COMMON_NS);
        $user->addChild('login', $this->login);
        $user->addChild('passwordHash', strtoupper(hash('sha512', $this->jelszo)))
            ->addAttribute('cryptoType', 'SHA-512');
        $user->addChild('taxNumber', $this->adoszam);
        $user->addChild('requestSignature', $this->alairas($requestId, $timestamp))
            ->addAttribute('cryptoType', 'SHA3-512');
    }

    private function szoftverHozzaadas($xml) {
        $software = $xml->addChild('software');
        foreach (self::SOFTWARE as $kulcs => $ertek) {
            $software->addChild($kulcs, $ertek);
        }
    }

    // Aláírás-alapszöveg: requestId + timestamp (yyyyMMddHHmmss maszkkal,
    // ezredmásodperc és minden nem-számjegy nélkül, UTC) + aláíró kulcs —
    // pontosan a NAV specifikáció 1.5-ös fejezete szerint, a
    // pzs/nav-online-invoice referenciával megegyezően.
    private function alairas($requestId, $timestamp) {
        $timestampMaszkolt = preg_replace('/\.\d{3}|\D+/', '', $timestamp);
        $alap = $requestId . $timestampMaszkolt . $this->alairoKulcs;
        return strtoupper(hash('sha3-512', $alap));
    }

    private function timestampGeneralas() {
        $now = microtime(true);
        $ezredmasodperc = min((int) round(($now - floor($now)) * 1000), 999);
        return gmdate('Y-m-d\TH:i:s', (int) $now) . sprintf('.%03dZ', $ezredmasodperc);
    }

    // Csak alfanumerikus, max. 30 karakter — a NAV requestId formai
    // követelménye. Naponta egyedinek kell lennie ugyanahhoz a technikai
    // felhasználóhoz — az időbélyeg-mikroszekundum + véletlen rész ezt
    // gyakorlatilag garantálja.
    private function generalRequestId() {
        return 'SZT' . date('YmdHis') . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
    }

    private function kuldes($utvonal, SimpleXMLElement $xml) {
        $ch = curl_init($this->baseUrl . $utvonal);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $xml->asXML(),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/xml; charset=UTF-8',
                'Accept: application/xml',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        ]);
        $valasz = curl_exec($ch);
        $curlHiba = curl_error($ch);
        curl_close($ch);

        if ($valasz === false) {
            throw new Exception('NAV kapcsolódási hiba: ' . $curlHiba);
        }

        return $this->valaszFeldolgozas($valasz);
    }

    // A névterek eltávolítása a válaszból leegyszerűsíti a mezők elérését
    // (ugyanez a technika, mint a pzs/nav-online-invoice XmlUtil-jában) —
    // a NAV válasza minden mezőt más-más névtér-előtaggal ad vissza
    // (ns2/ns3/ns4), ezek nélkül a SimpleXML-lekérdezés sokkal egyszerűbb.
    private function valaszFeldolgozas($xmlString) {
        if (strpos(trim($xmlString), '<?xml') !== 0) {
            throw new Exception('NAV: érvénytelen (nem XML) válasz érkezett.');
        }
        $tisztitott = preg_replace('/(<\/?)[a-zA-Z0-9]+:/', '$1', $xmlString);
        $tisztitott = preg_replace('/\sxmlns[^=]*="[^"]*"/', '', $tisztitott);

        $eredeti = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($tisztitott);
        libxml_use_internal_errors($eredeti);

        if ($xml === false) {
            throw new Exception('NAV: a válasz XML nem dolgozható fel.');
        }
        return $xml;
    }

    private function ellenorizFuncCode($responseXml) {
        $funcCode = (string) ($responseXml->result->funcCode ?? '');
        if ($funcCode !== 'OK') {
            $hibakod = (string) ($responseXml->result->errorCode ?? 'ISMERETLEN_HIBA');
            $uzenet = (string) ($responseXml->result->message ?? 'A NAV hibaüzenet nélkül utasította el a kérést.');

            // Az `INVALID_REQUEST` a NAV oldalán egy ÁLTALÁNOS, sokféle
            // problémát takaró kód (rossz taxNumber-formátum, hibás
            // requestSignature, stb.) — a tényleges, konkrét okot a
            // `technicalValidationMessages` blokk adja meg, amit korábban
            // csendben eldobtunk. Enélkül a felhasználó (és mi magunk) csak
            // annyit látunk, hogy "Helytelen kérés!", anélkül hogy tudnánk,
            // pontosan MI a helytelen benne.
            $reszletek = [];
            foreach ($responseXml->technicalValidationMessages ?? [] as $reszlet) {
                $kod = (string) ($reszlet->validationErrorCode ?? '');
                $uzi = (string) ($reszlet->message ?? '');
                if ($kod !== '' || $uzi !== '') {
                    $reszletek[] = trim("$kod: $uzi", ': ');
                }
            }

            $teljesUzenet = "NAV hiba ($hibakod): $uzenet";
            if (!empty($reszletek)) {
                $teljesUzenet .= ' — ' . implode(' | ', $reszletek);
            }
            throw new Exception($teljesUzenet);
        }
    }
}
