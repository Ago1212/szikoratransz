<?php

// Google Gemini vision API kliens a Fuvar-dokumentum OCR-hez (ld.
// docs/superpowers/specs/2026-07-25-fuvar-dokumentum-ocr-design.md, 5.
// pont). Nyers curl-hívás, nem SDK — a projektnek nincs composer.json-ja,
// ugyanaz az elv, mint a NavSzamlaClient/GpsmartClient osztályoknál. A
// modellválasztás (gemini-3.5-flash) és a prompt egy valódi, élő API-
// hívással lett leellenőrizve a tervezési fázisban a két mintadokumentumon
// (kézzel írott fuvarlevél + nyomtatott szállítólevél) mielőtt
// implementációra került volna.
//
// Több API-kulcs + kulcs-rotáció (2026-07-25, élesben megfigyelt kvóta-
// probléma után bevezetve): a Gemini ingyenes szintjének napi kvótája
// (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, modellenként 20
// hívás/nap) **Google Cloud PROJEKTENKÉNT** van korlátozva, nem
// kulcsonként — ugyanabban a projektben generált több kulcs mind
// ugyanazt a kvótát osztaná. Ezért a `$apiKeys` lista minden eleme egy
// KÜLÖN Google Cloud projektben generált kulcs kell legyen, hogy valódi,
// egymástól független kvótát adjanak. `extractFuvarAdatok()` sorban
// próbálja a kulcsokat, és csak akkor lép a következőre, ha a hívás
// kifejezetten HTTP 429 (kvóta-túllépés) hibát adott — egy más jellegű
// hiba (hálózati hiba, érvénytelen kérés) nem kulcs-specifikus, azt nem
// próbáljuk újra másik kulccsal.
class GeminiOcrClient {
    const MODEL = 'gemini-3.5-flash';
    const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
    const TIMEOUT_MASODPERC = 60;
    const HTTP_KVOTA_TULLEPVE = 429;
    const HTTP_SZOLGALTATAS_TULTERHELT = 503;

    private $apiKeys;

    // `$apiKeys` — tömb vagy egyetlen string (visszafelé kompatibilitás
    // miatt); üres bejegyzések kiszűrve.
    public function __construct($apiKeys) {
        $lista = is_array($apiKeys) ? $apiKeys : [$apiKeys];
        $this->apiKeys = array_values(array_filter($lista, function ($kulcs) {
            return !empty($kulcs);
        }));
    }

    // `$sajatCegnev` — a hívó cég neve (admin.cegnev), hogy a modell meg
    // tudja különböztetni a saját cégünket (fuvarozó, a dokumentum
    // nyomtatott fejlécén) a tényleges megbízótól. `null`/üres esetén is
    // működik, csak kevésbé megbízhatóan tudja majd ezt a megkülönböztetést
    // megtenni.
    public function extractFuvarAdatok($imageBytes, $mimeType, $sajatCegnev = null) {
        if (empty($this->apiKeys)) {
            return null;
        }

        foreach ($this->apiKeys as $apiKey) {
            [$adatok, $probalkozzunkMasKulccsal] = $this->hivasEgyKulccsal($apiKey, $imageBytes, $mimeType, $sajatCegnev);
            if ($adatok !== null) {
                return $adatok;
            }
            if (!$probalkozzunkMasKulccsal) {
                return null;
            }
            // Kvóta-túllépés (429) VAGY átmeneti túlterheltség (503) esetén
            // megyünk a listában a következő kulcsra — mindkettő a HÍVOTT
            // kulcs/projekt aktuális állapotára jellemző, nem a kérésre
            // magára, úgyhogy egy másik (külön GCP projektbeli) kulcs
            // sikerrel járhat még akkor is, ha az első 503-at adott.
        }

        return null;
    }

    // Visszaad egy [adatok|null, probalkozzunkMasKulccsal] párost — a hívó ez
    // alapján dönti el, hogy próbálkozzon-e a következő kulccsal (429 vagy
    // 503 esetén igen, minden más hibánál nem érdemes, mert nem kulcs-
    // specifikus).
    private function hivasEgyKulccsal($apiKey, $imageBytes, $mimeType, $sajatCegnev) {
        $payload = [
            'contents' => [[
                'parts' => [
                    ['text' => $this->buildPrompt($sajatCegnev)],
                    ['inline_data' => ['mime_type' => $mimeType, 'data' => base64_encode($imageBytes)]],
                ],
            ]],
            // `maxOutputTokens` explicit megadása KRITIKUS: a `gemini-3.5-flash`
            // "thinking" modell a válasz-token-keretet a látható JSON-kimenet
            // ÉS a belső "gondolkodási" token-felhasználás (`thoughtsTokenCount`
            // a válaszban) közt osztja meg — élő teszttel megerősítve (2026-07-25,
            // Task 5 end-to-end curl-ellenőrzés), hogy `maxOutputTokens` nélkül a
            // válasz a JSON közepén (jellemzően az utolsó mező, `egyeb_megjegyzes`
            // értéke közben, még a záró `}` előtt) csendben levágódott —
            // `finishReason` ekkor sem `MAX_TOKENS`-t, a válasz mégis érvénytelen,
            // nem parse-olható JSON-fragmens volt, amit `json_decode()` `null`-ra
            // old fel, tehát az egész OCR-hívás hamis "hiba" állapotot adott
            // vissza egy ténylegesen sikeres, csak túl szűkre szabott hívás után.
            // 8192 (a `Task 5` curl-ellenőrzésben ~2150 gondolkodási + ~250
            // látható token volt szükséges egyetlen dokumentumhoz) bőséges
            // tartalék mind a gondolkodásra, mind egy hosszabb, több mezős
            // dokumentumra.
            'generationConfig' => ['responseMimeType' => 'application/json', 'maxOutputTokens' => 8192],
        ];

        $url = self::ENDPOINT . self::MODEL . ':generateContent?key=' . urlencode($apiKey);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => self::TIMEOUT_MASODPERC,
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlHiba = curl_error($ch);
        curl_close($ch);

        if ($body === false || $curlHiba !== '' || $status !== 200) {
            $probalkozzunkMasKulccsal = in_array($status, [self::HTTP_KVOTA_TULLEPVE, self::HTTP_SZOLGALTATAS_TULTERHELT], true);
            return [null, $probalkozzunkMasKulccsal];
        }

        $valasz = json_decode($body, true);
        $szoveg = $valasz['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if ($szoveg === null) {
            return [null, false];
        }

        $adatok = json_decode($szoveg, true);
        return [is_array($adatok) ? $adatok : null, false];
    }

    private function buildPrompt($sajatCegnev) {
        $ceg = ($sajatCegnev !== null && trim((string) $sajatCegnev) !== '') ? $sajatCegnev : '(ismeretlen)';
        return <<<PROMPT
Ez egy magyar fuvarozási cég dokumentuma (fuvarlevél vagy szállítólevél).
Nyerd ki belőle a következő adatokat, és KIZÁRÓLAG egy JSON objektumot adj vissza,
pontosan ezzel a sémával:

{
  "tipus": "fuvarlevel" | "szallitolevel" | "ismeretlen",
  "rendszam": string | null,
  "sofor_neve": string | null,
  "datum": "YYYY-MM-DD" | null,
  "felrako": string | null,
  "lerako": string | null,
  "megbizo": string | null,
  "aru_megnevezese": string | null,
  "suly": string | null,
  "tavolsag_km": number | null,
  "tomeg_kg": number | null,
  "fuvarlevel_szam": string | null,
  "egyeb_megjegyzes": string | null
}

Szabályok:
- Ha egy mező nem olvasható vagy nem szerepel a dokumentumon, írj null-t - SOHA ne
  találj ki adatot.
- A fuvarlevél gyakran kézzel írott (kurzív magyar kézírás) - tégy meg mindent, hogy
  ezt is elolvasd, de ha bizonytalan vagy egy karakterben/számban, inkább a
  legvalószínűbb értéket add vissza, és jelezd az egyeb_megjegyzes mezőben, hogy
  bizonytalan vagy benne.
- Ha a dokumentumon több megálló/helyszín szerepel egy útvonalban (pl. több
  lerakási pont), az ELSŐ helyszínt vedd felrakónak, az UTOLSÓT lerakónak, a
  köztes megállókat sorold fel az egyeb_megjegyzes mezőben.
- FONTOS: a dokumentumot kiállító/nyomtató cég neve "{$ceg}" - ez a MI SAJÁT
  cégünk, a fuvarozó (aki a fuvart TELJESÍTI), SOHA nem lehet a "megbizo" mező
  értéke, még akkor sem, ha a fejlécben/nyomtatott logóban szerepel.
- A "megbizo" mező a fuvart MEGRENDELŐ/megbízó céget jelenti - fuvarlevélen
  jellemzően egy "Fuvaroztató neve, címe" vagy hasonló feliratú mezőben található
  (ez NEM a fuvarozó, hanem az ügyfél, aki a fuvart megrendelte), szállítólevélen
  a "Vevő" mező.
- A dokumentum alján gyakran szerepel a fuvar távolsága (km) és a szállítmány
  tömege - mindkettő TISZTÁN NUMERIKUS értékként adandó vissza, mértékegység
  nélkül (pl. "tavolsag_km": 450, ne "450 km"). Ha a tömeg tonnában (t) van
  megadva, számítsd át kg-ra (1 t = 1000 kg) - a "tomeg_kg" mező mindig
  kilogrammban értendő. Ha bármelyik nem olvasható vagy nem szerepel a
  dokumentumon, írj null-t.
PROMPT;
    }
}
