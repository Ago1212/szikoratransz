<?php
// Vezetési idő GPS-alapú javaslat napi frissítése — biztonsági háló azokra
// a cégekre/napokra, ahol senki nem nyitja meg élőben a Flottakövetést
// (aminek "Megtett út (ma)" élő lekérdezése — lekerdezMegtettUtMa() —
// mellékhatásként maga is frissíti ezt a cache-t, ld. GpsmartInterface
// komment). E nélkül azoknál a sofőröknél a Vezetési idő oldal GPS-
// javaslata sosem frissülne aznap, ha épp senki nem néz rá a
// Flottakövetésre.
//
// Csak a MAI napra fut — nincs "hiányzó napok" ablak, mint a napi
// km-cachenél (ld. gpsmart_km_cache_frissites.php), mert a javaslat
// KIZÁRÓLAG a mai napra értelmezhető (a sofőr↔kamion hozzárendelés csak
// "most" megbízható, ld. gpsmart_vezetesi_javaslat migráció komment).
//
// Ez a script NEM az api.php-n keresztül fut — HTTP-kontextus és
// authHash/session nélküli, önálló CLI/cron script (ld.
// gpsmart_km_cache_frissites.php azonos mintája).
//
// Crontab-bejegyzés (a tényleges elérési utat/PHP-verziót a szerverhez
// igazítva) — javasolt: naponta egyszer, kora este (amikor a nap nagy
// része már megtörtént, de a sofőr még be tud jelentkezni és menteni):
//   0 20 * * *  /usr/bin/php8.2 /var/www/szikoratransz/backend/cron/vezetesi_ido_javaslat_frissites.php >> /var/www/szikoratransz/backend/cron/vezetesi_ido_javaslat_frissites.log 2>&1

require __DIR__ . '/../db.php';
require __DIR__ . '/../config.php';
require __DIR__ . '/../interface/gpsmartInterface.php';
// `gpsmartInterface.php` a saját fájlja végén már példányosítja a globális
// `$gpsmartInterface`-t (ugyanaz a minta, mint ApiHandler.php-ban) — nem
// hozunk létre külön második példányt.

$database = new Database();
$db = $database->connect();

$cegek = $db->query('SELECT admin FROM gpsmart_beallitasok')->fetchAll(PDO::FETCH_COLUMN);

foreach ($cegek as $cegId) {
    try {
        // A visszaadott "megtett út" adatot itt nem használjuk — a cron
        // célja kizárólag a hívás MELLÉKHATÁSA (a gpsmart_vezetesi_javaslat
        // cache frissítése minden jelenleg kamionhoz rendelt sofőrre).
        $eredmeny = $gpsmartInterface->lekerdezMegtettUtMa($cegId);
        if ($eredmeny['success']) {
            $jarmuSzam = count($eredmeny['jarmuvek'] ?? []);
            echo date('Y-m-d H:i:s') . " OK ceg={$cegId} ({$jarmuSzam} jármű feldolgozva)\n";
        } else {
            echo date('Y-m-d H:i:s') . " HIBA ceg={$cegId}: {$eredmeny['message']}\n";
        }
    } catch (Exception $e) {
        echo date('Y-m-d H:i:s') . " KIVÉTEL ceg={$cegId}: {$e->getMessage()}\n";
    }
}
