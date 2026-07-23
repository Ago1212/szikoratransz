<?php

// Tachográf sofőrkártya-letöltés (.ddd, EU digitális tachográf szabványos
// bináris export) dekódere — kizárólag bináris feldolgozás, DB-kapcsolat és
// összes külső függőség nélkül (ugyanaz az elv, mint a CborDecoder.php /
// WebAuthnHelper.php párnál: nincs composer-csomag, egy szűk, konkrét
// esetkörre írt saját dekóder egyszerűbb, mint egy általános célú könyvtár).
//
// A blokk-keretezést és az alábbi FID-eket EBBEN a projektben, egy valódi
// mintafájlon (sofőrkártya-letöltés) tartalom-alapú ellenőrzéssel validáltuk,
// NEM hivatalos specifikációból — ld. részletek az egyes metódusoknál.
// Ahol egy blokk tartalma nem dekódolható megbízhatóan, a megfelelő metódus
// üres tömböt/null-t ad vissza egy figyelmeztetéssel, sosem kitalált adatot.
class DddParser {

    const TYPE_DATA_GEN1 = 0;
    const TYPE_SIGNATURE_GEN1 = 1;
    const TYPE_DATA_GEN2 = 2;
    const TYPE_SIGNATURE_GEN2 = 3;

    const FID_IDENTIFICATION = 0x0520;
    const FID_DRIVER_ACTIVITY = 0x0504;
    const FID_VEHICLES_USED = 0x0505;
    const FID_EVENTS = 0x0502;
    const FID_FAULTS = 0x0503;

    private $data;
    private $warnings = [];

    public function __construct($binaryData) {
        $this->data = $binaryData;
    }

    public function getWarnings() {
        return $this->warnings;
    }

    private function warn($message) {
        $this->warnings[] = $message;
    }

    // Blokk-keretezés: 2 bájt FID (big-endian) + 1 bájt típus + 2 bájt hossz
    // (big-endian) + payload. Típus 0/2 = adat (gen1/gen2), 1/3 = aláírás
    // (RSA 128 / ECC 64 bájt) — ez utóbbiakat átugorjuk, nem ellenőrizzük
    // (ld. a terv "Amit tudatosan NEM csinálunk" szakasza: nincs
    // kriptográfiai hitelesség-ellenőrzés ebben a körben). Egy adott FID-hez
    // ha gen1 ÉS gen2 verzió is szerepel a fájlban, az UTOLSÓ (gen2, mert az
    // mindig a gen1 UTÁN következik a fájlban) verzió nyer — a gen2 adat
    // bővebb/pontosabb. FONTOS: a generációt is eltároljuk blokkonként, mert
    // NEM minden EF azonos méretű/mezőkiosztású a két generációban (pl. a
    // Vehicles_Used gen2 rekordja 17 bájttal hosszabb — ld.
    // parseVehiclesUsed() — a rekordméretet ezért generációnként kell
    // eldönteni, nem szabad egy FID-re fixen feltételezni).
    private function walkBlocks() {
        $blocks = [];
        $pos = 0;
        $len = strlen($this->data);
        while ($pos + 5 <= $len) {
            $fid = (ord($this->data[$pos]) << 8) | ord($this->data[$pos + 1]);
            $type = ord($this->data[$pos + 2]);
            $blockLen = (ord($this->data[$pos + 3]) << 8) | ord($this->data[$pos + 4]);
            $dataStart = $pos + 5;
            if ($dataStart + $blockLen > $len) {
                $this->warn("A(z) $fid FID blokk hossza túlnyúlik a fájl végén, a bejárás megszakítva.");
                break;
            }
            if ($type === self::TYPE_DATA_GEN1 || $type === self::TYPE_DATA_GEN2) {
                $blocks[$fid] = [
                    'gen' => $type === self::TYPE_DATA_GEN1 ? 1 : 2,
                    'data' => substr($this->data, $dataStart, $blockLen),
                ];
            }
            $pos = $dataStart + $blockLen;
        }
        return $blocks;
    }

    // TimeReal: 4 bájtos, big-endian, unix-időbélyeg (UTC másodperc 1970-től).
    private static function timeReal($bytes) {
        $ts = (ord($bytes[0]) << 24) | (ord($bytes[1]) << 16) | (ord($bytes[2]) << 8) | ord($bytes[3]);
        if ($ts === 0) return null;
        return gmdate('Y-m-d H:i:s', $ts);
    }

    private static function trimText($text) {
        return rtrim($text, "\x20\x00");
    }

    // BCD Datef: 2 bájt BCD év + 1 bájt BCD hónap + 1 bájt BCD nap.
    private static function bcdDatef($bytes) {
        $bcdToInt = function ($b) {
            return (($b >> 4) & 0xF) * 10 + ($b & 0xF);
        };
        $year = $bcdToInt(ord($bytes[0])) * 100 + $bcdToInt(ord($bytes[1]));
        $month = $bcdToInt(ord($bytes[2]));
        $day = $bcdToInt(ord($bytes[3]));
        if ($year === 0 || $month === 0 || $day === 0) return null;
        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }

    // EF_Identification (kártyabirtokos-azonosítás), tag 0x0520, 143 bájt,
    // byte-pontosan validálva egy valódi mintafájlon (0 maradék bájt a
    // struktúra végén): issuingMemberState(1) + cardNumber(16, IA5) +
    // issuingAuthorityName(1 codepage + 35 text) + issueDate(4, TimeReal) +
    // validityBegin(4) + expiryDate(4) + holderSurname(1+35) +
    // holderFirstNames(1+35) + birthDate(4, BCD Datef) + preferredLanguage(2).
    public function parseIdentification($blocks) {
        if (!isset($blocks[self::FID_IDENTIFICATION])) {
            $this->warn('Az EF_Identification blokk (kártyabirtokos-azonosítás) nem található a fájlban.');
            return null;
        }
        $d = $blocks[self::FID_IDENTIFICATION]['data'];
        if (strlen($d) < 143) {
            $this->warn('Az EF_Identification blokk rövidebb a vártnál, kihagyva.');
            return null;
        }
        $offset = 0;
        $issuingMemberState = ord($d[$offset]); $offset += 1;
        $cardNumber = self::trimText(substr($d, $offset, 16)); $offset += 16;
        $offset += 1; // issuingAuthorityName codepage
        $issuingAuthorityName = self::trimText(substr($d, $offset, 35)); $offset += 35;
        $issueDate = self::timeReal(substr($d, $offset, 4)); $offset += 4;
        $validityBegin = self::timeReal(substr($d, $offset, 4)); $offset += 4;
        $expiryDate = self::timeReal(substr($d, $offset, 4)); $offset += 4;
        $offset += 1; // holderSurname codepage
        $holderSurname = self::trimText(substr($d, $offset, 35)); $offset += 35;
        $offset += 1; // holderFirstNames codepage
        $holderFirstNames = self::trimText(substr($d, $offset, 35)); $offset += 35;
        $birthDate = self::bcdDatef(substr($d, $offset, 4)); $offset += 4;
        $preferredLanguage = self::trimText(substr($d, $offset, 2)); $offset += 2;

        return [
            'issuingMemberState' => $issuingMemberState,
            'cardNumber' => $cardNumber,
            'issuingAuthorityName' => $issuingAuthorityName,
            'issueDate' => $issueDate,
            'validityBegin' => $validityBegin,
            'expiryDate' => $expiryDate,
            'holderSurname' => $holderSurname,
            'holderFirstNames' => $holderFirstNames,
            'birthDate' => $birthDate,
            'preferredLanguage' => $preferredLanguage,
        ];
    }

    // ActivityChangeInfo (16 bites): bit15=slot(0=vezető/1=társ),
    // bit14=személyzet, bit13=kártya-státusz(0=behelyezve/1=kivéve),
    // bitek12-11=tevékenység(00=PIHENŐ,01=RENDELKEZÉSRE ÁLLÁS,10=MUNKA,
    // 11=VEZETÉS), bitek10-0=percek éjfél óta.
    private static function decodeActivityChange($word) {
        $slot = ($word >> 15) & 0x1;
        $crew = ($word >> 14) & 0x1;
        $cardStatus = ($word >> 13) & 0x1;
        $activityCode = ($word >> 11) & 0x3;
        $minutes = $word & 0x7FF;
        $activityMap = [0 => 'piheno', 1 => 'rendelkezesre_allas', 2 => 'munka', 3 => 'vezetes'];
        return [
            'perc' => $minutes,
            'tevekenyseg' => $activityMap[$activityCode],
            'slot' => $slot === 0 ? 'vezeto' : 'tars',
            'szemelyzet' => (bool) $crew,
            'kartya_kivetel' => (bool) $cardStatus,
        ];
    }

    // EF_Driver_Activity_Data, tag 0x0504, ciklikus puffer: 2 bájt
    // oldestPointer + 2 bájt newestPointer, majd a ciklikus adatterület (a
    // fennmaradó bájtok, a 4 bájtos fejléc UTÁN kezdődik). Napi rekord:
    // activityPreviousRecordLength(2) + activityRecordLength(2) +
    // activityRecordDate(4, TimeReal) + activityDailyPresenceCounter(2) +
    // activityDayDistance(2, km) + activityChangeInfo[] (2 bájt/elem, elemszám
    // = (rekordhossz-12)/2). A newestPointer-től visszafelé járjuk be
    // (pos -= prevLen, moduló a puffer méretével) — egy valódi mintafájlon
    // 40 egymást követő, hézagmentes naptári napra validálva.
    public function parseDailyActivity($blocks, $maxDays = 60) {
        if (!isset($blocks[self::FID_DRIVER_ACTIVITY])) {
            $this->warn('Az EF_Driver_Activity_Data blokk (napi tevékenység) nem található a fájlban.');
            return [];
        }
        $d = $blocks[self::FID_DRIVER_ACTIVITY]['data'];
        if (strlen($d) < 4) {
            $this->warn('Az EF_Driver_Activity_Data blokk túl rövid, kihagyva.');
            return [];
        }
        $newestPointer = (ord($d[2]) << 8) | ord($d[3]);
        $cyclic = substr($d, 4);
        $bufLen = strlen($cyclic);
        if ($bufLen === 0) return [];

        $days = [];
        $pos = $newestPointer;
        $seen = 0;
        $visited = [$pos => true];
        while ($seen < $maxDays && $bufLen > 0) {
            if ($pos < 0 || $pos + 12 > $bufLen) break;
            $prevLen = (ord($cyclic[$pos]) << 8) | ord($cyclic[$pos + 1]);
            $recLen = (ord($cyclic[$pos + 2]) << 8) | ord($cyclic[$pos + 3]);
            $date = self::timeReal(substr($cyclic, $pos + 4, 4));
            $presenceCounter = (ord($cyclic[$pos + 8]) << 8) | ord($cyclic[$pos + 9]);
            $distance = (ord($cyclic[$pos + 10]) << 8) | ord($cyclic[$pos + 11]);

            $changesCount = $recLen > 12 ? intdiv($recLen - 12, 2) : 0;
            $changes = [];
            for ($i = 0; $i < $changesCount; $i++) {
                $wordOffset = $pos + 12 + $i * 2;
                if ($wordOffset + 2 > $bufLen) break;
                $word = (ord($cyclic[$wordOffset]) << 8) | ord($cyclic[$wordOffset + 1]);
                $changes[] = self::decodeActivityChange($word);
            }

            // Percek/tevékenység-típusonként összesítve az egymást követő
            // állapotváltások közötti időkülönbségből (az utolsó változástól
            // éjfélig tartó szakaszt nem számoljuk — a nap már véget ért).
            $percek = ['vezetes' => 0, 'munka' => 0, 'rendelkezesre_allas' => 0, 'piheno' => 0];
            for ($i = 0; $i < count($changes) - 1; $i++) {
                $delta = $changes[$i + 1]['perc'] - $changes[$i]['perc'];
                if ($delta < 0) continue;
                $percek[$changes[$i]['tevekenyseg']] += $delta;
            }

            if ($date !== null) {
                $days[] = [
                    'datum' => substr($date, 0, 10),
                    'tavolsagKm' => $distance,
                    'jelenletiSzamlalo' => $presenceCounter,
                    'aktivitasValtasok' => $changes,
                    'vezetesPerc' => $percek['vezetes'],
                    'munkaPerc' => $percek['munka'],
                    'rendelkezesreAllasPerc' => $percek['rendelkezesre_allas'],
                    'pihenoPerc' => $percek['piheno'],
                ];
            }

            $seen++;
            if ($prevLen === 0) break;
            $pos -= $prevLen;
            if ($pos < 0) $pos += $bufLen;
            if (isset($visited[$pos])) {
                $this->warn('A napi tevékenység ciklikus puffer bejárása visszaért egy már látott pozícióra — a bejárás itt megállt (a puffer teljes körbeérése).');
                break;
            }
            $visited[$pos] = true;
        }
        return $days;
    }

    // EF_Vehicles_Used, tag 0x0505 — EBBEN a fájlban tartalom-alapú
    // ellenőrzéssel (odométer-lánc folytonossága, ép 2026-os dátumok, tiszta
    // ASCII rendszám-szöveg) validálva: 2 bájt fejléc (a legújabb rekord
    // 0-alapú indexe — NEM bájt-eltolás, ez egy egyszerű, sorban feltöltött
    // tömb, NEM ciklikus puffer, ellentétben a napi tevékenység blokkal!),
    // utána egyenletesen fix méretű CardVehicleRecord-ok, sorban 0-tól.
    // A gen1 rekord 31 bájt: odometerBegin(3) + odometerEnd(3) +
    // firstUse(4, TimeReal) + lastUse(4, TimeReal) + registrationNation(1) +
    // registrationNumber(1 codepage + 13 karakter) + vuDataBlockCounter(2).
    // A gen2 rekord ugyanez +17 bájt: egy vehicleIdentificationNumber (VIN,
    // 17 karakteres IA5 szöveg) mező a végén, tehát 48 bájt/rekord — ezt is
    // ugyanezen a mintafájlon, a rekordok végén megjelenő valódi, 17
    // karakteres, ép ASCII VIN-szöveggel (pl. "XLRTEH4300G310234") validáltuk.
    // A rekordméret ezért a blokk GENERÁCIÓJÁTÓL függ, nem fix — enélkül a
    // gen2 adatot gen1 rekordmérettel olvasva minden rekord után progresszíven
    // elcsúszna (ez történt egy korábbi, hibás verzióban).
    public function parseVehiclesUsed($blocks, $maxRecords = 200) {
        if (!isset($blocks[self::FID_VEHICLES_USED])) {
            $this->warn('Az EF_Vehicles_Used blokk (felhasznált járművek) nem található a fájlban.');
            return [];
        }
        $gen = $blocks[self::FID_VEHICLES_USED]['gen'];
        $d = $blocks[self::FID_VEHICLES_USED]['data'];
        if (strlen($d) < 2) {
            $this->warn('Az EF_Vehicles_Used blokk túl rövid, kihagyva.');
            return [];
        }
        $recordsArea = substr($d, 2);
        $recSize = $gen === 2 ? 48 : 31;
        $count = intdiv(strlen($recordsArea), $recSize);
        $vehicles = [];
        for ($i = 0; $i < min($count, $maxRecords); $i++) {
            $rec = substr($recordsArea, $i * $recSize, $recSize);
            $odoBegin = (ord($rec[0]) << 16) | (ord($rec[1]) << 8) | ord($rec[2]);
            $odoEnd = (ord($rec[3]) << 16) | (ord($rec[4]) << 8) | ord($rec[5]);
            $firstUse = self::timeReal(substr($rec, 6, 4));
            $lastUse = self::timeReal(substr($rec, 10, 4));
            $nation = ord($rec[14]);
            $regNumber = self::trimText(substr($rec, 16, 13));
            $counter = (ord($rec[29]) << 8) | ord($rec[30]);
            $vin = $gen === 2 ? self::trimText(substr($rec, 31, 17)) : null;

            if ($odoBegin === 0 && $odoEnd === 0 && $firstUse === null && $regNumber === '') {
                break; // üres, még nem használt kapacitás — a tömb vége
            }

            $vehicles[] = [
                'odometerBegin' => $odoBegin,
                'odometerEnd' => $odoEnd,
                'firstUse' => $firstUse,
                'lastUse' => $lastUse,
                'nation' => $nation,
                'rendszam' => $regNumber,
                'counter' => $counter,
                'vin' => $vin,
            ];
        }
        return $vehicles;
    }

    // EF_Events_Data (tag 0x0502) / EF_Faults_Data (tag 0x0503) — a pontos
    // FID-eket EBBEN a fájlban a blokk-sorrend (Application_Identification
    // UTÁN, Driver_Activity_Data ELŐTT — ez megegyezik a standard EF-sorrend
    // ismert konvenciójával), a tiszta 24-bájtos rekordhosszra való osztás
    // (72, ill. 48 rekord) és a rekord-tartalom mintázata (minden rekord
    // NULLA/szóköz-feltöltött — ez ennél a konkrét sofőrnél tényleg 0
    // esemény/hiba előfordulást jelent, nem dekódolási hibát) alapján
    // azonosítottuk. **Ez a blokk NEM validálható byte-pontosan valós,
    // ténylegesen kitöltött rekorddal** (ehhez egy olyan mintafájl kellene,
    // aminek van rögzített eseménye/hibája) — a rekord-struktúra
    // (típus(1)+kezdet(4,TimeReal)+vég(4,TimeReal)+rendszám-nemzet(1)+
    // rendszám(1 codepage+13 karakter)=24 bájt) az EU Annex 1C szabvány
    // publikus, jól ismert CardEventRecord/CardFaultRecord mezőszerkezete.
    // Ha egy jövőbeli fájlban ez a feltételezés tévesnek bizonyul (pl. a
    // dekódolt típus-kód/dátum nem tűnik értelmesnek), a hívó oldal ezt a
    // metódust felül kell vizsgálja — itt csak a nyilvánvalóan hibás
    // (pl. jövőbeli/1970 előtti) rekordokat szűrjük ki védekezésül.
    public function parseEventsOrFaults($blocks, $fid, $maxRecords = 200) {
        if (!isset($blocks[$fid])) {
            return [];
        }
        $d = $blocks[$fid]['data'];
        $recSize = 24;
        $count = intdiv(strlen($d), $recSize);
        $items = [];
        for ($i = 0; $i < min($count, $maxRecords); $i++) {
            $rec = substr($d, $i * $recSize, $recSize);
            $type = ord($rec[0]);
            $begin = self::timeReal(substr($rec, 1, 4));
            $end = self::timeReal(substr($rec, 5, 4));
            $nation = ord($rec[9]);
            $regNumber = self::trimText(substr($rec, 10, 14));

            if ($type === 0 && $begin === null) {
                continue; // üres kapacitás-slot, nem valós esemény/hiba
            }
            // Védekező szűrés: ha a dátum a kártya-kiállítás elé (jóval
            // 2000 elé) esne, ez a rekord nagy eséllyel hibásan dekódolt,
            // nem valós adat — inkább kihagyjuk, mint kitalált infót adjunk.
            if ($begin !== null && $begin < '2000-01-01') {
                continue;
            }

            $items[] = [
                'tipus' => $type,
                'kezdet' => $begin,
                'veg' => $end,
                'nation' => $nation,
                'rendszam' => $regNumber,
            ];
        }
        return $items;
    }

    // Teljes fájl feldolgozása egy strukturált tömbbé. Minden szekció
    // önmagában is hibatűrő (ld. az egyes metódusok figyelmeztetés-elve) —
    // egy sikertelen szekció nem dobja el a többit.
    public function parse() {
        $blocks = $this->walkBlocks();
        return [
            'identification' => $this->parseIdentification($blocks),
            'napiAktivitas' => $this->parseDailyActivity($blocks),
            'jarmuvek' => $this->parseVehiclesUsed($blocks),
            'esemenyek' => $this->parseEventsOrFaults($blocks, self::FID_EVENTS),
            'hibak' => $this->parseEventsOrFaults($blocks, self::FID_FAULTS),
            'warnings' => $this->warnings,
        ];
    }
}
