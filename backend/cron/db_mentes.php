<?php
// Napi adatbázis-mentés (mysqldump + gzip), N napos rotációval.
//
// A mentési könyvtárat KÖTELEZŐ a `DB_BACKUP_DIR` env-változóval
// (backend/.env) megadni, és az nem eshet a repó/webroot alá — a `backend/`
// élesben a webrooton belül van, egy ott tárolt dump bárki számára
// letölthető lenne. A megőrzött napok száma: `DB_BACKUP_KEEP_DAYS` (alap 14).
//
// Crontab (a szerverhez igazítva):
//   30 2 * * *  /usr/bin/php8.2 /var/www/szikoratransz/backend/cron/db_mentes.php >> /var/log/szikoratransz_db_mentes.log 2>&1

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Ez a script kizárólag parancssorból futtatható.');
}

require __DIR__ . '/../db.php';

function hiba($uzenet) {
    fwrite(STDERR, date('c') . ' — HIBA: ' . $uzenet . PHP_EOL);
    exit(1);
}

$mentesiKonyvtar = envOrDefault('DB_BACKUP_DIR', '');
if ($mentesiKonyvtar === '') {
    hiba('A DB_BACKUP_DIR nincs beállítva (backend/.env).');
}
if (!is_dir($mentesiKonyvtar) && !mkdir($mentesiKonyvtar, 0700, true)) {
    hiba("A mentési könyvtár nem hozható létre: $mentesiKonyvtar");
}
$mentesiKonyvtar = realpath($mentesiKonyvtar);
$repoGyoker = realpath(__DIR__ . '/../..');
if (strpos($mentesiKonyvtar . '/', $repoGyoker . '/') === 0) {
    hiba("A mentési könyvtár nem lehet a projekt/webroot alatt: $mentesiKonyvtar");
}
if (!is_writable($mentesiKonyvtar)) {
    hiba("A mentési könyvtár nem írható: $mentesiKonyvtar");
}

$db = (new Database())->kapcsolatiAdatok();
$fajl = $mentesiKonyvtar . '/' . $db['db_name'] . '_' . date('Ymd_His') . '.sql.gz';
$hitelesito = tempnam(sys_get_temp_dir(), 'dbm');
chmod($hitelesito, 0600);
$idezo = fn($ertek) => '"' . addcslashes($ertek, "\\\"") . '"';
file_put_contents($hitelesito, "[client]\nuser=" . $idezo($db['username']) . "\npassword=" . $idezo($db['password']) . "\nhost=" . $idezo($db['host']) . "\n");
$parancs = sprintf(
    'mysqldump --defaults-file=%s --single-transaction --no-tablespaces --routines %s | gzip -9 > %s',
    escapeshellarg($hitelesito),
    escapeshellarg($db['db_name']),
    escapeshellarg($fajl)
);
exec('bash -c ' . escapeshellarg('set -o pipefail; ' . $parancs) . ' 2>&1', $kimenet, $kod);
unlink($hitelesito);

if ($kod !== 0 || !is_file($fajl) || filesize($fajl) < 100) {
    @unlink($fajl);
    hiba('mysqldump sikertelen (kód: ' . $kod . '): ' . implode(' ', $kimenet));
}
chmod($fajl, 0600);
echo date('c') . ' — mentés kész: ' . $fajl . ' (' . round(filesize($fajl) / 1024) . ' KB)' . PHP_EOL;

$megorzesNapok = max(1, (int) envOrDefault('DB_BACKUP_KEEP_DAYS', 14));
$hatar = time() - $megorzesNapok * 86400;
foreach (glob($mentesiKonyvtar . '/' . $db['db_name'] . '_*.sql.gz') as $regi) {
    if (filemtime($regi) < $hatar && unlink($regi)) {
        echo date('c') . ' — régi mentés törölve: ' . basename($regi) . PHP_EOL;
    }
}
