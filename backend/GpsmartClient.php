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
// Minden `lekerdezPoziciok()` hívás önálló bejelentkezéssel indul — a
// cookie sehol nincs gyorsítótárazva. Napi néhány (menüpont-megnyitásnyi)
// lekérdezésnél ez nem számottevő többletterhelés, cserébe sosem kell
// lejárt-cookie hibával foglalkozni.
class GpsmartClient {
    private const BASE_URL = 'https://flottanavigacio.gpsmart.eu';

    private $felhasznalonev;
    private $jelszo;
    private $userId;

    public function __construct($felhasznalonev, $jelszo, $userId) {
        $this->felhasznalonev = $felhasznalonev;
        $this->jelszo = $jelszo;
        $this->userId = $userId;
    }

    public function lekerdezPoziciok() {
        $cookie = $this->bejelentkezes();
        $html = $this->pozicioLekerdezes($cookie);
        return $this->htmlFeldolgozas($html);
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
            ];
        }

        return $poziciok;
    }
}
