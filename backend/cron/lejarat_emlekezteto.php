<?php
// Lejárat-emlékeztető — a P0 audit-tétel megvalósítása: eddig egyetlen
// lejáró határidő (jogosítvány, ADR, műszaki, biztosítás, karbantartás
// stb.) sem generált automatikus értesítést, csak akkor derült ki, ha
// valaki manuálisan megnyitotta az admin naptárt (ApiHandler::getEsemenyek).
//
// Ez a script NEM az api.php-n keresztül fut — HTTP-kontextus és
// authHash/session nélküli, önálló CLI/cron script, ami minden aktív
// adminhoz összegyűjti a következő 30 napban lejáró tételeit, és ha van
// ilyen, egy összefoglaló e-mailt küld neki. Naponta egyszeri futásra
// való (a napi ismétlés ellen nincs "már elküldve" jelző — ha ez zavaró,
// legegyszerűbb megoldás egy `elmelekeztetve` dátum-oszlop hozzáadása
// az érintett táblákhoz egy következő körben).
//
// Crontab-bejegyzés (a tényleges elérési utat/PHP-verziót a szerverhez
// igazítva):
//   0 7 * * *  /usr/bin/php8.2 /var/www/szikoratransz/backend/cron/lejarat_emlekezteto.php >> /var/www/szikoratransz/backend/cron/lejarat_emlekezteto.log 2>&1

// A fájl a `backend/` alatt, a webroot-on belül él — .htaccess-kizárás
// nélkül bárki, hitelesítés (authHash/session) nélkül közvetlenül
// lehívhatná HTTP-n (pl. `GET /cron/lejarat_emlekezteto.php`), ami
// tetszőleges gyakoriságú email-küldést tenne lehetővé minden aktív
// adminnak (ld. biztonsági audit). Ez a guard biztosítja, hogy a script
// tényleg csak CLI-ből (a crontab bejegyzésből) fusson le.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Ez a script kizárólag parancssorból futtatható.');
}

require __DIR__ . '/../db.php';
require __DIR__ . '/../interface/emailInterface.php';

$database = new Database();
$db = $database->connect();

$WARNING_WINDOW_DAYS = 30;

function collectExpiringItems(PDO $db, $adminId, $windowDays) {
    $today = new DateTime('today');
    $until = (clone $today)->modify("+{$windowDays} days");
    $items = [];

    $withinWindow = function ($dateStr) use ($today, $until) {
        if (empty($dateStr)) {
            return false;
        }
        try {
            $date = new DateTime($dateStr);
        } catch (Exception $e) {
            return false;
        }
        return $date >= $today && $date <= $until;
    };

    // Sofőr lejáratok
    $stmt = $db->prepare("SELECT name, szemelyi_lejarat, jogsi_lejarat, gki_lejarat, adr_lejarat FROM user WHERE admin = :id AND torolt <> 'I'");
    $stmt->bindParam(':id', $adminId);
    $stmt->execute();
    $labels = [
        'szemelyi_lejarat' => 'személyi igazolvány lejárat',
        'jogsi_lejarat' => 'jogosítvány lejárat',
        'gki_lejarat' => 'GKI-igazolvány lejárat',
        'adr_lejarat' => 'ADR-igazolvány lejárat',
    ];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        foreach ($labels as $col => $label) {
            if ($withinWindow($row[$col])) {
                $items[] = $row['name'] . ' — ' . $label . ' (' . $row[$col] . ')';
            }
        }
    }

    // Jármű lejáratok (kamion + potkocsi + furgon ugyanazokkal az oszlopokkal
    // — a furgon önhajtó jármű, mint a kamion, korábban hiányzott innen,
    // ld. biztonsági/logikai audit: egy furgon lejáró okmányai csendben
    // láthatatlanok maradtak ebben az emlékeztetőben is.)
    $jarmuLabels = [
        'muszaki_lejarat' => 'műszaki vizsga lejárat',
        'porolto_lejarat' => 'poroltó lejárat (1)',
        'porolto_lejarat_2' => 'poroltó lejárat (2)',
        'adr_lejarat' => 'ADR-igazolvány lejárat',
        'taograf_illesztes' => 'tachográf-illesztés',
        'emelohatfal_vizsga' => 'emelőhátfal-vizsga',
        'kot_biztositas' => 'kötélzet-biztosítás lejárat',
        'kaszko_biztositas' => 'kaszkóbiztosítás lejárat',
    ];
    foreach (['kamion', 'potkocsi', 'furgon'] as $tabla) {
        $cols = implode(', ', array_keys($jarmuLabels));
        $stmt = $db->prepare("SELECT rendszam, $cols FROM $tabla WHERE admin = :id AND torolt <> 'I'");
        $stmt->bindParam(':id', $adminId);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            foreach ($jarmuLabels as $col => $label) {
                if ($withinWindow($row[$col])) {
                    $items[] = $row['rendszam'] . ' — ' . $label . ' (' . $row[$col] . ')';
                }
            }
        }
    }

    // Egyedi határidők
    $stmt = $db->prepare("SELECT leiras, datum FROM egyedi_hataridok WHERE admin = :id AND torolt <> 'I'");
    $stmt->bindParam(':id', $adminId);
    $stmt->execute();
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if ($withinWindow($row['datum'])) {
            $items[] = $row['leiras'] . ' (' . $row['datum'] . ')';
        }
    }

    // Tervezett (jövőbeli) karbantartások
    foreach (['kamion_karbantartars' => 'kamion', 'potkocsi_karbantartars' => 'potkocsi', 'furgon_karbantartars' => 'furgon'] as $tabla => $jarmuTabla) {
        $stmt = $db->prepare("SELECT log, datum FROM $tabla WHERE admin = :id AND torolt <> 'I'");
        $stmt->bindParam(':id', $adminId);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($withinWindow($row['datum'])) {
                $items[] = 'Tervezett karbantartás — ' . $row['log'] . ' (' . $row['datum'] . ')';
            }
        }
    }

    return $items;
}

$emailInterface = new EmailInterface();

// De-duplikáció: `lejarat_emlekezteto_log` (admin_id+datum összetett kulcs,
// ld. sql/29.sql) biztosítja, hogy egy adott admin egy adott naptári napra
// csak egyszer kapjon emlékeztetőt, akkor is, ha a script duplán regisztrált
// cronból, manuális újrafuttatásból vagy DST-váltás miatti dupla lefutásból
// adódóan többször is lefut ugyanaznap (ld. biztonsági/megbízhatósági audit).
$ma = date('Y-m-d');
$logStmt = $db->prepare("SELECT 1 FROM lejarat_emlekezteto_log WHERE admin_id = :admin_id AND datum = :datum");
$logInsertStmt = $db->prepare("INSERT INTO lejarat_emlekezteto_log (admin_id, datum) VALUES (:admin_id, :datum)");

$adminStmt = $db->query("SELECT id, email, name FROM admin WHERE torolt <> 'I'");
foreach ($adminStmt->fetchAll(PDO::FETCH_ASSOC) as $admin) {
    $logStmt->execute([':admin_id' => $admin['id'], ':datum' => $ma]);
    if ($logStmt->fetch()) {
        echo date('c') . ' — ' . $admin['email'] . ': ma már küldtünk emlékeztetőt, kihagyva.' . PHP_EOL;
        continue;
    }

    $items = collectExpiringItems($db, $admin['id'], $WARNING_WINDOW_DAYS);
    if (empty($items)) {
        continue;
    }

    $result = $emailInterface->sendLejaratEmlekezteto($admin['email'], $admin['name'], $items, $WARNING_WINDOW_DAYS);
    echo date('c') . ' — ' . $admin['email'] . ': ' . count($items) . ' tétel, küldés ' . ($result['success'] ? 'sikeres' : 'sikertelen') . PHP_EOL;
    if ($result['success']) {
        $logInsertStmt->execute([':admin_id' => $admin['id'], ':datum' => $ma]);
    }
}
