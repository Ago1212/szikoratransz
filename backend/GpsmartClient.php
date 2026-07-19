<?php

// GPSmart flottakövetés (flottanavigacio.gpsmart.eu) kliens — a szolgáltató
// nem ad hosszú élettartamú API-kulcsot, a weboldala egy hagyományos
// munkamenet-cookie-val (CGISESSID) működik, amit csak a saját bejelentkező
// oldalukon (login.cgi) lehet megszerezni, felhasználónév+jelszó megadásával
// — pontosan úgy, mint egy böngészőből belépve. Ez a kliens ezt a
// bejelentkezést szimulálja szerver oldalon (curl), majd a kapott cookie-val
// kérdezi le a pozíciólistát adó `getpositions.pl` végpontot. A válasz NEM
// XML/JSON, hanem egy kész HTML táblázat (a szolgáltató saját, régi
// CGI-alapú felülete) — ezt DOMDocument-tel elemezzük szét, nem regexszel,
// mert a cím/rendszám mezőkben előfordulhat olyan karakter (pl. ékezet),
// ami egy egyszerű reguláris kifejezést könnyen elrontana.
//
// R27 (fejlesztési audit, 2026-07-19): korábban minden `lekerdezPoziciok()`/
// `lekerdezUtvonal()` hívás önálló bejelentkezéssel indult, a cookie
// sehol nem volt gyorsítótárazva. Ez a `$cookie` mezőn, PÉLDÁNY-szinten
// (nem folyamatok/kérések közötti, tartós cache-ben) tárolja a bejelentkezés
// eredményét — egyetlen HTTP-kérés élettartamán belül, ugyanazzal a
// `GpsmartClient`-példánnyal végzett több hívás (pl. a Flottakövetés
// "Megtett út (ma)"/kihasználtsági riport flotta-egészére futó ciklusa,
// ld. GpsmartInterface::getClient()) így csak EGYSZER jelentkezik be,
// nem jármű-számszor. Ez szándékosan NEM azonos a fájl korábbi fejléc-
// kommentjében elvetett tartós/kérések-közötti cache-eléssel — mivel a
// backend minden HTTP-kérés végén megszűnik (nincs hosszú élettartamú
// worker-folyamat), a cookie sosem élhet túl egy request-nyi időt, tehát
// a "lejárt cookie" kockázat, amit az eredeti komment el akart kerülni,
// itt fel sem merül.
class GpsmartClient {
    private const BASE_URL = 'https://flottanavigacio.gpsmart.eu';

    private $felhasznalonev;
    private $jelszo;
    private $userId;
    private $cookie = null;

    public function __construct($felhasznalonev, $jelszo, $userId) {
        $this->felhasznalonev = $felhasznalonev;
        $this->jelszo = $jelszo;
        $this->userId = $userId;
    }

    public function lekerdezPoziciok() {
        $cookie = $this->bejelentkezesGyorsitva();
        $html = $this->pozicioLekerdezes($cookie);
        return $this->htmlFeldolgozas($html);
    }

    // Egy adott jármű (GPSmart saját `carID`-je, ld. `car_id` mező a
    // `lekerdezPoziciok()` válaszban) útvonal-előzménye egy dátum/idő-
    // tartományra — a `waybill.pl` végpont, ami a pozíció-lekérdezéstől
    // eltérő, gazdagabb HTML-táblát ad vissza: útvonalpontok (lat/lon/idő/
    // cím/sebesség), megállások/szakaszok (hivatali/magán, időtartam,
    // táv, csúcssebesség) és egy napi összesítő (táv/menetidő/állásidő).
    public function lekerdezUtvonal($carId, $datumTol, $datumIg, $idoTol = '00:00', $idoIg = '23:59') {
        $cookie = $this->bejelentkezesGyorsitva();
        $html = $this->utvonalLekerdezes($cookie, $carId, $datumTol, $datumIg, $idoTol, $idoIg);
        return $this->utvonalFeldolgozas($html);
    }

    // Csak az ELSŐ hívásnál jelentkezik be ténylegesen — utána a példányon
    // tárolt cookie-t adja vissza. Ha egy hívó mégis egy már lejárt/
    // érvénytelen cookie-val futtatna le egy lekérdezést (pl. a GPSmart
    // szerver oldalán, ritkán, egy kérésen belül járna le a munkamenet),
    // az a meglévő hibakezelésen (üres/hibás válasz → Exception a hívó
    // `try/catch`-ében) keresztül ugyanúgy látszik, mint eddig — ez a
    // gyorsítótárazás nem változtat a hibamódon, csak a gyakori, sikeres
    // esetben spórol meg felesleges bejelentkezéseket.
    private function bejelentkezesGyorsitva() {
        if ($this->cookie === null) {
            $this->cookie = $this->bejelentkezes();
        }
        return $this->cookie;
    }

    private function utvonalLekerdezes($cookie, $carId, $datumTol, $datumIg, $idoTol, $idoIg) {
        $url = self::BASE_URL . '/cgi-bin/waybill.pl?' . http_build_query([
            'Lang' => 'Hun',
            'UserID' => $this->userId,
            'Type' => 11,
            'Template' => 'template1',
            'carID' => $carId,
            'startDate' => $datumTol,
            'endDate' => $datumIg,
            'startTime' => $idoTol,
            'endTime' => $idoIg,
            'Excel' => 0,
            'Sablon' => 1,
            'driverID' => 0,
        ]);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Cookie: CGISESSID=' . $cookie],
            CURLOPT_TIMEOUT => 30,
        ]);
        $valasz = curl_exec($ch);
        $curlHiba = curl_error($ch);
        curl_close($ch);

        if ($valasz === false) {
            throw new Exception('GPSmart kapcsolódási hiba: ' . $curlHiba);
        }

        return $valasz;
    }

    // A `waybill.pl` egy `id="waybillTable"` táblázatot ad vissza, soron-
    // ként vegyesen: napi fejléc (`mainLine`), szakasz-kezdés (`startLine`,
    // km óra állás + hivatali/magán jelzés + kezdő időpont), útvonalpontok
    // (`data-zone` attribútummal jelölt sorok, az `onclick="googleMarker(
    // lat, lon, 'idő', this)"`-ből nyerjük ki a koordinátákat — ez
    // megbízhatóbb, mint a cellaindex, mert a rejtett diagnosztikai
    // oszlopok száma sablononként változhatna), szakasz-zárás (`stopLine`,
    // menetidő/táv/csúcssebesség), és a végén egy összesítő (`allSummaryLine`,
    // beágyazott `summaryTable`: hivatali/magán/összesen táv, menetidő,
    // állásidő).
    private function utvonalFeldolgozas($html) {
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8"?>' . $html);
        libxml_clear_errors();

        $tabla = $dom->getElementById('waybillTable');
        if (!$tabla) {
            return ['pontok' => [], 'szakaszok' => [], 'osszesito' => null];
        }
        $xpath = new DOMXPath($dom);

        $szoveg = function ($node) {
            return $node ? trim(str_replace("\xc2\xa0", ' ', $node->textContent)) : '';
        };

        $pontok = [];
        $szakaszok = [];
        $osszesito = null;
        $aktualisSzakasz = null;

        foreach ($tabla->getElementsByTagName('tr') as $sor) {
            $class = $sor->getAttribute('class');

            if ($sor->hasAttribute('data-zone')) {
                $onclick = $sor->getAttribute('onclick');
                if (preg_match('/googleMarker\(([\-0-9.]+),\s*([\-0-9.]+),\s*\'([^\']+)\'/', $onclick, $m)) {
                    $cellak = $sor->getElementsByTagName('td');
                    $pontok[] = [
                        'lat' => (float) $m[1],
                        'lon' => (float) $m[2],
                        'ido' => $m[3],
                        'cim' => $szoveg($cellak->item(2)),
                        'sebesseg' => $szoveg($cellak->item(4)),
                        'uzemanyag' => $szoveg($cellak->item(6)),
                        'akkumulator' => $szoveg($cellak->item(17)),
                    ];
                }
                continue;
            }

            if (strpos($class, 'startLine') !== false) {
                $ido = null;
                foreach ($sor->getElementsByTagName('input') as $inp) {
                    if ($inp->getAttribute('type') === 'hidden' && preg_match('/^\d{4}-\d{2}-\d{2}/', $inp->getAttribute('value'))) {
                        $ido = $inp->getAttribute('value');
                        break;
                    }
                }
                $img = $xpath->query('.//img[contains(@class,"roadType")]', $sor)->item(0);
                $aktualisSzakasz = [
                    'tol' => $ido,
                    'tipus' => $img ? $img->getAttribute('title') : null,
                ];
                continue;
            }

            if (strpos($class, 'stopLine') !== false) {
                if ($aktualisSzakasz) {
                    $megtettUt = null;
                    $maxSebesseg = null;
                    foreach ($sor->getElementsByTagName('td') as $td) {
                        if ($td->getAttribute('title') === 'Megtett út') {
                            $megtettUt = trim(preg_replace('/\s+/', ' ', $szoveg($td)));
                        }
                        if ($td->getAttribute('title') === 'Legnagyobb sebesség') {
                            $maxSebesseg = $szoveg($td);
                        }
                    }
                    $aktualisSzakasz['megtett_ut'] = $megtettUt;
                    $aktualisSzakasz['max_sebesseg'] = $maxSebesseg;
                    $szakaszok[] = $aktualisSzakasz;
                    $aktualisSzakasz = null;
                }
                continue;
            }

            if (strpos($class, 'allSummaryLine') !== false) {
                // NEM az első <table> a sorban — CAN-busz/óraállás-adatú
                // járműveknél GPSmart egy plusz, korábbi "CAN" táblát is
                // beszúr (óraállás/táv/üzemanyag/tengelyterhelés) a valódi
                // GPS-alapú Hivatali/Magán/Összesen tábla ELÉ, azonos
                // "summaryTable" class-szal — item(0) ilyenkor a rossz
                // táblát kapná el, és a sorAdat(2)/(3)/(4) index a CAN-
                // tábla más alakú soraira mutatna (üres/hibás összesítőt
                // eredményezve). A GPS táblát a "GPS" fejléc-cellája alapján
                // azonosítjuk, nem a sorrendje alapján.
                $summaryTable = null;
                foreach ($sor->getElementsByTagName('table') as $jeloltTabla) {
                    $fejlec = $xpath->query('.//td[normalize-space(text())="GPS"]', $jeloltTabla);
                    if ($fejlec->length > 0) {
                        $summaryTable = $jeloltTabla;
                        break;
                    }
                }
                if ($summaryTable) {
                    $sorAdat = function ($index) use ($summaryTable, $szoveg) {
                        $sorok = $summaryTable->getElementsByTagName('tr');
                        if (!$sorok->item($index)) {
                            return [];
                        }
                        $adat = [];
                        foreach ($sorok->item($index)->getElementsByTagName('td') as $td) {
                            $adat[] = $szoveg($td);
                        }
                        return $adat;
                    };
                    $tavolsag = $sorAdat(2);
                    $menetido = $sorAdat(3);
                    $allasido = $sorAdat(4);
                    $osszesito = [
                        'tavolsag_hivatali' => $tavolsag[1] ?? null,
                        'tavolsag_magan' => $tavolsag[2] ?? null,
                        'tavolsag_osszesen' => $tavolsag[3] ?? null,
                        'menetido' => $menetido[3] ?? null,
                        'allasido' => $allasido[3] ?? null,
                    ];
                }
                continue;
            }
        }

        return ['pontok' => $pontok, 'szakaszok' => $szakaszok, 'osszesito' => $osszesito];
    }

    private function bejelentkezes() {
        $ch = curl_init(self::BASE_URL . '/cgi-bin/login.cgi');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'Lang' => 'Hun',
                'Username' => $this->felhasznalonev,
                'Password' => $this->jelszo,
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => 20,
        ]);
        $valasz = curl_exec($ch);
        $curlHiba = curl_error($ch);
        $headerMeret = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        if ($valasz === false) {
            throw new Exception('GPSmart kapcsolódási hiba: ' . $curlHiba);
        }

        $headerek = substr($valasz, 0, $headerMeret);
        $torzs = substr($valasz, $headerMeret);

        if (!preg_match('/Set-Cookie:\s*CGISESSID=([a-f0-9]+)/i', $headerek, $matches)) {
            throw new Exception('GPSmart bejelentkezés sikertelen — nem érkezett munkamenet-cookie.');
        }

        // A login.cgi HTTP 200-at ad vissza sikertelen belépésnél is (rossz
        // jelszónál is kapunk cookie-t) — a tényleges sikert a válasz HTML
        // szövegében lévő visszaigazolás jelzi, ezért azt is ellenőrizzük,
        // nem csak a cookie meglétét.
        if (stripos($torzs, 'belépett') === false) {
            throw new Exception('GPSmart bejelentkezés sikertelen — ellenőrizd a felhasználónevet/jelszót.');
        }

        return $matches[1];
    }

    private function pozicioLekerdezes($cookie) {
        $url = self::BASE_URL . '/cgi-bin/getpositions.pl?' . http_build_query([
            'Lang' => 'Hun',
            'UserID' => $this->userId,
            'Type' => 11,
            'Template' => 'template1',
            'Sound' => 'true',
        ]);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Cookie: CGISESSID=' . $cookie],
            CURLOPT_TIMEOUT => 20,
        ]);
        $valasz = curl_exec($ch);
        $curlHiba = curl_error($ch);
        curl_close($ch);

        if ($valasz === false) {
            throw new Exception('GPSmart kapcsolódási hiba: ' . $curlHiba);
        }

        return $valasz;
    }

    // A `getpositions.pl` egy kész, `id="positionTable"` táblázatot ad
    // vissza — soronként egy jármű, fix oszlopsorrenddel (a szolgáltató
    // `Template=template1` sablonja szerint, élőben ellenőrizve):
    // 0 jelölőnégyzet, 1 ikon, 2 cég, 3 RENDSZÁM, 4 sofőr, 5 LATITUDE,
    // 6 LONGITUDE, 7 IRÁNY, 8 IDŐ, 9 CÍM, 10 zóna, 11 gyújtás,
    // 12 SEBESSÉG, 13 ÜZEMANYAG, 14 KM, 15-16 (üres/belső), 17 TÁVOLSÁG,
    // 18 last_route.
    private function htmlFeldolgozas($html) {
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8"?>' . $html);
        libxml_clear_errors();

        $tabla = $dom->getElementById('positionTable');
        if (!$tabla) {
            return [];
        }

        $szoveg = function ($cellak, $i) {
            $item = $cellak->item($i);
            if (!$item) {
                return '';
            }
            // A &nbsp; textContent-ben nem sima szóköz (U+00A0), a natív
            // trim() nem vágja le — kézzel cseréljük normál szóközre előtte.
            return trim(str_replace("\xc2\xa0", ' ', $item->textContent));
        };

        $poziciok = [];
        foreach ($tabla->getElementsByTagName('tr') as $sor) {
            if ($sor->getAttribute('id') === 'header') {
                continue;
            }
            $cellak = $sor->getElementsByTagName('td');
            $rendszam = $szoveg($cellak, 3);
            if ($rendszam === '') {
                continue;
            }

            $lat = $szoveg($cellak, 5);
            $lon = $szoveg($cellak, 6);
            $irany = $szoveg($cellak, 7);

            $poziciok[] = [
                'rendszam' => $rendszam,
                'lat' => is_numeric($lat) ? (float) $lat : null,
                'lon' => is_numeric($lon) ? (float) $lon : null,
                'irany' => is_numeric($irany) ? (float) $irany : null,
                'idopont' => $szoveg($cellak, 8),
                'cim' => $szoveg($cellak, 9),
                'sebesseg' => $szoveg($cellak, 12),
                'uzemanyag' => $szoveg($cellak, 13),
                'km' => $szoveg($cellak, 14),
                // A GPSmart saját belső jármű-azonosítója — ugyanez az
                // érték kell a `waybill.pl` (útvonal-előzmény) `carID`
                // paraméterébe, ld. `lekerdezUtvonal()`. Élőben ellenőrizve
                // (a felhasználó által kapott UserID->carID lista pontosan
                // ezekkel az értékekkel egyezett).
                'car_id' => $szoveg($cellak, 16),
            ];
        }

        return $poziciok;
    }
}
