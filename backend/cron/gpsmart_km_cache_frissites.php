<?php
// GPSmart napi km-gyorsítótár (`gpsmart_napi_km`) feltöltése — háttérben,
// ütemezve tölti fel a hiányzó (lezárt) napokat, hogy a Pénzforgalom oldal
// Ft/km mutatója (ld. koltsegInterface.php getKoltsegOsszesito) SOSE
// kényszerüljön élő GPSmart-hívásra oldalbetöltéskor — egy hosszú, ritkán
// használt rés szinkron feltöltése időtúllépés-veszélyes lenne (ugyanaz az
// ok, ami miatt `GpsmartInterface::MAX_UTVONAL_NAPOK` is létezik).
//
// Szándékosan KORLÁTOZOTT MÉRETŰ munkát végez egy futtatás alatt
// (`MAX_CSOMAG_JARMUVENKENT` db 7-napos csomag / jármű / futtatás) — ha
// egy cég hetekig nem nyitja meg az oldalt, a rés nem egyszerre, egy
// potenciálisan időtúllépő rohamlekérdezéssel töltődik fel, hanem
// apránként, minden futtatással kicsit kevesebb marad belőle.
//
// A mai napot sosem cache-eli (ld. GpsmartInterface::frissitNapiKm
// komментje) — a nap még nem zárult le, azt mindig élőben kell lekérdezni,
// ha valakinek pont arra van szüksége.
//
// Ez a script NEM az api.php-n keresztül fut — HTTP-kontextus és
// authHash/session nélküli, önálló CLI/cron script (ld. lejarat_emlekezteto.php
// azonos mintája).
//
// Crontab-bejegyzés (a tényleges elérési utat/PHP-verziót a szerverhez
// igazítva) — óránkénti futtatás javasolt, hogy a rés folyamatosan,
// kis lépésekben csökkenjen:
//   0 * * * *  /usr/bin/php8.2 /var/www/szikoratransz/backend/cron/gpsmart_km_cache_frissites.php >> /var/www/szikoratransz/backend/cron/gpsmart_km_cache_frissites.log 2>&1

require __DIR__ . '/../db.php';
require __DIR__ . '/../config.php';
require __DIR__ . '/../interface/gpsmartInterface.php';
// `gpsmartInterface.php` a saját fájlja végén már példányosítja a globális
// `$gpsmartInterface`-t (ugyanaz a minta, mint ApiHandler.php-ban) — nem
// hozunk létre külön második példányt.

$database = new Database();
$db = $database->connect();

const ABLAK_NAPOK = 90; // meddig menjünk vissza a hiányzó napok keresésekor
const MAX_CSOMAG_JARMUVENKENT = 2; // max. hány 7-napos csomagot töltünk fel / jármű / futtatás

$datumIg = date('Y-m-d', strtotime('-1 day'));
$datumTol = date('Y-m-d', strtotime('-' . ABLAK_NAPOK . ' days'));

$cegek = $db->query('SELECT admin FROM gpsmart_beallitasok')->fetchAll(PDO::FETCH_COLUMN);

foreach ($cegek as $cegId) {
    $poziciok = $gpsmartInterface->lekerdezPoziciok($cegId);
    if (!$poziciok['success']) {
        // Rossz/lejárt GPSmart-hitelesítés vagy átmeneti hálózati hiba —
        // a következő futtatás úgyis újra próbálja, nem állítjuk le emiatt
        // a többi cég feldolgozását.
        echo date('Y-m-d H:i:s') . " HIBA ceg={$cegId}: {$poziciok['message']}\n";
        continue;
    }

    foreach ($poziciok['poziciok'] as $p) {
        // A furgon önhajtó jármű, mint a kamion — ugyanúgy feldolgozzuk a
        // napi km-gyorsítótár szempontjából (ld. GpsmartInterface komment).
        if ((empty($p['kamion_id']) && empty($p['furgon_id'])) || empty($p['car_id'])) {
            continue;
        }
        $jarmuTipus = !empty($p['furgon_id']) ? 'furgon' : 'kamion';
        $jarmuId = !empty($p['furgon_id']) ? $p['furgon_id'] : $p['kamion_id'];

        $hianyzoNapok = $jarmuTipus === 'furgon'
            ? $gpsmartInterface->getNapiKmHianyzoNapok(null, $datumTol, $datumIg, $jarmuId)
            : $gpsmartInterface->getNapiKmHianyzoNapok($jarmuId, $datumTol, $datumIg);
        if (empty($hianyzoNapok)) {
            continue;
        }

        // A hiányzó napokat legfeljebb 7 naptári napot lefedő csomagokra
        // bontjuk — egy csomag akkor is lefedhet már cache-elt napot, ha az
        // épp a hiányzó napok közé esik (a `frissitNapiKm` idempotens,
        // egy már meglévő nap felülírása ártalmatlan).
        $csomagok = [];
        $i = 0;
        while ($i < count($hianyzoNapok)) {
            $csomagTol = $hianyzoNapok[$i];
            $csomagIg = date('Y-m-d', strtotime($csomagTol . ' +6 days'));
            if ($csomagIg > $datumIg) {
                $csomagIg = $datumIg;
            }
            $csomagok[] = [$csomagTol, $csomagIg];
            while ($i < count($hianyzoNapok) && $hianyzoNapok[$i] <= $csomagIg) {
                $i++;
            }
        }

        $feltoltottCsomagok = 0;
        foreach ($csomagok as [$csomagTol, $csomagIg]) {
            if ($feltoltottCsomagok >= MAX_CSOMAG_JARMUVENKENT) {
                break;
            }
            try {
                $eredmeny = $jarmuTipus === 'furgon'
                    ? $gpsmartInterface->frissitNapiKm($cegId, $p['car_id'], null, $csomagTol, $csomagIg, $jarmuId)
                    : $gpsmartInterface->frissitNapiKm($cegId, $p['car_id'], $jarmuId, $csomagTol, $csomagIg);
                if ($eredmeny['success']) {
                    $feltoltottCsomagok++;
                    echo date('Y-m-d H:i:s') . " OK ceg={$cegId} {$jarmuTipus}={$jarmuId} {$csomagTol}..{$csomagIg} ({$eredmeny['cachelt_napok']} nap)\n";
                } else {
                    echo date('Y-m-d H:i:s') . " HIBA ceg={$cegId} {$jarmuTipus}={$jarmuId} {$csomagTol}..{$csomagIg}: {$eredmeny['message']}\n";
                }
            } catch (Exception $e) {
                echo date('Y-m-d H:i:s') . " KIVÉTEL ceg={$cegId} {$jarmuTipus}={$jarmuId} {$csomagTol}..{$csomagIg}: {$e->getMessage()}\n";
            }
        }
    }
}
